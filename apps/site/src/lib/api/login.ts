import { autenticarLogin } from "@/lib/auth/autenticar-login";
import { criarVerificadorGoogle, type VerificadorGoogle } from "@/lib/auth/google";
import { COOKIE_SESSAO_APAGADO, cookieDeSessao, origemConfere } from "@/lib/auth/guarda";
import { emitirSessao, TAMANHO_MINIMO_SEGREDO } from "@/lib/auth/sessao-jwt";
import type { Servicos } from "@/lib/servicos";
import { lerCorpoJson, respostaErro } from "./respostas";

export async function tratarLogin(req: Request, s: Servicos, verificarGoogle?: VerificadorGoogle): Promise<Response> {
  const { googleClientId, authJwtSecret, authJwtTtlHoras, authAllowlist } = s.config;
  if (!googleClientId || authJwtSecret.length < TAMANHO_MINIMO_SEGREDO) {
    return respostaErro(500, "config_ausente", "GOOGLE_CLIENT_ID ou AUTH_JWT_SECRET não configurados.");
  }
  if (!origemConfere(req)) return respostaErro(403, "origem_invalida", "Pedido vindo de fora do painel.");
  const leitura = await lerCorpoJson(req, 10_000);
  if (!leitura.ok) return leitura.resposta;
  const ttlSegundos = Math.round(authJwtTtlHoras * 3600);
  let resultado;
  try {
    resultado = await autenticarLogin(leitura.corpo, {
      verificarGoogle: verificarGoogle ?? criarVerificadorGoogle(googleClientId),
      allowlist: authAllowlist,
      emitir: (email) => emitirSessao(email, authJwtSecret, ttlSegundos),
    });
  } catch (erro) {
    console.error("[login] falha ao validar com o Google:", erro instanceof Error ? erro.name : "erro desconhecido");
    return respostaErro(502, "falha_upstream", "Não foi possível validar o login agora.");
  }
  const resposta = Response.json(resultado.corpo, { status: resultado.status });
  if (resultado.token) resposta.headers.set("set-cookie", cookieDeSessao(resultado.token, ttlSegundos));
  return resposta;
}

export function tratarLogout(): Response {
  const resposta = Response.json({ saiu: true });
  resposta.headers.set("set-cookie", COOKIE_SESSAO_APAGADO);
  return resposta;
}
