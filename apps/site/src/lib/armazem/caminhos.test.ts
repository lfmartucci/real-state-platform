import { describe, expect, it } from "vitest";
import { caminhos } from "./caminhos";

describe("caminhos", () => {
  it("monta os caminhos do layout do Blob (spec seção 3)", () => {
    expect(caminhos.imovel("MC007")).toBe("imoveis/MC007/imovel.json");
    expect(caminhos.endereco("MC007")).toBe("imoveis/MC007/endereco.json");
    expect(caminhos.reserva("MC007")).toBe("imoveis/MC007/reserva.json");
    expect(caminhos.lapide("MC007")).toBe("imoveis/MC007/excluido.json");
    expect(caminhos.pastaFotos("MC007")).toBe("imoveis/MC007/fotos/");
    expect(caminhos.flags).toBe("config/flags.json");
    expect(caminhos.evento("2026-10-15", "abc")).toBe("eventos/2026-10-15/abc.json");
    expect(caminhos.resumo("2026-10-15")).toBe("resumos/2026-10-15.json");
    expect(caminhos.pastaBackupDia("2026-10-15")).toBe("backup/2026-10-15/");
  });

  it("recusa código que poderia escapar do diretório", () => {
    expect(() => caminhos.imovel("../config")).toThrow("Código inválido");
    expect(() => caminhos.imovel("MC001/../../x")).toThrow("Código inválido");
  });

  it("recusa dia fora do formato", () => {
    expect(() => caminhos.resumo("15/10/2026")).toThrow("Dia inválido");
  });
});
