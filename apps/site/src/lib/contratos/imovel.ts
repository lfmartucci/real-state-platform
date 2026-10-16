import { z } from "zod";
import {
  CodigoSchema,
  DataIsoSchema,
  PublicacaoSchema,
  STATUS_FECHADOS,
  StatusSchema,
  TipoSchema,
  textoSemEmoji,
} from "./comum";

export const LARGURAS_FOTO = [800, 1600, 2560] as const;
export type Largura = (typeof LARGURAS_FOTO)[number];

/** Caminho de foto no store público: imoveis/<codigo>/fotos/<arquivo>.webp. O grupo 1 é o código. */
export const REGEX_URL_FOTO = /\/imoveis\/(MC\d{3})\/fotos\/[A-Za-z0-9._-]+\.webp$/;

const UrlFotoSchema = z.url().refine((url) => REGEX_URL_FOTO.test(url), "URL de foto fora do padrão");

export const FotoSchema = z.strictObject({
  ordem: z.int().min(1),
  legenda: z.string().trim().max(140).optional(),
  larguras: z.strictObject({ "800": UrlFotoSchema, "1600": UrlFotoSchema, "2560": UrlFotoSchema }),
  placeholder: z.string().startsWith("data:image/webp;base64,").max(4000),
});
export type Foto = z.infer<typeof FotoSchema>;

const PrecoSchema = z.int().positive();

export const OfertaSchema = z.discriminatedUnion("negocio", [
  z.strictObject({ negocio: z.literal("venda"), preco: PrecoSchema.optional() }),
  z.strictObject({
    negocio: z.literal("aluguel"),
    preco: PrecoSchema.optional(),
    inclui_condominio: z.boolean().optional(),
  }),
]);
export type Oferta = z.infer<typeof OfertaSchema>;

export const HistoricoItemSchema = z.strictObject({
  em: DataIsoSchema,
  por: z.string().min(1),
  campo: z.string().min(1),
  de: z.string().nullable(),
  para: z.string().nullable(),
});
export type HistoricoItem = z.infer<typeof HistoricoItemSchema>;

const Contagem = z.int().min(0).max(50);
const Area = z.number().positive().max(1_000_000);
const ReaisPorMes = z.int().min(0);

/** Campos que quem grava envia. O resto do imóvel (código, datas, histórico) é a API que calcula. */
const camposDeEntrada = {
  tipo: TipoSchema,
  status: StatusSchema,
  publicacao: PublicacaoSchema,
  ofertas: z.array(OfertaSchema).min(1).max(2),
  titulo: textoSemEmoji(10, 120),
  descricao: textoSemEmoji(1, 5000),
  bairro: z.string().trim().min(2).max(80),
  cidade: z.string().trim().min(2).max(80),
  condominio: ReaisPorMes.optional(),
  iptu: ReaisPorMes.optional(),
  area_util_m2: Area.optional(),
  area_total_m2: Area.optional(),
  quartos: Contagem.optional(),
  suites: Contagem.optional(),
  banheiros: Contagem.optional(),
  vagas: Contagem.optional(),
  comodidades: z.array(z.string().trim().min(2).max(60)).max(30),
  fotos: z.array(FotoSchema).min(1).max(60),
  destaque: z.boolean(),
};
export const CAMPOS_DE_ENTRADA = Object.keys(camposDeEntrada) as (keyof typeof camposDeEntrada)[];

type Conteudo = z.infer<z.ZodObject<typeof camposDeEntrada>>;

function regrasDeConteudo(imovel: Conteudo, ctx: z.RefinementCtx) {
  const negocios = imovel.ofertas.map((oferta) => oferta.negocio);
  if (new Set(negocios).size !== negocios.length) {
    ctx.addIssue({ code: "custom", path: ["ofertas"], message: "No máximo uma oferta de cada negócio" });
  }
  if (imovel.status === "vendido" && !negocios.includes("venda")) {
    ctx.addIssue({ code: "custom", path: ["status"], message: "Vendido só vale para imóvel com oferta de venda" });
  }
  if (imovel.status === "alugado" && !negocios.includes("aluguel")) {
    ctx.addIssue({ code: "custom", path: ["status"], message: "Alugado só vale para imóvel com oferta de aluguel" });
  }
  if (imovel.suites !== undefined && imovel.quartos !== undefined && imovel.suites > imovel.quartos) {
    ctx.addIssue({ code: "custom", path: ["suites"], message: "Suítes não podem passar do número de quartos" });
  }
  const ordens = imovel.fotos.map((foto) => foto.ordem).sort((a, b) => a - b);
  if (ordens.some((ordem, indice) => ordem !== indice + 1)) {
    ctx.addIssue({ code: "custom", path: ["fotos"], message: "As fotos precisam de ordem 1, 2, 3... sem repetir" });
  }
}

export const ImovelEntradaSchema = z.strictObject(camposDeEntrada).superRefine(regrasDeConteudo);
export type ImovelEntrada = z.infer<typeof ImovelEntradaSchema>;

export const ImovelSchema = z
  .strictObject({
    codigo: CodigoSchema,
    ...camposDeEntrada,
    status_desde: DataIsoSchema,
    publicado_em: DataIsoSchema.optional(),
    criado_em: DataIsoSchema,
    atualizado_em: DataIsoSchema,
    atualizado_por: z.string().min(1),
    historico: z.array(HistoricoItemSchema).max(20),
  })
  .superRefine((imovel, ctx) => {
    regrasDeConteudo(imovel, ctx);
    for (const foto of imovel.fotos) {
      for (const url of Object.values(foto.larguras)) {
        if (REGEX_URL_FOTO.exec(url)?.[1] !== imovel.codigo) {
          ctx.addIssue({ code: "custom", path: ["fotos"], message: "Foto aponta para outro imóvel" });
          return;
        }
      }
    }
    if (STATUS_FECHADOS.has(imovel.status) && imovel.publicacao !== "rascunho") {
      ctx.addIssue({ code: "custom", path: ["publicacao"], message: "Vendido ou alugado fica em rascunho" });
    }
    if (imovel.destaque && imovel.publicacao !== "publicado") {
      ctx.addIssue({ code: "custom", path: ["destaque"], message: "Destaque só vale para imóvel publicado" });
    }
  });
export type Imovel = z.infer<typeof ImovelSchema>;

/** imoveis/<codigo>/endereco.json: arquivo separado de propósito (seção 3 do spec). */
export const EnderecoSchema = z.strictObject({
  codigo: CodigoSchema,
  endereco_completo: z.string().trim().min(5).max(300),
  atualizado_em: DataIsoSchema,
});
export type Endereco = z.infer<typeof EnderecoSchema>;

/** imoveis/<codigo>/reserva.json: o código existe antes das fotos (ajuste A do plano). */
export const ReservaSchema = z.strictObject({ codigo: CodigoSchema, reservado_em: DataIsoSchema, por: z.string().min(1) });
export type Reserva = z.infer<typeof ReservaSchema>;

/** imoveis/<codigo>/excluido.json: impede reaproveitar o código (ajuste B do plano). */
export const LapideSchema = z.strictObject({ codigo: CodigoSchema, excluido_em: DataIsoSchema, por: z.string().min(1) });
export type Lapide = z.infer<typeof LapideSchema>;
