import { z } from "zod";
import { CodigoSchema, DataIsoSchema, NegocioSchema } from "./comum";

/** `contato` cobre botões sem imóvel (seção "Prazer", estado de erro). Ajuste D do plano. */
export const ORIGENS_CLIQUE = ["lista", "imovel", "flutuante", "contato"] as const;
const ORIGENS_SEM_IMOVEL = new Set(["flutuante", "contato"]);

const Clique = z.strictObject({
  tipo: z.literal("clique_whatsapp"),
  codigo: CodigoSchema.optional(),
  negocio: NegocioSchema.optional(),
  origem: z.enum(ORIGENS_CLIQUE),
});

const Visualizacao = z.strictObject({
  tipo: z.literal("visualizacao_imovel"),
  codigo: CodigoSchema,
  negocio: NegocioSchema.optional(),
});

/** O que o navegador envia. Não tem visitante_id nem data: o servidor preenche os dois. */
export const EventoEntradaSchema = z.discriminatedUnion("tipo", [Clique, Visualizacao]).superRefine((evento, ctx) => {
  if (evento.tipo === "clique_whatsapp" && !evento.codigo && !ORIGENS_SEM_IMOVEL.has(evento.origem)) {
    ctx.addIssue({ code: "custom", path: ["codigo"], message: "Clique da lista ou do imóvel precisa do código" });
  }
});
export type EventoEntrada = z.infer<typeof EventoEntradaSchema>;

const extrasGravados = { visitante_id: z.uuid().optional(), data: DataIsoSchema };

export const EventoGravadoSchema = z.discriminatedUnion("tipo", [
  Clique.extend(extrasGravados),
  Visualizacao.extend(extrasGravados),
]);
export type EventoGravado = z.infer<typeof EventoGravadoSchema>;

export const ContagemSchema = z.strictObject({ cliques: z.int().min(0), visualizacoes: z.int().min(0) });
export type Contagem = z.infer<typeof ContagemSchema>;

export const ResumoDiaSchema = z.strictObject({
  dia: z.iso.date(),
  gerado_em: DataIsoSchema,
  total_eventos: z.int().min(0),
  por_imovel: z.record(
    CodigoSchema,
    z.strictObject({ venda: ContagemSchema, aluguel: ContagemSchema, sem_negocio: ContagemSchema }),
  ),
  cliques_sem_imovel: z.int().min(0),
  visitantes: z.array(z.uuid()),
});
export type ResumoDia = z.infer<typeof ResumoDiaSchema>;
