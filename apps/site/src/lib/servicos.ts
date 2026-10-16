import { revalidateTag, unstable_cache } from "next/cache";
import type { ArmazemFotos, ArmazemJson } from "./armazem/tipos";
import { criarArmazens, lerConfig, type Config } from "./config";
import type { Flags } from "./contratos/flags";
import type { Imovel } from "./contratos/imovel";
import { lerFlags } from "./repositorio/flags";
import { listarImoveis } from "./repositorio/imoveis";

export type TagCache = "imoveis" | "flags";

/** Tudo de que os handlers e as páginas precisam. Os testes montam um Servicos próprio (src/testes/servicos-de-teste.ts). */
export interface Servicos {
  armazem: ArmazemJson;
  fotos: ArmazemFotos;
  config: Config;
  agora(): Date;
  revalidar(tag: TagCache): Promise<void>;
  /** Todos os imóveis (inclusive rascunhos), com cache por tag "imoveis". Só para uso no servidor. */
  catalogo(): Promise<Imovel[]>;
  /** Flags com cache por tag "flags". */
  flags(): Promise<Flags>;
}

let instancia: Servicos | null = null;

/** Só no runtime do Next: depende de next/cache. */
export function servicos(): Servicos {
  if (instancia) return instancia;
  const config = lerConfig(process.env);
  const { armazem, fotos } = criarArmazens(config);
  instancia = {
    armazem,
    fotos,
    config,
    agora: () => new Date(),
    // Rotas de API não podem usar updateTag; { expire: 0 } expira na hora (docs do Next 16, revalidateTag).
    revalidar: async (tag) => {
      revalidateTag(tag, { expire: 0 });
    },
    catalogo: unstable_cache(() => listarImoveis(armazem), ["catalogo-imoveis"], { tags: ["imoveis"] }),
    flags: unstable_cache(async () => (await lerFlags(armazem)).flags, ["flags"], { tags: ["flags"] }),
  };
  return instancia;
}
