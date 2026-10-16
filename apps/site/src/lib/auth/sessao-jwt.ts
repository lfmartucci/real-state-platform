import { createHmac, timingSafeEqual } from "node:crypto";
import { ISSUER_SESSAO, type SessaoClaims } from "@/lib/contratos/sessao";

export const TAMANHO_MINIMO_SEGREDO = 32;
const CABECALHO = { alg: "HS256", typ: "JWT" } as const;
const agoraEmSegundos = () => Math.floor(Date.now() / 1000);

const base64url = (texto: string) => Buffer.from(texto).toString("base64url");
const assinar = (dados: string, segredo: string) => createHmac("sha256", segredo).update(dados).digest("base64url");

function lerJson(parte: string): unknown {
  try {
    return JSON.parse(Buffer.from(parte, "base64url").toString("utf8"));
  } catch {
    return null; // parte malformada = token inválido; o chamador recebe null
  }
}

export function emitirSessao(email: string, segredo: string, ttlSegundos: number, agoraSeg = agoraEmSegundos()) {
  if (segredo.length < TAMANHO_MINIMO_SEGREDO) throw new Error(`AUTH_JWT_SECRET precisa de ${TAMANHO_MINIMO_SEGREDO} caracteres ou mais`);
  const claims: SessaoClaims = { sub: email.trim().toLowerCase(), papel: "admin", iss: ISSUER_SESSAO, iat: agoraSeg, exp: agoraSeg + ttlSegundos };
  const entrada = `${base64url(JSON.stringify(CABECALHO))}.${base64url(JSON.stringify(claims))}`;
  return { token: `${entrada}.${assinar(entrada, segredo)}`, expiraEm: claims.exp };
}

export function verificarSessao(token: string, segredo: string, agoraSeg = agoraEmSegundos()): SessaoClaims | null {
  if (segredo.length < TAMANHO_MINIMO_SEGREDO) return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [cabecalho, corpo, assinatura] = partes;
  const esperada = Buffer.from(assinar(`${cabecalho}.${corpo}`, segredo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  const cabecalhoLido = lerJson(cabecalho) as { alg?: unknown } | null;
  if (cabecalhoLido?.alg !== "HS256") return null;
  const claims = lerJson(corpo) as Partial<SessaoClaims> | null;
  if (!claims || claims.iss !== ISSUER_SESSAO || claims.papel !== "admin" || typeof claims.sub !== "string") return null;
  if (typeof claims.exp !== "number" || claims.exp <= agoraSeg || typeof claims.iat !== "number") return null;
  return claims as SessaoClaims;
}
