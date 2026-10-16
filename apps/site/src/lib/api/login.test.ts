import { describe, expect, it } from "vitest";
import type { IdentidadeGoogle } from "@/lib/auth/google";
import { verificarSessao } from "@/lib/auth/sessao-jwt";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { ORIGEM_APP } from "@/testes/requisicoes";
import { tratarLogin, tratarLogout } from "./login";

const google = (identidade: IdentidadeGoogle | null) => async () => identidade;
const pedidoDeLogin = (cabecalhos: Record<string, string> = { origin: ORIGEM_APP }) =>
  new Request(`${ORIGEM_APP}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabecalhos },
    body: JSON.stringify({ credential: "id-token" }),
  });

describe("POST /api/auth/login", () => {
  it("token inválido é 401 e não cria cookie", async () => {
    const resposta = await tratarLogin(pedidoDeLogin(), await criarServicosDeTeste(), google(null));
    expect(resposta.status).toBe(401);
    expect(resposta.headers.get("set-cookie")).toBeNull();
  });

  it("e-mail fora da lista é 403", async () => {
    const resposta = await tratarLogin(pedidoDeLogin(), await criarServicosDeTeste(), google({ email: "x@y.com", emailVerificado: true }));
    expect(resposta.status).toBe(403);
  });

  it("login válido grava cookie de sessão de 8 horas", async () => {
    const s = await criarServicosDeTeste();
    const resposta = await tratarLogin(pedidoDeLogin(), s, google({ email: "moises@exemplo.com", emailVerificado: true }));
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ email: "moises@exemplo.com" });
    const cookie = resposta.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^mcv_sessao=[^;]+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800$/);
    const token = cookie.split(";")[0].split("=")[1];
    expect(verificarSessao(token, s.config.authJwtSecret)?.sub).toBe("moises@exemplo.com");
  });

  it("login vindo de outro site é 403", async () => {
    const resposta = await tratarLogin(pedidoDeLogin({ origin: "https://outro.example" }), await criarServicosDeTeste(), google({ email: "moises@exemplo.com", emailVerificado: true }));
    expect(resposta.status).toBe(403);
  });

  it("sem GOOGLE_CLIENT_ID ou segredo curto é 500 config_ausente", async () => {
    const s = await criarServicosDeTeste();
    const resposta = await tratarLogin(pedidoDeLogin(), { ...s, config: { ...s.config, googleClientId: "" } }, google(null));
    expect(resposta.status).toBe(500);
    expect((await resposta.json()).erro).toBe("config_ausente");
  });

  it("Google fora do ar é 502", async () => {
    const resposta = await tratarLogin(pedidoDeLogin(), await criarServicosDeTeste(), async () => {
      throw new Error("rede");
    });
    expect(resposta.status).toBe(502);
  });
});

describe("POST /api/auth/logout", () => {
  it("apaga o cookie", () => {
    expect(tratarLogout().headers.get("set-cookie")).toBe("mcv_sessao=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  });
});
