import { z } from "zod";
import { caminhos } from "@/lib/armazem/caminhos";
import { ErroJaExiste, type ArmazemJson, type OpcoesGravacao } from "@/lib/armazem/tipos";
import { REGEX_CODIGO } from "@/lib/contratos/comum";
import {
  EnderecoSchema,
  ImovelSchema,
  LapideSchema,
  ReservaSchema,
  type Endereco,
  type Imovel,
  type Lapide,
  type Reserva,
} from "@/lib/contratos/imovel";
import { numeroDoCodigo, proximoCodigo } from "@/lib/dominio/codigo";

export class ErroDadosInvalidos extends Error {
  constructor(caminho: string, detalhe: string) {
    super(`${caminho} fora do esquema: ${detalhe}`);
    this.name = "ErroDadosInvalidos";
  }
}

async function lerValidado<T>(armazem: ArmazemJson, caminho: string, esquema: z.ZodType<T>) {
  const objeto = await armazem.ler(caminho);
  if (!objeto) return null;
  const resultado = esquema.safeParse(objeto.dados);
  if (!resultado.success) throw new ErroDadosInvalidos(caminho, z.prettifyError(resultado.error));
  return { dados: resultado.data, etag: objeto.etag };
}

export async function lerImovel(armazem: ArmazemJson, codigo: string): Promise<{ imovel: Imovel; etag: string } | null> {
  const lido = await lerValidado(armazem, caminhos.imovel(codigo), ImovelSchema);
  return lido ? { imovel: lido.dados, etag: lido.etag } : null;
}

export async function listarImoveis(armazem: ArmazemJson): Promise<Imovel[]> {
  const arquivos = (await armazem.listar(caminhos.pastaImoveis)).filter((item) => item.caminho.endsWith("/imovel.json"));
  const lidos = await Promise.all(
    arquivos.map(async (item) => {
      const objeto = await armazem.ler(item.caminho);
      if (!objeto) return null;
      const resultado = ImovelSchema.safeParse(objeto.dados);
      if (!resultado.success) {
        // Só o caminho vai para o log: o conteúdo pode ter dados que não devem sair do store.
        console.error(`[catalogo] ${item.caminho} fora do esquema; ignorado na listagem`);
        return null;
      }
      return resultado.data;
    }),
  );
  return lidos.filter((imovel): imovel is Imovel => imovel !== null).sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export async function gravarImovel(armazem: ArmazemJson, imovel: Imovel, opcoes: OpcoesGravacao = {}) {
  const valido = ImovelSchema.parse(imovel);
  return armazem.gravar(caminhos.imovel(valido.codigo), valido, opcoes);
}

export async function lerEndereco(armazem: ArmazemJson, codigo: string): Promise<Endereco | null> {
  return (await lerValidado(armazem, caminhos.endereco(codigo), EnderecoSchema))?.dados ?? null;
}

export async function gravarEndereco(armazem: ArmazemJson, endereco: Endereco): Promise<void> {
  const valido = EnderecoSchema.parse(endereco);
  await armazem.gravar(caminhos.endereco(valido.codigo), valido);
}

export async function lerReserva(armazem: ArmazemJson, codigo: string): Promise<Reserva | null> {
  return (await lerValidado(armazem, caminhos.reserva(codigo), ReservaSchema))?.dados ?? null;
}

export async function lerLapide(armazem: ArmazemJson, codigo: string): Promise<Lapide | null> {
  return (await lerValidado(armazem, caminhos.lapide(codigo), LapideSchema))?.dados ?? null;
}

export async function codigosUsados(armazem: ArmazemJson): Promise<string[]> {
  const pastas = await armazem.listarPastas(caminhos.pastaImoveis);
  return pastas
    .map((pasta) => pasta.slice(caminhos.pastaImoveis.length).replace(/\/$/, ""))
    .filter((codigo) => REGEX_CODIGO.test(codigo))
    .sort();
}

const TENTATIVAS_DE_RESERVA = 10;

/**
 * Reserva o próximo código gravando reserva.json com criação exclusiva.
 * Na colisão, tenta o seguinte ao que colidiu, mesmo que a listagem ainda não mostre o código novo.
 */
export async function reservarCodigo(armazem: ArmazemJson, contexto: { agora: Date; por: string }): Promise<string> {
  let minimo = 1;
  for (let tentativa = 0; tentativa < TENTATIVAS_DE_RESERVA; tentativa += 1) {
    const codigo = proximoCodigo(await codigosUsados(armazem), minimo);
    const reserva = ReservaSchema.parse({ codigo, reservado_em: contexto.agora.toISOString(), por: contexto.por });
    try {
      await armazem.gravar(caminhos.reserva(codigo), reserva, { criarSomente: true });
      return codigo;
    } catch (erro) {
      if (!(erro instanceof ErroJaExiste)) throw erro;
      minimo = numeroDoCodigo(codigo) + 1;
    }
  }
  throw new Error(`Não foi possível reservar um código em ${TENTATIVAS_DE_RESERVA} tentativas`);
}
