import { describe, expect, it } from "vitest";
import { FLAGS_PADRAO, FlagsEntradaSchema, FlagsSchema, paraFlagsPublicas } from "./flags";

describe("FlagsSchema", () => {
  it("padrão: área útil e quartos na primeira dobra, detalhes vazio, medição desligada", () => {
    expect(FLAGS_PADRAO).toEqual({ primeira_dobra: ["area_util_m2", "quartos"], detalhes: [], eventos_ativos: false });
    expect(FlagsSchema.safeParse(FLAGS_PADRAO).success).toBe(true);
  });

  it("recusa o quinto campo na primeira dobra", () => {
    const flags = { ...FLAGS_PADRAO, primeira_dobra: ["area_util_m2", "quartos", "suites", "vagas", "iptu"] };
    expect(FlagsEntradaSchema.safeParse(flags).success).toBe(false);
  });

  it("aceita exatamente quatro campos", () => {
    const flags = { ...FLAGS_PADRAO, primeira_dobra: ["area_util_m2", "quartos", "suites", "vagas"] };
    expect(FlagsEntradaSchema.safeParse(flags).success).toBe(true);
  });

  it("recusa chave de endereço ou qualquer campo fora do enum", () => {
    expect(FlagsEntradaSchema.safeParse({ ...FLAGS_PADRAO, detalhes: ["endereco_completo"] }).success).toBe(false);
    expect(FlagsEntradaSchema.safeParse({ ...FLAGS_PADRAO, primeira_dobra: ["bairro"] }).success).toBe(false);
  });

  it("recusa campo repetido", () => {
    expect(FlagsEntradaSchema.safeParse({ ...FLAGS_PADRAO, detalhes: ["vagas", "vagas"] }).success).toBe(false);
  });

  it("recusa chave extra no objeto", () => {
    expect(FlagsEntradaSchema.safeParse({ ...FLAGS_PADRAO, mostrar_endereco: true }).success).toBe(false);
  });

  it("flags públicas não levam quem editou", () => {
    const publicas = paraFlagsPublicas({ ...FLAGS_PADRAO, atualizado_em: "2026-10-15T12:00:00.000Z", atualizado_por: "gabriela@exemplo.com" });
    expect(JSON.stringify(publicas)).not.toContain("@");
  });
});
