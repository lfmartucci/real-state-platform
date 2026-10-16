import { z } from "zod";
import { caminhos } from "@/lib/armazem/caminhos";
import { ErroConflito, ErroJaExiste } from "@/lib/armazem/tipos";
import { autenticar, nomeDoAtor, type Ator } from "@/lib/auth/guarda";
import { CodigoSchema, REGEX_CODIGO } from "@/lib/contratos/comum";
import { ImovelEntradaSchema, LapideSchema, type Imovel, type ImovelEntrada } from "@/lib/contratos/imovel";
import { aplicarGravacao } from "@/lib/dominio/regras";
import {
  gravarEndereco,
  gravarImovel,
  lerEndereco,
  lerImovel,
  lerLapide,
  lerReserva,
  listarImoveis,
  reservarCodigo,
} from "@/lib/repositorio/imoveis";
import type { Servicos } from "@/lib/servicos";
import { detalhesZod, lerCorpoJson, respostaErro } from "./respostas";

const EnderecoEntrada = z.string().trim().min(5).max(300);
const CorpoCriacao = z.strictObject({ codigo: CodigoSchema, imovel: z.unknown(), endereco_completo: EnderecoEntrada.optional() });
const CorpoAtualizacao = z.strictObject({ imovel: z.unknown(), endereco_completo: EnderecoEntrada.optional() });

const MENSAGEM_CONFLITO = "Outra pessoa alterou este imóvel. Recarregue e tente de novo.";

function respostaImovel(imovel: Imovel, etag: string, status = 200, extra: Record<string, unknown> = {}): Response {
  return Response.json({ imovel, etag, ...extra }, { status, headers: { ETag: etag } });
}

function naoEncontrado(): Response {
  return respostaErro(404, "nao_encontrado", "Imóvel não encontrado.");
}

async function validarEntrada(bruto: unknown, codigo: string, s: Servicos): Promise<{ entrada: ImovelEntrada } | { resposta: Response }> {
  const resultado = ImovelEntradaSchema.safeParse(bruto);
  if (!resultado.success) {
    return { resposta: respostaErro(422, "esquema_invalido", "O imóvel não passou na validação.", { detalhes: detalhesZod(resultado.error) }) };
  }
  if (!s.config.fotosOrigem) return { resposta: respostaErro(500, "config_ausente", "FOTOS_ORIGEM não configurada no servidor.") };
  const prefixo = `${s.config.fotosOrigem}/imoveis/${codigo}/fotos/`;
  const foraDoStore = resultado.data.fotos.some((foto) => Object.values(foto.larguras).some((url) => !url.startsWith(prefixo)));
  if (foraDoStore) {
    return { resposta: respostaErro(422, "foto_fora_do_store", `Toda foto precisa estar em ${prefixo}`) };
  }
  return { entrada: resultado.data };
}

async function contarDestaquesDeOutros(s: Servicos, codigo: string): Promise<number> {
  return (await listarImoveis(s.armazem)).filter((imovel) => imovel.destaque && imovel.codigo !== codigo).length;
}

async function aplicar(s: Servicos, ator: Ator, codigo: string, atual: Imovel | null, entrada: ImovelEntrada) {
  return aplicarGravacao({
    codigo,
    atual,
    entrada,
    por: nomeDoAtor(ator),
    agora: s.agora(),
    destaquesDeOutros: await contarDestaquesDeOutros(s, codigo),
  });
}

export async function tratarListarImoveis(req: Request, s: Servicos): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: true });
  if (ator instanceof Response) return ator;
  return Response.json({ imoveis: await listarImoveis(s.armazem) });
}

export async function tratarReservarCodigo(req: Request, s: Servicos): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: true });
  if (ator instanceof Response) return ator;
  const codigo = await reservarCodigo(s.armazem, { agora: s.agora(), por: nomeDoAtor(ator) });
  return Response.json({ codigo }, { status: 201 });
}

export async function tratarCriarImovel(req: Request, s: Servicos): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: true });
  if (ator instanceof Response) return ator;
  const leitura = await lerCorpoJson(req);
  if (!leitura.ok) return leitura.resposta;
  const pedido = CorpoCriacao.safeParse(leitura.corpo);
  if (!pedido.success) return respostaErro(400, "corpo_invalido", "Envie { codigo, imovel, endereco_completo? }.", { detalhes: detalhesZod(pedido.error) });
  const { codigo, endereco_completo } = pedido.data;

  if (await lerLapide(s.armazem, codigo)) return respostaErro(410, "codigo_excluido", "Este código foi excluído e não volta a ser usado.");
  if (!(await lerReserva(s.armazem, codigo))) return respostaErro(422, "sem_reserva", "Reserve o código antes (POST /api/imoveis/reservas).");
  if (await lerImovel(s.armazem, codigo)) return respostaErro(409, "ja_existe", "Este código já tem imóvel. Use PUT para editar.");

  const validacao = await validarEntrada(pedido.data.imovel, codigo, s);
  if ("resposta" in validacao) return validacao.resposta;
  const resultado = await aplicar(s, ator, codigo, null, validacao.entrada);
  if (!resultado.ok) return respostaErro(422, resultado.erro, resultado.mensagem);

  let etag: string;
  try {
    ({ etag } = await gravarImovel(s.armazem, resultado.imovel, { criarSomente: true }));
  } catch (erro) {
    if (erro instanceof ErroJaExiste) return respostaErro(409, "ja_existe", "Este código já tem imóvel. Use PUT para editar.");
    throw erro;
  }
  if (endereco_completo) {
    await gravarEndereco(s.armazem, { codigo, endereco_completo, atualizado_em: s.agora().toISOString() });
  }
  await s.revalidar("imoveis");
  return respostaImovel(resultado.imovel, etag, 201);
}

export async function tratarLerImovel(req: Request, s: Servicos, codigo: string): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: true });
  if (ator instanceof Response) return ator;
  if (!REGEX_CODIGO.test(codigo)) return naoEncontrado();
  const lido = await lerImovel(s.armazem, codigo);
  if (!lido) {
    return (await lerLapide(s.armazem, codigo)) ? respostaErro(410, "codigo_excluido", "Este imóvel foi excluído.") : naoEncontrado();
  }
  const endereco = await lerEndereco(s.armazem, codigo);
  return respostaImovel(lido.imovel, lido.etag, 200, { endereco_completo: endereco?.endereco_completo ?? null });
}

export async function tratarAtualizarImovel(req: Request, s: Servicos, codigo: string): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: true });
  if (ator instanceof Response) return ator;
  if (!REGEX_CODIGO.test(codigo)) return naoEncontrado();
  const ifMatch = req.headers.get("if-match");
  if (!ifMatch) return respostaErro(428, "etag_ausente", "Envie o cabeçalho If-Match com o ETag da última leitura.");
  const leitura = await lerCorpoJson(req);
  if (!leitura.ok) return leitura.resposta;
  const pedido = CorpoAtualizacao.safeParse(leitura.corpo);
  if (!pedido.success) return respostaErro(400, "corpo_invalido", "Envie { imovel, endereco_completo? }.", { detalhes: detalhesZod(pedido.error) });

  const lido = await lerImovel(s.armazem, codigo);
  if (!lido) {
    return (await lerLapide(s.armazem, codigo)) ? respostaErro(410, "codigo_excluido", "Este imóvel foi excluído.") : naoEncontrado();
  }
  if (lido.etag !== ifMatch) return respostaErro(409, "conflito", MENSAGEM_CONFLITO);

  const validacao = await validarEntrada(pedido.data.imovel, codigo, s);
  if ("resposta" in validacao) return validacao.resposta;
  const resultado = await aplicar(s, ator, codigo, lido.imovel, validacao.entrada);
  if (!resultado.ok) return respostaErro(422, resultado.erro, resultado.mensagem);

  let etag: string;
  try {
    ({ etag } = await gravarImovel(s.armazem, resultado.imovel, { ifMatch }));
  } catch (erro) {
    if (erro instanceof ErroConflito) return respostaErro(409, "conflito", MENSAGEM_CONFLITO);
    throw erro;
  }
  if (pedido.data.endereco_completo) {
    await gravarEndereco(s.armazem, { codigo, endereco_completo: pedido.data.endereco_completo, atualizado_em: s.agora().toISOString() });
  }
  await s.revalidar("imoveis");
  return respostaImovel(resultado.imovel, etag);
}

const CorpoExclusao = z.strictObject({ confirmacao: z.string() });

async function apagarRestos(s: Servicos, codigo: string): Promise<void> {
  await s.armazem.apagar([caminhos.endereco(codigo), caminhos.reserva(codigo)]);
  await s.fotos.apagar(await s.fotos.listar(caminhos.pastaFotos(codigo)));
}

/** Só rascunho, só painel, com o código digitado. Os backups guardam os JSON por 30 dias; as fotos não voltam (spec 6). */
export async function tratarExcluirImovel(req: Request, s: Servicos, codigo: string): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: false });
  if (ator instanceof Response) return ator;
  if (!REGEX_CODIGO.test(codigo)) return naoEncontrado();
  const ifMatch = req.headers.get("if-match");
  if (!ifMatch) return respostaErro(428, "etag_ausente", "Envie o cabeçalho If-Match com o ETag da última leitura.");
  const leitura = await lerCorpoJson(req, 1_000);
  if (!leitura.ok) return leitura.resposta;
  const pedido = CorpoExclusao.safeParse(leitura.corpo);
  if (!pedido.success || pedido.data.confirmacao !== codigo) {
    return respostaErro(422, "confirmacao_invalida", `Digite ${codigo} para confirmar a exclusão.`);
  }

  const lido = await lerImovel(s.armazem, codigo);
  if (!lido) {
    // Exclusão que parou no meio: termina de limpar o que sobrou.
    if (await lerLapide(s.armazem, codigo)) {
      await s.revalidar("imoveis");
      await apagarRestos(s, codigo);
      return Response.json({ excluido: codigo });
    }
    return naoEncontrado();
  }
  if (lido.imovel.publicacao !== "rascunho") return respostaErro(422, "so_rascunho", "Retire o imóvel do ar antes de excluir.");
  if (lido.etag !== ifMatch) return respostaErro(409, "conflito", MENSAGEM_CONFLITO);

  // A lápide vem primeiro: mesmo que algo falhe depois, o código nunca volta a ser usado.
  const lapide = LapideSchema.parse({ codigo, excluido_em: s.agora().toISOString(), por: nomeDoAtor(ator) });
  await s.armazem.gravar(caminhos.lapide(codigo), lapide);
  try {
    await s.armazem.apagar([caminhos.imovel(codigo)], { ifMatch });
  } catch (erro) {
    if (erro instanceof ErroConflito) {
      // Só desfaz a lápide se o imóvel continua no ar (outro PUT mudou o ETag). Se ele sumiu, outra
      // exclusão venceu a corrida: a lápide é dela e precisa ficar, senão o código seria reaproveitado.
      if (await lerImovel(s.armazem, codigo)) await s.armazem.apagar([caminhos.lapide(codigo)]);
      return respostaErro(409, "conflito", MENSAGEM_CONFLITO);
    }
    throw erro;
  }
  // Revalida já: o imóvel saiu do ar, mesmo que a limpeza abaixo falhe e o DELETE precise ser repetido.
  await s.revalidar("imoveis");
  await apagarRestos(s, codigo);
  return Response.json({ excluido: codigo });
}
