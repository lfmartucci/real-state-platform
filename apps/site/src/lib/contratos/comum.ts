import { z } from "zod";

export const REGEX_CODIGO = /^MC\d{3}$/;
export const CodigoSchema = z.string().regex(REGEX_CODIGO, "Código deve ser MC seguido de 3 dígitos");

export const TIPOS = [
  "apartamento",
  "casa",
  "casa_condominio",
  "terreno",
  "cobertura",
  "sala_comercial",
  "galpao",
  "chacara",
] as const;
export const TipoSchema = z.enum(TIPOS);
export type Tipo = z.infer<typeof TipoSchema>;

export const STATUS = ["disponivel", "reservado", "vendido", "alugado"] as const;
export const StatusSchema = z.enum(STATUS);
export type Status = z.infer<typeof StatusSchema>;
/** Status que tiram o imóvel do mercado: o imóvel volta a rascunho na mesma gravação. */
export const STATUS_FECHADOS: ReadonlySet<Status> = new Set(["vendido", "alugado"]);

export const PUBLICACOES = ["rascunho", "publicado"] as const;
export const PublicacaoSchema = z.enum(PUBLICACOES);
export type Publicacao = z.infer<typeof PublicacaoSchema>;

export const NEGOCIOS = ["venda", "aluguel"] as const;
export const NegocioSchema = z.enum(NEGOCIOS);
export type Negocio = z.infer<typeof NegocioSchema>;

export const DataIsoSchema = z.iso.datetime();

const EMOJI = /\p{Extended_Pictographic}/u;

/** Texto livre do site: aparado, com limites, e sem emoji (regra do spec, seção 4.1). */
export function textoSemEmoji(minimo: number, maximo: number) {
  return z
    .string()
    .trim()
    .min(minimo)
    .max(maximo)
    .refine((texto) => !EMOJI.test(texto), "Sem emoji");
}
