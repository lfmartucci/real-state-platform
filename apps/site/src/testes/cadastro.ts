import { tratarCriarImovel, tratarReservarCodigo } from "@/lib/api/imoveis";
import type { Imovel, ImovelEntrada } from "@/lib/contratos/imovel";
import type { Servicos } from "@/lib/servicos";
import { entradaDeExemplo, fotosDeExemplo } from "./fixtures";
import { requisicao, type ComoAutenticar } from "./requisicoes";

/** Fluxo da skill: reserva o código e cria o imóvel com fotos na pasta desse código. */
export async function cadastrar(
  s: Servicos,
  entrada: Partial<ImovelEntrada> = {},
  extras: { endereco_completo?: string; autenticacao?: ComoAutenticar } = {},
): Promise<{ codigo: string; etag: string; imovel: Imovel }> {
  const autenticacao = extras.autenticacao ?? "skill";
  const reserva = await tratarReservarCodigo(requisicao("POST", "/api/imoveis/reservas", { autenticacao }), s);
  const { codigo } = (await reserva.json()) as { codigo: string };
  const corpo = {
    codigo,
    imovel: entradaDeExemplo({ fotos: fotosDeExemplo(codigo), ...entrada }),
    ...(extras.endereco_completo ? { endereco_completo: extras.endereco_completo } : {}),
  };
  const resposta = await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo, autenticacao }), s);
  if (resposta.status !== 201) throw new Error(`cadastro falhou: ${resposta.status} ${await resposta.text()}`);
  const { imovel, etag } = (await resposta.json()) as { imovel: Imovel; etag: string };
  return { codigo, etag, imovel };
}
