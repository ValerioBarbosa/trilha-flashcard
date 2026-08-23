import { describe, expect, it } from "vitest";
import SpacedRepetition from "../spaced-repetition.js";

const { dateKey, cardKey, computeNextRating, isDue, isWrong, getStudyStreak } = SpacedRepetition;

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

  function daysAhead(days) {
    return new Date(now.getTime() + days * 86400000).toISOString();
  }

  it("starts a new card at stage 1 with a 1-day interval on 'good'", () => {
    const rating = computeNextRating(undefined, "good", now);
    expect(rating.attempts).toBe(1);
    expect(rating.remembered).toBe(1);
    expect(rating.stage).toBe(1);
    expect(rating.lastResult).toBe("good");
    expect(rating.nextReview).toBe(daysAhead(1));
  });

  it("advances through longer intervals on consecutive 'good' ratings", () => {
    let rating = computeNextRating(undefined, "good", now);
    expect(rating.interval).toBe(1);

    rating = computeNextRating(rating, "good", now);
    expect(rating.interval).toBe(6);

    rating = computeNextRating(rating, "good", now);
    expect(rating.interval).toBeGreaterThan(6);
  });

  it("schedules a longer interval on 'easy' than on 'good'", () => {
    const good = computeNextRating(undefined, "good", now);
    const easy = computeNextRating(undefined, "easy", now);
    expect(easy.interval).toBeGreaterThan(good.interval);
    expect(easy.remembered).toBe(1);
  });

  it("schedules a shorter interval on 'hard' than on 'good' once past the first step", () => {
    let good = computeNextRating(undefined, "good", now);
    good = computeNextRating(good, "good", now);

    let hard = computeNextRating(undefined, "good", now);
    hard = computeNextRating(hard, "hard", now);

    expect(hard.interval).toBeLessThan(good.interval);
    expect(hard.remembered).toBe(2);
  });

  it("resets stage to 0 and schedules a 1-day review when rated 'again'", () => {
    let advanced = computeNextRating(undefined, "good", now);
    advanced = computeNextRating(advanced, "good", now);
    expect(advanced.stage).toBe(2);

    const forgotten = computeNextRating(advanced, "again", now);
    expect(forgotten.stage).toBe(0);
    expect(forgotten.lastResult).toBe("again");
    expect(forgotten.nextReview).toBe(daysAhead(1));
    expect(forgotten.remembered).toBe(advanced.remembered);
    expect(forgotten.attempts).toBe(advanced.attempts + 1);
  });

  it("lowers the ease factor on 'again' and 'hard', raises it on 'easy'", () => {
    const again = computeNextRating(undefined, "again", now);
    const hard = computeNextRating(undefined, "hard", now);
    const easy = computeNextRating(undefined, "easy", now);
    expect(again.ease).toBeLessThan(2.5);
    expect(hard.ease).toBeLessThan(2.5);
    expect(easy.ease).toBeGreaterThan(2.5);
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
  it("is true when lastResult is 'again' (or the legacy 'forgot')", () => {
    expect(isWrong({ lastResult: "again" })).toBe(true);
    expect(isWrong({ lastResult: "forgot" })).toBe(true);
    expect(isWrong({ lastResult: "good" })).toBe(false);
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
