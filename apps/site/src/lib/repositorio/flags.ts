import { z } from "zod";
import { caminhos } from "@/lib/armazem/caminhos";
import type { ArmazemJson } from "@/lib/armazem/tipos";
import { FLAGS_PADRAO, FlagsSchema, type Flags } from "@/lib/contratos/flags";
import { ErroDadosInvalidos } from "./imoveis";

export async function lerFlags(armazem: ArmazemJson): Promise<{ flags: Flags; etag: string | null }> {
  const objeto = await armazem.ler(caminhos.flags);
  if (!objeto) return { flags: FLAGS_PADRAO, etag: null };
  const resultado = FlagsSchema.safeParse(objeto.dados);
  if (!resultado.success) throw new ErroDadosInvalidos(caminhos.flags, z.prettifyError(resultado.error));
  return { flags: resultado.data, etag: objeto.etag };
}

/** etagAtual null = o arquivo ainda não existe; a gravação só cria. */
export async function gravarFlags(armazem: ArmazemJson, flags: Flags, etagAtual: string | null) {
  const validas = FlagsSchema.parse(flags);
  return armazem.gravar(caminhos.flags, validas, etagAtual ? { ifMatch: etagAtual } : { criarSomente: true });
}
