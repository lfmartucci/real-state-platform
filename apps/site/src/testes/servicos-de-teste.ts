import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ArmazemFotosArquivo, ArmazemJsonArquivo } from "@/lib/armazem/arquivo";
import type { Config } from "@/lib/config";
import { lerFlags } from "@/lib/repositorio/flags";
import { listarImoveis } from "@/lib/repositorio/imoveis";
import type { Servicos, TagCache } from "@/lib/servicos";
import { ORIGEM_FOTOS_TESTE } from "./fixtures";

export const CONFIG_TESTE: Config = {
  driver: "arquivo",
  armazemDir: "",
  armazemFotosDir: "",
  blobPrivadoToken: "",
  blobPublicoToken: "",
  fotosOrigem: ORIGEM_FOTOS_TESTE,
  authJwtSecret: "segredo-de-teste-com-mais-de-32-caracteres",
  authJwtTtlHoras: 8,
  googleClientId: "cliente-google-teste",
  authAllowlist: "gabriela@exemplo.com, Moises@Exemplo.com",
  skillApiSecret: "segredo-da-skill-de-teste",
  cronSecret: "segredo-do-cron-de-teste",
};

export type ServicosDeTeste = Servicos & {
  tagsRevalidadas: TagCache[];
  raiz: string;
  definirAgora(data: Date): void;
};

/** Servicos com armazém de arquivo num diretório temporário, relógio fixo e revalidação registrada. Sem cache. */
export async function criarServicosDeTeste(sobrescrever: Partial<Servicos> = {}): Promise<ServicosDeTeste> {
  const raiz = await mkdtemp(path.join(tmpdir(), "mcv-servicos-"));
  const armazem = new ArmazemJsonArquivo(path.join(raiz, "privado"));
  const fotos = new ArmazemFotosArquivo(path.join(raiz, "publico"), ORIGEM_FOTOS_TESTE);
  const tagsRevalidadas: TagCache[] = [];
  let agora = new Date("2026-10-15T12:00:00.000Z");
  return {
    armazem,
    fotos,
    config: { ...CONFIG_TESTE, armazemDir: raiz, armazemFotosDir: path.join(raiz, "publico") },
    agora: () => agora,
    definirAgora: (data) => {
      agora = data;
    },
    revalidar: async (tag) => {
      tagsRevalidadas.push(tag);
    },
    catalogo: () => listarImoveis(armazem),
    flags: async () => (await lerFlags(armazem)).flags,
    tagsRevalidadas,
    raiz,
    ...sobrescrever,
  };
}
