(function (root) {
  const DAY_MS = 86400000;
  const REVIEW_RATINGS = ["again", "hard", "good", "easy"];
  const MIN_EASE = 1.3;
  const DEFAULT_EASE = 2.5;

  function dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function cardKey(deckId, cardFront) {
    return `${deckId}::${cardFront}`;
  }

  function computeNextRating(previousRating, rating, now = new Date()) {
    const previous = previousRating || { attempts: 0, remembered: 0, stage: 0, ease: DEFAULT_EASE, interval: 0 };
    const ease = previous.ease || DEFAULT_EASE;
    const stage = previous.stage || 0;
    const previousInterval = previous.interval || 0;
    const didRemember = rating !== "again";

    let nextEase = ease;
    let nextInterval;
    let nextStage;

    if (rating === "again") {
      nextEase = Math.max(MIN_EASE, ease - 0.2);
      nextInterval = 1;
      nextStage = 0;
    } else if (rating === "hard") {
      nextEase = Math.max(MIN_EASE, ease - 0.15);
      nextInterval = stage === 0 ? 1 : Math.max(1, Math.round(previousInterval * 1.2));
      nextStage = stage + 1;
    } else if (rating === "easy") {
      nextEase = ease + 0.15;
      nextInterval = stage === 0 ? 4 : Math.max(1, Math.round(previousInterval * nextEase * 1.3));
      nextStage = stage + 1;
    } else {
      nextInterval = stage === 0 ? 1 : stage === 1 ? 6 : Math.max(1, Math.round(previousInterval * ease));
      nextStage = stage + 1;
    }

    const nextReview = new Date(now.getTime() + nextInterval * DAY_MS);

    return {
      attempts: previous.attempts + 1,
      remembered: (previous.remembered || 0) + (didRemember ? 1 : 0),
      stage: nextStage,
      ease: Math.round(nextEase * 100) / 100,
      interval: nextInterval,
      lastResult: rating,
      lastReviewed: now.toISOString(),
      nextReview: nextReview.toISOString(),
    };
  }

  function isDue(rating, now = Date.now()) {
    return Boolean(rating?.nextReview && new Date(rating.nextReview).getTime() <= now);
  }

  function isWrong(rating) {
    return rating?.lastResult === "again" || rating?.lastResult === "forgot";
  }

  function getStudyStreak(activityDates, referenceDate = new Date()) {
    const studiedDates = new Set(activityDates || []);
    const cursor = new Date(referenceDate);
    cursor.setHours(12, 0, 0, 0);

    if (!studiedDates.has(dateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
      if (!studiedDates.has(dateKey(cursor))) return 0;
    }

    let streak = 0;
    while (studiedDates.has(dateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  const api = {
    REVIEW_RATINGS,
    dateKey,
    cardKey,
    computeNextRating,
    isDue,
    isWrong,
    getStudyStreak,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SpacedRepetition = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

if (typeof document !== "undefined") {
  const motionScript = document.createElement("script");
  motionScript.type = "module";
  motionScript.src = "./motion-animations.js?v=20260824-1";
  document.head.append(motionScript);
}
