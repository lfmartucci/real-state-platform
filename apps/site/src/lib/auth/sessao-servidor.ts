import { cookies } from "next/headers";
import { COOKIE_SESSAO } from "@/lib/contratos/sessao";
import { servicos } from "@/lib/servicos";
import { estaNaAllowlist } from "./allowlist";
import { verificarSessao } from "./sessao-jwt";

/** Para Server Components do painel: o e-mail da sessão válida, ou null. */
export async function emailDaSessao(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const { authJwtSecret, authAllowlist } = servicos().config;
  const claims = verificarSessao(token, authJwtSecret);
  return claims && estaNaAllowlist(claims.sub, authAllowlist) ? claims.sub : null;
}
