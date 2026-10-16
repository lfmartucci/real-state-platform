import { CAMPOS_DE_ENTRADA, type HistoricoItem, type ImovelEntrada } from "@/lib/contratos/imovel";

export const LIMITE_HISTORICO = 20;
const LIMITE_TEXTO = 200;

function resumir(campo: string, valor: unknown): string | null {
  if (valor === undefined) return null;
  if (campo === "fotos" && Array.isArray(valor)) return `${valor.length} fotos`;
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
  return texto.length > LIMITE_TEXTO ? texto.slice(0, LIMITE_TEXTO) : texto;
}

/** Só campos do imóvel entram: o endereço vive em outro arquivo e nunca chega aqui (spec 4.1). Ordem alfabética do campo. */
export function diferencas(antes: ImovelEntrada, depois: ImovelEntrada, por: string, em: string): HistoricoItem[] {
  return [...CAMPOS_DE_ENTRADA]
    .sort()
    .filter((campo) => JSON.stringify(antes[campo]) !== JSON.stringify(depois[campo]))
    .map((campo) => ({ em, por, campo, de: resumir(campo, antes[campo]), para: resumir(campo, depois[campo]) }));
}

export function acrescentar(historico: HistoricoItem[], novos: HistoricoItem[]): HistoricoItem[] {
  return [...historico, ...novos].slice(-LIMITE_HISTORICO);
}
