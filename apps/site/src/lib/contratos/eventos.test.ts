import { describe, expect, it } from "vitest";
import { EventoEntradaSchema, EventoGravadoSchema, ResumoDiaSchema } from "./eventos";

describe("EventoEntradaSchema", () => {
  it("aceita clique com código, negócio e origem", () => {
    const evento = { tipo: "clique_whatsapp", codigo: "MC001", negocio: "aluguel", origem: "imovel" };
    expect(EventoEntradaSchema.safeParse(evento).success).toBe(true);
  });

  it("aceita clique sem código vindo do botão flutuante ou da seção de contato", () => {
    expect(EventoEntradaSchema.safeParse({ tipo: "clique_whatsapp", origem: "flutuante" }).success).toBe(true);
    expect(EventoEntradaSchema.safeParse({ tipo: "clique_whatsapp", origem: "contato" }).success).toBe(true);
  });

  it("recusa clique sem código vindo da lista ou do imóvel", () => {
    expect(EventoEntradaSchema.safeParse({ tipo: "clique_whatsapp", origem: "lista" }).success).toBe(false);
    expect(EventoEntradaSchema.safeParse({ tipo: "clique_whatsapp", origem: "imovel" }).success).toBe(false);
  });

  it("recusa visualização sem código", () => {
    expect(EventoEntradaSchema.safeParse({ tipo: "visualizacao_imovel" }).success).toBe(false);
  });

  it("recusa visitante_id vindo do navegador (o servidor lê do cookie)", () => {
    const evento = { tipo: "visualizacao_imovel", codigo: "MC001", visitante_id: crypto.randomUUID() };
    expect(EventoEntradaSchema.safeParse(evento).success).toBe(false);
  });

  it("recusa campos extras como IP ou user agent", () => {
    const evento = { tipo: "visualizacao_imovel", codigo: "MC001", ip: "1.2.3.4" };
    expect(EventoEntradaSchema.safeParse(evento).success).toBe(false);
  });
});

describe("EventoGravadoSchema", () => {
  it("exige data ISO e aceita visitante_id UUID opcional", () => {
    const base = { tipo: "visualizacao_imovel", codigo: "MC001", data: "2026-10-15T12:00:00.000Z" };
    expect(EventoGravadoSchema.safeParse(base).success).toBe(true);
    expect(EventoGravadoSchema.safeParse({ ...base, visitante_id: crypto.randomUUID() }).success).toBe(true);
    expect(EventoGravadoSchema.safeParse({ ...base, visitante_id: "abc" }).success).toBe(false);
  });
});

describe("ResumoDiaSchema", () => {
  it("aceita um resumo diário", () => {
    const zero = { cliques: 0, visualizacoes: 0 };
    const resumo = {
      dia: "2026-10-14",
      gerado_em: "2026-10-15T06:00:00.000Z",
      total_eventos: 3,
      por_imovel: { MC001: { venda: { cliques: 1, visualizacoes: 2 }, aluguel: zero, sem_negocio: zero } },
      cliques_sem_imovel: 0,
      visitantes: [crypto.randomUUID()],
    };
    expect(ResumoDiaSchema.safeParse(resumo).success).toBe(true);
  });
});
