import { STATUS_FECHADOS } from "@/lib/contratos/comum";
import type { HistoricoItem, Imovel, ImovelEntrada } from "@/lib/contratos/imovel";
import { acrescentar, diferencas } from "./historico";

export const LIMITE_DESTAQUES = 5;

export type ErroDeRegra = "fechado_nao_publica" | "destaque_fora_do_ar" | "limite_destaques";
export type ResultadoGravacao = { ok: true; imovel: Imovel } | { ok: false; erro: ErroDeRegra; mensagem: string };

export interface ContextoGravacao {
  codigo: string;
  atual: Imovel | null;
  entrada: ImovelEntrada;
  /** e-mail do editor, "skill" ou "api" */
  por: string;
  agora: Date;
  /** quantos OUTROS imóveis já têm destaque */
  destaquesDeOutros: number;
}

/** Único lugar das regras de gravação (ADR 0001). O esquema já garantiu ofertas x status. */
export function aplicarGravacao(ctx: ContextoGravacao): ResultadoGravacao {
  const { atual, entrada } = ctx;
  const em = ctx.agora.toISOString();
  const statusMudou = !atual || atual.status !== entrada.status;

  let publicacao = entrada.publicacao;
  if (STATUS_FECHADOS.has(entrada.status)) {
    if (statusMudou) publicacao = "rascunho";
    else if (publicacao === "publicado") {
      return { ok: false, erro: "fechado_nao_publica", mensagem: "Imóvel vendido ou alugado não pode ir ao ar. Troque o status antes." };
    }
  }

  let destaque = entrada.destaque;
  if (publicacao === "rascunho" && destaque) {
    if (!atual?.destaque) return { ok: false, erro: "destaque_fora_do_ar", mensagem: "Só imóvel publicado pode ser destaque." };
    destaque = false; // saiu do ar: libera a vaga (ajuste E)
  }
  if (destaque && !atual?.destaque && ctx.destaquesDeOutros >= LIMITE_DESTAQUES) {
    return { ok: false, erro: "limite_destaques", mensagem: `Já há ${LIMITE_DESTAQUES} destaques. Desmarque um antes.` };
  }

  const conteudo: ImovelEntrada = { ...entrada, publicacao, destaque };
  const publicadoEm = atual?.publicado_em ?? (publicacao === "publicado" ? em : undefined);
  const novos: HistoricoItem[] = atual
    ? diferencas(atual, conteudo, ctx.por, em)
    : [{ em, por: ctx.por, campo: "criacao", de: null, para: publicacao }];

  const imovel: Imovel = {
    codigo: ctx.codigo,
    ...conteudo,
    status_desde: statusMudou || !atual ? em : atual.status_desde,
    ...(publicadoEm ? { publicado_em: publicadoEm } : {}),
    criado_em: atual?.criado_em ?? em,
    atualizado_em: em,
    atualizado_por: ctx.por,
    historico: acrescentar(atual?.historico ?? [], novos),
  };
  return { ok: true, imovel };
}
