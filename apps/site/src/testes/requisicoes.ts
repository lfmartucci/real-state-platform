import { emitirSessao } from "@/lib/auth/sessao-jwt";
import { COOKIE_SESSAO } from "@/lib/contratos/sessao";
import { CONFIG_TESTE } from "./servicos-de-teste";

export const ORIGEM_APP = "http://localhost:3000";

export type ComoAutenticar = "skill" | "api" | "admin" | "nenhum" | { email: string };

/** Monta um Request como o Next entrega ao handler. Padrão: autenticado como a skill. */
export function requisicao(
  metodo: string,
  caminho: string,
  opcoes: { corpo?: unknown; autenticacao?: ComoAutenticar; cabecalhos?: Record<string, string> } = {},
): Request {
  const cabecalhos = new Headers(opcoes.cabecalhos);
  const autenticacao = opcoes.autenticacao ?? "skill";
  if (autenticacao === "skill" || autenticacao === "api") {
    cabecalhos.set("authorization", `Bearer ${CONFIG_TESTE.skillApiSecret}`);
    if (autenticacao === "api") cabecalhos.set("x-mcv-ator", "api");
  } else if (autenticacao !== "nenhum") {
    const email = autenticacao === "admin" ? "gabriela@exemplo.com" : autenticacao.email;
    const { token } = emitirSessao(email, CONFIG_TESTE.authJwtSecret, 3600);
    cabecalhos.set("cookie", `${COOKIE_SESSAO}=${token}`);
    if (!cabecalhos.has("origin")) cabecalhos.set("origin", ORIGEM_APP);
  }
  if (opcoes.corpo !== undefined) cabecalhos.set("content-type", "application/json");
  return new Request(`${ORIGEM_APP}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
}
