import { describe, expect, it } from "vitest";
import { ArmazemJsonArquivo } from "./armazem/arquivo";
import { ArmazemJsonIndisponivel } from "./armazem/indisponivel";
import { criarArmazens, lerConfig } from "./config";

describe("lerConfig", () => {
  it("usa o driver vercel por padrão e TTL de 8 horas", () => {
    const config = lerConfig({});
    expect(config.driver).toBe("vercel");
    expect(config.authJwtTtlHoras).toBe(8);
  });

  it("ignora TTL não positivo", () => {
    expect(lerConfig({ AUTH_JWT_TTL_HORAS: "-5" }).authJwtTtlHoras).toBe(8);
    expect(lerConfig({ AUTH_JWT_TTL_HORAS: "2" }).authJwtTtlHoras).toBe(2);
  });

  it("recusa driver desconhecido", () => {
    expect(() => lerConfig({ ARMAZEM_DRIVER: "s3" })).toThrow("ARMAZEM_DRIVER inválido");
  });

  it("tira a barra final da origem das fotos", () => {
    expect(lerConfig({ FOTOS_ORIGEM: "https://x.public.blob.vercel-storage.com/" }).fotosOrigem).toBe(
      "https://x.public.blob.vercel-storage.com",
    );
  });

  it("fotos do driver arquivo ficam em $ARMAZEM_DIR/publico por padrão", () => {
    expect(lerConfig({ ARMAZEM_DRIVER: "arquivo", ARMAZEM_DIR: "/tmp/x" }).armazemFotosDir).toBe("/tmp/x/publico");
  });
});

describe("criarArmazens", () => {
  it("monta o adaptador de cada driver", () => {
    expect(criarArmazens(lerConfig({ ARMAZEM_DRIVER: "arquivo", ARMAZEM_DIR: "/tmp/x" })).armazem).toBeInstanceOf(ArmazemJsonArquivo);
    expect(criarArmazens(lerConfig({ ARMAZEM_DRIVER: "indisponivel" })).armazem).toBeInstanceOf(ArmazemJsonIndisponivel);
  });

  it("driver vercel sem token falha com mensagem clara", () => {
    expect(() => criarArmazens(lerConfig({ ARMAZEM_DRIVER: "vercel" }))).toThrow("BLOB_PRIVADO_READ_WRITE_TOKEN ausente");
  });
});
