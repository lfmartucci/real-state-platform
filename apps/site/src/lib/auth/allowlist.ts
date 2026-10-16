export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function lerAllowlist(bruta?: string): Set<string> {
  if (!bruta) return new Set();
  return new Set(bruta.split(/[\s,;]+/).map(normalizarEmail).filter((email) => email.length > 0));
}

/** Nega por padrão: lista vazia não autoriza ninguém (spec seção 6). */
export function estaNaAllowlist(email: string, bruta?: string): boolean {
  const lista = lerAllowlist(bruta);
  return lista.size > 0 && lista.has(normalizarEmail(email));
}
