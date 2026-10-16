import { describe, expect, it } from "vitest";
import { estaNaAllowlist, lerAllowlist } from "./allowlist";

describe("allowlist", () => {
  it("aceita vírgula, ponto e vírgula, espaço e quebra de linha, em minúsculas", () => {
    expect(lerAllowlist(" A@x.com, b@x.com;c@x.com\nD@X.com ")).toEqual(new Set(["a@x.com", "b@x.com", "c@x.com", "d@x.com"]));
  });

  it("nega por padrão quando está vazia ou ausente", () => {
    expect(estaNaAllowlist("a@x.com", undefined)).toBe(false);
    expect(estaNaAllowlist("a@x.com", "   ")).toBe(false);
  });

  it("compara em minúsculas", () => {
    expect(estaNaAllowlist("Moises@Exemplo.COM", "moises@exemplo.com")).toBe(true);
    expect(estaNaAllowlist("intruso@x.com", "moises@exemplo.com")).toBe(false);
  });
});
