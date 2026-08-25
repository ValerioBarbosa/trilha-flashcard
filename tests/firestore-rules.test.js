import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const firebaseConfig = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));

describe("configuração do Firestore", () => {
  it("aponta o Firebase CLI para as regras auditadas", () => {
    expect(firebaseConfig.firestore.rules).toBe("firestore.rules");
  });

  it("isola cada documento pelo UID autenticado", () => {
    expect(rules).toContain("match /flashcardUsers/{userId}");
    expect(rules).toContain("request.auth.uid == userId");
    expect(rules).toContain("request.resource.data.ownerUid == userId");
    expect(rules).toContain("allow delete: if false");
  });
});
