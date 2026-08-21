const STORAGE_KEY = "trilha-flashcard-state";
const THEME_STORAGE_KEY = "trilha-flashcard-theme";
const CUSTOM_DECKS_KEY = "trilha-flashcard-custom-decks";
const BUILTIN_OVERRIDES_KEY = "trilha-flashcard-builtin-overrides";
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

function loadBuiltinOverrides() {
  try {
    const value = JSON.parse(localStorage.getItem(BUILTIN_OVERRIDES_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function saveBuiltinOverrides() {
  const overrides = {};
  decks.forEach((deck) => {
    if (!deck.custom) overrides[deck.id] = deck.cards;
  });
  localStorage.setItem(BUILTIN_OVERRIDES_KEY, JSON.stringify(overrides));
}

function persistDeckCards(deck) {
  if (deck.custom) {
    saveCustomDecks();
  } else {
    saveBuiltinOverrides();
  }
}

const decks = [...trt4Decks, ...loadCustomDecks()];

(function applyBuiltinOverrides() {
  const overrides = loadBuiltinOverrides();
  decks.forEach((deck) => {
    if (
      !deck.custom
      && Array.isArray(overrides[deck.id])
      && (overrides[deck.id].length > 0 || deck.cards.length === 0)
    ) {
      deck.cards = overrides[deck.id];
    }
  });
})();

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
  openManageCardsButton: document.querySelector("#open-manage-cards-button"),
  manageCardsDialog: document.querySelector("#manage-cards-dialog"),
  manageCardsClose: document.querySelector("#manage-cards-close"),
  manageCardsKicker: document.querySelector("#manage-cards-kicker"),
  manageCardsSummary: document.querySelector("#manage-cards-summary"),
  cardAddButton: document.querySelector("#card-add-button"),
  cardImportButton: document.querySelector("#card-import-button"),
  cardImportInput: document.querySelector("#card-import-input"),
  cardExportDeckButton: document.querySelector("#card-export-deck-button"),
  cardListSearch: document.querySelector("#card-list-search"),
  cardForm: document.querySelector("#card-form"),
  cardFormIndex: document.querySelector("#card-form-index"),
  cardFormSourceDeck: document.querySelector("#card-form-source-deck"),
  cardFormDiscipline: document.querySelector("#card-form-discipline"),
  cardFormFront: document.querySelector("#card-form-front"),
  cardFormBack: document.querySelector("#card-form-back"),
  cardFormTopic: document.querySelector("#card-form-topic"),
  cardFormTopicWarning: document.querySelector("#card-form-topic-warning"),
  cardFormSubtopic: document.querySelector("#card-form-subtopic"),
  cardFormLegalBasis: document.querySelector("#card-form-legal-basis"),
  cardFormType: document.querySelector("#card-form-type"),
  cardFormPriority: document.querySelector("#card-form-priority"),
  cardFormDifficulty: document.querySelector("#card-form-difficulty"),
  cardFormTag: document.querySelector("#card-form-tag"),
  cardFormExample: document.querySelector("#card-form-example"),
  cardFormComplement: document.querySelector("#card-form-complement"),
  cardFormPitfall: document.querySelector("#card-form-pitfall"),
  cardFormMnemonic: document.querySelector("#card-form-mnemonic"),
  cardFormCancel: document.querySelector("#card-form-cancel"),
  cardFormSaveAddAnother: document.querySelector("#card-form-save-add-another"),
  cardList: document.querySelector("#card-list"),
  installButton: document.querySelector("#install-app-button"),
  installDialog: document.querySelector("#install-dialog"),
  installDialogClose: document.querySelector("#install-dialog-close"),
  installDialogIntro: document.querySelector("#install-dialog-intro"),
  installSteps: document.querySelector("#install-steps"),
  installConfirmButton: document.querySelector("#install-confirm-button"),
  toast: document.querySelector("#toast"),
};

let deferredInstallPrompt = null;

function isAppInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function setInstallButtonVisibility() {
  elements.installButton.hidden = isAppInstalled();
}

function openInstallDialog() {
  if (isAppInstalled()) {
    showToast("O aplicativo já está instalado");
    return;
  }

  const isIOS = isIOSDevice();
  elements.installDialogIntro.textContent = isIOS
    ? "No iPhone ou iPad, a instalação é feita pelo menu Compartilhar do Safari."
    : deferredInstallPrompt
      ? "Instale o aplicativo para acessar seus flashcards diretamente pela tela inicial."
      : "Use o menu do navegador para adicionar o aplicativo à tela inicial.";

  elements.installSteps.innerHTML = isIOS
    ? "<li>Abra esta página no Safari.</li><li>Toque no botão Compartilhar.</li><li>Escolha “Adicionar à Tela de Início”.</li><li>Toque em “Adicionar”.</li>"
    : deferredInstallPrompt
      ? "<li>Toque em “Instalar agora” abaixo.</li><li>Confirme a instalação apresentada pelo navegador.</li><li>Abra o Trilha Flashcard pela tela inicial.</li>"
      : "<li>Abra o menu do navegador.</li><li>Escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.</li><li>Confirme a instalação.</li>";

  elements.installConfirmButton.hidden = !deferredInstallPrompt || isIOS;
  elements.installDialog.showModal();
  elements.installDialogClose.focus();
}

function closeInstallDialog() {
  if (elements.installDialog.open) elements.installDialog.close();
  elements.installButton.focus();
}

async function promptInstall() {
  if (!deferredInstallPrompt) {
    openInstallDialog();
    return;
  }

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  closeInstallDialog();
  if (choice.outcome === "accepted") {
    elements.installButton.hidden = true;
    showToast("Instalação iniciada");
  } else {
    showToast("Instalação cancelada");
  }
}

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
let ratingAdvanceTimer = null;
let lastTopicDeckId = null;

function applyTheme(theme) {
  if (theme === "dark" || theme === "light") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  const effectiveTheme = theme === "dark" || theme === "light"
    ? theme
    : systemPrefersDark() ? "dark" : "light";
  document.querySelector("#theme-color")?.setAttribute(
    "content",
    effectiveTheme === "dark" ? "#0b1220" : "#fbfcff"
  );
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
  return currentDeck().cards[state.index] ?? null;
}

function cardKey(deck, card) {
  return buildCardKey(deck.id, card.front);
}

function currentCardKey() {
  const card = currentCard();
  return card ? cardKey(currentDeck(), card) : null;
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

function getDeckWeight(deck) {
  const match = deck.title.match(/·\s*([\d,]+)\s*%/);
  return match ? parseFloat(match[1].replace(",", ".")) : null;
}

function getDecksForDisplay() {
  const overview = decks.find((deck) => deck.id === "trt4-overview");
  const rest = decks.filter((deck) => deck !== overview);
  const weighted = rest.filter((deck) => getDeckWeight(deck) !== null)
    .sort((a, b) => getDeckWeight(b) - getDeckWeight(a));
  const unweighted = rest.filter((deck) => getDeckWeight(deck) === null);
  return overview ? [overview, ...weighted, ...unweighted] : [...weighted, ...unweighted];
}

function getTopicCoverage(deck) {
  if (!Array.isArray(deck.topics) || !deck.topics.length) return null;
  const covered = new Set(deck.cards.map((card) => card.topic).filter(Boolean));
  const coveredCount = deck.topics.filter((topic) => covered.has(topic)).length;
  return { covered: coveredCount, total: deck.topics.length };
}

function getUniqueTopics(deck) {
  if (Array.isArray(deck.topics) && deck.topics.length) {
    return deck.topics;
  }
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
  elements.deckSelect.innerHTML = getDecksForDisplay()
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
  elements.progressLabel.textContent = total === 0 ? "Sem cartões" : `${(position === -1 ? 0 : position) + 1} de ${total}`;
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
  elements.sessionCount.textContent = total === 0 ? "0 de 0" : `${(position === -1 ? 0 : position) + 1} de ${total}`;
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
  const isEmpty = !card;
  elements.flashcard.disabled = isEmpty;
  elements.reveal.disabled = isEmpty;
  elements.forgot.disabled = isEmpty || ratingAdvanceTimer !== null;
  elements.remembered.disabled = isEmpty || ratingAdvanceTimer !== null;
  elements.previous.disabled = isEmpty;
  elements.next.disabled = isEmpty;

  if (isEmpty) {
    elements.front.textContent = "Este baralho ainda não tem cartões.";
    elements.front.classList.remove("is-medium", "is-long");
    elements.back.textContent = "";
    elements.back.classList.remove("is-long");
    elements.example.textContent = "";
    elements.tagFront.textContent = "";
    elements.tagBack.textContent = "";
    elements.topic.textContent = "";
    fillCallout(elements.complement, elements.complementText, "");
    fillCallout(elements.pitfall, elements.pitfallText, "");
    fillCallout(elements.mnemonic, elements.mnemonicText, "");
    elements.flashcard.classList.remove("is-flipped");
    elements.flashcard.setAttribute("aria-label", "Baralho vazio");
    return;
  }

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

  elements.deckPerformance.innerHTML = getDecksForDisplay().map((deck) => {
    const stats = getDeckStats(deck);
    const progress = deck.cards.length ? Math.round((stats.reviewed / deck.cards.length) * 100) : 0;
    const deckAccuracy = stats.attempts ? Math.round((stats.remembered / stats.attempts) * 100) : 0;
    const coverage = getTopicCoverage(deck);
    const coverageText = coverage ? ` · ${coverage.covered} de ${coverage.total} assuntos` : "";
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
        <small>${deck.cards.length === 0 ? "sem cartões" : stats.attempts ? `${deckAccuracy}% de acerto` : "ainda não iniciado"}${coverageText}</small>
      </article>
    `;
  }).join("");
  elements.deckPerformance.querySelectorAll("[data-remove-deck]").forEach((button) => {
    button.addEventListener("click", () => removeCustomDeck(button.dataset.removeDeck));
  });
}

function render() {
  state.index = Math.min(Math.max(state.index, 0), Math.max(currentDeck().cards.length - 1, 0));
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
  if (!currentCard()) return;
  state.flipped = !state.flipped;
  renderCard();
}

function move(direction) {
  const indices = getFilteredIndices();
  if (!indices.length) return;
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
  const key = currentCardKey();
  if (!key || ratingAdvanceTimer !== null) return;
  const now = new Date();
  state.ratings[key] = computeNextRating(state.ratings[key], didRemember, now);
  elements.forgot.disabled = true;
  elements.remembered.disabled = true;
  registerActivity();
  renderProgress();
  renderDashboard();
  saveProgress();
  showToast(didRemember ? "Boa — revisão agendada" : "Tudo bem — veremos novamente amanhã");

  ratingAdvanceTimer = window.setTimeout(() => {
    ratingAdvanceTimer = null;

    if (currentCardKey() !== key) {
      renderCard();
      return;
    }

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

function openManageCards() {
  closeDashboard();
  elements.cardListSearch.value = "";
  renderManageCards();
  elements.manageCardsDialog.showModal();
  elements.manageCardsDialog.scrollTop = 0;
  elements.manageCardsClose.focus();
}

function closeManageCards() {
  if (elements.manageCardsDialog.open) elements.manageCardsDialog.close();
  closeCardForm();
  elements.openManageCardsButton.focus();
}

function renderManageCards() {
  const deck = currentDeck();
  elements.manageCardsKicker.textContent = deck.title.toUpperCase();
  elements.manageCardsSummary.textContent = deck.cards.length
    ? `${deck.cards.length} ${deck.cards.length === 1 ? "cartão" : "cartões"} neste baralho.`
    : "Nenhum cartão neste baralho ainda.";
  const coverage = getTopicCoverage(deck);
  if (coverage) {
    elements.manageCardsSummary.textContent += ` ${coverage.covered} de ${coverage.total} assuntos do edital com cartão.`;
  }

  elements.cardList.innerHTML = deck.cards.length
    ? deck.cards
        .map((card, index) => {
          const searchValue = [card.front, card.back, card.topic, card.subtopic, card.legalBasis, card.type, card.priority, card.difficulty].filter(Boolean).join(" ").toLowerCase();
          return `
            <article class="card-list-row" data-search="${escapeHtml(searchValue)}">
              <div class="card-list-row-main">
                <span class="card-list-front">${escapeHtml(card.front)}</span>
                <span class="card-list-topic">${[card.topic, card.subtopic, card.type, card.priority ? `Prioridade ${card.priority}` : "", card.difficulty].filter(Boolean).map(escapeHtml).join(" · ") || "sem classificação"}</span>
              </div>
              <div class="card-list-row-actions">
                <button type="button" class="data-button" data-edit-card="${index}">Editar</button>
                <button type="button" class="deck-remove-button" data-delete-card="${index}" aria-label="Excluir cartão">✕</button>
              </div>
            </article>
          `;
        })
        .join("")
    : `<p class="card-list-empty">Nenhum cartão ainda. Use "Adicionar cartão" ou "Importar cartões" para começar.</p>`;

  elements.cardList.querySelectorAll("[data-edit-card]").forEach((button) => {
    button.addEventListener("click", () => openCardForm(Number(button.dataset.editCard)));
  });
  elements.cardList.querySelectorAll("[data-delete-card]").forEach((button) => {
    button.addEventListener("click", () => deleteCard(Number(button.dataset.deleteCard)));
  });
  filterCardList();
}

function filterCardList() {
  const query = elements.cardListSearch.value.trim().toLowerCase();
  elements.cardList.querySelectorAll(".card-list-row").forEach((row) => {
    row.hidden = Boolean(query) && !row.dataset.search.includes(query);
  });
}

function editalDecks() {
  return decks.filter((deck) => deck.id !== "trt4-overview" && Array.isArray(deck.topics) && deck.topics.length > 0);
}

function replaceSelectOptions(select, options) {
  const fragment = document.createDocumentFragment();
  options.forEach(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    fragment.append(option);
  });
  select.replaceChildren(fragment);
}

function renderDisciplineOptions(selectedDeckId = "", extraDeck = null) {
  const availableDecks = editalDecks();
  if (
    extraDeck
    && Array.isArray(extraDeck.topics)
    && extraDeck.topics.length > 0
    && !availableDecks.some((deck) => deck.id === extraDeck.id)
  ) {
    availableDecks.unshift(extraDeck);
  }

  replaceSelectOptions(elements.cardFormDiscipline, [
    { value: "", label: "Selecione a disciplina" },
    ...availableDecks.map((deck) => ({ value: deck.id, label: deck.title })),
  ]);
  elements.cardFormDiscipline.value = selectedDeckId;
}

function renderTopicOptions(selectedTopic = "") {
  const deck = decks.find((entry) => entry.id === elements.cardFormDiscipline.value);
  const topics = Array.isArray(deck?.topics) ? deck.topics : [];
  const options = [{ value: "", label: "Selecione o assunto" }];

  topics.forEach((topic) => {
    options.push({ value: topic, label: topic });
  });
  if (selectedTopic && !topics.includes(selectedTopic)) {
    options.push({ value: selectedTopic, label: `${selectedTopic} (importado)` });
  }

  replaceSelectOptions(elements.cardFormTopic, options);
  elements.cardFormTopic.disabled = !deck;
  elements.cardFormTopic.value = selectedTopic;
  checkTopicWarning();
}

function checkTopicWarning() {
  const deck = decks.find((entry) => entry.id === elements.cardFormDiscipline.value);
  const value = elements.cardFormTopic.value;
  const isUnknown = Boolean(value) && Array.isArray(deck?.topics) && !deck.topics.includes(value);
  elements.cardFormTopicWarning.hidden = !isUnknown;
}

function openCardForm(index) {
  const sourceDeck = currentDeck();
  const card = index === null ? null : sourceDeck.cards[index];
  const disciplineDecks = editalDecks();
  const defaultDeck = disciplineDecks.some((deck) => deck.id === sourceDeck.id)
    ? sourceDeck
    : disciplineDecks[0];
  const selectedDeckId = card ? sourceDeck.id : defaultDeck?.id || "";

  elements.cardFormIndex.value = index === null ? "" : String(index);
  elements.cardFormSourceDeck.value = sourceDeck.id;
  renderDisciplineOptions(selectedDeckId, card ? sourceDeck : null);
  renderTopicOptions(card?.topic || "");
  elements.cardFormFront.value = card?.front || "";
  elements.cardFormBack.value = card?.back || "";
  elements.cardFormSubtopic.value = card?.subtopic || "";
  elements.cardFormLegalBasis.value = card?.legalBasis || "";
  elements.cardFormType.value = card?.type || "Conceito";
  elements.cardFormPriority.value = card?.priority || "B";
  elements.cardFormDifficulty.value = card?.difficulty || "Médio";
  elements.cardFormTag.value = card?.tag || "";
  elements.cardFormExample.value = card?.example || "";
  elements.cardFormComplement.value = card?.complement || "";
  elements.cardFormPitfall.value = card?.pitfall || "";
  elements.cardFormMnemonic.value = card?.mnemonic || "";
  elements.cardFormSaveAddAnother.hidden = index !== null;
  elements.cardForm.hidden = false;
  elements.cardForm.scrollIntoView({ block: "nearest" });
  if (!window.matchMedia("(pointer: coarse)").matches) {
    elements.cardFormDiscipline.focus();
  }
}

function closeCardForm() {
  elements.cardForm.hidden = true;
  elements.cardForm.reset();
  elements.cardFormIndex.value = "";
  elements.cardFormSourceDeck.value = "";
  elements.cardFormTopicWarning.hidden = true;
}

function buildCardFromForm() {
  const front = elements.cardFormFront.value.trim();
  const back = elements.cardFormBack.value.trim();
  const disciplineId = elements.cardFormDiscipline.value;
  const topic = elements.cardFormTopic.value;
  if (!front || !back || !disciplineId || !topic) return null;

  const card = {
    front,
    back,
    topic,
    type: elements.cardFormType.value,
    priority: elements.cardFormPriority.value,
    difficulty: elements.cardFormDifficulty.value,
  };
  const subtopic = elements.cardFormSubtopic.value.trim();
  const legalBasis = elements.cardFormLegalBasis.value.trim();
  const tag = elements.cardFormTag.value.trim();
  const example = elements.cardFormExample.value.trim();
  const complement = elements.cardFormComplement.value.trim();
  const pitfall = elements.cardFormPitfall.value.trim();
  const mnemonic = elements.cardFormMnemonic.value.trim();
  if (subtopic) card.subtopic = subtopic;
  if (legalBasis) card.legalBasis = legalBasis;
  if (tag) card.tag = tag;
  if (example) card.example = example;
  if (complement) card.complement = complement;
  if (pitfall) card.pitfall = pitfall;
  if (mnemonic) card.mnemonic = mnemonic;
  return { card, disciplineId };
}

function handleCardFormSubmit(event) {
  event.preventDefault();
  const built = buildCardFromForm();
  if (!built) {
    showToast("Preencha Disciplina, Assunto, Enunciado e Gabarito");
    return;
  }

  const { card: newCard, disciplineId } = built;
  const targetDeck = decks.find((deck) => deck.id === disciplineId);
  const sourceDeck = decks.find((deck) => deck.id === elements.cardFormSourceDeck.value) || currentDeck();
  if (!targetDeck || !targetDeck.topics.includes(newCard.topic)) {
    showToast("Selecione uma disciplina e um assunto válidos do edital");
    return;
  }

  const indexValue = elements.cardFormIndex.value;
  const isEdit = indexValue !== "";
  const editingIndex = isEdit ? Number(indexValue) : -1;
  const duplicateIndex = targetDeck.cards.findIndex(
    (card, index) => !(isEdit && targetDeck.id === sourceDeck.id && index === editingIndex)
      && card.front.trim().toLowerCase() === newCard.front.trim().toLowerCase()
  );
  if (duplicateIndex !== -1 && !window.confirm("Já existe um cartão com este enunciado nesta disciplina. Salvar mesmo assim?")) {
    return;
  }

  if (isEdit) {
    const previousCard = sourceDeck.cards[editingIndex];
    if (!previousCard) {
      showToast("Cartão original não encontrado");
      return;
    }
    const previousKey = buildCardKey(sourceDeck.id, previousCard.front);
    const newKey = buildCardKey(targetDeck.id, newCard.front);
    if (state.ratings[previousKey]) {
      state.ratings[newKey] = state.ratings[previousKey];
      if (previousKey !== newKey) delete state.ratings[previousKey];
    }

    if (sourceDeck.id === targetDeck.id) {
      sourceDeck.cards[editingIndex] = newCard;
      persistDeckCards(sourceDeck);
    } else {
      sourceDeck.cards.splice(editingIndex, 1);
      targetDeck.cards.push(newCard);
      persistDeckCards(sourceDeck);
      persistDeckCards(targetDeck);
    }
  } else {
    targetDeck.cards.push(newCard);
    persistDeckCards(targetDeck);
  }

  state.deckId = targetDeck.id;
  state.index = Math.max(0, targetDeck.cards.indexOf(newCard));
  state.topicFilter = "";
  renderDeckOptions();
  lastTopicDeckId = null;
  render();
  renderManageCards();

  const keepOpen = !isEdit && event.submitter?.id === "card-form-save-add-another";
  if (keepOpen) {
    const topic = elements.cardFormTopic.value;
    const selectedDiscipline = elements.cardFormDiscipline.value;
    elements.cardForm.reset();
    elements.cardFormIndex.value = "";
    elements.cardFormSourceDeck.value = targetDeck.id;
    renderDisciplineOptions(selectedDiscipline);
    renderTopicOptions(topic);
    elements.cardFormType.value = "Conceito";
    elements.cardFormPriority.value = "B";
    elements.cardFormDifficulty.value = "Médio";
    elements.cardFormFront.focus();
    showToast("Cartão adicionado — continue digitando");
  } else {
    closeCardForm();
    showToast(isEdit ? "Cartão atualizado" : "Cartão adicionado");
  }
}

function deleteCard(index) {
  const deck = currentDeck();
  const card = deck.cards[index];
  if (!card) return;
  const preview = card.front.length > 60 ? `${card.front.slice(0, 60)}…` : card.front;
  if (!window.confirm(`Excluir o cartão "${preview}"?`)) return;

  delete state.ratings[buildCardKey(deck.id, card.front)];
  deck.cards.splice(index, 1);
  persistDeckCards(deck);
  renderManageCards();
  lastTopicDeckId = null;
  render();
  showToast("Cartão excluído");
}

const PDFJS_MODULE_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

function normalizeImportedCards(rawCards) {
  if (!Array.isArray(rawCards)) return [];

  return rawCards
    .filter((card) => card && typeof card.front === "string" && card.front.trim() && typeof card.back === "string" && card.back.trim())
    .map((card) => ({
      front: card.front.trim(),
      back: card.back.trim(),
      ...(typeof card.example === "string" && card.example.trim() ? { example: card.example.trim() } : {}),
      ...(typeof card.tag === "string" && card.tag.trim() ? { tag: card.tag.trim() } : {}),
      ...(typeof card.topic === "string" && card.topic.trim() ? { topic: card.topic.trim() } : {}),
      ...(typeof card.complement === "string" && card.complement.trim() ? { complement: card.complement.trim() } : {}),
      ...(typeof card.pitfall === "string" && card.pitfall.trim() ? { pitfall: card.pitfall.trim() } : {}),
      ...(typeof card.mnemonic === "string" && card.mnemonic.trim() ? { mnemonic: card.mnemonic.trim() } : {}),
    }));
}

function parseLabeledPdfCards(text) {
  const cards = [];
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const frontPattern = /^(?:pergunta|quest[aã]o|frente|q)\s*[:\-–—]\s*(.*)$/i;
  const backPattern = /^(?:resposta|gabarito|verso|a)\s*[:\-–—]\s*(.*)$/i;
  let current = null;
  let side = null;

  const finish = () => {
    if (current?.front?.trim() && current?.back?.trim()) {
      cards.push({ front: current.front.trim(), back: current.back.trim(), tag: "PDF" });
    }
  };

  lines.forEach((line) => {
    const frontMatch = line.match(frontPattern);
    const backMatch = line.match(backPattern);

    if (frontMatch) {
      finish();
      current = { front: frontMatch[1], back: "" };
      side = "front";
    } else if (backMatch && current) {
      current.back = backMatch[1];
      side = "back";
    } else if (current && side) {
      current[side] = `${current[side]}\n${line}`.trim();
    }
  });
  finish();
  return cards;
}

function parsePdfPageFallback(text, pageNumber) {
  const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length >= 2) {
    return {
      front: blocks[0],
      back: blocks.slice(1).join("\n\n"),
      tag: "PDF",
      complement: `Importado da página ${pageNumber}.`,
    };
  }

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return {
      front: lines[0],
      back: lines.slice(1).join("\n"),
      tag: "PDF",
      complement: `Importado da página ${pageNumber}.`,
    };
  }
  return null;
}

async function extractCardsFromPdf(file) {
  const pdfjs = await import(PDFJS_MODULE_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const cards = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let pageText = "";
    content.items.forEach((item) => {
      pageText += item.str;
      pageText += item.hasEOL ? "\n" : " ";
    });
    pageText = pageText.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
    if (!pageText) continue;

    const labeled = parseLabeledPdfCards(pageText);
    if (labeled.length) {
      cards.push(...labeled.map((card) => ({ ...card, complement: `Importado da página ${pageNumber}.` })));
    } else {
      const fallback = parsePdfPageFallback(pageText, pageNumber);
      if (fallback) cards.push(fallback);
    }
  }

  return cards;
}

function addImportedCards(cards, sourceLabel) {
  if (!cards.length) throw new Error("empty");

  const deck = currentDeck();
  cards.forEach((card) => deck.cards.push(card));
  persistDeckCards(deck);
  renderManageCards();
  lastTopicDeckId = null;
  render();
  showToast(`${cards.length} ${cards.length === 1 ? "cartão importado" : "cartões importados"} do ${sourceLabel}`);
}

async function importCardsIntoCurrentDeck(file) {
  try {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      showToast("Lendo e convertendo o PDF...");
      const cards = await extractCardsFromPdf(file);
      if (!cards.length) throw new Error("empty-pdf");
      const confirmed = window.confirm(
        `O PDF gerou ${cards.length} ${cards.length === 1 ? "cartão" : "cartões"}. Deseja adicionar ao baralho atual? Você poderá revisar e editar cada cartão em seguida.`
      );
      if (!confirmed) {
        showToast("Importação cancelada");
        return;
      }
      addImportedCards(cards, "PDF");
      return;
    }

    const data = JSON.parse(await file.text());
    const rawCards = Array.isArray(data) ? data : Array.isArray(data?.cards) ? data.cards : null;
    const cards = normalizeImportedCards(rawCards);
    addImportedCards(cards, "JSON");
  } catch (error) {
    console.error("Falha ao importar cartões:", error);
    showToast(
      file.name.toLowerCase().endsWith(".pdf")
        ? "Não foi possível extrair cartões deste PDF"
        : "Arquivo JSON inválido para importar cartões"
    );
  }
}

function exportDeckCards() {
  const deck = currentDeck();
  const payload = {
    title: deck.title,
    topics: deck.topics || [],
    cards: deck.cards,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(deck.title)}-cartoes-${dateKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Cartões exportados");
}

elements.installButton.addEventListener("click", openInstallDialog);
elements.installDialogClose.addEventListener("click", closeInstallDialog);
elements.installDialog.addEventListener("click", (event) => {
  if (event.target === elements.installDialog) closeInstallDialog();
});
elements.installConfirmButton.addEventListener("click", () => void promptInstall());

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  setInstallButtonVisibility();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  elements.installButton.hidden = true;
  if (elements.installDialog.open) elements.installDialog.close();
  showToast("Trilha Flashcard instalado");
});

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
elements.openManageCardsButton.addEventListener("click", openManageCards);
elements.manageCardsClose.addEventListener("click", closeManageCards);
elements.manageCardsDialog.addEventListener("click", (event) => {
  if (event.target === elements.manageCardsDialog) closeManageCards();
});
elements.cardAddButton.addEventListener("click", () => openCardForm(null));
elements.cardFormCancel.addEventListener("click", closeCardForm);
elements.cardForm.addEventListener("submit", handleCardFormSubmit);
elements.cardImportButton.addEventListener("click", () => elements.cardImportInput.click());
elements.cardImportInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) void importCardsIntoCurrentDeck(file);
  event.target.value = "";
});
elements.cardExportDeckButton.addEventListener("click", exportDeckCards);
elements.cardListSearch.addEventListener("input", filterCardList);
elements.cardFormDiscipline.addEventListener("change", () => renderTopicOptions(""));
elements.cardFormTopic.addEventListener("change", checkTopicWarning);

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
  state.index = indices.includes(state.index) ? state.index : indices[0] ?? 0;
  state.flipped = false;
  render();
});

document.addEventListener("keydown", (event) => {
  if (elements.dashboardDialog.open || elements.manageCardsDialog.open || elements.installDialog.open) return;
  const isTypingTarget = event.target instanceof HTMLSelectElement
    || event.target instanceof HTMLInputElement
    || event.target instanceof HTMLTextAreaElement
    || event.target.isContentEditable;
  if (isTypingTarget) return;
  if (event.code === "Space") {
    if (event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    toggleCard();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    move(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
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
setInstallButtonVisibility();

renderDeckOptions();
render();
