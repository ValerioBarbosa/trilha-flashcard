import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

describe("fluxo de estudo v2", () => {
  it("carrega o banco durável antes do aplicativo", () => {
    expect(html.indexOf("card-database.js")).toBeGreaterThan(-1);
    expect(html.indexOf("hydrateLocalStorage")).toBeLessThan(html.indexOf('import("./app.js'));
    expect(serviceWorker).toContain("card-database.js?v=20260821-1");
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
