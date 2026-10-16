import { estaNaAllowlist, normalizarEmail } from "./allowlist";
import type { VerificadorGoogle } from "./google";

export interface ResultadoLogin {
  status: number;
  corpo: { erro?: string; mensagem?: string; email?: string };
  token?: string;
}

interface Dependencias {
  verificarGoogle: VerificadorGoogle;
  allowlist: string;
  emitir: (email: string) => { token: string };
}

/** Núcleo puro do login, no desenho do pep19 (api/_lib/authenticate.ts), sem papéis no banco. */
export async function autenticarLogin(corpo: unknown, deps: Dependencias): Promise<ResultadoLogin> {
  const credential =
    typeof corpo === "object" && corpo !== null && typeof (corpo as { credential?: unknown }).credential === "string"
      ? (corpo as { credential: string }).credential
      : null;
  if (!credential) return { status: 400, corpo: { erro: "corpo_invalido", mensagem: "Envie { credential }." } };

  const identidade = await deps.verificarGoogle(credential);
  if (!identidade) return { status: 401, corpo: { erro: "token_invalido", mensagem: "Login do Google inválido ou expirado." } };
  if (!identidade.emailVerificado) {
    return { status: 401, corpo: { erro: "email_nao_verificado", mensagem: "A conta Google precisa ter e-mail verificado." } };
  }
  if (!estaNaAllowlist(identidade.email, deps.allowlist)) {
    return { status: 403, corpo: { erro: "nao_autorizado", mensagem: "Este e-mail não tem acesso ao painel." } };
  }
  const email = normalizarEmail(identidade.email);
  return { status: 200, corpo: { email }, token: deps.emitir(email).token };
}
