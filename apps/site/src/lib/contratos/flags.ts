import { z } from "zod";
import { DataIsoSchema } from "./comum";

/** Enum fechado de campos públicos que podem aparecer na página do imóvel (spec 4.2). Endereço nunca entra. */
export const CAMPOS_PUBLICOS = [
  "area_util_m2",
  "area_total_m2",
  "quartos",
  "suites",
  "banheiros",
  "vagas",
  "condominio",
  "iptu",
  "tipo",
] as const;
export const CampoPublicoSchema = z.enum(CAMPOS_PUBLICOS);
export type CampoPublico = z.infer<typeof CampoPublicoSchema>;

export const LIMITE_PRIMEIRA_DOBRA = 4;

const listaSemRepetir = (maximo: number) =>
  z
    .array(CampoPublicoSchema)
    .max(maximo)
    .refine((lista) => new Set(lista).size === lista.length, "Campo repetido");

const camposDeEntrada = {
  primeira_dobra: listaSemRepetir(LIMITE_PRIMEIRA_DOBRA),
  detalhes: listaSemRepetir(CAMPOS_PUBLICOS.length),
  eventos_ativos: z.boolean(),
};

export const FlagsEntradaSchema = z.strictObject(camposDeEntrada);
export type FlagsEntrada = z.infer<typeof FlagsEntradaSchema>;

export const FlagsSchema = z.strictObject({
  ...camposDeEntrada,
  atualizado_em: DataIsoSchema.optional(),
  atualizado_por: z.string().min(1).optional(),
});
export type Flags = z.infer<typeof FlagsSchema>;

export const FLAGS_PADRAO: Flags = { primeira_dobra: ["area_util_m2", "quartos"], detalhes: [], eventos_ativos: false };

export type FlagsPublicas = Pick<Flags, "primeira_dobra" | "detalhes" | "eventos_ativos">;

export function paraFlagsPublicas(flags: Flags): FlagsPublicas {
  return { primeira_dobra: flags.primeira_dobra, detalhes: flags.detalhes, eventos_ativos: flags.eventos_ativos };
}
