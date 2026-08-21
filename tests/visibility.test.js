import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const styles = readFileSync(resolve(root, "styles.css"), "utf8");
const index = readFileSync(resolve(root, "index.html"), "utf8");

describe("visibilidade do formulário de cartões", () => {
  it("preserva o atributo hidden contra regras de display dos componentes", () => {
    expect(styles).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
  });

  it("mantém o formulário fechado até o usuário adicionar ou editar um cartão", () => {
    expect(index).toMatch(/<form class="card-form" id="card-form" hidden>/);
  });
});
