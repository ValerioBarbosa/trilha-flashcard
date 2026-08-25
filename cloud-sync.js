(function exposeCloudSync(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloudSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCloudSyncApi() {
  const SYNC_PREFIXES = ["trilha-flashcard-"];
  const EXCLUDED_KEYS = new Set(["trilha-flashcard-theme", "trilha-flashcard-cloud-meta"]);

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
        return result.exists() ? result.data() : null;
      },
      async write(uid, snapshot, { expectedUpdatedAtISO = null, force = false } = {}) {
        const reference = firestoreApi.doc(db, "flashcardUsers", uid);
        const updatedAtISO = new Date().toISOString();
        const payload = {
          ownerUid: uid,
          snapshot,
          updatedAt: firestoreApi.serverTimestamp(),
          updatedAtISO,
        };

        await firestoreApi.runTransaction(db, async (transaction) => {
          const current = await transaction.get(reference);
          const currentToken = current.exists() ? current.data().updatedAtISO || null : null;
          if (!force && currentToken !== expectedUpdatedAtISO) throw new Error("cloud-conflict");
          transaction.set(reference, payload);
        }, { maxAttempts: 3 });
        return updatedAtISO;
      },
    };
  }

  return {
    applySnapshot,
    createFirebaseAdapter,
    createSnapshot,
    hasStudyData,
    isSyncableKey,
    firebaseErrorCode,
    isRetryableError,
    reconciliationAction,
    snapshotFingerprint,
  };
});
