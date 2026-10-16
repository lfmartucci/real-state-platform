export const ISSUER_SESSAO = "mc-vieira-site";
export const COOKIE_SESSAO = "mcv_sessao";
export const COOKIE_VISITANTE = "mcv_visitante";

/** Um papel só (spec 4.3). */
export type Papel = "admin";

export interface SessaoClaims {
  /** e-mail do editor, em minúsculas */
  sub: string;
  papel: Papel;
  iss: typeof ISSUER_SESSAO;
  /** emitido em (segundos epoch) */
  iat: number;
  /** expira em (segundos epoch) */
  exp: number;
}
