(function exposeCloudSync(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloudSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCloudSyncApi() {
  const SYNC_PREFIXES = ["trilha-flashcard-"];
  const EXCLUDED_KEYS = new Set(["trilha-flashcard-theme", "trilha-flashcard-cloud-meta"]);
  const CLOUD_SNAPSHOT_VERSION = 2;
  const DEFAULT_CHUNK_BYTES = 240000;

  function isSyncableKey(key) {
    return SYNC_PREFIXES.some((prefix) => key.startsWith(prefix)) && !EXCLUDED_KEYS.has(key);
  }

  function createSnapshot(storage) {
    const entries = {};
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && isSyncableKey(key)) keys.push(key);
    }
    keys.sort().forEach((key) => { entries[key] = storage.getItem(key); });
    return { version: 1, entries };
  }

  function applySnapshot(storage, snapshot) {
    if (!snapshot || snapshot.version !== 1 || !snapshot.entries || typeof snapshot.entries !== "object") {
      throw new Error("invalid-cloud-snapshot");
    }
    const remoteKeys = new Set(Object.keys(snapshot.entries).filter(isSyncableKey));
    const localKeys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && isSyncableKey(key)) localKeys.push(key);
    }
    localKeys.forEach((key) => {
      if (!remoteKeys.has(key)) storage.removeItem(key);
    });
    Object.entries(snapshot.entries).forEach(([key, value]) => {
      if (isSyncableKey(key) && typeof value === "string") storage.setItem(key, value);
    });
  }

  function snapshotFingerprint(snapshot) {
    const serialized = JSON.stringify(snapshot);
    let hash = 2166136261;
    for (let index = 0; index < serialized.length; index += 1) {
      hash ^= serialized.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function splitUtf8(value, maxBytes = DEFAULT_CHUNK_BYTES) {
    const text = String(value || "");
    if (!text) return [""];
    const encoder = new TextEncoder();
    const chunks = [];
    let current = "";
    let currentBytes = 0;
    for (const character of text) {
      const size = encoder.encode(character).length;
      if (current && currentBytes + size > maxBytes) {
        chunks.push(current);
        current = "";
        currentBytes = 0;
      }
      current += character;
      currentBytes += size;
    }
    if (current || !chunks.length) chunks.push(current);
    return chunks;
  }

  function serializeSnapshotChunks(snapshot, maxBytes = DEFAULT_CHUNK_BYTES) {
    return splitUtf8(JSON.stringify(snapshot), maxBytes);
  }

  function deserializeSnapshotChunks(chunks) {
    try {
      const snapshot = JSON.parse((chunks || []).join(""));
      if (!snapshot || snapshot.version !== 1 || typeof snapshot.entries !== "object") {
        throw new Error("invalid-cloud-snapshot");
      }
      return snapshot;
    } catch (error) {
      if (error?.message === "invalid-cloud-snapshot") throw error;
      throw new Error("invalid-cloud-snapshot", { cause: error });
    }
  }

  function reconciliationAction({ local, remote, meta, uid }) {
    if (!remote?.snapshot) return "upload";
    if (!hasStudyData(local)) return "download";
    const sameRemote = meta?.uid === uid && meta?.remoteUpdatedAtISO === remote.updatedAtISO;
    if (!sameRemote) return "conflict";
    return meta.dirty || meta.syncedFingerprint !== snapshotFingerprint(local) ? "upload" : "saved";
  }

  function hasStudyData(snapshot) {
    return Object.keys(snapshot?.entries || {}).some((key) => (
      key === "trilha-flashcard-state"
      || key === "trilha-flashcard-custom-decks"
      || key.startsWith("trilha-flashcard-deck:")
    ));
  }

  function firebaseErrorCode(error) {
    return String(error?.code || error?.message || "unknown")
      .replace(/^firestore\//, "")
      .replace(/^auth\//, "");
  }

  function isRetryableError(error) {
    return ["aborted", "cancelled", "deadline-exceeded", "internal", "network-request-failed", "unavailable", "unknown"]
      .includes(firebaseErrorCode(error));
  }

  async function createFirebaseAdapter(config) {
    if (!config?.apiKey || !config?.projectId || !config?.appId) throw new Error("firebase-not-configured");
    const version = "10.14.1";
    const [{ initializeApp }, authApi, firestoreApi] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`),
    ]);
    const app = initializeApp(config);
    const auth = authApi.getAuth(app);
    const db = firestoreApi.initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
    const provider = new authApi.GoogleAuthProvider();

    return {
      observeUser(callback) { return authApi.onAuthStateChanged(auth, callback); },
      signIn() {
        return authApi.signInWithPopup(auth, provider);
      },
      signOut() { return authApi.signOut(auth); },
      async refreshAuth() {
        if (!auth.currentUser) throw new Error("unauthenticated");
        await auth.currentUser.getIdToken(true);
      },
      async read(uid) {
        const reference = firestoreApi.doc(db, "flashcardUsers", uid);
        const result = firestoreApi.getDocFromServer
          ? await firestoreApi.getDocFromServer(reference)
          : await firestoreApi.getDoc(reference);
        if (!result.exists()) return null;
        const remote = result.data();
        if (remote.snapshot) return remote;
        if (remote.snapshotVersion !== CLOUD_SNAPSHOT_VERSION || !Number.isInteger(remote.chunkCount) || remote.chunkCount < 1) {
          throw new Error("invalid-cloud-snapshot");
        }
        const chunkReads = Array.from({ length: remote.chunkCount }, (_, index) => {
          const chunkReference = firestoreApi.doc(db, "flashcardUsers", uid, "chunks", String(index).padStart(5, "0"));
          return firestoreApi.getDocFromServer
            ? firestoreApi.getDocFromServer(chunkReference)
            : firestoreApi.getDoc(chunkReference);
        });
        const chunks = await Promise.all(chunkReads);
        if (chunks.some((chunk) => !chunk.exists())) throw new Error("invalid-cloud-snapshot");
        return {
          ...remote,
          snapshot: deserializeSnapshotChunks(chunks.map((chunk) => chunk.data().data)),
        };
      },
      async write(uid, snapshot, { expectedUpdatedAtISO = null, force = false } = {}) {
        const reference = firestoreApi.doc(db, "flashcardUsers", uid);
        const updatedAtISO = new Date().toISOString();
        const chunks = serializeSnapshotChunks(snapshot);
        const payload = {
          ownerUid: uid,
          snapshotVersion: CLOUD_SNAPSHOT_VERSION,
          chunkCount: chunks.length,
          updatedAt: firestoreApi.serverTimestamp(),
          updatedAtISO,
        };

        await firestoreApi.runTransaction(db, async (transaction) => {
          const current = await transaction.get(reference);
          const currentData = current.exists() ? current.data() : null;
          const currentToken = currentData?.updatedAtISO || null;
          if (!force && currentToken !== expectedUpdatedAtISO) throw new Error("cloud-conflict");
          transaction.set(reference, payload);
          chunks.forEach((data, index) => {
            const chunkReference = firestoreApi.doc(db, "flashcardUsers", uid, "chunks", String(index).padStart(5, "0"));
            transaction.set(chunkReference, { ownerUid: uid, index, data, updatedAtISO });
          });
          const previousChunkCount = Number.isInteger(currentData?.chunkCount) ? currentData.chunkCount : 0;
          for (let index = chunks.length; index < previousChunkCount; index += 1) {
            const staleReference = firestoreApi.doc(db, "flashcardUsers", uid, "chunks", String(index).padStart(5, "0"));
            transaction.delete(staleReference);
          }
        }, { maxAttempts: 3 });
        return updatedAtISO;
      },
    };
  }

  return {
    applySnapshot,
    createFirebaseAdapter,
    createSnapshot,
    deserializeSnapshotChunks,
    hasStudyData,
    isSyncableKey,
    firebaseErrorCode,
    isRetryableError,
    reconciliationAction,
    serializeSnapshotChunks,
    snapshotFingerprint,
  };
});
