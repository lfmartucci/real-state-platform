import { describe, expect, it } from "vitest";
import { EnderecoSchema, ImovelEntradaSchema, ImovelSchema } from "./imovel";
import { entradaDeExemplo, fotosDeExemplo, imovelDeExemplo } from "@/testes/fixtures";

const mensagens = (resultado: { success: boolean; error?: { issues: { message: string }[] } }) =>
  resultado.error?.issues.map((issue) => issue.message) ?? [];

describe("ImovelEntradaSchema", () => {
  it("aceita a entrada de exemplo", () => {
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo()).success).toBe(true);
  });

  it("recusa tipo fora do enum", () => {
    const resultado = ImovelEntradaSchema.safeParse({ ...entradaDeExemplo(), tipo: "sobrado" });
    expect(resultado.success).toBe(false);
  });

  it("recusa chave desconhecida (esquema fechado)", () => {
    const resultado = ImovelEntradaSchema.safeParse({ ...entradaDeExemplo(), endereco: "Rua X, 10" });
    expect(resultado.success).toBe(false);
  });

  it("aceita uma oferta de venda e uma de aluguel", () => {
    const entrada = entradaDeExemplo({
      ofertas: [
        { negocio: "venda", preco: 1_200_000 },
        { negocio: "aluguel", preco: 6_000, inclui_condominio: true },
      ],
    });
    expect(ImovelEntradaSchema.safeParse(entrada).success).toBe(true);
  });

  it("recusa duas ofertas do mesmo negócio", () => {
    const entrada = entradaDeExemplo({
      ofertas: [
        { negocio: "venda", preco: 1 },
        { negocio: "venda", preco: 2 },
      ],
    });
    expect(mensagens(ImovelEntradaSchema.safeParse(entrada))).toContain("No máximo uma oferta de cada negócio");
  });

  it("recusa lista de ofertas vazia", () => {
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo({ ofertas: [] })).success).toBe(false);
  });

  it("aceita oferta sem preço (preço sob consulta)", () => {
    const entrada = entradaDeExemplo({ ofertas: [{ negocio: "venda" }] });
    expect(ImovelEntradaSchema.safeParse(entrada).success).toBe(true);
  });

  it("recusa inclui_condominio na oferta de venda", () => {
    const entrada = { ...entradaDeExemplo(), ofertas: [{ negocio: "venda", preco: 1, inclui_condominio: true }] };
    expect(ImovelEntradaSchema.safeParse(entrada).success).toBe(false);
  });

  it("recusa preço não inteiro", () => {
    const entrada = entradaDeExemplo({ ofertas: [{ negocio: "venda", preco: 10.5 }] });
    expect(ImovelEntradaSchema.safeParse(entrada).success).toBe(false);
  });

  it("recusa vendido sem oferta de venda", () => {
    const entrada = entradaDeExemplo({ status: "vendido", ofertas: [{ negocio: "aluguel", preco: 3_000 }] });
    expect(mensagens(ImovelEntradaSchema.safeParse(entrada))).toContain(
      "Vendido só vale para imóvel com oferta de venda",
    );
  });

  it("recusa alugado sem oferta de aluguel", () => {
    const entrada = entradaDeExemplo({ status: "alugado", ofertas: [{ negocio: "venda", preco: 3_000 }] });
    expect(mensagens(ImovelEntradaSchema.safeParse(entrada))).toContain(
      "Alugado só vale para imóvel com oferta de aluguel",
    );
  });

  it("recusa emoji no título e na descrição", () => {
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo({ titulo: "Casa linda com piscina 🏠" })).success).toBe(false);
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo({ descricao: "Ótima ✨" })).success).toBe(false);
  });

  it("aceita acentos, travessão e números no título", () => {
    expect(
      ImovelEntradaSchema.safeParse(entradaDeExemplo({ titulo: "Casa térrea – 3 quartos e jardim amplo" })).success,
    ).toBe(true);
  });

  it("recusa mais suítes que quartos", () => {
    expect(mensagens(ImovelEntradaSchema.safeParse(entradaDeExemplo({ quartos: 2, suites: 3 })))).toContain(
      "Suítes não podem passar do número de quartos",
    );
  });

  it("recusa fotos com ordem repetida ou fora de sequência", () => {
    const fotos = fotosDeExemplo("MC001", 2);
    fotos[1] = { ...fotos[1], ordem: 1 };
    expect(mensagens(ImovelEntradaSchema.safeParse(entradaDeExemplo({ fotos })))).toContain(
      "As fotos precisam de ordem 1, 2, 3... sem repetir",
    );
  });

  it("recusa imóvel sem foto", () => {
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo({ fotos: [] })).success).toBe(false);
  });

  it("recusa URL de foto que não é .webp no caminho de fotos de um imóvel", () => {
    const fotos = fotosDeExemplo("MC001", 1);
    fotos[0] = { ...fotos[0], larguras: { ...fotos[0].larguras, "800": "https://x.com/foto.jpg" } };
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo({ fotos })).success).toBe(false);
  });

  it("recusa placeholder que não é data URI WebP", () => {
    const fotos = fotosDeExemplo("MC001", 1);
    fotos[0] = { ...fotos[0], placeholder: "https://x.com/p.webp" };
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo({ fotos })).success).toBe(false);
  });
});

describe("ImovelSchema (persistido)", () => {
  it("aceita o imóvel de exemplo", () => {
    const resultado = ImovelSchema.safeParse(imovelDeExemplo());
    expect(resultado.error?.issues ?? []).toEqual([]);
  });

  it("recusa código fora do formato MC + 3 dígitos", () => {
    expect(ImovelSchema.safeParse(imovelDeExemplo({ codigo: "MC12" })).success).toBe(false);
    expect(ImovelSchema.safeParse(imovelDeExemplo({ codigo: "mc012" })).success).toBe(false);
    expect(ImovelSchema.safeParse(imovelDeExemplo({ codigo: "MC0123" })).success).toBe(false);
  });

  it("recusa foto de outro imóvel", () => {
    const imovel = imovelDeExemplo({ codigo: "MC002", fotos: fotosDeExemplo("MC001", 1) });
    expect(mensagens(ImovelSchema.safeParse(imovel))).toContain("Foto aponta para outro imóvel");
  });

  it("recusa vendido publicado (vendido sai do ar)", () => {
    const imovel = imovelDeExemplo({ status: "vendido", publicacao: "publicado" });
    expect(mensagens(ImovelSchema.safeParse(imovel))).toContain("Vendido ou alugado fica em rascunho");
  });

  it("recusa destaque em rascunho", () => {
    const imovel = imovelDeExemplo({ publicacao: "rascunho", destaque: true });
    expect(mensagens(ImovelSchema.safeParse(imovel))).toContain("Destaque só vale para imóvel publicado");
  });

  it("recusa histórico com mais de 20 itens", () => {
    const item = { em: "2026-10-15T12:00:00.000Z", por: "skill", campo: "titulo", de: "a", para: "b" };
    const imovel = imovelDeExemplo({ historico: Array.from({ length: 21 }, () => item) });
    expect(ImovelSchema.safeParse(imovel).success).toBe(false);
  });
});

describe("EnderecoSchema", () => {
  it("aceita endereço completo com código", () => {
    const endereco = { codigo: "MC001", endereco_completo: "Rua das Flores, 120, Embu-Guaçu", atualizado_em: "2026-10-15T12:00:00.000Z" };
    expect(EnderecoSchema.safeParse(endereco).success).toBe(true);
  });
});
