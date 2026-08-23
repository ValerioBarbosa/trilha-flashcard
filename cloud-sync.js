(function exposeCloudSync(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloudSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCloudSyncApi() {
  const CARD_FIELDS = [
    "front", "back", "topic", "subtopic", "legalBasis", "tag",
    "example", "complement", "pitfall", "mnemonic", "type", "priority", "difficulty",
  ];

  function compareTimestamps(a, b) {
    const timeA = a ? new Date(a).getTime() : -Infinity;
    const timeB = b ? new Date(b).getTime() : -Infinity;
    return timeA - timeB;
  }

  // ---- local state (decks/state.ratings/graves) -> flat records shaped like Firestore documents ----

  function flattenDecks(decks) {
    return decks.map((deck) => ({
      id: deck.id,
      title: deck.title,
      topics: deck.topics || [],
      custom: Boolean(deck.custom),
      sourceNote: deck.sourceNote || null,
      updatedAt: deck.updatedAt || null,
    }));
  }

  function flattenCards(decks) {
    const cards = [];
    decks.forEach((deck) => {
      deck.cards.forEach((card) => {
        if (!card.id) return;
        const record = { id: card.id, deckId: deck.id, updatedAt: card.updatedAt || null };
        CARD_FIELDS.forEach((field) => {
          if (card[field] !== undefined) record[field] = card[field];
        });
        cards.push(record);
      });
    });
    return cards;
  }

  function ratingUpdatedAt(rating) {
    return rating?.lastReviewed || null;
  }

  function flattenRatings(ratings) {
    return Object.entries(ratings || {}).map(([key, rating]) => {
      const separatorIndex = key.indexOf("::");
      const deckId = key.slice(0, separatorIndex);
      const cardId = key.slice(separatorIndex + 2);
      return { id: cardId, deckId, ...rating };
    });
  }

  function flattenLocalState({ decks, ratings, graves }) {
    return {
      decks: flattenDecks(decks),
      cards: flattenCards(decks),
      ratings: flattenRatings(ratings),
      graves: (graves || []).map((grave) => ({ ...grave })),
    };
  }

  // ---- flat records -> local state shape (decks with nested cards, state.ratings map) ----

  function hydrateDecks(records) {
    const deckMap = new Map(records.decks.map((deck) => [deck.id, {
      id: deck.id,
      title: deck.title,
      topics: deck.topics || [],
      ...(deck.custom ? { custom: true } : {}),
      ...(deck.sourceNote ? { sourceNote: deck.sourceNote } : {}),
      updatedAt: deck.updatedAt,
      cards: [],
    }]));
    records.cards.forEach((card) => {
      const deck = deckMap.get(card.deckId);
      if (!deck) return;
      const { deckId, ...cardFields } = card;
      deck.cards.push(cardFields);
    });
    return [...deckMap.values()];
  }

  function hydrateRatings(records) {
    const ratings = {};
    records.ratings.forEach((entry) => {
      const { id, deckId, ...rating } = entry;
      ratings[`${deckId}::${id}`] = rating;
    });
    return ratings;
  }

  // ---- per-id, last-write-wins merge (this is what replaces the old whole-blob conflict dialog) ----

  function mergeById(localRecords, remoteRecords, getUpdatedAt) {
    const byId = new Map();
    localRecords.forEach((record) => byId.set(record.id, record));
    remoteRecords.forEach((remoteRecord) => {
      const localRecord = byId.get(remoteRecord.id);
      if (!localRecord || compareTimestamps(getUpdatedAt(remoteRecord), getUpdatedAt(localRecord)) > 0) {
        byId.set(remoteRecord.id, remoteRecord);
      }
    });
    return byId;
  }

  function applyGraves(byId, graves, type, getUpdatedAt) {
    graves
      .filter((grave) => grave.type === type)
      .forEach((grave) => {
        const record = byId.get(grave.id);
        if (record && compareTimestamps(grave.deletedAt, getUpdatedAt(record)) >= 0) {
          byId.delete(grave.id);
        }
      });
  }

  function mergeGraves(localGraves, remoteGraves) {
    const byId = new Map();
    [...localGraves, ...remoteGraves].forEach((grave) => {
      const existing = byId.get(grave.id);
      if (!existing || compareTimestamps(grave.deletedAt, existing.deletedAt) > 0) {
        byId.set(grave.id, grave);
      }
    });
    return [...byId.values()];
  }

  function mergeState(local, remote) {
    const graves = mergeGraves(local.graves, remote.graves);

    const deckById = mergeById(local.decks, remote.decks, (deck) => deck.updatedAt);
    applyGraves(deckById, graves, "deck", (deck) => deck.updatedAt);

    const cardById = mergeById(local.cards, remote.cards, (card) => card.updatedAt);
    applyGraves(cardById, graves, "card", (card) => card.updatedAt);
    // a card whose deck was deleted has no home; drop it rather than resurrect an orphan
    [...cardById.values()].forEach((card) => {
      if (!deckById.has(card.deckId)) cardById.delete(card.id);
    });

    const ratingById = mergeById(local.ratings, remote.ratings, ratingUpdatedAt);
    applyGraves(ratingById, graves, "card", ratingUpdatedAt);

    return {
      decks: [...deckById.values()],
      cards: [...cardById.values()],
      ratings: [...ratingById.values()],
      graves,
    };
  }

  // which merged records are not already identical on the remote side, i.e. need to be pushed
  function planRemoteWrites(merged, remote) {
    const diff = (mergedList, remoteList) => {
      const remoteById = new Map(remoteList.map((record) => [record.id, record]));
      return mergedList.filter((record) => JSON.stringify(record) !== JSON.stringify(remoteById.get(record.id)));
    };
    return {
      decks: diff(merged.decks, remote.decks),
      cards: diff(merged.cards, remote.cards),
      ratings: diff(merged.ratings, remote.ratings),
      graves: diff(merged.graves, remote.graves),
    };
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

    function collectionsFor(uid) {
      const userDoc = firestoreApi.doc(db, "flashcardUsers", uid);
      return {
        decks: firestoreApi.collection(userDoc, "decks"),
        ratings: firestoreApi.collection(userDoc, "ratings"),
        graves: firestoreApi.collection(userDoc, "graves"),
      };
    }

    async function readAll(uid) {
      const collections = collectionsFor(uid);
      const [deckDocs, ratingDocs, graveDocs] = await Promise.all([
        firestoreApi.getDocs(collections.decks),
        firestoreApi.getDocs(collections.ratings),
        firestoreApi.getDocs(collections.graves),
      ]);
      const decks = deckDocs.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }));
      const cardLists = await Promise.all(decks.map(async (deck) => {
        const cardDocs = await firestoreApi.getDocs(
          firestoreApi.collection(collections.decks, deck.id, "cards")
        );
        return cardDocs.docs.map((docSnapshot) => ({ id: docSnapshot.id, deckId: deck.id, ...docSnapshot.data() }));
      }));
      return {
        decks,
        cards: cardLists.flat(),
        ratings: ratingDocs.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() })),
        graves: graveDocs.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() })),
      };
    }

    async function writeChanges(uid, changes) {
      const collections = collectionsFor(uid);
      let batch = firestoreApi.writeBatch(db);
      const batches = [batch];
      let opCount = 0;
      const queue = (ref, data) => {
        batch.set(ref, data, { merge: true });
        opCount += 1;
        if (opCount >= 450) {
          batch = firestoreApi.writeBatch(db);
          batches.push(batch);
          opCount = 0;
        }
      };

      changes.decks.forEach((deck) => {
        const { id, ...fields } = deck;
        queue(firestoreApi.doc(collections.decks, id), fields);
      });
      changes.cards.forEach((card) => {
        const { id, deckId, ...fields } = card;
        queue(firestoreApi.doc(collections.decks, deckId, "cards", id), fields);
      });
      changes.ratings.forEach((rating) => {
        const { id, ...fields } = rating;
        queue(firestoreApi.doc(collections.ratings, id), fields);
      });
      changes.graves.forEach((grave) => {
        const { id, ...fields } = grave;
        queue(firestoreApi.doc(collections.graves, id), fields);
      });

      for (const pendingBatch of batches) await pendingBatch.commit();
    }

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
      readAll,
      writeChanges,
    };
  }

  return {
    flattenLocalState,
    hydrateDecks,
    hydrateRatings,
    mergeState,
    planRemoteWrites,
    createFirebaseAdapter,
  };
});
