import { describe, expect, it } from "vitest";

describe("ambiente de teste", () => {
  it("resolve o alias @/", async () => {
    const modulo = await import("@/lib/sanidade-alvo");
    expect(modulo.NOME_DO_SITE).toBe("M.C. Vieira Imóveis");
  });
});
