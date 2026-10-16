import { REGEX_CODIGO } from "@/lib/contratos/comum";

const MAIOR_NUMERO = 999;

export function numeroDoCodigo(codigo: string): number {
  if (!REGEX_CODIGO.test(codigo)) throw new Error("Código inválido");
  return Number(codigo.slice(2));
}

export function formatarCodigo(numero: number): string {
  return `MC${String(numero).padStart(3, "0")}`;
}

/** Maior código usado + 1, nunca abaixo de `minimo`. Usados incluem reservas e lápides (ajustes A e B). */
export function proximoCodigo(usados: string[], minimo = 1): string {
  const maior = usados.reduce((atual, codigo) => Math.max(atual, numeroDoCodigo(codigo)), 0);
  const proximo = Math.max(maior + 1, minimo);
  if (proximo > MAIOR_NUMERO) throw new Error("Códigos esgotados (MC999)");
  return formatarCodigo(proximo);
}
