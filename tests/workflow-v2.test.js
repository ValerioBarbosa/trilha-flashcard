import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const spacedRepetition = readFileSync(new URL("../spaced-repetition.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("fluxo de estudo v2", () => {
  it("carrega o banco durável antes do aplicativo", () => {
    expect(html.indexOf("card-database.js")).toBeGreaterThan(-1);
    expect(html.indexOf("hydrateLocalStorage")).toBeLessThan(html.indexOf('import("./app.js'));
    expect(serviceWorker).toContain("card-database.js?v=20260826-1");
    expect(html.indexOf("data-model.js")).toBeGreaterThan(-1);
    expect(serviceWorker).toContain("data-model.js?v=20260826-2");
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


describe("persistência da sessão ativa", () => {
  it("salva e restaura fila, posição e placar", () => {
    expect(app).toContain("function serializeActiveSession()");
    expect(app).toContain("function restoreActiveSession()");
    expect(app).toContain("activeSession: serializeActiveSession()");
    expect(app).toContain("queueKeys: state.customQueue.map");
    expect(app).toContain('setActiveSurface(resumedActiveSession ? "study" : "home")');
    expect(app).toContain('showToast("Sessão retomada")');
    expect(html).toContain("app.js?v=20260829-dup1");
    expect(serviceWorker).toContain("trilha-flashcard-v39");
    expect(serviceWorker).toContain("motion-animations.js?v=20260824-1");
    expect(spacedRepetition).toContain("motion-animations.js?v=20260824-1");
  });
});

describe("fluxos de segurança e produtividade", () => {
  it("torna a sincronização diagnosticável e recuperável", () => {
    ["cloud-account", "cloud-last-sync", "cloud-retry-button"].forEach((id) => expect(html).toContain(`id="${id}"`));
    expect(app).toContain("function retryCloudSync()");
    expect(app).toContain("function formatCloudTimestamp");
    expect(app).toContain("function cloudFailurePresentation");
    expect(app).toContain("function writeCloudSnapshotWithRetry");
  });

  it("fecha a sessão com resultado e reforço dos erros", () => {
    expect(html).toContain('id="session-complete-dialog"');
    expect(html).toContain('id="session-complete-review-errors"');
    expect(app).toContain("function completeStudySession");
    expect(app).toContain("sessionWrongKeys");
    expect(html).toContain("<option>50</option>");
  });

  it("oferece ações em massa, duplicados e relatório de importação", () => {
    ["card-list-select-visible", "card-list-duplicates", "card-bulk-actions", "import-report-dialog"].forEach((id) => expect(html).toContain(`id="${id}"`));
    expect(app).toContain("function moveSelectedCards");
    expect(app).toContain("function deleteSelectedCards");
    expect(app).toContain("function showImportReport");
    expect(app).toMatch(/await CardDatabase\.persistEntries\(\[\.\.\.entries\]\);\s+if \(added > 0\) markCloudDirty\(\);/);
    expect(app).toContain("CardManager.classifyImportCards");
    expect(app).toContain('duplicate ? " disabled" : " checked"');
    expect(styles).toContain(".import-preview-row.is-duplicate");
  });
});


describe("Sincronização e dados isolada do desempenho", () => {
  it("exibe apenas backup e nuvem no modal próprio", () => {
    const syncStart = html.indexOf('id="sync-data-dialog"');
    const syncEnd = html.indexOf('id="cloud-conflict-dialog"');
    const syncDialog = html.slice(syncStart, syncEnd);
    const dashboardStart = html.indexOf('id="dashboard-dialog"');
    const dashboardEnd = html.indexOf('id="sync-data-dialog"');
    const dashboardDialog = html.slice(dashboardStart, dashboardEnd);

    expect(syncDialog).toContain('id="data-section-title">Seus dados');
    expect(syncDialog).toContain('id="cloud-section-title">Sincronização na nuvem');
    expect(syncDialog).toContain('id="export-button"');
    expect(syncDialog).toContain('id="import-button"');
    expect(syncDialog).toContain('id="cloud-sync-now-button"');
    expect(syncDialog).toContain('id="cloud-sign-out-button"');
    expect(syncDialog).not.toContain("Taxa de acerto");
    expect(syncDialog).not.toContain("Progresso por disciplina");
    expect(dashboardDialog).not.toContain('id="data-section-title"');
    expect(app).toContain("function openSyncData()");
    expect(app).toContain("closeHomeMore(); openSyncData();");
  });
});

describe("banco de matérias e perfis", () => {
  it("organiza disciplinas vazias e registra peso no edital", () => {
    expect(html).toContain("Banco de Matérias");
    expect(html).toContain('id="new-discipline-weight"');
    expect(html).toContain('id="home-profile-summary"');
    expect(app).toContain("assuntos cadastrados · pronta para cartões");
    expect(app).toContain('Number.isFinite(weightValue) && weightValue > 0 ? { weight: weightValue }');
  });

  it("mantém concurso, cargo, banca e ano em perfis isolados", () => {
    ["profile-new-name", "profile-new-role", "profile-new-board", "profile-new-year"].forEach((id) => {
      expect(html).toContain(`id="${id}"`);
    });
    expect(app).toContain("DataModel.sanitizeProfile");
    expect(app).toContain("CardStorage.profileStorageScope");
    expect(app).toContain("CardDatabase.deleteByPrefixes");
  });
});
