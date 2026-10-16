import { OAuth2Client } from "google-auth-library";

export interface IdentidadeGoogle {
  email: string;
  emailVerificado: boolean;
}

export type VerificadorGoogle = (credential: string) => Promise<IdentidadeGoogle | null>;

const PREFIXO_FALHA_CERTIFICADOS = "Failed to retrieve verification certificates";

/** Único ponto que fala com o Google: valida assinatura, audiência (nosso client id), emissor e validade do ID token. */
export function criarVerificadorGoogle(clientId: string): VerificadorGoogle {
  const cliente = new OAuth2Client(clientId);
  return async (credential) => {
    let payload;
    try {
      payload = (await cliente.verifyIdToken({ idToken: credential, audience: clientId })).getPayload();
    } catch (erro) {
      // Critério (google-auth-library 11.x): getFederatedSignonCertsAsync prefixa com PREFIXO_FALHA_CERTIFICADOS
      // toda falha de rede/HTTP ao buscar os certificados do Google. Isso é queda do Google: relança (login responde 502).
      // Qualquer outro erro vem da verificação do token (assinatura, expiração, audiência, formato): token recusado, 401.
      if (erro instanceof Error && erro.message.startsWith(PREFIXO_FALHA_CERTIFICADOS)) throw erro;
      // Nunca logar erro.message: a lib embute o JWT inteiro ou o payload (e-mail, nome) na mensagem.
      console.warn("[login] ID token do Google recusado");
      return null;
    }
    if (!payload?.email) return null;
    return { email: payload.email, emailVerificado: payload.email_verified === true };
  };
}
