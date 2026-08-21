(function (root) {
  const REVIEW_INTERVAL_DAYS = [1, 7, 30];
  const DAY_MS = 86400000;

  function dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function cardKey(deckId, cardFront) {
    return `${deckId}::${cardFront}`;
  }

  function computeNextRating(previousRating, didRemember, now = new Date()) {
    const previous = previousRating || { attempts: 0, remembered: 0, stage: 0 };
    const intervalIndex = Math.min(previous.stage || 0, REVIEW_INTERVAL_DAYS.length - 1);
    const intervalDays = didRemember ? REVIEW_INTERVAL_DAYS[intervalIndex] : 1;
    const nextReview = new Date(now.getTime() + intervalDays * DAY_MS);

    return {
      attempts: previous.attempts + 1,
      remembered: (previous.remembered || 0) + (didRemember ? 1 : 0),
      stage: didRemember ? Math.min((previous.stage || 0) + 1, REVIEW_INTERVAL_DAYS.length) : 0,
      lastResult: didRemember ? "remembered" : "forgot",
      lastReviewed: now.toISOString(),
      nextReview: nextReview.toISOString(),
    };
  }

  function isDue(rating, now = Date.now()) {
    return Boolean(rating?.nextReview && new Date(rating.nextReview).getTime() <= now);
  }

  function isWrong(rating) {
    return rating?.lastResult === "forgot";
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
    REVIEW_INTERVAL_DAYS,
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
  motionScript.src = "./motion-animations.js?v=20260820-1";
  document.head.append(motionScript);
}
