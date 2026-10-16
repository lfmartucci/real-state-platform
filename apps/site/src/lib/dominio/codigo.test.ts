import { describe, expect, it } from "vitest";
import { formatarCodigo, numeroDoCodigo, proximoCodigo } from "./codigo";

describe("código do imóvel", () => {
  it("formata com 3 dígitos", () => {
    expect(formatarCodigo(7)).toBe("MC007");
    expect(formatarCodigo(123)).toBe("MC123");
  });

  it("lê o número do código", () => {
    expect(numeroDoCodigo("MC042")).toBe(42);
  });

  it("começa em MC001 sem nenhum código usado", () => {
    expect(proximoCodigo([])).toBe("MC001");
  });

  it("usa o maior + 1, mesmo com buracos", () => {
    expect(proximoCodigo(["MC001", "MC005", "MC003"])).toBe("MC006");
  });

  it("respeita o mínimo pedido (retentativa depois de colisão)", () => {
    expect(proximoCodigo(["MC001"], 9)).toBe("MC009");
  });

  it("falha ao passar de MC999", () => {
    expect(() => proximoCodigo(["MC999"])).toThrow("Códigos esgotados");
  });
});
