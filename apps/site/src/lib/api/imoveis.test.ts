import { describe, expect, it } from "vitest";
import type { Imovel } from "@/lib/contratos/imovel";
import { cadastrar } from "@/testes/cadastro";
import { entradaDeExemplo, fotosDeExemplo } from "@/testes/fixtures";
import { requisicao } from "@/testes/requisicoes";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { tratarAtualizarImovel, tratarCriarImovel, tratarLerImovel, tratarListarImoveis, tratarReservarCodigo } from "./imoveis";

const ENDERECO = "Rua das Palmeiras, 45, Embu-Guaçu";
const json = async (resposta: Response) => resposta.json() as Promise<Record<string, unknown>>;
const atualizar = (s: Awaited<ReturnType<typeof criarServicosDeTeste>>, codigo: string, imovel: unknown, etag: string | null, autenticacao: "skill" | "admin" = "admin") =>
  tratarAtualizarImovel(
    requisicao("PUT", `/api/imoveis/${codigo}`, { corpo: { imovel }, autenticacao, cabecalhos: etag ? { "if-match": etag } : {} }),
    s,
    codigo,
  );

describe("autenticação das rotas de imóvel", () => {
  it("gravação sem login nem segredo falha", async () => {
    const s = await criarServicosDeTeste();
    const corpo = { codigo: "MC001", imovel: entradaDeExemplo() };
    expect((await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo, autenticacao: "nenhum" }), s)).status).toBe(401);
    expect((await tratarReservarCodigo(requisicao("POST", "/api/imoveis/reservas", { autenticacao: "nenhum" }), s)).status).toBe(401);
    expect((await tratarListarImoveis(requisicao("GET", "/api/imoveis", { autenticacao: "nenhum" }), s)).status).toBe(401);
  });
});

describe("criação", () => {
  it("reserva e cria; grava atualizado_por da skill e revalida o cache", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, imovel, etag } = await cadastrar(s);
    expect(codigo).toBe("MC001");
    expect(etag).toMatch(/^".+"$/);
    expect(imovel).toMatchObject({ codigo: "MC001", atualizado_por: "skill", publicacao: "publicado" });
    expect(s.tagsRevalidadas).toContain("imoveis");
  });

  it("pela API do Moisés o autor fica 'api'", async () => {
    const s = await criarServicosDeTeste();
    expect((await cadastrar(s, {}, { autenticacao: "api" })).imovel.atualizado_por).toBe("api");
  });

  it("duas reservas simultâneas recebem códigos diferentes", async () => {
    const s = await criarServicosDeTeste();
    const respostas = await Promise.all([1, 2].map(() => tratarReservarCodigo(requisicao("POST", "/api/imoveis/reservas"), s)));
    const codigos = await Promise.all(respostas.map(async (resposta) => (await json(resposta)).codigo));
    expect(new Set(codigos).size).toBe(2);
  });

  it("criar sem reserva é 422 sem_reserva", async () => {
    const s = await criarServicosDeTeste();
    const resposta = await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo: { codigo: "MC001", imovel: entradaDeExemplo() } }), s);
    expect(resposta.status).toBe(422);
    expect((await json(resposta)).erro).toBe("sem_reserva");
  });

  it("criar duas vezes no mesmo código é 409", async () => {
    const s = await criarServicosDeTeste();
    const { codigo } = await cadastrar(s);
    const corpo = { codigo, imovel: entradaDeExemplo({ fotos: fotosDeExemplo(codigo) }) };
    expect((await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo }), s)).status).toBe(409);
  });

  it("esquema inválido é 422 com detalhes por campo", async () => {
    const s = await criarServicosDeTeste();
    await tratarReservarCodigo(requisicao("POST", "/api/imoveis/reservas"), s);
    const corpo = { codigo: "MC001", imovel: { ...entradaDeExemplo(), tipo: "sobrado" } };
    const resposta = await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo }), s);
    expect(resposta.status).toBe(422);
    expect((await json(resposta)).detalhes).toContainEqual(expect.objectContaining({ caminho: "tipo" }));
  });

  it("foto fora do store público ou de outro imóvel é 422", async () => {
    const s = await criarServicosDeTeste();
    await tratarReservarCodigo(requisicao("POST", "/api/imoveis/reservas"), s);
    const deFora = { codigo: "MC001", imovel: entradaDeExemplo({ fotos: fotosDeExemplo("MC001", 1, "https://outro.example") }) };
    expect((await json(await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo: deFora }), s))).erro).toBe("foto_fora_do_store");
    const deOutro = { codigo: "MC001", imovel: entradaDeExemplo({ fotos: fotosDeExemplo("MC009", 1) }) };
    expect((await json(await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo: deOutro }), s))).erro).toBe("foto_fora_do_store");
  });
});

describe("endereço", () => {
  it("vai num arquivo separado e só volta na leitura individual", async () => {
    const s = await criarServicosDeTeste();
    const { codigo } = await cadastrar(s, {}, { endereco_completo: ENDERECO });
    const lido = await json(await tratarLerImovel(requisicao("GET", `/api/imoveis/${codigo}`), s, codigo));
    expect(lido.endereco_completo).toBe(ENDERECO);
    expect(JSON.stringify(lido.imovel)).not.toContain("Palmeiras");
    const lista = await (await tratarListarImoveis(requisicao("GET", "/api/imoveis"), s)).text();
    expect(lista).not.toContain("Palmeiras");
  });

  it("nunca entra no histórico", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s);
    const corpo = { imovel: entradaDeExemplo({ fotos: fotosDeExemplo(codigo) }), endereco_completo: ENDERECO };
    const resposta = await tratarAtualizarImovel(requisicao("PUT", `/api/imoveis/${codigo}`, { corpo, cabecalhos: { "if-match": etag } }), s, codigo);
    expect(resposta.status).toBe(200);
    expect(JSON.stringify(await json(resposta))).not.toContain("Palmeiras");
  });
});

describe("leitura", () => {
  it("código inexistente ou inválido é 404", async () => {
    const s = await criarServicosDeTeste();
    expect((await tratarLerImovel(requisicao("GET", "/api/imoveis/MC404"), s, "MC404")).status).toBe(404);
    expect((await tratarLerImovel(requisicao("GET", "/api/imoveis/..%2Fconfig"), s, "../config")).status).toBe(404);
  });

  it("devolve o ETag no corpo e no cabeçalho", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s);
    const resposta = await tratarLerImovel(requisicao("GET", `/api/imoveis/${codigo}`), s, codigo);
    expect(resposta.headers.get("etag")).toBe(etag);
    expect((await json(resposta)).etag).toBe(etag);
  });
});

describe("atualização", () => {
  it("sem If-Match é 428", async () => {
    const s = await criarServicosDeTeste();
    const { codigo } = await cadastrar(s);
    expect((await atualizar(s, codigo, entradaDeExemplo({ fotos: fotosDeExemplo(codigo) }), null)).status).toBe(428);
  });

  it("gravação concorrente do mesmo imóvel: uma vence, a outra recebe 409", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s);
    const base = entradaDeExemplo({ fotos: fotosDeExemplo(codigo) });
    const [primeira, segunda] = await Promise.all([
      atualizar(s, codigo, { ...base, titulo: "Título da Gabriela para a casa" }, etag),
      atualizar(s, codigo, { ...base, titulo: "Título do Moisés para a casa" }, etag),
    ]);
    expect([primeira.status, segunda.status].sort()).toEqual([200, 409]);
    const perdedora = primeira.status === 409 ? primeira : segunda;
    expect((await json(perdedora)).erro).toBe("conflito");
  });

  it("marcar vendido tira do ar na hora e revalida", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s);
    s.tagsRevalidadas.length = 0;
    const resposta = await atualizar(s, codigo, entradaDeExemplo({ fotos: fotosDeExemplo(codigo), status: "vendido" }), etag);
    expect(((await json(resposta)).imovel as Imovel).publicacao).toBe("rascunho");
    expect(s.tagsRevalidadas).toEqual(["imoveis"]);
  });

  it("sexto destaque é recusado com 422", async () => {
    const s = await criarServicosDeTeste();
    for (let n = 0; n < 5; n += 1) await cadastrar(s, { destaque: true });
    const { codigo, etag } = await cadastrar(s);
    const resposta = await atualizar(s, codigo, entradaDeExemplo({ fotos: fotosDeExemplo(codigo), destaque: true }), etag);
    expect(resposta.status).toBe(422);
    expect((await json(resposta)).erro).toBe("limite_destaques");
  });

  it("o painel grava com o e-mail do editor", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s);
    const resposta = await atualizar(s, codigo, entradaDeExemplo({ fotos: fotosDeExemplo(codigo), status: "reservado" }), etag, "admin");
    expect(((await json(resposta)).imovel as Imovel).atualizado_por).toBe("gabriela@exemplo.com");
  });
});
