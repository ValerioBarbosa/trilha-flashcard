const decks = trt4Decks;

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
  previous: document.querySelector("#previous-button"),
  next: document.querySelector("#next-button"),
  shuffle: document.querySelector("#shuffle-button"),
  reveal: document.querySelector("#reveal-button"),
  forgot: document.querySelector("#forgot-button"),
  remembered: document.querySelector("#remembered-button"),
  toast: document.querySelector("#toast"),
};

const savedState = JSON.parse(localStorage.getItem("rumo-concursos-state") || "null");
const state = {
  deckId: savedState?.deckId && decks.some((deck) => deck.id === savedState.deckId) ? savedState.deckId : decks[0].id,
  index: Number.isInteger(savedState?.index) ? savedState.index : 0,
  flipped: false,
  studied: 0,
  remembered: 0,
};

let toastTimer;

function currentDeck() {
  return decks.find((deck) => deck.id === state.deckId);
}

function currentCard() {
  return currentDeck().cards[state.index];
}

function saveProgress() {
  localStorage.setItem("rumo-concursos-state", JSON.stringify({ deckId: state.deckId, index: state.index }));
}

function renderDeckOptions() {
  elements.deckSelect.innerHTML = decks
    .map((deck) => `<option value="${deck.id}">${deck.title}</option>`)
    .join("");
  elements.deckSelect.value = state.deckId;
}

function renderProgress() {
  const total = currentDeck().cards.length;
  elements.progressLabel.textContent = `${state.index + 1} de ${total}`;
  elements.sessionScore.textContent = state.studied === 0
    ? "0 estudados"
    : `${state.remembered} de ${state.studied} lembrados`;
  elements.progressTrack.style.setProperty("--segments", total);
  elements.progressTrack.innerHTML = currentDeck().cards
    .map((_, index) => {
      const status = index < state.index ? "complete" : index === state.index ? "current" : "";
      return `<span class="progress-segment ${status}" aria-hidden="true"></span>`;
    })
    .join("");
  elements.sessionCount.textContent = `${state.index + 1} de ${total}`;
  elements.sessionDots.innerHTML = currentDeck().cards
    .map((_, index) => {
      const status = index < state.index ? "complete" : index === state.index ? "current" : "";
      return `<span class="session-dot ${status}"></span>`;
    })
    .join("");
}

function renderCard() {
  const card = currentCard();
  elements.front.textContent = card.front;
  elements.back.textContent = card.back;
  elements.example.textContent = card.example || "";
  elements.front.classList.toggle("is-medium", card.front.length > 34 && card.front.length <= 76);
  elements.front.classList.toggle("is-long", card.front.length > 76);
  elements.back.classList.toggle("is-long", card.back.length > 105);
  elements.flashcard.classList.toggle("is-flipped", state.flipped);
  elements.flashcard.setAttribute("aria-label", state.flipped ? "Mostrar enunciado" : "Revelar gabarito");
  elements.reveal.querySelector("span").textContent = state.flipped ? "Ver enunciado" : "Ver gabarito";
}

function render() {
  state.index = Math.min(state.index, currentDeck().cards.length - 1);
  renderProgress();
  renderCard();
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

function rateCard(didRemember) {
  state.studied += 1;
  state.remembered += didRemember ? 1 : 0;
  showToast(didRemember ? "Boa — conteúdo lembrado" : "Tudo bem — vamos rever depois");
  window.setTimeout(() => move(1), 180);
}

function shuffleCards() {
  const cards = currentDeck().cards;
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[randomIndex]] = [cards[randomIndex], cards[index]];
  }
  state.index = 0;
  state.flipped = false;
  render();
  showToast("Baralho embaralhado");
}

elements.deckSelect.addEventListener("change", (event) => {
  state.deckId = event.target.value;
  state.index = 0;
  state.flipped = false;
  state.studied = 0;
  state.remembered = 0;
  render();
});

elements.flashcard.addEventListener("click", toggleCard);
elements.reveal.addEventListener("click", toggleCard);
elements.previous.addEventListener("click", () => move(-1));
elements.next.addEventListener("click", () => move(1));
elements.shuffle.addEventListener("click", shuffleCards);
elements.forgot.addEventListener("click", () => rateCard(false));
elements.remembered.addEventListener("click", () => rateCard(true));

document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLSelectElement) return;
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
