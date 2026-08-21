(function exposeCardDatabase(root) {
  const DB_NAME = "trilha-flashcard";
  const STORE_NAME = "key-value";

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function transaction(mode, operation) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      operation(store);
      tx.oncomplete = () => { database.close(); resolve(); };
      tx.onerror = () => { database.close(); reject(tx.error); };
      tx.onabort = () => { database.close(); reject(tx.error); };
    });
  }

  async function persistEntries(entries) {
    if (!entries?.length) return;
    await transaction("readwrite", (store) => entries.forEach(([key, value]) => store.put(value, key)));
  }

  async function hydrateLocalStorage(storage) {
    const database = await openDatabase();
    const entries = await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAllKeys();
      request.onsuccess = async () => {
        const keys = request.result;
        const values = await Promise.all(keys.map((key) => new Promise((res, rej) => {
          const item = tx.objectStore(STORE_NAME).get(key);
          item.onsuccess = () => res(item.result);
          item.onerror = () => rej(item.error);
        })));
        resolve(keys.map((key, index) => [key, values[index]]));
      };
      request.onerror = () => reject(request.error);
    });
    database.close();
    entries.forEach(([key, value]) => {
      if (storage.getItem(key) === null && typeof value === "string") storage.setItem(key, value);
    });
  }

  root.CardDatabase = { persistEntries, hydrateLocalStorage };
})(typeof globalThis !== "undefined" ? globalThis : this);
