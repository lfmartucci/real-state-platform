import { describe, expect, it } from "vitest";
import { entradaDeExemplo, fotosDeExemplo } from "@/testes/fixtures";
import { acrescentar, diferencas } from "./historico";

const EM = "2026-10-15T12:00:00.000Z";

describe("histórico", () => {
  it("registra só os campos que mudaram, com de e para", () => {
    const antes = entradaDeExemplo();
    const depois = { ...antes, titulo: "Casa em condomínio com piscina aquecida", status: "reservado" as const };
    expect(diferencas(antes, depois, "gabriela@exemplo.com", EM)).toEqual([
      { em: EM, por: "gabriela@exemplo.com", campo: "status", de: "disponivel", para: "reservado" },
      { em: EM, por: "gabriela@exemplo.com", campo: "titulo", de: antes.titulo, para: "Casa em condomínio com piscina aquecida" },
    ]);
  });

  it("resume fotos pela quantidade e campos ausentes como null", () => {
    const antes = entradaDeExemplo();
    const depois = { ...antes, fotos: fotosDeExemplo("MC001", 5), vagas: undefined };
    const itens = diferencas(antes, depois, "skill", EM);
    expect(itens).toContainEqual({ em: EM, por: "skill", campo: "fotos", de: "3 fotos", para: "5 fotos" });
    expect(itens).toContainEqual({ em: EM, por: "skill", campo: "vagas", de: "3", para: null });
  });

  it("corta textos longos em 200 caracteres", () => {
    const antes = entradaDeExemplo();
    const [item] = diferencas(antes, { ...antes, descricao: "a".repeat(500) }, "skill", EM);
    expect(item.para).toHaveLength(200);
  });

  it("mantém só as últimas 20 alterações", () => {
    const item = (n: number) => ({ em: EM, por: "skill", campo: `c${n}`, de: null, para: null });
    const resultado = acrescentar(Array.from({ length: 19 }, (_, n) => item(n)), [item(19), item(20), item(21)]);
    expect(resultado).toHaveLength(20);
    expect(resultado[0].campo).toBe("c2");
    expect(resultado.at(-1)?.campo).toBe("c21");
  });
});
