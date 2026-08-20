const STORAGE_KEY = "trilha-flashcard-state";
const THEME_STORAGE_KEY = "trilha-flashcard-theme";
const CUSTOM_DECKS_KEY = "trilha-flashcard-custom-decks";
const { dateKey, cardKey: buildCardKey, computeNextRating, isDue, isWrong, getStudyStreak: computeStudyStreak } = SpacedRepetition;

function loadCustomDecks() {
  try {
    const value = JSON.parse(localStorage.getItem(CUSTOM_DECKS_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveCustomDecks() {
  localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(decks.filter((deck) => deck.custom)));
}

const decks = [...trt4Decks, ...loadCustomDecks()];

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
  themeToggle: document.querySelector("#theme-toggle-button"),
  searchInput: document.querySelector("#search-input"),
  searchClear: document.querySelector("#search-clear"),
  searchResults: document.querySelector("#search-results"),
  topicSelect: document.querySelector("#topic-select"),
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
  reviewWrong: document.querySelector("#review-wrong-button"),
  deckPerformance: document.querySelector("#deck-performance"),
  exportButton: document.querySelector("#export-button"),
  importButton: document.querySelector("#import-button"),
  importInput: document.querySelector("#import-input"),
  importDeckButton: document.querySelector("#import-deck-button"),
  importDeckInput: document.querySelector("#import-deck-input"),
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
  queueMode: null,
  topicFilter: "",
};

let toastTimer;
let lastTopicDeckId = null;

function applyTheme(theme) {
  if (theme === "dark" || theme === "light") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function toggleTheme() {
  const current = localStorage.getItem(THEME_STORAGE_KEY) || (systemPrefersDark() ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
  elements.themeToggle.setAttribute("aria-pressed", String(next === "dark"));
}

function currentDeck() {
  return decks.find((deck) => deck.id === state.deckId);
}

function currentCard() {
  return currentDeck().cards[state.index];
}

function cardKey(deck, card) {
  return buildCardKey(deck.id, card.front);
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

function getDeckStats(deck, cards = deck.cards) {
  return cards.reduce((stats, card) => {
    const rating = state.ratings[cardKey(deck, card)];
    if (!rating?.attempts) return stats;
    stats.reviewed += 1;
    stats.attempts += rating.attempts;
    stats.remembered += rating.remembered || 0;
    return stats;
  }, { reviewed: 0, attempts: 0, remembered: 0 });
}

function getUniqueTopics(deck) {
  const seen = new Set();
  const topics = [];
  deck.cards.forEach((card) => {
    if (card.topic && !seen.has(card.topic)) {
      seen.add(card.topic);
      topics.push(card.topic);
    }
  });
  return topics;
}

function syncTopicOptions() {
  const deck = currentDeck();
  if (deck.id !== lastTopicDeckId) {
    lastTopicDeckId = deck.id;
    state.topicFilter = "";
    const topics = getUniqueTopics(deck);
    elements.topicSelect.innerHTML = ['<option value="">Todos os assuntos</option>']
      .concat(topics.map((topic) => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`))
      .join("");
    elements.topicSelect.disabled = topics.length === 0;
  }
  elements.topicSelect.value = state.topicFilter;
}

function getFilteredIndices() {
  const deck = currentDeck();
  if (!state.topicFilter) return deck.cards.map((_, index) => index);
  const indices = [];
  deck.cards.forEach((card, index) => {
    if (card.topic === state.topicFilter) indices.push(index);
  });
  return indices.length ? indices : deck.cards.map((_, index) => index);
}

function getDueEntries(now = Date.now()) {
  return allCardEntries()
    .filter(({ key }) => isDue(state.ratings[key], now))
    .sort((first, second) => (
      new Date(state.ratings[first.key].nextReview).getTime()
      - new Date(state.ratings[second.key].nextReview).getTime()
    ));
}

function getWrongEntries() {
  return allCardEntries()
    .filter(({ key }) => isWrong(state.ratings[key]))
    .sort((first, second) => (
      new Date(state.ratings[first.key].lastReviewed).getTime()
      - new Date(state.ratings[second.key].lastReviewed).getTime()
    ));
}

function getNextReview() {
  return Object.values(state.ratings)
    .filter((rating) => rating?.nextReview)
    .map((rating) => new Date(rating.nextReview).getTime())
    .filter(Number.isFinite)
    .sort((first, second) => first - second)[0] || null;
}

function registerActivity() {
  const today = dateKey();
  if (!state.activity.includes(today)) state.activity.push(today);
  state.activity = state.activity.slice(-366);
}

function getStudyStreak() {
  return computeStudyStreak(state.activity);
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
    .map((deck) => `<option value="${deck.id}">${escapeHtml(deck.title)}</option>`)
    .join("");
  elements.deckSelect.value = state.deckId;
}

function renderProgress() {
  const deck = currentDeck();
  const indices = getFilteredIndices();
  const total = indices.length;
  const stats = getDeckStats(deck, indices.map((index) => deck.cards[index]));
  const position = indices.indexOf(state.index);
  elements.progressLabel.textContent = `${(position === -1 ? 0 : position) + 1} de ${total}`;
  elements.sessionScore.textContent = stats.attempts === 0
    ? "0 estudados"
    : `${stats.remembered} de ${stats.attempts} lembrados`;
  elements.progressTrack.style.setProperty("--segments", total);
  elements.progressTrack.setAttribute("aria-valuemax", String(total));
  elements.progressTrack.setAttribute("aria-valuenow", String(stats.reviewed));
  elements.progressTrack.setAttribute("aria-valuetext", `${stats.reviewed} de ${total} cartões revisados`);
  elements.progressTrack.innerHTML = indices
    .map((cardIndex) => {
      const card = deck.cards[cardIndex];
      const wasReviewed = Boolean(state.ratings[cardKey(deck, card)]?.attempts);
      const status = cardIndex === state.index ? "current" : wasReviewed ? "complete" : "";
      return `<span class="progress-segment ${status}" aria-hidden="true"></span>`;
    })
    .join("");
  elements.sessionCount.textContent = `${stats.reviewed} de ${total}`;
  elements.sessionDots.innerHTML = indices
    .map((cardIndex) => {
      const card = deck.cards[cardIndex];
      const wasReviewed = Boolean(state.ratings[cardKey(deck, card)]?.attempts);
      const status = cardIndex === state.index ? "current" : wasReviewed ? "complete" : "";
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
  const wrongEntries = getWrongEntries();
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

  elements.reviewWrong.disabled = wrongEntries.length === 0;
  elements.reviewWrong.textContent = wrongEntries.length
    ? `Revisar ${wrongEntries.length} ${wrongEntries.length === 1 ? "errado" : "errados"}`
    : "Nenhum cartão errado";

  elements.deckPerformance.innerHTML = decks.map((deck) => {
    const stats = getDeckStats(deck);
    const progress = Math.round((stats.reviewed / deck.cards.length) * 100);
    const deckAccuracy = stats.attempts ? Math.round((stats.remembered / stats.attempts) * 100) : 0;
    return `
      <article class="deck-performance-row">
        <div class="deck-performance-heading">
          <span>${escapeHtml(deck.title)}</span>
          ${deck.custom ? `<button type="button" class="deck-remove-button" data-remove-deck="${escapeHtml(deck.id)}" aria-label="Remover baralho ${escapeHtml(deck.title)}">✕</button>` : ""}
          <strong>${stats.reviewed}/${deck.cards.length}</strong>
        </div>
        <div class="deck-performance-track" aria-hidden="true">
          <span style="width: ${progress}%"></span>
        </div>
        <small>${stats.attempts ? `${deckAccuracy}% de acerto` : "ainda não iniciado"}</small>
      </article>
    `;
  }).join("");
  elements.deckPerformance.querySelectorAll("[data-remove-deck]").forEach((button) => {
    button.addEventListener("click", () => removeCustomDeck(button.dataset.removeDeck));
  });
}

function render() {
  state.index = Math.min(Math.max(state.index, 0), currentDeck().cards.length - 1);
  elements.deckSelect.value = state.deckId;
  elements.deckSourceNote.textContent = currentDeck().sourceNote || "";
  syncTopicOptions();
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
  const indices = getFilteredIndices();
  const position = indices.indexOf(state.index);
  const fromPosition = position === -1 ? 0 : position;
  const nextPosition = (fromPosition + direction + indices.length) % indices.length;
  state.index = indices[nextPosition];
  state.flipped = false;
  render();
}

function goToEntry(entry) {
  state.deckId = entry.deck.id;
  state.index = entry.index;
  state.flipped = false;
  state.topicFilter = "";
  render();
}

function rateCard(didRemember) {
  const now = new Date();
  const key = currentCardKey();
  state.ratings[key] = computeNextRating(state.ratings[key], didRemember, now);
  registerActivity();
  renderProgress();
  renderDashboard();
  saveProgress();
  showToast(didRemember ? "Boa — revisão agendada" : "Tudo bem — veremos novamente amanhã");

  window.setTimeout(() => {
    if (!state.queueMode) {
      move(1);
      return;
    }

    const queue = state.queueMode === "wrong" ? getWrongEntries() : getDueEntries();
    const nextEntry = queue[0];
    if (nextEntry) {
      goToEntry(nextEntry);
      return;
    }

    const finishedMessage = state.queueMode === "wrong" ? "Cartões errados revisados" : "Revisões do dia concluídas";
    state.queueMode = null;
    move(1);
    showToast(finishedMessage);
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
  state.queueMode = null;
  state.topicFilter = "";
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
  state.queueMode = "due";
  closeDashboard();
  goToEntry(firstDue);
  showToast("Revisão do dia iniciada");
}

function startWrongReview() {
  const firstWrong = getWrongEntries()[0];
  if (!firstWrong) return;
  state.queueMode = "wrong";
  closeDashboard();
  goToEntry(firstWrong);
  showToast("Revisão dos errados iniciada");
}

function escapeHtml(value) {
  return (value || "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeText(value) {
  return (value || "").toString().toLowerCase();
}

function closeSearchResults() {
  elements.searchResults.hidden = true;
  elements.searchResults.innerHTML = "";
}

function renderSearchResults(rawQuery) {
  const query = normalizeText(rawQuery).trim();
  elements.searchClear.hidden = query.length === 0;
  if (!query) {
    closeSearchResults();
    return;
  }

  const matches = allCardEntries()
    .filter(({ deck, card }) => {
      const haystack = [card.front, card.back, card.tag, card.topic, deck.title].map(normalizeText).join(" ");
      return haystack.includes(query);
    })
    .slice(0, 30);

  elements.searchResults.innerHTML = matches.length
    ? matches
        .map(
          (entry, index) => `
            <button type="button" class="search-result" data-result-index="${index}" role="option">
              <span class="search-result-front">${escapeHtml(entry.card.front)}</span>
              <span class="search-result-meta">${escapeHtml(entry.deck.title)}${entry.card.tag ? ` · ${escapeHtml(entry.card.tag)}` : ""}</span>
            </button>
          `
        )
        .join("")
    : `<p class="search-empty">Nenhum cartão encontrado.</p>`;

  elements.searchResults.hidden = false;
  elements.searchResults.querySelectorAll(".search-result").forEach((button, index) => {
    button.addEventListener("click", () => {
      goToEntry(matches[index]);
      elements.searchInput.value = "";
      elements.searchClear.hidden = true;
      closeSearchResults();
    });
  });
}

function exportProgress() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    deckId: state.deckId,
    index: state.index,
    ratings: state.ratings,
    activity: state.activity,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trilha-flashcard-progresso-${dateKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Progresso exportado");
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== "object") throw new Error("invalid");

      state.ratings = data.ratings && typeof data.ratings === "object" && !Array.isArray(data.ratings)
        ? data.ratings
        : {};
      state.activity = Array.isArray(data.activity)
        ? [...new Set(data.activity.filter((entry) => typeof entry === "string"))]
        : [];
      if (typeof data.deckId === "string" && decks.some((deck) => deck.id === data.deckId)) {
        state.deckId = data.deckId;
      }
      if (Number.isInteger(data.index)) {
        state.index = data.index;
      }
      state.flipped = false;
      state.queueMode = null;
      render();
      showToast("Progresso importado");
    } catch {
      showToast("Arquivo inválido para importação");
    }
  };
  reader.onerror = () => showToast("Não foi possível ler o arquivo");
  reader.readAsText(file);
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "baralho"
  );
}

function normalizeImportedDeck(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const cardsInput = Array.isArray(raw.cards) ? raw.cards : null;
  if (!title || !cardsInput) return null;

  const cards = cardsInput
    .filter((card) => card && typeof card.front === "string" && card.front.trim() && typeof card.back === "string" && card.back.trim())
    .map((card) => ({
      front: card.front.trim(),
      back: card.back.trim(),
      ...(typeof card.example === "string" ? { example: card.example } : {}),
      ...(typeof card.tag === "string" ? { tag: card.tag } : {}),
      ...(typeof card.topic === "string" ? { topic: card.topic } : {}),
      ...(typeof card.complement === "string" ? { complement: card.complement } : {}),
      ...(typeof card.pitfall === "string" ? { pitfall: card.pitfall } : {}),
      ...(typeof card.mnemonic === "string" ? { mnemonic: card.mnemonic } : {}),
    }));

  if (!cards.length) return null;

  return {
    id: `custom-${slugify(title)}-${Date.now().toString(36)}`,
    title,
    custom: true,
    cards,
  };
}

function importDeck(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const rawDecks = Array.isArray(data) ? data : Array.isArray(data?.decks) ? data.decks : [data];
      const imported = rawDecks.map(normalizeImportedDeck).filter(Boolean);
      if (!imported.length) throw new Error("invalid");

      imported.forEach((deck) => decks.push(deck));
      saveCustomDecks();
      renderDeckOptions();
      state.deckId = imported[0].id;
      state.index = 0;
      state.flipped = false;
      state.queueMode = null;
      render();
      showToast(
        imported.length === 1
          ? `Baralho "${imported[0].title}" importado com ${imported[0].cards.length} cartões`
          : `${imported.length} baralhos importados`
      );
    } catch {
      showToast("Arquivo inválido para importar baralho");
    }
  };
  reader.onerror = () => showToast("Não foi possível ler o arquivo");
  reader.readAsText(file);
}

function removeCustomDeck(deckId) {
  const deck = decks.find((entry) => entry.id === deckId && entry.custom);
  if (!deck) return;
  if (!window.confirm(`Remover o baralho "${deck.title}"? O progresso salvo dele também será apagado.`)) return;

  decks.splice(decks.indexOf(deck), 1);
  deck.cards.forEach((card) => {
    delete state.ratings[buildCardKey(deck.id, card.front)];
  });
  saveCustomDecks();

  if (state.deckId === deckId) {
    state.deckId = decks[0].id;
    state.index = 0;
  }
  renderDeckOptions();
  render();
  showToast("Baralho removido");
}

elements.deckSelect.addEventListener("change", (event) => {
  state.deckId = event.target.value;
  state.index = 0;
  state.flipped = false;
  state.queueMode = null;
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
elements.reviewWrong.addEventListener("click", startWrongReview);
elements.dashboardDialog.addEventListener("click", (event) => {
  if (event.target === elements.dashboardDialog) closeDashboard();
});
elements.themeToggle.addEventListener("click", toggleTheme);
elements.exportButton.addEventListener("click", exportProgress);
elements.importButton.addEventListener("click", () => elements.importInput.click());
elements.importInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importProgress(file);
  event.target.value = "";
});
elements.importDeckButton.addEventListener("click", () => elements.importDeckInput.click());
elements.importDeckInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importDeck(file);
  event.target.value = "";
});

elements.searchInput.addEventListener("input", (event) => renderSearchResults(event.target.value));
elements.searchInput.addEventListener("focus", (event) => renderSearchResults(event.target.value));
elements.searchClear.addEventListener("click", () => {
  elements.searchInput.value = "";
  elements.searchInput.focus();
  renderSearchResults("");
});
document.addEventListener("click", (event) => {
  if (!elements.searchInput.closest(".search-bar").contains(event.target)) {
    closeSearchResults();
  }
});
elements.searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSearchResults();
});

elements.topicSelect.addEventListener("change", (event) => {
  state.topicFilter = event.target.value;
  const indices = getFilteredIndices();
  state.index = indices.includes(state.index) ? state.index : indices[0];
  state.flipped = false;
  render();
});

document.addEventListener("keydown", (event) => {
  if (elements.dashboardDialog.open) return;
  if (
    event.target instanceof HTMLSelectElement
    || event.target instanceof HTMLButtonElement
    || event.target instanceof HTMLInputElement
  ) return;
  if (event.code === "Space") {
    event.preventDefault();
    toggleCard();
  } else if (event.key === "ArrowLeft") {
    move(-1);
  } else if (event.key === "ArrowRight") {
    move(1);
  }
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

const explicitTheme = document.documentElement.getAttribute("data-theme");
const effectiveDark = explicitTheme === "dark" || (!explicitTheme && systemPrefersDark());
elements.themeToggle.setAttribute("aria-pressed", String(effectiveDark));

renderDeckOptions();
render();
