import { describe, expect, it } from "vitest";
import { caminhos } from "@/lib/armazem/caminhos";
import { cadastrar } from "@/testes/cadastro";
import { entradaDeExemplo, fotosDeExemplo } from "@/testes/fixtures";
import { requisicao } from "@/testes/requisicoes";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { tratarCriarImovel, tratarExcluirImovel, tratarLerImovel, tratarReservarCodigo } from "./imoveis";

const excluir = (s: Awaited<ReturnType<typeof criarServicosDeTeste>>, codigo: string, etag: string, confirmacao = codigo, autenticacao: "admin" | "skill" = "admin") =>
  tratarExcluirImovel(
    requisicao("DELETE", `/api/imoveis/${codigo}`, { autenticacao, corpo: { confirmacao }, cabecalhos: { "if-match": etag } }),
    s,
    codigo,
  );

describe("DELETE /api/imoveis/:codigo", () => {
  it("só exclui rascunho", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s);
    const resposta = await excluir(s, codigo, etag);
    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toBe("so_rascunho");
  });

  it("exige digitar o código", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s, { publicacao: "rascunho" });
    expect((await excluir(s, codigo, etag, "MC999")).status).toBe(422);
  });

  it("a skill não exclui", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s, { publicacao: "rascunho" });
    expect((await excluir(s, codigo, etag, codigo, "skill")).status).toBe(403);
  });

  it("apaga JSON, endereço e fotos, e o código passa a responder 410", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s, { publicacao: "rascunho" }, { endereco_completo: "Rua Um, 100, Centro" });
    await s.fotos.enviar(`imoveis/${codigo}/fotos/1-abcdef0123-800.webp`, Buffer.from("x"), "image/webp");
    const resposta = await excluir(s, codigo, etag);
    expect(resposta.status).toBe(200);
    expect(await s.armazem.ler(caminhos.imovel(codigo))).toBeNull();
    expect(await s.armazem.ler(caminhos.endereco(codigo))).toBeNull();
    expect(await s.fotos.listar(caminhos.pastaFotos(codigo))).toEqual([]);
    expect((await tratarLerImovel(requisicao("GET", `/api/imoveis/${codigo}`), s, codigo)).status).toBe(410);
    expect(s.tagsRevalidadas.at(-1)).toBe("imoveis");
  });

  it("reserva depois de excluir o maior código não reaproveita (Review Focus 1)", async () => {
    const s = await criarServicosDeTeste();
    await cadastrar(s);
    const { codigo, etag } = await cadastrar(s, { publicacao: "rascunho" });
    expect(codigo).toBe("MC002");
    await excluir(s, codigo, etag);
    const nova = await tratarReservarCodigo(requisicao("POST", "/api/imoveis/reservas"), s);
    expect((await nova.json()).codigo).toBe("MC003");
    const corpo = { codigo: "MC002", imovel: entradaDeExemplo({ fotos: fotosDeExemplo("MC002") }) };
    expect((await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo }), s)).status).toBe(410);
  });

  it("ETag velho é 409 e nada é apagado", async () => {
    const s = await criarServicosDeTeste();
    const { codigo } = await cadastrar(s, { publicacao: "rascunho" });
    expect((await excluir(s, codigo, '"velho"')).status).toBe(409);
    expect(await s.armazem.ler(caminhos.imovel(codigo))).not.toBeNull();
  });
});
