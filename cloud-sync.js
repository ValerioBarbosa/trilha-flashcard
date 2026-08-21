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
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && isSyncableKey(key)) entries[key] = storage.getItem(key);
    }
    return { version: 1, entries };
  }

  function applySnapshot(storage, snapshot) {
    if (!snapshot || snapshot.version !== 1 || !snapshot.entries || typeof snapshot.entries !== "object") {
      throw new Error("invalid-cloud-snapshot");
    }
    Object.entries(snapshot.entries).forEach(([key, value]) => {
      if (isSyncableKey(key) && typeof value === "string") storage.setItem(key, value);
    });
  }

  function hasStudyData(snapshot) {
    return Object.keys(snapshot?.entries || {}).some((key) => (
      key === "trilha-flashcard-state"
      || key === "trilha-flashcard-custom-decks"
      || key.startsWith("trilha-flashcard-deck:")
    ));
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
    const db = firestoreApi.getFirestore(app);
    const provider = new authApi.GoogleAuthProvider();

    return {
      observeUser(callback) { return authApi.onAuthStateChanged(auth, callback); },
      signIn() {
        const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent)
          || window.matchMedia?.("(max-width: 720px)").matches;
        return mobile
          ? authApi.signInWithRedirect(auth, provider)
          : authApi.signInWithPopup(auth, provider);
      },
      signOut() { return authApi.signOut(auth); },
      async read(uid) {
        const result = await firestoreApi.getDoc(firestoreApi.doc(db, "flashcardUsers", uid));
        return result.exists() ? result.data() : null;
      },
      async write(uid, snapshot) {
        const updatedAtISO = new Date().toISOString();
        await firestoreApi.setDoc(firestoreApi.doc(db, "flashcardUsers", uid), {
          ownerUid: uid,
          snapshot,
          updatedAt: firestoreApi.serverTimestamp(),
          updatedAtISO,
        });
        return updatedAtISO;
      },
    };
  }

  return { applySnapshot, createFirebaseAdapter, createSnapshot, hasStudyData, isSyncableKey };
});
