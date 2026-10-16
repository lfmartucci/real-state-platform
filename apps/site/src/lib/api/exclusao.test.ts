import { describe, expect, it } from "vitest";
import { caminhos } from "@/lib/armazem/caminhos";
import { cadastrar } from "@/testes/cadastro";
import { entradaDeExemplo, fotosDeExemplo } from "@/testes/fixtures";
import { requisicao } from "@/testes/requisicoes";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { tratarAtualizarImovel, tratarCriarImovel, tratarExcluirImovel, tratarLerImovel, tratarReservarCodigo } from "./imoveis";

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

  it("PUT concorrente entre a leitura e o apagar: 409, sem lápide e com o imóvel intacto", async () => {
    const base = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(base, { publicacao: "rascunho" });
    const novoDados = { ...(await base.armazem.ler(caminhos.imovel(codigo)))?.dados as object, titulo: "Título trocado por outro gravador" };
    // Outro gravador troca o conteúdo (e o ETag) depois da leitura do handler e antes do apagar.
    const armazem = Object.create(base.armazem) as typeof base.armazem;
    armazem.apagar = async (caminhosParaApagar, opcoes) => {
      if (caminhosParaApagar.includes(caminhos.imovel(codigo))) await base.armazem.gravar(caminhos.imovel(codigo), novoDados);
      return base.armazem.apagar(caminhosParaApagar, opcoes);
    };
    const resposta = await excluir({ ...base, armazem }, codigo, etag);
    expect(resposta.status).toBe(409);
    expect(await base.armazem.ler(caminhos.lapide(codigo))).toBeNull();
    expect((await base.armazem.ler(caminhos.imovel(codigo)))?.dados).toEqual(novoDados);
  });

  it("dois DELETE concorrentes com o mesmo ETag: a lápide continua e o código não volta (C1)", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s, { publicacao: "rascunho" });
    const respostas = await Promise.all([excluir(s, codigo, etag), excluir(s, codigo, etag)]);
    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 409]);
    expect(await s.armazem.ler(caminhos.lapide(codigo))).not.toBeNull();
    expect((await s.armazem.listar(`imoveis/${codigo}/`)).map((item) => item.caminho)).toContain(caminhos.lapide(codigo));
    expect((await tratarLerImovel(requisicao("GET", `/api/imoveis/${codigo}`), s, codigo)).status).toBe(410);
  });

  it("PUT em código excluído responde 410 codigo_excluido (I2)", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s, { publicacao: "rascunho" });
    await excluir(s, codigo, etag);
    const corpo = { imovel: entradaDeExemplo({ fotos: fotosDeExemplo(codigo) }) };
    const resposta = await tratarAtualizarImovel(requisicao("PUT", `/api/imoveis/${codigo}`, { corpo, cabecalhos: { "if-match": etag } }), s, codigo);
    expect(resposta.status).toBe(410);
    expect((await resposta.json()).erro).toBe("codigo_excluido");
  });

  it("retoma exclusão que parou depois da lápide: imóvel ausente, restos são apagados", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s, { publicacao: "rascunho" }, { endereco_completo: "Rua Um, 100, Centro" });
    await s.fotos.enviar(`imoveis/${codigo}/fotos/1-abcdef0123-800.webp`, Buffer.from("x"), "image/webp");
    await s.armazem.gravar(caminhos.lapide(codigo), { codigo, excluido_em: "2026-10-15T12:00:00.000Z", por: "gabriela@exemplo.com" });
    await s.armazem.apagar([caminhos.imovel(codigo)]);
    const resposta = await excluir(s, codigo, etag);
    expect(resposta.status).toBe(200);
    expect(await s.armazem.ler(caminhos.endereco(codigo))).toBeNull();
    expect(await s.armazem.ler(caminhos.reserva(codigo))).toBeNull();
    expect(await s.fotos.listar(caminhos.pastaFotos(codigo))).toEqual([]);
    expect(await s.armazem.ler(caminhos.lapide(codigo))).not.toBeNull();
    expect(s.tagsRevalidadas).toContain("imoveis");
  });

  it("falha no meio da limpeza das fotos: repetir o DELETE conclui a exclusão", async () => {
    const base = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(base, { publicacao: "rascunho" }, { endereco_completo: "Rua Um, 100, Centro" });
    await base.fotos.enviar(`imoveis/${codigo}/fotos/1-abcdef0123-800.webp`, Buffer.from("x"), "image/webp");
    let falhas = 1;
    const fotos = Object.create(base.fotos) as typeof base.fotos;
    fotos.apagar = async (caminhosParaApagar) => {
      if (falhas > 0) {
        falhas -= 1;
        throw new Error("falha simulada no store de fotos");
      }
      return base.fotos.apagar(caminhosParaApagar);
    };
    const s = { ...base, fotos };
    // Erro não tratado no handler: o Next responde 500, como nas outras rotas.
    await expect(excluir(s, codigo, etag)).rejects.toThrow("falha simulada");
    expect(base.tagsRevalidadas).toContain("imoveis");
    expect(await base.armazem.ler(caminhos.imovel(codigo))).toBeNull();
    expect(await base.armazem.ler(caminhos.lapide(codigo))).not.toBeNull();
    expect((await excluir(s, codigo, etag)).status).toBe(200);
    expect(await base.armazem.ler(caminhos.endereco(codigo))).toBeNull();
    expect(await base.armazem.ler(caminhos.reserva(codigo))).toBeNull();
    expect(await base.fotos.listar(caminhos.pastaFotos(codigo))).toEqual([]);
  });
});
