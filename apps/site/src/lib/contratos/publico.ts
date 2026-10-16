import type { Imovel } from "./imovel";

/** Única lista do que sai do servidor para o navegador. Histórico, e-mails e datas internas ficam de fora. */
export const CAMPOS_DO_IMOVEL_PUBLICO = [
  "codigo",
  "tipo",
  "status",
  "ofertas",
  "titulo",
  "descricao",
  "bairro",
  "cidade",
  "condominio",
  "iptu",
  "area_util_m2",
  "area_total_m2",
  "quartos",
  "suites",
  "banheiros",
  "vagas",
  "comodidades",
  "fotos",
  "destaque",
  "publicado_em",
  "atualizado_em",
] as const satisfies readonly (keyof Imovel)[];

export type ImovelPublico = Pick<Imovel, (typeof CAMPOS_DO_IMOVEL_PUBLICO)[number]>;

export function paraPublico(imovel: Imovel): ImovelPublico {
  const publico: Record<string, unknown> = {};
  for (const campo of CAMPOS_DO_IMOVEL_PUBLICO) {
    if (imovel[campo] !== undefined) publico[campo] = imovel[campo];
  }
  return publico as ImovelPublico;
}
