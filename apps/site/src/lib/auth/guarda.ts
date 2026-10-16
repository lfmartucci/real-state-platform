import { createHash, timingSafeEqual } from "node:crypto";
import { respostaErro } from "@/lib/api/respostas";
import type { Config } from "@/lib/config";
import { COOKIE_SESSAO } from "@/lib/contratos/sessao";
import { estaNaAllowlist } from "./allowlist";
import { verificarSessao } from "./sessao-jwt";

export type Ator = { tipo: "admin"; email: string } | { tipo: "skill"; nome: "skill" | "api" };

const METODOS_DE_ESCRITA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function lerCookie(req: Request, nome: string): string | null {
  const cabecalho = req.headers.get("cookie");
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(";")) {
    const [chave, ...valor] = parte.trim().split("=");
    if (chave === nome) return valor.join("=");
  }
  return null;
}

/** Spec 4.3: escrita do painel confere Origin contra a própria origem do app. */
export function origemConfere(req: Request): boolean {
  const origem = req.headers.get("origin");
  return origem !== null && origem === new URL(req.url).origin;
}

function segredosIguais(recebido: string, esperado: string): boolean {
  if (!esperado) return false;
  const digerir = (texto: string) => createHash("sha256").update(texto).digest();
  return timingSafeEqual(digerir(recebido), digerir(esperado));
}

export function autenticar(req: Request, config: Config, opcoes: { aceitaSkill: boolean }, agoraSeg?: number): Ator | Response {
  const autorizacao = req.headers.get("authorization");
  if (autorizacao?.startsWith("Bearer ")) {
    if (!opcoes.aceitaSkill) return respostaErro(403, "skill_nao_permitida", "Esta rota é só do painel.");
    if (!segredosIguais(autorizacao.slice("Bearer ".length), config.skillApiSecret)) {
      return respostaErro(401, "nao_autenticado", "Segredo da API inválido.");
    }
    return { tipo: "skill", nome: req.headers.get("x-mcv-ator") === "api" ? "api" : "skill" };
  }
  const token = lerCookie(req, COOKIE_SESSAO);
  const claims = token ? verificarSessao(token, config.authJwtSecret, agoraSeg) : null;
  if (!claims || !estaNaAllowlist(claims.sub, config.authAllowlist)) {
    return respostaErro(401, "nao_autenticado", "Sessão ausente ou expirada. Entre de novo no painel.");
  }
  if (METODOS_DE_ESCRITA.has(req.method) && !origemConfere(req)) {
    return respostaErro(403, "origem_invalida", "Pedido vindo de fora do painel.");
  }
  return { tipo: "admin", email: claims.sub };
}

export function nomeDoAtor(ator: Ator): string {
  return ator.tipo === "admin" ? ator.email : ator.nome;
}

export function cookieDeSessao(token: string, ttlSegundos: number): string {
  return `${COOKIE_SESSAO}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttlSegundos}`;
}

export const COOKIE_SESSAO_APAGADO = `${COOKIE_SESSAO}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
