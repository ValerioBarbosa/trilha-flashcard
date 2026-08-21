import { animate, stagger } from "https://cdn.jsdelivr.net/npm/motion@13.1.0/+esm";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion) {
  const safeAnimate = (target, keyframes, options = {}) => {
    if (!target) return;
    try {
      animate(target, keyframes, options);
    } catch {
      // Progressive enhancement: the app must keep working even without animation.
    }
  };

  const animateCardIn = (direction = 1) => safeAnimate(
    document.querySelector("#flashcard"),
    { opacity: [0.6, 1], x: [20 * direction, 0], scale: [0.98, 1] },
    { duration: 0.3, easing: [0.22, 1, 0.36, 1] },
  );

  const animateFlip = () => safeAnimate(
    document.querySelector("#flashcard"),
    { scale: [1, 0.985, 1] },
    { duration: 0.22, easing: "ease-in-out" },
  );

  const animateFeedback = (remembered) => {
    safeAnimate(
      document.querySelector("#flashcard"),
      remembered
        ? { y: [0, -5, 0], scale: [1, 1.012, 1] }
        : { x: [0, -5, 5, -3, 3, 0] },
      { duration: remembered ? 0.32 : 0.36, easing: "ease-out" },
    );

    if (remembered) {
      safeAnimate(
        document.querySelector("#remembered-button"),
        { scale: [1, 1.08, 1] },
        { duration: 0.25, easing: "ease-out" },
      );
    } else {
      safeAnimate(
        document.querySelector("#forgot-button"),
        { x: [0, -4, 4, -2, 2, 0] },
        { duration: 0.28, easing: "ease-out" },
      );
    }
  };

  const animateDialog = (dialog) => {
    if (!dialog?.open) return;
    safeAnimate(dialog, { opacity: [0, 1] }, { duration: 0.16, easing: "ease-out" });
    safeAnimate(
      dialog.querySelector(".dashboard-content"),
      { opacity: [0, 1], y: [20, 0], scale: [0.985, 1] },
      { duration: 0.25, easing: [0.22, 1, 0.36, 1] },
    );
  };

  document.querySelector("#previous-button")?.addEventListener("click", () => queueMicrotask(() => animateCardIn(-1)));
  document.querySelector("#next-button")?.addEventListener("click", () => queueMicrotask(() => animateCardIn(1)));
  document.querySelector("#flashcard")?.addEventListener("click", () => queueMicrotask(animateFlip));
  document.querySelector("#reveal-button")?.addEventListener("click", () => queueMicrotask(animateFlip));
  document.querySelector("#remembered-button")?.addEventListener("click", () => animateFeedback(true));
  document.querySelector("#forgot-button")?.addEventListener("click", () => animateFeedback(false));

  document.querySelectorAll("dialog.dashboard-dialog").forEach((dialog) => {
    new MutationObserver(() => animateDialog(dialog)).observe(dialog, {
      attributes: true,
      attributeFilter: ["open"],
    });
  });

  const searchResults = document.querySelector("#search-results");
  if (searchResults) {
    new MutationObserver(() => {
      if (searchResults.hidden) return;
      const items = searchResults.querySelectorAll("[role='option'], button, :scope > *");
      if (items.length) {
        safeAnimate(
          items,
          { opacity: [0, 1], y: [6, 0] },
          { duration: 0.18, delay: stagger(0.025), easing: "ease-out" },
        );
      }
    }).observe(searchResults, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }

  const performance = document.querySelector("#deck-performance");
  if (performance) {
    new MutationObserver(() => {
      const rows = performance.querySelectorAll(".deck-performance-row");
      if (rows.length) {
        safeAnimate(
          rows,
          { opacity: [0, 1], y: [8, 0] },
          { duration: 0.22, delay: stagger(0.025), easing: "ease-out" },
        );
      }
    }).observe(performance, { childList: true, subtree: true });
  }

  const toast = document.querySelector("#toast");
  if (toast) {
    new MutationObserver(() => {
      if (toast.classList.contains("show")) {
        safeAnimate(
          toast,
          { opacity: [0, 1], y: [10, 0], scale: [0.98, 1] },
          { duration: 0.2, easing: "ease-out" },
        );
      }
    }).observe(toast, { attributes: true, attributeFilter: ["class"] });
  }

  safeAnimate(
    document.querySelectorAll(".topbar, .filter-row, .progress-heading, .card-stage, .actions"),
    { opacity: [0, 1], y: [8, 0] },
    { duration: 0.28, delay: stagger(0.04), easing: [0.22, 1, 0.36, 1] },
  );
}
