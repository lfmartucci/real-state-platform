import { describe, expect, it } from "vitest";
import { paraPublico } from "./publico";
import { imovelDeExemplo } from "@/testes/fixtures";

describe("paraPublico", () => {
  const imovel = imovelDeExemplo({
    atualizado_por: "gabriela@exemplo.com",
    historico: [{ em: "2026-10-10T12:00:00.000Z", por: "moises@exemplo.com", campo: "titulo", de: "a", para: "b" }],
  });

  it("descarta histórico e e-mails da equipe", () => {
    const publico = paraPublico(imovel);
    const serializado = JSON.stringify(publico);
    expect(serializado).not.toContain("@exemplo.com");
    expect(publico).not.toHaveProperty("historico");
    expect(publico).not.toHaveProperty("atualizado_por");
    expect(publico).not.toHaveProperty("criado_em");
  });

  it("mantém o que o visitante vê", () => {
    const publico = paraPublico(imovel);
    expect(publico.codigo).toBe("MC001");
    expect(publico.titulo).toBe(imovel.titulo);
    expect(publico.fotos).toEqual(imovel.fotos);
    expect(publico.atualizado_em).toBe(imovel.atualizado_em);
  });

  it("não inventa campos ausentes", () => {
    const { vagas: _vagas, ...semVagas } = imovelDeExemplo();
    expect(paraPublico(semVagas)).not.toHaveProperty("vagas");
  });
});
