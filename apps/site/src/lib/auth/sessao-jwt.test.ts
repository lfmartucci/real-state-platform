import { describe, expect, it } from "vitest";
import { emitirSessao, verificarSessao } from "./sessao-jwt";

const SEGREDO = "um-segredo-de-teste-com-mais-de-32-caracteres";
const AGORA = 1_760_000_000;

describe("sessão JWT", () => {
  it("emite e verifica com sub em minúsculas, papel admin e validade", () => {
    const { token, expiraEm } = emitirSessao("Gabriela@Exemplo.com", SEGREDO, 8 * 3600, AGORA);
    expect(expiraEm).toBe(AGORA + 8 * 3600);
    expect(verificarSessao(token, SEGREDO, AGORA + 60)).toEqual({
      sub: "gabriela@exemplo.com",
      papel: "admin",
      iss: "mc-vieira-site",
      iat: AGORA,
      exp: AGORA + 8 * 3600,
    });
  });

  it("recusa token expirado", () => {
    const { token } = emitirSessao("a@b.com", SEGREDO, 60, AGORA);
    expect(verificarSessao(token, SEGREDO, AGORA + 61)).toBeNull();
  });

  it("recusa assinatura de outro segredo e token adulterado", () => {
    const { token } = emitirSessao("a@b.com", SEGREDO, 60, AGORA);
    expect(verificarSessao(token, `${SEGREDO}-outro`, AGORA)).toBeNull();
    const [cabecalho, , assinatura] = token.split(".");
    const corpoFalso = Buffer.from(JSON.stringify({ sub: "intruso@x.com", papel: "admin", iss: "mc-vieira-site", iat: AGORA, exp: AGORA + 999 })).toString("base64url");
    expect(verificarSessao(`${cabecalho}.${corpoFalso}.${assinatura}`, SEGREDO, AGORA)).toBeNull();
  });

  it("recusa alg diferente de HS256 e formato quebrado", () => {
    const { token } = emitirSessao("a@b.com", SEGREDO, 60, AGORA);
    const [, corpo, assinatura] = token.split(".");
    const semAlg = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    expect(verificarSessao(`${semAlg}.${corpo}.${assinatura}`, SEGREDO, AGORA)).toBeNull();
    expect(verificarSessao("nao-e-jwt", SEGREDO, AGORA)).toBeNull();
  });

  it("não emite nem verifica com segredo curto", () => {
    expect(() => emitirSessao("a@b.com", "curto", 60, AGORA)).toThrow("32 caracteres");
    const { token } = emitirSessao("a@b.com", SEGREDO, 60, AGORA);
    expect(verificarSessao(token, "", AGORA)).toBeNull();
  });
});
