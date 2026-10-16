import { describe, expect, it } from "vitest";
import { autenticarLogin } from "./autenticar-login";
import type { IdentidadeGoogle } from "./google";

const deps = (identidade: IdentidadeGoogle | null) => ({
  verificarGoogle: async () => identidade,
  allowlist: "gabriela@exemplo.com",
  emitir: (email: string) => ({ token: `token-de-${email}` }),
});

describe("autenticarLogin", () => {
  it("corpo sem credential é 400", async () => {
    expect((await autenticarLogin({}, deps(null))).status).toBe(400);
  });

  it("token do Google inválido é 401", async () => {
    expect((await autenticarLogin({ credential: "x" }, deps(null))).corpo.erro).toBe("token_invalido");
  });

  it("queda do Google propaga o erro (o handler responde 502)", async () => {
    const falha = { ...deps(null), verificarGoogle: async () => { throw new Error("rede"); } };
    await expect(autenticarLogin({ credential: "x" }, falha)).rejects.toThrow("rede");
  });

  it("e-mail não verificado é 401", async () => {
    const resultado = await autenticarLogin({ credential: "x" }, deps({ email: "gabriela@exemplo.com", emailVerificado: false }));
    expect(resultado).toMatchObject({ status: 401, corpo: { erro: "email_nao_verificado" } });
  });

  it("e-mail fora da lista é 403", async () => {
    const resultado = await autenticarLogin({ credential: "x" }, deps({ email: "intruso@x.com", emailVerificado: true }));
    expect(resultado).toMatchObject({ status: 403, corpo: { erro: "nao_autorizado" } });
  });

  it("e-mail da lista recebe token, com e-mail em minúsculas", async () => {
    const resultado = await autenticarLogin({ credential: "x" }, deps({ email: "Gabriela@Exemplo.com", emailVerificado: true }));
    expect(resultado).toEqual({ status: 200, corpo: { email: "gabriela@exemplo.com" }, token: "token-de-gabriela@exemplo.com" });
  });
});
