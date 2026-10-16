import { describe, expect, it } from "vitest";
import type { Imovel } from "@/lib/contratos/imovel";
import { ImovelSchema } from "@/lib/contratos/imovel";
import { entradaDeExemplo, imovelDeExemplo } from "@/testes/fixtures";
import { aplicarGravacao, type ContextoGravacao } from "./regras";

const AGORA = new Date("2026-10-15T12:00:00.000Z");
const ctx = (sobrescrever: Partial<ContextoGravacao>): ContextoGravacao => ({
  codigo: "MC001",
  atual: null,
  entrada: entradaDeExemplo(),
  por: "gabriela@exemplo.com",
  agora: AGORA,
  destaquesDeOutros: 0,
  ...sobrescrever,
});
const gravado = (resultado: ReturnType<typeof aplicarGravacao>): Imovel => {
  if (!resultado.ok) throw new Error(`esperava ok, veio ${resultado.erro}`);
  expect(ImovelSchema.safeParse(resultado.imovel).success).toBe(true);
  return resultado.imovel;
};

describe("criação", () => {
  it("preenche código, datas, autor e histórico de criação", () => {
    const imovel = gravado(aplicarGravacao(ctx({})));
    expect(imovel).toMatchObject({
      codigo: "MC001",
      criado_em: AGORA.toISOString(),
      atualizado_em: AGORA.toISOString(),
      status_desde: AGORA.toISOString(),
      publicado_em: AGORA.toISOString(),
      atualizado_por: "gabriela@exemplo.com",
    });
    expect(imovel.historico).toEqual([{ em: AGORA.toISOString(), por: "gabriela@exemplo.com", campo: "criacao", de: null, para: "publicado" }]);
  });

  it("rascunho do lote nasce sem publicado_em", () => {
    const imovel = gravado(aplicarGravacao(ctx({ entrada: entradaDeExemplo({ publicacao: "rascunho" }), por: "skill" })));
    expect(imovel.publicado_em).toBeUndefined();
  });
});

describe("status e publicação", () => {
  const atual = imovelDeExemplo({ status_desde: "2026-10-01T12:00:00.000Z", publicado_em: "2026-10-01T12:00:00.000Z" });

  it("marcar vendido devolve a rascunho na mesma gravação e grava status_desde", () => {
    const imovel = gravado(aplicarGravacao(ctx({ atual, entrada: entradaDeExemplo({ status: "vendido" }) })));
    expect(imovel.publicacao).toBe("rascunho");
    expect(imovel.status_desde).toBe(AGORA.toISOString());
    // diferencas() ordena os campos em ordem alfabética
    expect(imovel.historico.map((item) => item.campo)).toEqual(["publicacao", "status"]);
  });

  it("publicar um imóvel que já estava vendido é recusado", () => {
    const vendido = imovelDeExemplo({ status: "vendido", publicacao: "rascunho" });
    const resultado = aplicarGravacao(ctx({ atual: vendido, entrada: entradaDeExemplo({ status: "vendido", publicacao: "publicado" }) }));
    expect(resultado).toMatchObject({ ok: false, erro: "fechado_nao_publica" });
  });

  it("status igual mantém status_desde", () => {
    const imovel = gravado(aplicarGravacao(ctx({ atual, entrada: entradaDeExemplo({ titulo: "Outro título bem descritivo" }) })));
    expect(imovel.status_desde).toBe("2026-10-01T12:00:00.000Z");
  });

  it("aluguel que acaba volta a disponível com as ofertas que tinha", () => {
    const ofertas = [{ negocio: "aluguel" as const, preco: 3_000 }];
    const alugado = imovelDeExemplo({ status: "alugado", publicacao: "rascunho", ofertas });
    const imovel = gravado(aplicarGravacao(ctx({ atual: alugado, entrada: entradaDeExemplo({ status: "disponivel", publicacao: "rascunho", ofertas }) })));
    expect(imovel.status).toBe("disponivel");
    expect(imovel.ofertas).toEqual(ofertas);
  });

  it("republicar mantém a data da primeira publicação", () => {
    const retirado = imovelDeExemplo({ publicacao: "rascunho", publicado_em: "2026-09-01T12:00:00.000Z" });
    const imovel = gravado(aplicarGravacao(ctx({ atual: retirado, entrada: entradaDeExemplo({ publicacao: "publicado" }) })));
    expect(imovel.publicado_em).toBe("2026-09-01T12:00:00.000Z");
  });
});

describe("destaques", () => {
  it("o sexto destaque é recusado", () => {
    const atual = imovelDeExemplo({ destaque: false });
    const resultado = aplicarGravacao(ctx({ atual, entrada: entradaDeExemplo({ destaque: true }), destaquesDeOutros: 5 }));
    expect(resultado).toMatchObject({ ok: false, erro: "limite_destaques" });
  });

  it("o quinto destaque entra", () => {
    const atual = imovelDeExemplo({ destaque: false });
    expect(gravado(aplicarGravacao(ctx({ atual, entrada: entradaDeExemplo({ destaque: true }), destaquesDeOutros: 4 }))).destaque).toBe(true);
  });

  it("voltar a rascunho limpa o destaque e libera a vaga (Review Focus 4)", () => {
    const emDestaque = imovelDeExemplo({ destaque: true });
    const retirado = gravado(aplicarGravacao(ctx({ atual: emDestaque, entrada: entradaDeExemplo({ destaque: true, publicacao: "rascunho" }), destaquesDeOutros: 4 })));
    expect(retirado.destaque).toBe(false);
    // Com a vaga livre, outro imóvel publicado pode ser destacado (agora são 4 outros com destaque).
    const outro = imovelDeExemplo({ codigo: "MC002", destaque: false });
    const destacado = aplicarGravacao(ctx({ codigo: "MC002", atual: outro, entrada: entradaDeExemplo({ destaque: true }), destaquesDeOutros: 4 }));
    expect(destacado.ok).toBe(true);
  });

  it("destacar um rascunho é recusado", () => {
    const rascunho = imovelDeExemplo({ publicacao: "rascunho", destaque: false });
    const resultado = aplicarGravacao(ctx({ atual: rascunho, entrada: entradaDeExemplo({ publicacao: "rascunho", destaque: true }) }));
    expect(resultado).toMatchObject({ ok: false, erro: "destaque_fora_do_ar" });
  });

  it("marcar vendido um destaque limpa o destaque", () => {
    const emDestaque = imovelDeExemplo({ destaque: true });
    const imovel = gravado(aplicarGravacao(ctx({ atual: emDestaque, entrada: entradaDeExemplo({ destaque: true, status: "vendido" }) })));
    expect(imovel).toMatchObject({ destaque: false, publicacao: "rascunho" });
  });
});

describe("histórico na gravação", () => {
  it("acumula e corta em 20", () => {
    const item = { em: "2026-10-01T12:00:00.000Z", por: "skill", campo: "titulo", de: "a", para: "b" };
    const atual = imovelDeExemplo({ historico: Array.from({ length: 20 }, () => item) });
    const imovel = gravado(aplicarGravacao(ctx({ atual, entrada: entradaDeExemplo({ status: "reservado" }) })));
    expect(imovel.historico).toHaveLength(20);
    expect(imovel.historico.at(-1)).toMatchObject({ campo: "status", para: "reservado" });
  });
});
