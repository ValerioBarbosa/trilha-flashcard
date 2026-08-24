import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("fluxo de estudo v2", () => {
  it("carrega o banco durável antes do aplicativo", () => {
    expect(html.indexOf("card-database.js")).toBeGreaterThan(-1);
    expect(html.indexOf("hydrateLocalStorage")).toBeLessThan(html.indexOf('import("./app.js'));
    expect(serviceWorker).toContain("card-database.js?v=20260822-1");
  });

  it("expõe filtros e árvore no gerenciador de cartões", () => {
    ["card-list-discipline", "card-list-topic-filter", "card-list-priority", "card-list-difficulty", "card-list-expand-all"].forEach((id) => {
      expect(html).toContain(`id="${id}"`);
    });
    expect(html).toContain("card-manager.js");
    expect(app).toContain("CardManager.organizeCards");
    expect(app).toContain("card-topic-group");
  });

  it("expõe prévia, lixeira, backup e sessão personalizada", () => {
    ["import-preview-dialog", "trash-dialog", "study-session-dialog", "export-button"].forEach((id) => {
      expect(html).toContain(`id="${id}"`);
    });
    expect(app).toContain("openImportPreview");
    expect(app).toContain("restoreTrashItem");
    expect(app).toContain("buildCustomSession");
    expect(app).toContain('kind: "trilha-flashcard-full-backup"');
  });
});


describe("tela inicial orientada à revisão", () => {
  it("expõe o fluxo principal de estudo", () => {
    expect(html).toContain('id="home-dashboard"');
    expect(html).toContain('id="home-continue-button"');
    expect(html).toContain('data-home-nav="cards"');
    expect(html).toContain('id="home-cloud-status"');
    expect(app).toContain("function renderHomeDashboard()");
    expect(app).toContain("function continueFromHome()");
    expect(app).toContain("openDeckFromHome");
    expect(app).toContain('setActiveSurface("decks")');
    expect(app).toContain('surface === "home" || surface === "decks"');
    expect(styles).toContain(".decks-active .home-hero");
    expect(html).toContain('id="home-study-plan-title"');
    expect(html).toContain('id="home-recommended"');
    expect(app).toContain("function getRecommendedFocus()");
    expect(app).toContain("function startHomeNewStudy()");
    expect(styles).toContain(".home-active:not(.decks-active) .home-deck-toolbar");
  });
});


describe("sessão diária focada", () => {
  it("mantém fila, progresso e controles de estudo", () => {
    expect(app).toContain("function buildDailyQueue(limit = 20)");
    expect(app).toContain("sessionTotal: 0");
    expect(app).toContain('document.body.classList.toggle("study-active"');
    expect(app).toContain("ratingActions.hidden = inSimulatedSession || !state.flipped");
    expect(html).toContain('id="study-exit-button"');
    expect(html).toContain('id="study-session-header-count"');
    expect(styles).toContain(".study-active .mobile-primary-nav");
    expect(styles).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
  });
});
