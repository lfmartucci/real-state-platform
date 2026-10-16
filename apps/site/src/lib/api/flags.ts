import { z } from "zod";
import { ErroConflito, ErroJaExiste } from "@/lib/armazem/tipos";
import { autenticar } from "@/lib/auth/guarda";
import { FlagsEntradaSchema, type Flags } from "@/lib/contratos/flags";
import { gravarFlags, lerFlags } from "@/lib/repositorio/flags";
import type { Servicos } from "@/lib/servicos";
import { detalhesZod, lerCorpoJson, respostaErro } from "./respostas";

const CorpoFlags = z.strictObject({ flags: FlagsEntradaSchema, confirmacao_medicao: z.literal("LIGAR").optional() });
const MENSAGEM_CONFLITO = "Outra pessoa alterou os campos visíveis. Recarregue e tente de novo.";

export async function tratarLerFlags(req: Request, s: Servicos): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: false });
  if (ator instanceof Response) return ator;
  return Response.json(await lerFlags(s.armazem));
}

export async function tratarGravarFlags(req: Request, s: Servicos): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: false });
  if (ator instanceof Response) return ator;
  if (ator.tipo !== "admin") return respostaErro(403, "skill_nao_permitida", "Esta rota é só do painel.");
  const leitura = await lerCorpoJson(req, 10_000);
  if (!leitura.ok) return leitura.resposta;
  const pedido = CorpoFlags.safeParse(leitura.corpo);
  if (!pedido.success) {
    return respostaErro(422, "esquema_invalido", "Campos visíveis inválidos (máximo de 4 na primeira dobra).", { detalhes: detalhesZod(pedido.error) });
  }

  const atual = await lerFlags(s.armazem);
  const ifMatch = req.headers.get("if-match");
  if (atual.etag && !ifMatch) return respostaErro(428, "etag_ausente", "Envie o cabeçalho If-Match com o ETag da última leitura.");
  if (atual.etag && ifMatch !== atual.etag) return respostaErro(409, "conflito", MENSAGEM_CONFLITO);
  if (!atual.flags.eventos_ativos && pedido.data.flags.eventos_ativos && pedido.data.confirmacao_medicao !== "LIGAR") {
    return respostaErro(422, "confirmacao_medicao", "Para ligar a medição, digite LIGAR. Só ligue com o de acordo do Moisés por escrito.");
  }

  const flags: Flags = { ...pedido.data.flags, atualizado_em: s.agora().toISOString(), atualizado_por: ator.email };
  let etag: string;
  try {
    ({ etag } = await gravarFlags(s.armazem, flags, atual.etag));
  } catch (erro) {
    if (erro instanceof ErroConflito || erro instanceof ErroJaExiste) return respostaErro(409, "conflito", MENSAGEM_CONFLITO);
    throw erro;
  }
  await s.revalidar("flags");
  return Response.json({ flags, etag });
}
