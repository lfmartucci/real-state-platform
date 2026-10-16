import { describe, expect, it } from "vitest";
import { CONFIG_TESTE } from "@/testes/servicos-de-teste";
import { ORIGEM_APP, requisicao } from "@/testes/requisicoes";
import { autenticar, cookieDeSessao, lerCookie } from "./guarda";

const status = (resultado: unknown) => (resultado instanceof Response ? resultado.status : 200);

describe("autenticar", () => {
  it("sem cookie nem segredo é 401", () => {
    expect(status(autenticar(requisicao("GET", "/api/imoveis", { autenticacao: "nenhum" }), CONFIG_TESTE, { aceitaSkill: true }))).toBe(401);
  });

  it("segredo da skill certo vira ator skill; com x-mcv-ator=api vira api", () => {
    expect(autenticar(requisicao("POST", "/api/imoveis"), CONFIG_TESTE, { aceitaSkill: true })).toEqual({ tipo: "skill", nome: "skill" });
    expect(autenticar(requisicao("POST", "/api/imoveis", { autenticacao: "api" }), CONFIG_TESTE, { aceitaSkill: true })).toEqual({ tipo: "skill", nome: "api" });
  });

  it("segredo errado é 401; segredo vazio no servidor nega tudo", () => {
    const errado = requisicao("POST", "/api/imoveis", { autenticacao: "nenhum", cabecalhos: { authorization: "Bearer outro" } });
    expect(status(autenticar(errado, CONFIG_TESTE, { aceitaSkill: true }))).toBe(401);
    expect(status(autenticar(requisicao("POST", "/api/imoveis"), { ...CONFIG_TESTE, skillApiSecret: "" }, { aceitaSkill: true }))).toBe(401);
  });

  it("skill em rota só do painel é 403", () => {
    expect(status(autenticar(requisicao("PUT", "/api/flags"), CONFIG_TESTE, { aceitaSkill: false }))).toBe(403);
  });

  it("admin válido vira ator admin", () => {
    expect(autenticar(requisicao("GET", "/api/flags", { autenticacao: "admin" }), CONFIG_TESTE, { aceitaSkill: false })).toEqual({
      tipo: "admin",
      email: "gabriela@exemplo.com",
    });
  });

  it("e-mail que saiu da allowlist perde acesso mesmo com JWT válido", () => {
    const pedido = requisicao("GET", "/api/flags", { autenticacao: { email: "ex-editor@exemplo.com" } });
    expect(status(autenticar(pedido, CONFIG_TESTE, { aceitaSkill: false }))).toBe(401);
  });

  it("escrita do painel sem Origin, ou com Origin de outro site, é 403", () => {
    const outroSite = requisicao("PUT", "/api/flags", { autenticacao: "admin", cabecalhos: { origin: "https://malicioso.example" } });
    expect(status(autenticar(outroSite, CONFIG_TESTE, { aceitaSkill: false }))).toBe(403);
    const semOrigem = new Request(`${ORIGEM_APP}/api/flags`, {
      method: "PUT",
      headers: { cookie: requisicao("GET", "/", { autenticacao: "admin" }).headers.get("cookie")! },
    });
    expect(status(autenticar(semOrigem, CONFIG_TESTE, { aceitaSkill: false }))).toBe(403);
  });

  it("leitura do painel não exige Origin", () => {
    const leitura = new Request(`${ORIGEM_APP}/api/flags`, { headers: { cookie: requisicao("GET", "/", { autenticacao: "admin" }).headers.get("cookie")! } });
    expect(status(autenticar(leitura, CONFIG_TESTE, { aceitaSkill: false }))).toBe(200);
  });
});

describe("cookies", () => {
  it("lê um cookie entre vários", () => {
    const pedido = new Request(ORIGEM_APP, { headers: { cookie: "a=1; mcv_sessao=abc.def.ghi; b=2" } });
    expect(lerCookie(pedido, "mcv_sessao")).toBe("abc.def.ghi");
    expect(lerCookie(pedido, "nao")).toBeNull();
  });

  it("cookie de sessão é HttpOnly, Secure, SameSite=Lax", () => {
    expect(cookieDeSessao("tok", 28_800)).toBe("mcv_sessao=tok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800");
  });
});
