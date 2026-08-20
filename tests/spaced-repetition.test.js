import { describe, expect, it } from "vitest";
import SpacedRepetition from "../spaced-repetition.js";

const { dateKey, cardKey, computeNextRating, isDue, isWrong, getStudyStreak, REVIEW_INTERVAL_DAYS } = SpacedRepetition;

describe("dateKey", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("pads single-digit month and day", () => {
    expect(dateKey(new Date(2026, 8, 9))).toBe("2026-09-09");
  });
});

describe("cardKey", () => {
  it("joins deck id and card front with a separator", () => {
    expect(cardKey("labor-law", "Qual é o objeto do Direito do Trabalho?")).toBe(
      "labor-law::Qual é o objeto do Direito do Trabalho?"
    );
  });
});

describe("computeNextRating", () => {
  const now = new Date("2026-01-10T12:00:00Z");

  it("starts a new card at stage 0 with a 1-day interval when remembered", () => {
    const rating = computeNextRating(undefined, true, now);
    expect(rating.attempts).toBe(1);
    expect(rating.remembered).toBe(1);
    expect(rating.stage).toBe(1);
    expect(rating.lastResult).toBe("remembered");
    expect(rating.nextReview).toBe(new Date(now.getTime() + REVIEW_INTERVAL_DAYS[0] * 86400000).toISOString());
  });

  it("advances through the review intervals on consecutive remembered ratings", () => {
    let rating = computeNextRating(undefined, true, now);
    expect(rating.stage).toBe(1);

    rating = computeNextRating(rating, true, now);
    expect(rating.stage).toBe(2);
    expect(rating.nextReview).toBe(new Date(now.getTime() + REVIEW_INTERVAL_DAYS[1] * 86400000).toISOString());

    rating = computeNextRating(rating, true, now);
    expect(rating.stage).toBe(3);
    expect(rating.nextReview).toBe(new Date(now.getTime() + REVIEW_INTERVAL_DAYS[2] * 86400000).toISOString());
  });

  it("does not advance stage past the last review interval", () => {
    let rating = { attempts: 3, remembered: 3, stage: REVIEW_INTERVAL_DAYS.length };
    rating = computeNextRating(rating, true, now);
    expect(rating.stage).toBe(REVIEW_INTERVAL_DAYS.length);
    expect(rating.nextReview).toBe(
      new Date(now.getTime() + REVIEW_INTERVAL_DAYS[REVIEW_INTERVAL_DAYS.length - 1] * 86400000).toISOString()
    );
  });

  it("resets stage to 0 and schedules a 1-day review when forgotten", () => {
    const advanced = computeNextRating(computeNextRating(undefined, true, now), true, now);
    expect(advanced.stage).toBe(2);

    const forgotten = computeNextRating(advanced, false, now);
    expect(forgotten.stage).toBe(0);
    expect(forgotten.lastResult).toBe("forgot");
    expect(forgotten.nextReview).toBe(new Date(now.getTime() + 86400000).toISOString());
    expect(forgotten.remembered).toBe(advanced.remembered);
    expect(forgotten.attempts).toBe(advanced.attempts + 1);
  });
});

describe("isDue", () => {
  it("is false without a rating", () => {
    expect(isDue(undefined)).toBe(false);
  });

  it("is true when nextReview is in the past", () => {
    const rating = { nextReview: new Date(Date.now() - 1000).toISOString() };
    expect(isDue(rating)).toBe(true);
  });

  it("is false when nextReview is in the future", () => {
    const rating = { nextReview: new Date(Date.now() + 86400000).toISOString() };
    expect(isDue(rating)).toBe(false);
  });
});

describe("isWrong", () => {
  it("is true only when lastResult is forgot", () => {
    expect(isWrong({ lastResult: "forgot" })).toBe(true);
    expect(isWrong({ lastResult: "remembered" })).toBe(false);
    expect(isWrong(undefined)).toBe(false);
  });
});

describe("getStudyStreak", () => {
  it("is 0 with no activity", () => {
    expect(getStudyStreak([])).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const today = new Date(2026, 0, 10);
    const activity = [dateKey(new Date(2026, 0, 8)), dateKey(new Date(2026, 0, 9)), dateKey(new Date(2026, 0, 10))];
    expect(getStudyStreak(activity, today)).toBe(3);
  });

  it("still counts the streak if today has no activity yet but yesterday does", () => {
    const today = new Date(2026, 0, 10);
    const activity = [dateKey(new Date(2026, 0, 8)), dateKey(new Date(2026, 0, 9))];
    expect(getStudyStreak(activity, today)).toBe(2);
  });

  it("breaks the streak when a day is missing", () => {
    const today = new Date(2026, 0, 10);
    const activity = [dateKey(new Date(2026, 0, 5)), dateKey(new Date(2026, 0, 10))];
    expect(getStudyStreak(activity, today)).toBe(1);
  });

  it("is 0 when the last activity is more than a day before the reference date", () => {
    const today = new Date(2026, 0, 10);
    const activity = [dateKey(new Date(2026, 0, 5))];
    expect(getStudyStreak(activity, today)).toBe(0);
  });
});
