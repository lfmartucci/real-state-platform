import { describe, expect, it } from "vitest";
import { FLAGS_PADRAO } from "@/lib/contratos/flags";
import { requisicao } from "@/testes/requisicoes";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { tratarGravarFlags, tratarLerFlags } from "./flags";

const gravar = (s: Awaited<ReturnType<typeof criarServicosDeTeste>>, corpo: unknown, etag?: string | null, autenticacao: "admin" | "skill" = "admin") =>
  tratarGravarFlags(requisicao("PUT", "/api/flags", { corpo, autenticacao, cabecalhos: etag ? { "if-match": etag } : {} }), s);

describe("/api/flags", () => {
  it("lê o padrão com ETag nulo", async () => {
    const s = await criarServicosDeTeste();
    expect(await (await tratarLerFlags(requisicao("GET", "/api/flags", { autenticacao: "admin" }), s)).json()).toEqual({ flags: FLAGS_PADRAO, etag: null });
  });

  it("grava com o e-mail do editor e revalida o cache das flags", async () => {
    const s = await criarServicosDeTeste();
    const resposta = await gravar(s, { flags: { ...FLAGS_PADRAO, detalhes: ["vagas", "iptu"] } });
    expect(resposta.status).toBe(200);
    const { flags } = await resposta.json();
    expect(flags).toMatchObject({ detalhes: ["vagas", "iptu"], atualizado_por: "gabriela@exemplo.com" });
    expect(s.tagsRevalidadas).toEqual(["flags"]);
  });

  it("recusa o quinto campo na primeira dobra e chave de endereço", async () => {
    const s = await criarServicosDeTeste();
    expect((await gravar(s, { flags: { ...FLAGS_PADRAO, primeira_dobra: ["area_util_m2", "quartos", "suites", "vagas", "iptu"] } })).status).toBe(422);
    expect((await gravar(s, { flags: { ...FLAGS_PADRAO, detalhes: ["endereco_completo"] } })).status).toBe(422);
  });

  it("segunda gravação exige o ETag atual", async () => {
    const s = await criarServicosDeTeste();
    const { etag } = await (await gravar(s, { flags: FLAGS_PADRAO })).json();
    expect((await gravar(s, { flags: FLAGS_PADRAO })).status).toBe(428);
    expect((await gravar(s, { flags: FLAGS_PADRAO }, '"velho"')).status).toBe(409);
    expect((await gravar(s, { flags: FLAGS_PADRAO }, etag)).status).toBe(200);
  });

  it("ligar a medição exige a confirmação LIGAR", async () => {
    const s = await criarServicosDeTeste();
    const ligar = { ...FLAGS_PADRAO, eventos_ativos: true };
    const sem = await gravar(s, { flags: ligar });
    expect(sem.status).toBe(422);
    expect((await sem.json()).erro).toBe("confirmacao_medicao");
    expect((await gravar(s, { flags: ligar, confirmacao_medicao: "LIGAR" })).status).toBe(200);
  });

  it("a skill não mexe nas flags", async () => {
    const s = await criarServicosDeTeste();
    expect((await gravar(s, { flags: FLAGS_PADRAO }, null, "skill")).status).toBe(403);
  });
});
