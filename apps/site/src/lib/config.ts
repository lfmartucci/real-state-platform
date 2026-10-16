import path from "node:path";
import { ArmazemFotosArquivo, ArmazemJsonArquivo } from "./armazem/arquivo";
import { ArmazemFotosIndisponivel, ArmazemJsonIndisponivel } from "./armazem/indisponivel";
import type { ArmazemFotos, ArmazemJson } from "./armazem/tipos";
import { ArmazemFotosVercel, ArmazemJsonVercel } from "./armazem/vercel";

export type DriverArmazem = "vercel" | "arquivo" | "indisponivel";
const DRIVERS: readonly DriverArmazem[] = ["vercel", "arquivo", "indisponivel"];
const TTL_PADRAO_HORAS = 8;

export interface Config {
  driver: DriverArmazem;
  armazemDir: string;
  armazemFotosDir: string;
  blobPrivadoToken: string;
  blobPublicoToken: string;
  fotosOrigem: string;
  authJwtSecret: string;
  authJwtTtlHoras: number;
  googleClientId: string;
  authAllowlist: string;
  skillApiSecret: string;
  cronSecret: string;
}

/** Lê o ambiente sem lançar por segredo ausente: cada consumidor nega acesso (fail-closed) se o seu estiver vazio. */
export function lerConfig(env: Record<string, string | undefined>): Config {
  const driver = (env.ARMAZEM_DRIVER || "vercel") as DriverArmazem;
  if (!DRIVERS.includes(driver)) throw new Error(`ARMAZEM_DRIVER inválido: ${env.ARMAZEM_DRIVER}`);
  const armazemDir = path.resolve(env.ARMAZEM_DIR || ".dados-local");
  const ttl = Number(env.AUTH_JWT_TTL_HORAS);
  return {
    driver,
    armazemDir,
    armazemFotosDir: env.ARMAZEM_FOTOS_DIR ? path.resolve(env.ARMAZEM_FOTOS_DIR) : path.join(armazemDir, "publico"),
    blobPrivadoToken: env.BLOB_PRIVADO_READ_WRITE_TOKEN ?? "",
    blobPublicoToken: env.BLOB_PUBLICO_READ_WRITE_TOKEN ?? "",
    fotosOrigem: (env.FOTOS_ORIGEM ?? "").replace(/\/$/, ""),
    authJwtSecret: env.AUTH_JWT_SECRET ?? "",
    authJwtTtlHoras: ttl > 0 ? ttl : TTL_PADRAO_HORAS,
    googleClientId: env.GOOGLE_CLIENT_ID ?? "",
    authAllowlist: env.AUTH_ALLOWLIST ?? "",
    skillApiSecret: env.SKILL_API_SECRET ?? "",
    cronSecret: env.CRON_SECRET ?? "",
  };
}

export function criarArmazens(config: Config): { armazem: ArmazemJson; fotos: ArmazemFotos } {
  switch (config.driver) {
    case "arquivo":
      return {
        armazem: new ArmazemJsonArquivo(path.join(config.armazemDir, "privado")),
        fotos: new ArmazemFotosArquivo(config.armazemFotosDir, config.fotosOrigem),
      };
    case "indisponivel":
      return { armazem: new ArmazemJsonIndisponivel(), fotos: new ArmazemFotosIndisponivel(config.fotosOrigem) };
    case "vercel":
      return {
        armazem: new ArmazemJsonVercel(config.blobPrivadoToken),
        fotos: new ArmazemFotosVercel(config.blobPublicoToken, config.fotosOrigem),
      };
  }
}
