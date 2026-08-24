import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

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
  });
});
