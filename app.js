const THEME_STORAGE_KEY = "trilha-flashcard-theme";
const { dateKey, cardKey: buildCardKey, computeNextRating, isDue, isWrong, getStudyStreak: computeStudyStreak } = SpacedRepetition;

const PROFILES_KEY = "trilha-flashcard-profiles";
const ACTIVE_PROFILE_KEY = "trilha-flashcard-active-profile";
const DEFAULT_PROFILE_ID = CardStorage.DEFAULT_PROFILE_ID;
const DEFAULT_PROFILE_NAME = "TRT-4 · AJAJ";
const PROFILE_PRESETS = ["SEFAZ-RS", "Receita Federal", "ABIN"];

function loadProfileList() {
  try {
    const value = JSON.parse(localStorage.getItem(PROFILES_KEY) || "[]");
    return Array.isArray(value)
      ? value.filter((profile) => profile && typeof profile.id === "string" && typeof profile.name === "string")
      : [];
  } catch {
    return [];
  }
}

function saveProfileList(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function getAllProfiles() {
  return [{ id: DEFAULT_PROFILE_ID, name: DEFAULT_PROFILE_NAME, builtin: true }, ...loadProfileList()];
}

function getActiveProfileId() {
  const stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
  return stored && getAllProfiles().some((profile) => profile.id === stored) ? stored : DEFAULT_PROFILE_ID;
}

function scopedKey(baseKey, profileId) {
  return profileId === DEFAULT_PROFILE_ID ? baseKey : `${baseKey}::${profileId}`;
}

const activeProfileId = getActiveProfileId();
const STORAGE_KEY = scopedKey("trilha-flashcard-state", activeProfileId);
const TRASH_STORAGE_KEY = scopedKey("trilha-flashcard-trash", activeProfileId);

const deckStorage = CardStorage.createDeckStorage(localStorage, activeProfileId);
const decks = activeProfileId === DEFAULT_PROFILE_ID
  ? [...trt4Decks, ...deckStorage.loadCustomDecks()]
  : [...deckStorage.loadCustomDecks()];

function switchToProfile(profileId) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
  location.reload();
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createProfile(name) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const profiles = loadProfileList();
  const baseId = slugify(trimmed) || `perfil-${Date.now()}`;
  let id = baseId;
  let suffix = 2;
  const existingIds = new Set(getAllProfiles().map((profile) => profile.id));
  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  const profile = { id, name: trimmed, builtin: false };
  saveProfileList([...profiles, profile]);
  return profile;
}

function deleteProfile(profileId) {
  if (profileId === DEFAULT_PROFILE_ID) return;
  [
    scopedKey("trilha-flashcard-state", profileId),
    scopedKey("trilha-flashcard-trash", profileId),
    `${CardStorage.CUSTOM_DECKS_KEY}::${profileId}`,
  ].forEach((key) => localStorage.removeItem(key));
  saveProfileList(loadProfileList().filter((profile) => profile.id !== profileId));
  if (getActiveProfileId() === profileId) {
    localStorage.setItem(ACTIVE_PROFILE_KEY, DEFAULT_PROFILE_ID);
  }
}

function persistDeckCards(deck) {
  const entries = deckStorage.persistDecks([deck], decks);
  void CardDatabase.persistEntries([...entries]).catch((error) => console.warn("Falha no espelho IndexedDB", error));
  markCloudDirty();
}

(function applyBuiltinOverrides() {
  decks.forEach((deck) => {
    const override = deck.custom ? null : deckStorage.loadBuiltinOverride(deck.id);
    if (
      !deck.custom
      && Array.isArray(override)
      && (override.length > 0 || deck.cards.length === 0)
    ) {
      deck.cards = override;
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
  ratingActions: document.querySelector("#rating-actions"),
  again: document.querySelector("#again-button"),
  hard: document.querySelector("#hard-button"),
  good: document.querySelector("#good-button"),
  easy: document.querySelector("#easy-button"),
  simulatedActions: document.querySelector("#simulated-actions"),
  simulatedNextButton: document.querySelector("#simulated-next-button"),
  themeToggle: document.querySelector("#theme-toggle-button"),
  searchInput: document.querySelector("#search-input"),
  searchClear: document.querySelector("#search-clear"),
  searchResults: document.querySelector("#search-results"),
  topicSelect: document.querySelector("#topic-select"),
  dashboardButton: document.querySelector("#dashboard-button"),
  openStudySessionButton: document.querySelector("#open-study-session-button"),
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
  topicDashboardToday: document.querySelector("#topic-dashboard-today"),
  weeklyEvolution: document.querySelector("#weekly-evolution"),
  topicTableBody: document.querySelector("#topic-table-body"),
  topicTableEmpty: document.querySelector("#topic-table-empty"),
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
  trashButton: document.querySelector("#trash-button"),
  undoDeleteButton: document.querySelector("#undo-delete-button"),
  cardListSearch: document.querySelector("#card-list-search"),
  cardListDiscipline: document.querySelector("#card-list-discipline"),
  cardListTopic: document.querySelector("#card-list-topic-filter"),
  cardListPriority: document.querySelector("#card-list-priority"),
  cardListDifficulty: document.querySelector("#card-list-difficulty"),
  cardListSort: document.querySelector("#card-list-sort"),
  cardListResultCount: document.querySelector("#card-list-result-count"),
  cardListExpandAll: document.querySelector("#card-list-expand-all"),
  cardListCollapseAll: document.querySelector("#card-list-collapse-all"),
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
  importPreviewDialog: document.querySelector("#import-preview-dialog"),
  importPreviewClose: document.querySelector("#import-preview-close"),
  importPreviewCancel: document.querySelector("#import-preview-cancel"),
  importPreviewConfirm: document.querySelector("#import-preview-confirm"),
  importPreviewSummary: document.querySelector("#import-preview-summary"),
  importPreviewList: document.querySelector("#import-preview-list"),
  trashDialog: document.querySelector("#trash-dialog"),
  trashClose: document.querySelector("#trash-close"),
  trashList: document.querySelector("#trash-list"),
  studySessionDialog: document.querySelector("#study-session-dialog"),
  studySessionClose: document.querySelector("#study-session-close"),
  studySessionForm: document.querySelector("#study-session-form"),
  studySessionCount: document.querySelector("#study-session-count"),
  studySessionScope: document.querySelector("#study-session-scope"),
  studySessionPriority: document.querySelector("#study-session-priority"),
  studySessionDiscipline: document.querySelector("#study-session-discipline"),
  studySessionTopic: document.querySelector("#study-session-topic"),
  studySessionSimulated: document.querySelector("#study-session-simulated"),
  installButton: document.querySelector("#install-app-button"),
  installDialog: document.querySelector("#install-dialog"),
  installDialogClose: document.querySelector("#install-dialog-close"),
  installDialogIntro: document.querySelector("#install-dialog-intro"),
  installSteps: document.querySelector("#install-steps"),
  installConfirmButton: document.querySelector("#install-confirm-button"),
  toast: document.querySelector("#toast"),
  cloudSyncStatus: document.querySelector("#cloud-sync-status"),
  cloudSyncDetail: document.querySelector("#cloud-sync-detail"),
  cloudSignInButton: document.querySelector("#cloud-sign-in-button"),
  cloudSyncNowButton: document.querySelector("#cloud-sync-now-button"),
  cloudSignOutButton: document.querySelector("#cloud-sign-out-button"),
  cloudConflictDialog: document.querySelector("#cloud-conflict-dialog"),
  cloudUseLocalButton: document.querySelector("#cloud-use-local-button"),
  cloudUseRemoteButton: document.querySelector("#cloud-use-remote-button"),
  cloudConflictCancel: document.querySelector("#cloud-conflict-cancel"),
  studyArea: document.querySelector("#study-area"),
  emptyProfileState: document.querySelector("#empty-profile-state"),
  emptyProfileCreateButton: document.querySelector("#empty-profile-create-button"),
  newDisciplineButton: document.querySelector("#new-discipline-button"),
  newDisciplineDialog: document.querySelector("#new-discipline-dialog"),
  newDisciplineClose: document.querySelector("#new-discipline-close"),
  newDisciplineName: document.querySelector("#new-discipline-name"),
  newDisciplineTopics: document.querySelector("#new-discipline-topics"),
  newDisciplineCancel: document.querySelector("#new-discipline-cancel"),
  newDisciplineSave: document.querySelector("#new-discipline-save"),
  profileSwitchButton: document.querySelector("#profile-switch-button"),
  profilesDialog: document.querySelector("#profiles-dialog"),
  profilesClose: document.querySelector("#profiles-close"),
  profileList: document.querySelector("#profile-list"),
  profilePresets: document.querySelector("#profile-presets"),
  profileNewName: document.querySelector("#profile-new-name"),
  profileNewCreate: document.querySelector("#profile-new-create"),
  homeDashboard: document.querySelector("#home-dashboard"),
  homeGreeting: document.querySelector("#home-greeting"),
  homeCloudButton: document.querySelector("#home-cloud-button"),
  homeCloudStatus: document.querySelector("#home-cloud-status"),
  homeNewCount: document.querySelector("#home-new-count"),
  homeDueCount: document.querySelector("#home-due-count"),
  homeStreakCount: document.querySelector("#home-streak-count"),
  homeContinueButton: document.querySelector("#home-continue-button"),
  homeReviewEstimate: document.querySelector("#home-review-estimate"),
  homeDeckSearch: document.querySelector("#home-deck-search"),
  homeDeckList: document.querySelector("#home-deck-list"),
  homeStudySessionButton: document.querySelector("#home-study-session-button"),
  primaryNav: document.querySelector(".mobile-primary-nav"),
  homeMoreDialog: document.querySelector("#home-more-dialog"),
  homeMoreClose: document.querySelector("#home-more-close"),
  homeMoreSession: document.querySelector("#home-more-session"),
  homeMoreSync: document.querySelector("#home-more-sync"),
  homeMoreTheme: document.querySelector("#home-more-theme"),
  homeMoreInstall: document.querySelector("#home-more-install"),
  homeMoreProfile: document.querySelector("#home-more-profile"),
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
    : decks[0]?.id ?? null,
  index: Number.isInteger(savedState.index) ? savedState.index : 0,
  flipped: false,
  ratings: savedState.ratings && typeof savedState.ratings === "object" && !Array.isArray(savedState.ratings)
    ? savedState.ratings
    : {},
  activity: Array.isArray(savedState.activity)
    ? [...new Set(savedState.activity.filter((date) => typeof date === "string"))]
    : [],
  queueMode: null,
  customQueue: [],
  customSimulated: false,
  dailyReviewCounts: savedState.dailyReviewCounts && typeof savedState.dailyReviewCounts === "object" && !Array.isArray(savedState.dailyReviewCounts)
    ? savedState.dailyReviewCounts
    : {},
  topicFilter: "",
};

let trash = (() => {
  try {
    const value = JSON.parse(localStorage.getItem(TRASH_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
})();
let pendingImport = null;
const managerOpenTopics = new Set();

function persistTrash() {
  const value = JSON.stringify(trash.slice(-100));
  localStorage.setItem(TRASH_STORAGE_KEY, value);
  void CardDatabase.persistEntries([[TRASH_STORAGE_KEY, value]]).catch((error) => console.warn("Falha ao salvar lixeira", error));
  markCloudDirty();
}

let toastTimer;
let ratingAdvanceTimer = null;
let lastTopicDeckId = null;
let cloudAdapter = null;
let cloudUser = null;
let cloudReady = false;
let cloudSyncTimer = null;
let activeSurface = "home";

const CLOUD_META_KEY = "trilha-flashcard-cloud-meta";

function setCloudStatus(label, stateName = "local", detail = null) {
  if (!elements.cloudSyncStatus) return;
  elements.cloudSyncStatus.textContent = label;
  elements.cloudSyncStatus.dataset.state = stateName;
  if (elements.homeCloudStatus) {
    elements.homeCloudStatus.textContent = label;
    elements.homeCloudButton.dataset.state = stateName;
  }
  if (detail) elements.cloudSyncDetail.textContent = detail;
}

function readCloudMeta() {
  try { return JSON.parse(localStorage.getItem(CLOUD_META_KEY) || "null") || {}; }
  catch { return {}; }
}

function writeCloudMeta(meta) {
  localStorage.setItem(CLOUD_META_KEY, JSON.stringify(meta));
}

function markCloudDirty() {
  const meta = readCloudMeta();
  writeCloudMeta({ ...meta, dirty: true, localRevision: (Number(meta.localRevision) || 0) + 1 });
  if (!cloudReady || !cloudUser || !cloudAdapter) return;
  clearTimeout(cloudSyncTimer);
  setCloudStatus(navigator.onLine ? "Sincronizando…" : "Aguardando internet", "syncing");
  cloudSyncTimer = setTimeout(() => void uploadCloudSnapshot(), 1400);
}

async function uploadCloudSnapshot({ notify = false, force = false } = {}) {
  if (!cloudUser || !cloudAdapter) return;
  if (!navigator.onLine) {
    setCloudStatus("Aguardando internet", "syncing", "As alterações serão enviadas automaticamente quando a conexão voltar.");
    return;
  }
  try {
    setCloudStatus("Sincronizando…", "syncing");
    const snapshot = CloudSync.createSnapshot(localStorage);
    const meta = readCloudMeta();
    const updatedAtISO = await cloudAdapter.write(cloudUser.uid, snapshot, {
      expectedUpdatedAtISO: meta.uid === cloudUser.uid ? meta.remoteUpdatedAtISO || null : null,
      force,
    });
    writeCloudMeta({
      ...meta,
      uid: cloudUser.uid,
      remoteUpdatedAtISO: updatedAtISO,
      syncedFingerprint: CloudSync.snapshotFingerprint(snapshot),
      dirty: false,
    });
    cloudReady = true;
    setCloudStatus("Salvo", "saved", `Sincronizado com ${cloudUser.email || "sua conta Google"}.`);
    if (notify) showToast("Dados sincronizados na nuvem");
  } catch (error) {
    if (error?.message === "cloud-conflict") {
      cloudReady = false;
      setCloudStatus("Escolha necessária", "syncing", "A nuvem mudou em outro dispositivo.");
      await reconcileCloudData(cloudUser).catch(() => {});
      if (notify) showToast("Revise o conflito antes de sincronizar");
      return;
    }
    console.error("Falha na sincronização:", error);
    setCloudStatus("Falha ao sincronizar", "error", "Seus dados continuam seguros neste aparelho. Tente novamente quando estiver online.");
    if (notify) showToast("Não foi possível sincronizar agora");
  }
}

async function applyRemoteSnapshot(remote) {
  const rollback = CloudSync.createSnapshot(localStorage);
  try {
    sessionStorage.setItem("trilha-flashcard-cloud-rollback", JSON.stringify(rollback));
    CloudSync.applySnapshot(localStorage, remote.snapshot);
    await CardDatabase.replaceEntries(Object.entries(remote.snapshot.entries));
    writeCloudMeta({
      ...readCloudMeta(),
      uid: cloudUser.uid,
      remoteUpdatedAtISO: remote.updatedAtISO || "",
      syncedFingerprint: CloudSync.snapshotFingerprint(remote.snapshot),
      dirty: false,
    });
    location.reload();
  } catch (error) {
    CloudSync.applySnapshot(localStorage, rollback);
    await CardDatabase.replaceEntries(Object.entries(rollback.entries)).catch(() => {});
    console.error("Falha ao baixar dados da nuvem:", error);
    setCloudStatus("Falha ao restaurar", "error");
    showToast("Os dados deste aparelho não foram alterados");
  }
}

async function reconcileCloudData(user) {
  setCloudStatus("Verificando…", "syncing");
  const remote = await cloudAdapter.read(user.uid);
  const local = CloudSync.createSnapshot(localStorage);
  const meta = readCloudMeta();

  const action = CloudSync.reconciliationAction({ local, remote, meta, uid: user.uid });

  if (action === "upload") {
    cloudReady = true;
    await uploadCloudSnapshot();
    if (!remote?.snapshot) showToast("Dados deste aparelho enviados para a nuvem");
    return;
  }
  if (action === "download") {
    await applyRemoteSnapshot(remote);
    return;
  }
  if (action === "saved") {
    cloudReady = true;
    setCloudStatus("Salvo", "saved", `Sincronizado com ${user.email || "sua conta Google"}.`);
    return;
  }

  cloudReady = false;
  setCloudStatus("Escolha necessária", "syncing", "Há uma versão neste aparelho e outra na nuvem.");
  elements.cloudConflictDialog.showModal();
  elements.cloudUseLocalButton.focus();
  elements.cloudUseRemoteButton.onclick = () => {
    elements.cloudConflictDialog.close();
    void applyRemoteSnapshot(remote);
  };
}

function updateCloudButtons(user) {
  elements.cloudSignInButton.hidden = Boolean(user);
  elements.cloudSyncNowButton.hidden = !user;
  elements.cloudSignOutButton.hidden = !user;
}

async function initializeCloudSync() {
  try {
    cloudAdapter = await CloudSync.createFirebaseAdapter(globalThis.TrilhaFirebaseConfig);
    cloudAdapter.observeUser(async (user) => {
      cloudUser = user;
      updateCloudButtons(user);
      if (!user) {
        cloudReady = false;
        setCloudStatus("Somente neste aparelho", "local", "Entre com o Google para sincronizar entre dispositivos.");
        return;
      }
      try { await reconcileCloudData(user); }
      catch (error) {
        console.error("Falha ao verificar a nuvem:", error);
        setCloudStatus("Nuvem indisponível", "error", "Seus dados continuam seguros neste aparelho.");
      }
    });
  } catch (error) {
    const pendingConfiguration = error?.message === "firebase-not-configured";
    elements.cloudSignInButton.disabled = true;
    setCloudStatus(
      pendingConfiguration ? "Configuração pendente" : "Nuvem indisponível",
      pendingConfiguration ? "local" : "error",
      pendingConfiguration
        ? "A sincronização está pronta no aplicativo e aguarda a ativação do projeto Firebase."
        : "Seus dados continuam seguros neste aparelho."
    );
  }
}

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
  return decks.find((deck) => deck.id === state.deckId) ?? null;
}

function currentCard() {
  return currentDeck()?.cards[state.index] ?? null;
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
  if (!deck) return [];
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

  state.dailyReviewCounts[today] = (state.dailyReviewCounts[today] || 0) + 1;
  const cutoff = dateKey(new Date(Date.now() - 60 * 86400000));
  Object.keys(state.dailyReviewCounts).forEach((key) => {
    if (key < cutoff) delete state.dailyReviewCounts[key];
  });
}

function getLastNDaysCounts(days) {
  const result = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 86400000);
    const key = dateKey(date);
    result.push({ date: key, weekday: date.toLocaleDateString("pt-BR", { weekday: "short" }), count: state.dailyReviewCounts[key] || 0, isToday: offset === 0 });
  }
  return result;
}

function getStudyStreak() {
  return computeStudyStreak(state.activity);
}

function saveProgress() {
  const value = JSON.stringify({
    version: 2,
    deckId: state.deckId,
    index: state.index,
    ratings: state.ratings,
    activity: state.activity,
    dailyReviewCounts: state.dailyReviewCounts,
  });
  if (localStorage.getItem(STORAGE_KEY) === value) return;
  localStorage.setItem(STORAGE_KEY, value);
  void CardDatabase.persistEntries([[STORAGE_KEY, value]]).catch((error) => console.warn("Falha ao salvar progresso no IndexedDB", error));
  markCloudDirty();
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
  const ratingDisabled = isEmpty || ratingAdvanceTimer !== null;
  elements.again.disabled = ratingDisabled;
  elements.hard.disabled = ratingDisabled;
  elements.good.disabled = ratingDisabled;
  elements.easy.disabled = ratingDisabled;
  elements.simulatedNextButton.disabled = ratingDisabled;
  elements.previous.disabled = isEmpty;
  elements.next.disabled = isEmpty;

  const inSimulatedSession = state.queueMode === "custom" && state.customSimulated;
  elements.ratingActions.hidden = inSimulatedSession;
  elements.simulatedActions.hidden = !inSimulatedSession;

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

  renderTopicDashboard();
}

function getTopicStats() {
  const map = new Map();
  const now = Date.now();

  editalDecks().forEach((deck) => {
    deck.topics.forEach((topic) => {
      map.set(`${deck.id}::${topic}`, {
        deckTitle: deck.title,
        topic,
        total: 0,
        reviewed: 0,
        attempts: 0,
        remembered: 0,
        due: 0,
        priorityAPending: 0,
      });
    });
  });

  decks.forEach((deck) => {
    if (!Array.isArray(deck.topics) || !deck.topics.length) return;
    deck.cards.forEach((card) => {
      if (!card.topic) return;
      const key = `${deck.id}::${card.topic}`;
      let entry = map.get(key);
      if (!entry) {
        entry = { deckTitle: deck.title, topic: card.topic, total: 0, reviewed: 0, attempts: 0, remembered: 0, due: 0, priorityAPending: 0 };
        map.set(key, entry);
      }
      const rating = state.ratings[cardKey(deck, card)];
      entry.total += 1;
      if (rating?.attempts) {
        entry.reviewed += 1;
        entry.attempts += rating.attempts;
        entry.remembered += rating.remembered || 0;
      } else if (card.priority === "A") {
        entry.priorityAPending += 1;
      }
      if (isDue(rating, now)) entry.due += 1;
    });
  });

  return [...map.values()];
}

function renderTopicDashboard() {
  const today = dateKey();
  elements.topicDashboardToday.textContent = `${state.dailyReviewCounts[today] || 0} estudados hoje`;

  const days = getLastNDaysCounts(7);
  const maxCount = Math.max(1, ...days.map((day) => day.count));
  elements.weeklyEvolution.innerHTML = days.map((day) => `
    <div class="weekly-evolution-day ${day.isToday ? "is-today" : ""}">
      <div class="weekly-evolution-bar" style="height: ${Math.max(6, Math.round((day.count / maxCount) * 100))}%" title="${day.count} cartões"></div>
      <span class="weekly-evolution-label">${escapeHtml(day.weekday.replace(".", ""))}</span>
    </div>
  `).join("");

  const stats = getTopicStats().filter((entry) => entry.total > 0);
  const ranked = [...stats].sort((a, b) => {
    const accuracyA = a.attempts ? a.remembered / a.attempts : -1;
    const accuracyB = b.attempts ? b.remembered / b.attempts : -1;
    return accuracyA - accuracyB;
  });

  elements.topicTableEmpty.hidden = ranked.length > 0;
  elements.topicTableBody.innerHTML = ranked.map((entry) => {
    const accuracy = entry.attempts ? Math.round((entry.remembered / entry.attempts) * 100) : null;
    const isWeak = accuracy !== null && accuracy < 60;
    return `
      <div class="topic-table-row ${isWeak ? "is-weak" : ""}" role="row">
        <span class="topic-table-topic" role="cell">
          <strong>${escapeHtml(entry.topic)}</strong>
          <small>${escapeHtml(entry.deckTitle)} · ${entry.reviewed}/${entry.total} cartões</small>
        </span>
        <span role="cell">${accuracy === null ? "—" : `${accuracy}%`}</span>
        <span role="cell">${entry.due || "—"}</span>
        <span role="cell">${entry.priorityAPending || "—"}</span>
      </div>
    `;
  }).join("");
}


function cleanDeckTitle(title) {
  return String(title || "").split(" · ")[0];
}

function deckAccent(index) {
  return ["blue", "violet", "green", "amber"][index % 4];
}

function renderHomeDashboard() {
  if (!elements.homeDashboard) return;
  const entries = allCardEntries();
  const newCount = entries.filter(({ key }) => !state.ratings[key]?.attempts).length;
  const dueCount = getDueEntries().length;
  const streak = getStudyStreak();
  const query = String(elements.homeDeckSearch?.value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  elements.homeGreeting.textContent = `${greeting}, Valério`;
  elements.homeNewCount.textContent = String(newCount);
  elements.homeDueCount.textContent = String(dueCount);
  elements.homeStreakCount.textContent = String(streak);
  const reviewTotal = dueCount || Math.min(newCount, 20);
  elements.homeContinueButton.disabled = entries.length === 0;
  elements.homeReviewEstimate.textContent = reviewTotal
    ? `${reviewTotal} ${reviewTotal === 1 ? "cartão" : "cartões"} para revisar · ~${Math.max(2, Math.ceil(reviewTotal * 0.75))} min`
    : "Tudo em dia — você pode estudar um baralho";
  const visibleDecks = getDecksForDisplay().filter((deck) => {
    if (!query) return true;
    const haystack = [deck.title, ...(deck.topics || []), ...deck.cards.flatMap((card) => [card.front, card.topic, card.tag])].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return haystack.includes(query);
  });
  elements.homeDeckList.innerHTML = visibleDecks.length ? visibleDecks.map((deck, index) => {
    const stats = getDeckStats(deck);
    const due = deck.cards.filter((card) => isDue(state.ratings[cardKey(deck, card)], Date.now())).length;
    const fresh = deck.cards.filter((card) => !state.ratings[cardKey(deck, card)]?.attempts).length;
    const pending = due || fresh;
    const progress = deck.cards.length ? Math.round((stats.reviewed / deck.cards.length) * 100) : 0;
    return `
      <button class="home-deck-row ${deck.id === state.deckId ? "is-active" : ""}" type="button" data-home-deck="${escapeHtml(deck.id)}">
        <span class="home-deck-icon is-${deckAccent(index)}" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m4 7 8-4 8 4-8 4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></svg>
        </span>
        <span class="home-deck-copy">
          <strong>${escapeHtml(cleanDeckTitle(deck.title))}</strong>
          <small>${deck.cards.length} ${deck.cards.length === 1 ? "cartão" : "cartões"} · <em>${pending} para revisar</em></small>
          <span class="home-deck-progress" aria-hidden="true"><i style="width:${progress}%"></i></span>
        </span>
        <svg class="home-deck-arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    `;
  }).join("") : '<p class="home-deck-empty">Nenhum baralho encontrado.</p>';
  elements.homeDeckList.querySelectorAll("[data-home-deck]").forEach((button) => {
    button.addEventListener("click", () => openDeckFromHome(button.dataset.homeDeck));
  });
}

function setActiveSurface(surface) {
  activeSurface = surface;
  const showHome = surface === "home";
  document.body.classList.toggle("home-active", showHome);
  elements.homeDashboard.hidden = !showHome;
  elements.studyArea.hidden = showHome || decks.length === 0;
  elements.primaryNav?.querySelectorAll("[data-home-nav]").forEach((button) => {
    const selected = (showHome && button.dataset.homeNav === "home") || (!showHome && button.dataset.homeNav === "home");
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (showHome) renderHomeDashboard();
}

function openDeckFromHome(deckId) {
  const deck = decks.find((entry) => entry.id === deckId);
  if (!deck) return;
  state.deckId = deck.id;
  state.index = 0;
  state.flipped = false;
  state.queueMode = null;
  state.topicFilter = "";
  render();
  setActiveSurface("study");
}

function continueFromHome() {
  const first = getDueEntries()[0] || allCardEntries()[0];
  if (!first) return;
  state.queueMode = getDueEntries().length ? "due" : null;
  goToEntry(first);
  setActiveSurface("study");
  showToast(state.queueMode === "due" ? "Revisão do dia iniciada" : "Estudo iniciado");
}

function openHomeMore() {
  elements.homeMoreDialog.showModal();
  elements.homeMoreClose.focus();
}

function closeHomeMore() {
  if (elements.homeMoreDialog.open) elements.homeMoreDialog.close();
}

function render() {
  if (decks.length === 0) {
    elements.studyArea.hidden = true;
    elements.emptyProfileState.hidden = false;
    return;
  }
  elements.studyArea.hidden = false;
  elements.emptyProfileState.hidden = true;

  state.index = Math.min(Math.max(state.index, 0), Math.max(currentDeck().cards.length - 1, 0));
  elements.deckSelect.value = state.deckId;
  elements.deckSourceNote.textContent = currentDeck().sourceNote || "";
  syncTopicOptions();
  renderProgress();
  renderCard();
  renderDashboard();
  renderHomeDashboard();
  if (activeSurface === "home") elements.studyArea.hidden = true;
  saveProgress();
}

function updateTopbarAvailability() {
  const hasDecks = decks.length > 0;
  elements.dashboardButton.disabled = !hasDecks;
  elements.openManageCardsButton.disabled = !hasDecks;
  elements.shuffle.disabled = !hasDecks;
  elements.openStudySessionButton.disabled = !hasDecks;
}

function getActiveProfile() {
  return getAllProfiles().find((profile) => profile.id === activeProfileId) || getAllProfiles()[0];
}

function renderProfileSwitchButton() {
  elements.profileSwitchButton.textContent = getActiveProfile().name;
}

function renderProfilesDialog() {
  const profiles = getAllProfiles();
  elements.profileList.innerHTML = profiles.map((profile) => `
    <article class="profile-row ${profile.id === activeProfileId ? "is-active" : ""}">
      <span class="profile-row-name">
        ${escapeHtml(profile.name)}
        ${profile.id === activeProfileId ? '<span class="profile-row-badge">ATIVO</span>' : ""}
      </span>
      <span class="profile-row-actions">
        ${profile.id === activeProfileId ? "" : `<button type="button" class="data-button" data-activate-profile="${escapeHtml(profile.id)}">Ativar</button>`}
        ${profile.builtin ? "" : `<button type="button" class="deck-remove-button" data-delete-profile="${escapeHtml(profile.id)}" aria-label="Excluir perfil ${escapeHtml(profile.name)}">✕</button>`}
      </span>
    </article>
  `).join("");

  elements.profileList.querySelectorAll("[data-activate-profile]").forEach((button) => {
    button.addEventListener("click", () => switchToProfile(button.dataset.activateProfile));
  });
  elements.profileList.querySelectorAll("[data-delete-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      const profile = profiles.find((entry) => entry.id === button.dataset.deleteProfile);
      if (!profile) return;
      if (!window.confirm(`Excluir o perfil "${profile.name}"? Todas as disciplinas, cartões e o desempenho dele serão apagados.`)) return;
      const wasActive = profile.id === activeProfileId;
      deleteProfile(profile.id);
      if (wasActive) {
        location.reload();
        return;
      }
      renderProfilesDialog();
    });
  });

  elements.profilePresets.innerHTML = PROFILE_PRESETS
    .filter((preset) => !profiles.some((profile) => profile.name === preset))
    .map((preset) => `<button type="button" class="data-button" data-preset="${escapeHtml(preset)}">${escapeHtml(preset)}</button>`)
    .join("");
  elements.profilePresets.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.profileNewName.value = button.dataset.preset;
      elements.profileNewName.focus();
    });
  });
}

function openProfilesDialog() {
  elements.profileNewName.value = "";
  renderProfilesDialog();
  elements.profilesDialog.showModal();
  elements.profilesDialog.scrollTop = 0;
  elements.profilesClose.focus();
}

function closeProfilesDialog() {
  if (elements.profilesDialog.open) elements.profilesDialog.close();
  elements.profileSwitchButton.focus();
}

function createProfileAndActivate() {
  const profile = createProfile(elements.profileNewName.value);
  if (!profile) {
    showToast("Informe o nome do novo perfil");
    return;
  }
  switchToProfile(profile.id);
}

function openNewDisciplineDialog() {
  elements.newDisciplineName.value = "";
  elements.newDisciplineTopics.value = "";
  elements.newDisciplineDialog.showModal();
  elements.newDisciplineDialog.scrollTop = 0;
  elements.newDisciplineName.focus();
}

function closeNewDisciplineDialog() {
  if (elements.newDisciplineDialog.open) elements.newDisciplineDialog.close();
}

function createNewDiscipline() {
  const name = elements.newDisciplineName.value.trim();
  if (!name) {
    showToast("Informe o nome da disciplina");
    return;
  }
  const topics = elements.newDisciplineTopics.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!topics.length) {
    showToast("Informe ao menos um assunto para esta disciplina");
    return;
  }
  const baseId = slugify(name) || `disciplina-${Date.now()}`;
  let id = baseId;
  let suffix = 2;
  while (decks.some((deck) => deck.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const deck = { id, title: name, custom: true, topics, cards: [] };
  decks.push(deck);
  persistDeckCards(deck);
  state.deckId = deck.id;
  state.index = 0;
  lastTopicDeckId = null;
  closeNewDisciplineDialog();
  updateTopbarAvailability();
  renderDeckOptions();
  render();
  showToast(`Disciplina "${name}" criada`);
}

const dialogStack = [];
document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("close", () => {
    const index = dialogStack.indexOf(dialog);
    if (index !== -1) dialogStack.splice(index, 1);
  });
});
const nativeShowModal = HTMLDialogElement.prototype.showModal;
HTMLDialogElement.prototype.showModal = function trackedShowModal(...args) {
  const index = dialogStack.indexOf(this);
  if (index !== -1) dialogStack.splice(index, 1);
  dialogStack.push(this);
  return nativeShowModal.apply(this, args);
};

function toastHost() {
  for (let index = dialogStack.length - 1; index >= 0; index -= 1) {
    if (dialogStack[index].open) return dialogStack[index];
  }
  return document.body;
}

function showToast(message) {
  const host = toastHost();
  if (elements.toast.parentElement !== host) host.appendChild(elements.toast);
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

const RATING_TOASTS = {
  again: "Tudo bem — veremos novamente amanhã",
  hard: "Anotado — revisão mais próxima",
  good: "Boa — revisão agendada",
  easy: "Ótimo — revisão mais espaçada",
};

function rateCard(rating) {
  const key = currentCardKey();
  if (!key || ratingAdvanceTimer !== null) return;
  const now = new Date();
  state.ratings[key] = computeNextRating(state.ratings[key], rating, now);
  elements.again.disabled = true;
  elements.hard.disabled = true;
  elements.good.disabled = true;
  elements.easy.disabled = true;
  registerActivity();
  renderProgress();
  renderDashboard();
  saveProgress();
  showToast(RATING_TOASTS[rating] || RATING_TOASTS.good);

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

    const queue = state.queueMode === "custom"
      ? state.customQueue.filter((entry) => entry.key !== key)
      : state.queueMode === "wrong" ? getWrongEntries() : getDueEntries();
    if (state.queueMode === "custom") state.customQueue = queue;
    const nextEntry = queue[0];
    if (nextEntry) {
      goToEntry(nextEntry);
      return;
    }

    const finishedMessage = state.queueMode === "custom"
      ? "Sessão personalizada concluída"
      : state.queueMode === "wrong" ? "Cartões errados revisados" : "Revisões do dia concluídas";
    state.queueMode = null;
    state.customSimulated = false;
    move(1);
    showToast(finishedMessage);
  }, 320);
}

function advanceSimulatedSession() {
  if (state.queueMode !== "custom" || !state.customSimulated || ratingAdvanceTimer !== null) return;
  const key = currentCardKey();
  ratingAdvanceTimer = window.setTimeout(() => {
    ratingAdvanceTimer = null;
    state.customQueue = state.customQueue.filter((entry) => entry.key !== key);
    const nextEntry = state.customQueue[0];
    if (nextEntry) {
      goToEntry(nextEntry);
      return;
    }
    state.queueMode = null;
    state.customSimulated = false;
    move(1);
    showToast("Simulado concluído");
  }, 200);
  renderCard();
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

function renderStudySessionDisciplineOptions() {
  const options = [{ value: "", label: "Todas as disciplinas" }].concat(
    decks.filter((deck) => deck.cards.length > 0).map((deck) => ({ value: deck.id, label: deck.title }))
  );
  replaceSelectOptions(elements.studySessionDiscipline, options);
}

function renderStudySessionTopicOptions() {
  const deck = decks.find((entry) => entry.id === elements.studySessionDiscipline.value);
  const topics = deck ? getUniqueTopics(deck) : [];
  replaceSelectOptions(elements.studySessionTopic, [
    { value: "", label: "Todos os assuntos" },
    ...topics.map((topic) => ({ value: topic, label: topic })),
  ]);
  elements.studySessionTopic.disabled = !deck || topics.length === 0;
}

function openStudySession() {
  renderStudySessionDisciplineOptions();
  elements.studySessionDiscipline.value = "";
  renderStudySessionTopicOptions();
  elements.studySessionSimulated.checked = false;
  elements.studySessionDialog.showModal();
  elements.studySessionClose.focus();
}

function buildCustomSession(event) {
  event.preventDefault();
  const scope = elements.studySessionScope.value;
  const priority = elements.studySessionPriority.value;
  const disciplineId = elements.studySessionDiscipline.value;
  const topic = elements.studySessionTopic.value;
  const simulated = elements.studySessionSimulated.checked;
  const count = Number(elements.studySessionCount.value);
  let entries = allCardEntries();
  if (disciplineId) entries = entries.filter(({ deck }) => deck.id === disciplineId);
  if (topic) entries = entries.filter(({ card }) => card.topic === topic);
  if (scope === "new") entries = entries.filter(({ key }) => !state.ratings[key]?.attempts);
  if (scope === "wrong") entries = entries.filter(({ key }) => isWrong(state.ratings[key]));
  if (scope === "due") entries = entries.filter(({ key }) => isDue(state.ratings[key]));
  if (priority) entries = entries.filter(({ card }) => card.priority === priority);
  entries.sort(() => Math.random() - 0.5);
  state.customQueue = entries.slice(0, count);
  if (!state.customQueue.length) {
    showToast("Nenhum cartão corresponde aos filtros");
    return;
  }
  state.queueMode = "custom";
  state.customSimulated = simulated;
  elements.studySessionDialog.close();
  goToEntry(state.customQueue[0]);
  showToast(`Sessão iniciada com ${state.customQueue.length} cartões${simulated ? " (modo simulado)" : ""}`);
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
    version: 3,
    kind: "trilha-flashcard-full-backup",
    exportedAt: new Date().toISOString(),
    deckId: state.deckId,
    index: state.index,
    ratings: state.ratings,
    activity: state.activity,
    decks: decks.map((deck) => ({
      id: deck.id,
      title: deck.title,
      custom: Boolean(deck.custom),
      topics: deck.topics || [],
      cards: deck.cards,
    })),
    trash,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trilha-flashcard-backup-completo-${dateKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Backup completo baixado");
}

async function importProgress(file) {
    try {
      const data = JSON.parse(await file.text());
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
      if (Array.isArray(data.decks)) {
        data.decks.forEach((savedDeck) => {
          let deck = decks.find((entry) => entry.id === savedDeck.id);
          if (!deck && savedDeck.custom && Array.isArray(savedDeck.cards)) {
            deck = { id: savedDeck.id, title: savedDeck.title || "Baralho restaurado", custom: true, topics: savedDeck.topics || [], cards: [] };
            decks.push(deck);
          }
          if (deck && Array.isArray(savedDeck.cards)) deck.cards = savedDeck.cards;
        });
        const entries = deckStorage.persistDecks(decks, decks);
        await CardDatabase.persistEntries([...entries]);
      }
      trash = Array.isArray(data.trash) ? data.trash.slice(-100) : trash;
      persistTrash();
      state.flipped = false;
      state.queueMode = null;
      renderDeckOptions();
      render();
      showToast("Backup completo restaurado");
    } catch {
      showToast("Backup inválido ou incompatível");
    }
}

function removeCustomDeck(deckId) {
  const deck = decks.find((entry) => entry.id === deckId && entry.custom);
  if (!deck) return;
  if (!window.confirm(`Remover o baralho "${deck.title}"? O progresso salvo dele também será apagado.`)) return;

  decks.splice(decks.indexOf(deck), 1);
  deck.cards.forEach((card) => {
    delete state.ratings[buildCardKey(deck.id, card.front)];
  });
  persistDeckCards(deck);

  if (state.deckId === deckId) {
    state.deckId = decks[0]?.id ?? null;
    state.index = 0;
  }
  updateTopbarAvailability();
  renderDeckOptions();
  render();
  showToast("Baralho removido");
}

function openManageCards() {
  closeDashboard();
  elements.cardListSearch.value = "";
  elements.cardListTopic.value = "";
  elements.cardListPriority.value = "";
  elements.cardListDifficulty.value = "";
  elements.cardListSort.value = "original";
  managerOpenTopics.clear();
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

function renderManagerFilters(deck) {
  replaceSelectOptions(elements.cardListDiscipline, decks.map((entry) => ({
    value: entry.id,
    label: `${entry.title} (${entry.cards.length})`,
  })));
  elements.cardListDiscipline.value = deck.id;

  const previousTopic = elements.cardListTopic.value;
  const topics = [...new Set(deck.cards.map((card) => card.topic || "Sem assunto"))]
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
  replaceSelectOptions(elements.cardListTopic, [
    { value: "", label: "Todos os assuntos" },
    ...topics.map((topic) => ({ value: topic, label: topic })),
  ]);
  elements.cardListTopic.value = topics.includes(previousTopic) ? previousTopic : "";
}

function managerFilters() {
  return {
    query: elements.cardListSearch.value,
    topic: elements.cardListTopic.value,
    priority: elements.cardListPriority.value,
    difficulty: elements.cardListDifficulty.value,
    sort: elements.cardListSort.value,
  };
}

function renderManageCards() {
  const deck = currentDeck();
  renderManagerFilters(deck);
  elements.trashButton.textContent = `Lixeira (${trash.length})`;
  elements.undoDeleteButton.hidden = trash.length === 0;
  elements.manageCardsKicker.textContent = deck.title.toUpperCase();

  const result = CardManager.organizeCards(deck.cards, managerFilters());
  elements.manageCardsSummary.textContent = deck.cards.length
    ? `${deck.cards.length} ${deck.cards.length === 1 ? "cartão" : "cartões"} neste baralho.`
    : "Nenhum cartão neste baralho ainda.";
  const coverage = getTopicCoverage(deck);
  if (coverage) {
    elements.manageCardsSummary.textContent += ` ${coverage.covered} de ${coverage.total} assuntos do edital com cartão.`;
  }
  elements.cardListResultCount.textContent = result.filtered === result.total
    ? `${result.total} ${result.total === 1 ? "cartão" : "cartões"}`
    : `${result.filtered} de ${result.total} cartões`;

  const filters = managerFilters();
  const forceOpen = Boolean(filters.query.trim() || filters.topic || filters.priority || filters.difficulty);
  elements.cardList.innerHTML = result.groups.length
    ? result.groups.map((group) => {
        const isOpen = forceOpen || managerOpenTopics.has(group.name);
        const rows = group.entries.map(({ card, index }) => `
          <article class="card-list-row">
            <div class="card-list-row-main">
              <span class="card-list-front">${escapeHtml(card.front)}</span>
              <span class="card-list-topic">${[card.subtopic, card.type, card.priority ? `Prioridade ${card.priority}` : "", card.difficulty, card.legalBasis].filter(Boolean).map(escapeHtml).join(" · ") || "sem classificação"}</span>
            </div>
            <div class="card-list-row-actions">
              <button type="button" class="data-button card-edit-button" data-edit-card="${index}">Editar</button>
              <details class="card-row-menu">
                <summary aria-label="Mais ações para este cartão">•••</summary>
                <button type="button" data-delete-card="${index}">Excluir cartão</button>
              </details>
            </div>
          </article>`).join("");
        return `
          <details class="card-topic-group" data-topic="${escapeHtml(group.name)}" ${isOpen ? "open" : ""}>
            <summary>
              <span>${escapeHtml(group.name)}</span>
              <strong>${group.entries.length} ${group.entries.length === 1 ? "cartão" : "cartões"}</strong>
            </summary>
            <div class="card-topic-cards">${rows}</div>
          </details>`;
      }).join("")
    : `<p class="card-list-empty">${deck.cards.length ? "Nenhum cartão corresponde aos filtros." : 'Nenhum cartão ainda. Use "Adicionar cartão" ou "Importar cartões" para começar.'}</p>`;

  elements.cardList.querySelectorAll(".card-topic-group").forEach((group) => {
    group.addEventListener("toggle", () => {
      const topic = group.dataset.topic;
      if (group.open) managerOpenTopics.add(topic);
      else managerOpenTopics.delete(topic);
    });
  });
  elements.cardList.querySelectorAll("[data-edit-card]").forEach((button) => {
    button.addEventListener("click", () => openCardForm(Number(button.dataset.editCard)));
  });
  elements.cardList.querySelectorAll("[data-delete-card]").forEach((button) => {
    button.addEventListener("click", () => deleteCard(Number(button.dataset.deleteCard)));
  });
}

function filterCardList() {
  renderManageCards();
}

function changeManagerDiscipline() {
  const deck = decks.find((entry) => entry.id === elements.cardListDiscipline.value);
  if (!deck || deck.id === state.deckId) return;
  state.deckId = deck.id;
  state.index = 0;
  state.flipped = false;
  state.topicFilter = "";
  elements.cardListTopic.value = "";
  managerOpenTopics.clear();
  renderDeckOptions();
  lastTopicDeckId = null;
  render();
  renderManageCards();
}

function setAllManagerGroups(open) {
  elements.cardList.querySelectorAll(".card-topic-group").forEach((group) => {
    group.open = open;
    if (open) managerOpenTopics.add(group.dataset.topic);
    else managerOpenTopics.delete(group.dataset.topic);
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
  trash.push({ id: `${Date.now()}-${Math.random()}`, deckId: deck.id, index, card, deletedAt: new Date().toISOString() });
  persistTrash();
  deck.cards.splice(index, 1);
  persistDeckCards(deck);
  renderManageCards();
  lastTopicDeckId = null;
  render();
  showToast("Cartão movido para a lixeira");
}

function restoreTrashItem(itemId = null) {
  const trashIndex = itemId ? trash.findIndex((item) => item.id === itemId) : trash.length - 1;
  const item = trash[trashIndex];
  if (!item) return;
  const deck = decks.find((entry) => entry.id === item.deckId);
  if (!deck) return;
  deck.cards.splice(Math.min(item.index, deck.cards.length), 0, item.card);
  trash.splice(trashIndex, 1);
  persistTrash();
  persistDeckCards(deck);
  lastTopicDeckId = null;
  render();
  renderManageCards();
  renderTrash();
  showToast("Cartão restaurado");
}

function renderTrash() {
  elements.trashList.innerHTML = trash.length
    ? [...trash].reverse().map((item) => `
      <article class="card-list-row">
        <div class="card-list-row-main"><span class="card-list-front">${escapeHtml(item.card.front)}</span><span class="card-list-topic">${escapeHtml(decks.find((deck) => deck.id === item.deckId)?.title || item.deckId)}</span></div>
        <button class="data-button" type="button" data-restore-trash="${escapeHtml(item.id)}">Restaurar</button>
      </article>`).join("")
    : '<p class="card-list-empty">A lixeira está vazia.</p>';
  elements.trashList.querySelectorAll("[data-restore-trash]").forEach((button) => {
    button.addEventListener("click", () => restoreTrashItem(button.dataset.restoreTrash));
  });
}

const PDFJS_MODULE_URL = "./vendor/pdf.mjs?v=4.10.38";
const PDFJS_WORKER_URL = "./vendor/pdf.worker.mjs?v=4.10.38";
const { normalizeImportedCards, parseLabeledPdfCards, parsePdfPageFallback } = CardImport;

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

function normalizeDeckName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*·\s*[\d,]+\s*%.*$/, "")
    .trim()
    .toLowerCase();
}

function findImportTarget(card, fallbackDeck) {
  if (!card.discipline) return fallbackDeck;
  const requested = normalizeDeckName(card.discipline);
  return decks.find((deck) => deck.id === card.discipline || normalizeDeckName(deck.title) === requested) || fallbackDeck;
}

function openImportPreview(cards, sourceLabel) {
  pendingImport = { cards, sourceLabel };
  const duplicates = cards.filter((card) => {
    const deck = findImportTarget(card, currentDeck());
    return deck.cards.some((existing) => existing.front.trim().toLowerCase() === card.front.trim().toLowerCase());
  }).length;
  elements.importPreviewSummary.textContent = `${cards.length} cartões encontrados${duplicates ? ` · ${duplicates} repetidos serão ignorados` : ""}. Desmarque o que não deseja importar.`;
  elements.importPreviewList.innerHTML = cards.map((card, index) => {
    const deck = findImportTarget(card, currentDeck());
    return `<label class="import-preview-row"><input type="checkbox" data-import-index="${index}" checked><span><strong>${escapeHtml(card.front)}</strong><small>${escapeHtml(deck.title)}${card.topic ? ` · ${escapeHtml(card.topic)}` : ""}</small></span></label>`;
  }).join("");
  elements.importPreviewDialog.showModal();
}

async function addImportedCards(cards, sourceLabel) {
  if (!cards.length) throw new Error("empty");

  const fallbackDeck = currentDeck();
  const changedDecks = new Set();
  const snapshots = new Map();
  let added = 0;
  let duplicates = 0;
  cards.forEach((importedCard) => {
    const deck = findImportTarget(importedCard, fallbackDeck);
    const { discipline, ...card } = importedCard;
    const duplicate = deck.cards.some((existing) => existing.front.trim().toLowerCase() === card.front.trim().toLowerCase());
    if (duplicate) {
      duplicates += 1;
      return;
    }
    if (!snapshots.has(deck)) snapshots.set(deck, deck.cards.slice());
    deck.cards.push(card);
    changedDecks.add(deck);
    added += 1;
  });
  try {
    const entries = deckStorage.persistDecks(changedDecks, decks);
    await CardDatabase.persistEntries([...entries]);
  } catch (error) {
    snapshots.forEach((snapshot, deck) => {
      deck.cards = snapshot;
    });
    try { deckStorage.persistDecks(changedDecks, decks); } catch {}
    throw new Error("storage-failed", { cause: error });
  }
  renderManageCards();
  lastTopicDeckId = null;
  render();
  const duplicateMessage = duplicates ? `; ${duplicates} repetido${duplicates === 1 ? " ignorado" : "s ignorados"}` : "";
  showToast(`${added} ${added === 1 ? "cartão importado" : "cartões importados"} do ${sourceLabel}${duplicateMessage}`);
}

async function importCardsIntoCurrentDeck(file) {
  const originalLabel = elements.cardImportButton.textContent;
  elements.cardImportButton.disabled = true;
  elements.cardImportButton.textContent = "Importando...";
  try {
    if (file.size > 25 * 1024 * 1024) throw new Error("file-too-large");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      showToast("Lendo e convertendo o PDF...");
      const cards = await extractCardsFromPdf(file);
      if (!cards.length) throw new Error("empty-pdf");
      openImportPreview(cards, "PDF");
      return;
    }

    const data = JSON.parse(await file.text());
    const rawCards = Array.isArray(data)
      ? data
      : Array.isArray(data?.cards)
        ? data.cards
        : Array.isArray(data?.decks)
          ? data.decks.flatMap((deck) => Array.isArray(deck?.cards)
            ? deck.cards.map((card) => ({ ...card, discipline: card.discipline || deck.id || deck.title }))
            : [])
          : null;
    const cards = normalizeImportedCards(rawCards);
    openImportPreview(cards, "JSON");
  } catch (error) {
    console.error("Falha ao importar cartões:", error);
    showToast(
      error.message === "file-too-large"
        ? "Arquivo muito grande — limite de 25 MB"
        : error.message === "storage-failed"
          ? "Não foi possível salvar os cartões. Libere espaço no navegador e tente novamente"
        : file.name.toLowerCase().endsWith(".pdf")
          ? "PDF sem texto reconhecível ou formato incompatível"
          : "JSON inválido: use os campos pergunta/resposta ou front/back"
    );
  } finally {
    elements.cardImportButton.disabled = false;
    elements.cardImportButton.textContent = originalLabel;
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
elements.cloudSignInButton.addEventListener("click", async () => {
  try { await cloudAdapter?.signIn(); }
  catch (error) {
    if (error?.code !== "auth/popup-closed-by-user") {
      console.error("Falha no login Google:", error);
      showToast("Não foi possível entrar com o Google");
    }
  }
});
elements.cloudSyncNowButton.addEventListener("click", () => void uploadCloudSnapshot({ notify: true }));
elements.cloudSignOutButton.addEventListener("click", async () => {
  clearTimeout(cloudSyncTimer);
  await cloudAdapter?.signOut();
  showToast("Sincronização desconectada");
});
elements.cloudUseLocalButton.addEventListener("click", async () => {
  elements.cloudConflictDialog.close();
  cloudReady = true;
  await uploadCloudSnapshot({ notify: true, force: true });
});
elements.cloudConflictCancel.addEventListener("click", () => elements.cloudConflictDialog.close());
window.addEventListener("online", () => {
  if (!cloudUser) return;
  if (cloudReady) void uploadCloudSnapshot();
  else void reconcileCloudData(cloudUser).catch(() => setCloudStatus("Nuvem indisponível", "error"));
});
window.addEventListener("offline", () => {
  if (cloudUser) setCloudStatus("Aguardando internet", "syncing", "As alterações serão sincronizadas quando a conexão voltar.");
});

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


elements.homeContinueButton.addEventListener("click", continueFromHome);
elements.homeDeckSearch.addEventListener("input", renderHomeDashboard);
elements.homeStudySessionButton.addEventListener("click", openStudySession);
elements.homeCloudButton.addEventListener("click", () => {
  if (cloudUser) void uploadCloudSnapshot({ notify: true });
  else openDashboard();
});
elements.primaryNav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-home-nav]");
  if (!button) return;
  const action = button.dataset.homeNav;
  if (action === "home") setActiveSurface("home");
  if (action === "decks") {
    setActiveSurface("home");
    elements.homeDeckSearch.focus();
  }
  if (action === "cards") openManageCards();
  if (action === "progress") openDashboard();
  if (action === "more") openHomeMore();
});
elements.homeMoreClose.addEventListener("click", closeHomeMore);
elements.homeMoreDialog.addEventListener("click", (event) => {
  if (event.target === elements.homeMoreDialog) closeHomeMore();
});
elements.homeMoreSession.addEventListener("click", () => { closeHomeMore(); openStudySession(); });
elements.homeMoreSync.addEventListener("click", () => { closeHomeMore(); openDashboard(); });
elements.homeMoreTheme.addEventListener("click", () => { elements.themeToggle.click(); });
elements.homeMoreInstall.addEventListener("click", () => { closeHomeMore(); openInstallDialog(); });
elements.homeMoreProfile.addEventListener("click", () => { closeHomeMore(); elements.profileSwitchButton.click(); });

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
elements.again.addEventListener("click", () => rateCard("again"));
elements.hard.addEventListener("click", () => rateCard("hard"));
elements.good.addEventListener("click", () => rateCard("good"));
elements.easy.addEventListener("click", () => rateCard("easy"));
elements.simulatedNextButton.addEventListener("click", advanceSimulatedSession);
elements.dashboardButton.addEventListener("click", openDashboard);
elements.openStudySessionButton.addEventListener("click", openStudySession);
elements.studySessionClose.addEventListener("click", () => elements.studySessionDialog.close());
elements.studySessionForm.addEventListener("submit", buildCustomSession);
elements.studySessionDiscipline.addEventListener("change", () => renderStudySessionTopicOptions());
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
elements.trashButton.addEventListener("click", () => { renderTrash(); elements.trashDialog.showModal(); });
elements.trashClose.addEventListener("click", () => elements.trashDialog.close());
elements.undoDeleteButton.addEventListener("click", () => restoreTrashItem());
elements.profileSwitchButton.addEventListener("click", openProfilesDialog);
elements.profilesClose.addEventListener("click", closeProfilesDialog);
elements.profileNewCreate.addEventListener("click", createProfileAndActivate);
elements.profilesDialog.addEventListener("click", (event) => {
  if (event.target === elements.profilesDialog) closeProfilesDialog();
});
elements.newDisciplineButton.addEventListener("click", openNewDisciplineDialog);
elements.emptyProfileCreateButton.addEventListener("click", openNewDisciplineDialog);
elements.newDisciplineClose.addEventListener("click", closeNewDisciplineDialog);
elements.newDisciplineCancel.addEventListener("click", closeNewDisciplineDialog);
elements.newDisciplineSave.addEventListener("click", createNewDiscipline);
elements.newDisciplineDialog.addEventListener("click", (event) => {
  if (event.target === elements.newDisciplineDialog) closeNewDisciplineDialog();
});
elements.importPreviewClose.addEventListener("click", () => elements.importPreviewDialog.close());
elements.importPreviewCancel.addEventListener("click", () => { pendingImport = null; elements.importPreviewDialog.close(); showToast("Importação cancelada"); });
elements.importPreviewConfirm.addEventListener("click", async () => {
  if (!pendingImport) return;
  const cards = [...elements.importPreviewList.querySelectorAll("[data-import-index]:checked")]
    .map((input) => pendingImport.cards[Number(input.dataset.importIndex)]);
  if (!cards.length) { showToast("Selecione pelo menos um cartão"); return; }
  const { sourceLabel } = pendingImport;
  elements.importPreviewConfirm.disabled = true;
  try {
    await addImportedCards(cards, sourceLabel);
    pendingImport = null;
    elements.importPreviewDialog.close();
  } catch (error) {
    console.error(error);
    showToast("Não foi possível salvar os cartões");
  } finally { elements.importPreviewConfirm.disabled = false; }
});
elements.cardListSearch.addEventListener("input", filterCardList);
elements.cardListDiscipline.addEventListener("change", changeManagerDiscipline);
[elements.cardListTopic, elements.cardListPriority, elements.cardListDifficulty, elements.cardListSort]
  .forEach((control) => control.addEventListener("change", filterCardList));
elements.cardListExpandAll.addEventListener("click", () => setAllManagerGroups(true));
elements.cardListCollapseAll.addEventListener("click", () => setAllManagerGroups(false));
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
  if (
    elements.dashboardDialog.open
    || elements.manageCardsDialog.open
    || elements.installDialog.open
    || elements.importPreviewDialog.open
    || elements.trashDialog.open
    || elements.studySessionDialog.open
    || elements.profilesDialog.open
    || elements.newDisciplineDialog.open
  ) return;
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
    navigator.serviceWorker
      .register("sw.js?v=20260823-1", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {});
  });
}

setActiveSurface("home");
void initializeCloudSync();

const explicitTheme = document.documentElement.getAttribute("data-theme");
const effectiveDark = explicitTheme === "dark" || (!explicitTheme && systemPrefersDark());
elements.themeToggle.setAttribute("aria-pressed", String(effectiveDark));
setInstallButtonVisibility();

renderProfileSwitchButton();
updateTopbarAvailability();
renderDeckOptions();
render();
