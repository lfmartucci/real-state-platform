import { OAuth2Client } from "google-auth-library";

export interface IdentidadeGoogle {
  email: string;
  emailVerificado: boolean;
}

export type VerificadorGoogle = (credential: string) => Promise<IdentidadeGoogle | null>;

/** Único ponto que fala com o Google: valida assinatura, audiência (nosso client id), emissor e validade do ID token. */
export function criarVerificadorGoogle(clientId: string): VerificadorGoogle {
  const cliente = new OAuth2Client(clientId);
  return async (credential) => {
    let payload;
    try {
      payload = (await cliente.verifyIdToken({ idToken: credential, audience: clientId })).getPayload();
    } catch (erro) {
      // Token malformado, expirado ou de outra audiência: o login responde 401.
      console.warn("[login] ID token do Google recusado:", erro instanceof Error ? erro.message : String(erro));
      return null;
    }
    if (!payload?.email) return null;
    return { email: payload.email, emailVerificado: payload.email_verified === true };
  };
}
