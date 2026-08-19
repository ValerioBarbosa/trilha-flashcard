const decks = trt4Decks;
const STORAGE_KEY = "trilha-flashcard-state";
const REVIEW_INTERVAL_DAYS = [1, 7, 30];

const elements = {
  deckSelect: document.querySelector("#deck-select"),
  progressLabel: document.querySelector("#progress-label"),
  sessionScore: document.querySelector("#session-score"),
  progressTrack: document.querySelector("#progress-track"),
  sessionDots: document.querySelector("#session-dots"),
  sessionCount: document.querySelector("#session-count"),
  flashcard: document.querySelector("#flashcard"),
  front: document.querySelector("#card-front"),
  back: document.querySelector("#card-back"),
  example: document.querySelector("#card-example"),
  tagFront: document.querySelector("#card-tag-front"),
  tagBack: document.querySelector("#card-tag-back"),
  topic: document.querySelector("#card-topic"),
  complement: document.querySelector("#card-complement"),
  complementText: document.querySelector("#card-complement-text"),
  pitfall: document.querySelector("#card-pitfall"),
  pitfallText: document.querySelector("#card-pitfall-text"),
  mnemonic: document.querySelector("#card-mnemonic"),
  mnemonicText: document.querySelector("#card-mnemonic-text"),
  deckSourceNote: document.querySelector("#deck-source-note"),
  previous: document.querySelector("#previous-button"),
  next: document.querySelector("#next-button"),
  shuffle: document.querySelector("#shuffle-button"),
  reveal: document.querySelector("#reveal-button"),
  forgot: document.querySelector("#forgot-button"),
  remembered: document.querySelector("#remembered-button"),
  dashboardButton: document.querySelector("#dashboard-button"),
  dashboardDialog: document.querySelector("#dashboard-dialog"),
  dashboardClose: document.querySelector("#dashboard-close"),
  dashboardSummary: document.querySelector("#dashboard-summary"),
  metricReviewed: document.querySelector("#metric-reviewed"),
  metricTotal: document.querySelector("#metric-total"),
  metricAccuracy: document.querySelector("#metric-accuracy"),
  metricDue: document.querySelector("#metric-due"),
  metricNextReview: document.querySelector("#metric-next-review"),
  metricStreak: document.querySelector("#metric-streak"),
  reviewDue: document.querySelector("#review-due-button"),
  deckPerformance: document.querySelector("#deck-performance"),
  toast: document.querySelector("#toast"),
};

function loadSavedState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

const savedState = loadSavedState();
const state = {
  deckId: savedState.deckId && decks.some((deck) => deck.id === savedState.deckId)
    ? savedState.deckId
    : decks[0].id,
  index: Number.isInteger(savedState.index) ? savedState.index : 0,
  flipped: false,
  ratings: savedState.ratings && typeof savedState.ratings === "object" && !Array.isArray(savedState.ratings)
    ? savedState.ratings
    : {},
  activity: Array.isArray(savedState.activity)
    ? [...new Set(savedState.activity.filter((date) => typeof date === "string"))]
    : [],
  reviewMode: false,
};

let toastTimer;

function currentDeck() {
  return decks.find((deck) => deck.id === state.deckId);
}

function currentCard() {
  return currentDeck().cards[state.index];
}

function cardKey(deck, card) {
  return `${deck.id}::${card.front}`;
}

function currentCardKey() {
  return cardKey(currentDeck(), currentCard());
}

function allCardEntries() {
  return decks.flatMap((deck) => deck.cards.map((card, index) => ({
    deck,
    card,
    index,
    key: cardKey(deck, card),
  })));
}

function getDeckStats(deck) {
  return deck.cards.reduce((stats, card) => {
    const rating = state.ratings[cardKey(deck, card)];
    if (!rating?.attempts) return stats;
    stats.reviewed += 1;
    stats.attempts += rating.attempts;
    stats.remembered += rating.remembered || 0;
    return stats;
  }, { reviewed: 0, attempts: 0, remembered: 0 });
}

function getDueEntries(now = Date.now()) {
  return allCardEntries()
    .filter(({ key }) => {
      const rating = state.ratings[key];
      return rating?.nextReview && new Date(rating.nextReview).getTime() <= now;
    })
    .sort((first, second) => (
      new Date(state.ratings[first.key].nextReview).getTime()
      - new Date(state.ratings[second.key].nextReview).getTime()
    ));
}

function getNextReview() {
  return Object.values(state.ratings)
    .filter((rating) => rating?.nextReview)
    .map((rating) => new Date(rating.nextReview).getTime())
    .filter(Number.isFinite)
    .sort((first, second) => first - second)[0] || null;
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function registerActivity() {
  const today = dateKey();
  if (!state.activity.includes(today)) state.activity.push(today);
  state.activity = state.activity.slice(-366);
}

function getStudyStreak() {
  const studiedDates = new Set(state.activity);
  const cursor = new Date();
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

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 2,
    deckId: state.deckId,
    index: state.index,
    ratings: state.ratings,
    activity: state.activity,
  }));
}

function renderDeckOptions() {
  elements.deckSelect.innerHTML = decks
    .map((deck) => `<option value="${deck.id}">${deck.title}</option>`)
    .join("");
  elements.deckSelect.value = state.deckId;
}

function renderProgress() {
  const deck = currentDeck();
  const total = deck.cards.length;
  const stats = getDeckStats(deck);
  elements.progressLabel.textContent = `${state.index + 1} de ${total}`;
  elements.sessionScore.textContent = stats.attempts === 0
    ? "0 estudados"
    : `${stats.remembered} de ${stats.attempts} lembrados`;
  elements.progressTrack.style.setProperty("--segments", total);
  elements.progressTrack.setAttribute("aria-valuemax", String(total));
  elements.progressTrack.setAttribute("aria-valuenow", String(stats.reviewed));
  elements.progressTrack.setAttribute("aria-valuetext", `${stats.reviewed} de ${total} cartões revisados`);
  elements.progressTrack.innerHTML = deck.cards
    .map((card, index) => {
      const wasReviewed = Boolean(state.ratings[cardKey(deck, card)]?.attempts);
      const status = index === state.index ? "current" : wasReviewed ? "complete" : "";
      return `<span class="progress-segment ${status}" aria-hidden="true"></span>`;
    })
    .join("");
  elements.sessionCount.textContent = `${stats.reviewed} de ${total}`;
  elements.sessionDots.innerHTML = deck.cards
    .map((card, index) => {
      const wasReviewed = Boolean(state.ratings[cardKey(deck, card)]?.attempts);
      const status = index === state.index ? "current" : wasReviewed ? "complete" : "";
      return `<span class="session-dot ${status}"></span>`;
    })
    .join("");
}

function fillCallout(wrapper, textEl, value) {
  const hasValue = Boolean(value);
  textEl.textContent = value || "";
  wrapper.classList.toggle("is-empty", !hasValue);
}

function renderCard() {
  const card = currentCard();
  elements.front.textContent = card.front;
  elements.back.textContent = card.back;
  elements.example.textContent = card.example || "";
  elements.tagFront.textContent = card.tag || "";
  elements.tagBack.textContent = card.tag || "";
  elements.topic.textContent = card.topic || "";
  fillCallout(elements.complement, elements.complementText, card.complement);
  fillCallout(elements.pitfall, elements.pitfallText, card.pitfall);
  fillCallout(elements.mnemonic, elements.mnemonicText, card.mnemonic);
  elements.front.classList.toggle("is-medium", card.front.length > 34 && card.front.length <= 76);
  elements.front.classList.toggle("is-long", card.front.length > 76);
  elements.back.classList.toggle("is-long", card.back.length > 105 || Boolean(card.complement || card.pitfall || card.mnemonic));
  elements.flashcard.classList.toggle("is-flipped", state.flipped);
  elements.flashcard.setAttribute("aria-label", state.flipped ? "Mostrar enunciado" : "Revelar gabarito");
  elements.reveal.querySelector("span").textContent = state.flipped ? "Ver enunciado" : "Ver gabarito";
}

function formatNextReview(timestamp) {
  if (!timestamp) return "comece avaliando um cartão";
  const today = new Date();
  const target = new Date(timestamp);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target - today) / 86400000);
  if (days <= 0) return "há revisões disponíveis";
  if (days === 1) return "próxima revisão amanhã";
  if (days < 7) return `próxima revisão em ${days} dias`;
  return `próxima em ${target.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
}

function renderDashboard() {
  const totalCards = decks.reduce((sum, deck) => sum + deck.cards.length, 0);
  const ratings = Object.values(state.ratings).filter((rating) => rating?.attempts);
  const reviewed = ratings.length;
  const attempts = ratings.reduce((sum, rating) => sum + rating.attempts, 0);
  const remembered = ratings.reduce((sum, rating) => sum + (rating.remembered || 0), 0);
  const accuracy = attempts ? Math.round((remembered / attempts) * 100) : 0;
  const dueEntries = getDueEntries();
  const streak = getStudyStreak();

  elements.metricReviewed.textContent = String(reviewed);
  elements.metricTotal.textContent = `de ${totalCards} cartões`;
  elements.metricAccuracy.textContent = `${accuracy}%`;
  elements.metricDue.textContent = String(dueEntries.length);
  elements.metricNextReview.textContent = formatNextReview(getNextReview());
  elements.metricStreak.textContent = `${streak} ${streak === 1 ? "dia" : "dias"}`;
  elements.dashboardSummary.textContent = reviewed
    ? `${reviewed} ${reviewed === 1 ? "cartão revisado" : "cartões revisados"} em ${state.activity.length} ${state.activity.length === 1 ? "dia de estudo" : "dias de estudo"}.`
    : "Seu histórico fica salvo neste navegador e alimenta as próximas revisões.";

  elements.reviewDue.disabled = dueEntries.length === 0;
  elements.reviewDue.textContent = dueEntries.length
    ? `Revisar ${dueEntries.length} ${dueEntries.length === 1 ? "cartão" : "cartões"} agora`
    : "Nenhuma revisão pendente";

  elements.deckPerformance.innerHTML = decks.map((deck) => {
    const stats = getDeckStats(deck);
    const progress = Math.round((stats.reviewed / deck.cards.length) * 100);
    const deckAccuracy = stats.attempts ? Math.round((stats.remembered / stats.attempts) * 100) : 0;
    return `
      <article class="deck-performance-row">
        <div class="deck-performance-heading">
          <span>${deck.title}</span>
          <strong>${stats.reviewed}/${deck.cards.length}</strong>
        </div>
        <div class="deck-performance-track" aria-hidden="true">
          <span style="width: ${progress}%"></span>
        </div>
        <small>${stats.attempts ? `${deckAccuracy}% de acerto` : "ainda não iniciado"}</small>
      </article>
    `;
  }).join("");
}

function render() {
  state.index = Math.min(Math.max(state.index, 0), currentDeck().cards.length - 1);
  elements.deckSelect.value = state.deckId;
  elements.deckSourceNote.textContent = currentDeck().sourceNote || "";
  renderProgress();
  renderCard();
  renderDashboard();
  saveProgress();
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

function toggleCard() {
  state.flipped = !state.flipped;
  renderCard();
}

function move(direction) {
  const total = currentDeck().cards.length;
  state.index = (state.index + direction + total) % total;
  state.flipped = false;
  render();
}

function goToEntry(entry) {
  state.deckId = entry.deck.id;
  state.index = entry.index;
  state.flipped = false;
  render();
}

function rateCard(didRemember) {
  const now = new Date();
  const key = currentCardKey();
  const previous = state.ratings[key] || { attempts: 0, remembered: 0, stage: 0 };
  const intervalIndex = Math.min(previous.stage || 0, REVIEW_INTERVAL_DAYS.length - 1);
  const intervalDays = didRemember ? REVIEW_INTERVAL_DAYS[intervalIndex] : 1;
  const nextReview = new Date(now.getTime() + intervalDays * 86400000);

  state.ratings[key] = {
    attempts: previous.attempts + 1,
    remembered: (previous.remembered || 0) + (didRemember ? 1 : 0),
    stage: didRemember ? Math.min((previous.stage || 0) + 1, REVIEW_INTERVAL_DAYS.length) : 0,
    lastResult: didRemember ? "remembered" : "forgot",
    lastReviewed: now.toISOString(),
    nextReview: nextReview.toISOString(),
  };
  registerActivity();
  renderProgress();
  renderDashboard();
  saveProgress();
  showToast(didRemember ? "Boa — revisão agendada" : "Tudo bem — veremos novamente amanhã");

  window.setTimeout(() => {
    if (!state.reviewMode) {
      move(1);
      return;
    }

    const nextDue = getDueEntries()[0];
    if (nextDue) {
      goToEntry(nextDue);
      return;
    }

    state.reviewMode = false;
    move(1);
    showToast("Revisões do dia concluídas");
  }, 320);
}

function shuffleCards() {
  const cards = currentDeck().cards;
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[randomIndex]] = [cards[randomIndex], cards[index]];
  }
  state.index = 0;
  state.flipped = false;
  state.reviewMode = false;
  render();
  showToast("Baralho embaralhado");
}

function openDashboard() {
  renderDashboard();
  elements.dashboardDialog.showModal();
  elements.dashboardDialog.scrollTop = 0;
  elements.dashboardClose.focus();
}

function closeDashboard() {
  if (elements.dashboardDialog.open) elements.dashboardDialog.close();
  elements.dashboardButton.focus();
}

function startDueReview() {
  const firstDue = getDueEntries()[0];
  if (!firstDue) return;
  state.reviewMode = true;
  closeDashboard();
  goToEntry(firstDue);
  showToast("Revisão do dia iniciada");
}

elements.deckSelect.addEventListener("change", (event) => {
  state.deckId = event.target.value;
  state.index = 0;
  state.flipped = false;
  state.reviewMode = false;
  render();
});

elements.flashcard.addEventListener("click", toggleCard);
elements.reveal.addEventListener("click", toggleCard);
elements.previous.addEventListener("click", () => move(-1));
elements.next.addEventListener("click", () => move(1));
elements.shuffle.addEventListener("click", shuffleCards);
elements.forgot.addEventListener("click", () => rateCard(false));
elements.remembered.addEventListener("click", () => rateCard(true));
elements.dashboardButton.addEventListener("click", openDashboard);
elements.dashboardClose.addEventListener("click", closeDashboard);
elements.reviewDue.addEventListener("click", startDueReview);
elements.dashboardDialog.addEventListener("click", (event) => {
  if (event.target === elements.dashboardDialog) closeDashboard();
});

document.addEventListener("keydown", (event) => {
  if (elements.dashboardDialog.open) return;
  if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
  if (event.code === "Space") {
    event.preventDefault();
    toggleCard();
  } else if (event.key === "ArrowLeft") {
    move(-1);
  } else if (event.key === "ArrowRight") {
    move(1);
  }
});

renderDeckOptions();
render();
