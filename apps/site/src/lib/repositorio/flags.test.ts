import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ArmazemJsonArquivo } from "@/lib/armazem/arquivo";
import { ErroConflito, ErroJaExiste } from "@/lib/armazem/tipos";
import { FLAGS_PADRAO } from "@/lib/contratos/flags";
import { gravarFlags, lerFlags } from "./flags";

const novoArmazem = async () => new ArmazemJsonArquivo(await mkdtemp(path.join(tmpdir(), "mcv-flags-")));

describe("repositório de flags", () => {
  it("sem arquivo, devolve o padrão e ETag nulo", async () => {
    expect(await lerFlags(await novoArmazem())).toEqual({ flags: FLAGS_PADRAO, etag: null });
  });

  it("primeira gravação cria; a segunda exige o ETag", async () => {
    const armazem = await novoArmazem();
    const { etag } = await gravarFlags(armazem, { ...FLAGS_PADRAO, detalhes: ["vagas"] }, null);
    await expect(gravarFlags(armazem, FLAGS_PADRAO, null)).rejects.toBeInstanceOf(ErroJaExiste);
    await expect(gravarFlags(armazem, FLAGS_PADRAO, '"velho"')).rejects.toBeInstanceOf(ErroConflito);
    await gravarFlags(armazem, FLAGS_PADRAO, etag);
    expect((await lerFlags(armazem)).flags.detalhes).toEqual([]);
  });

  it("recusa gravar flags fora do esquema", async () => {
    const armazem = await novoArmazem();
    const invalidas = { ...FLAGS_PADRAO, primeira_dobra: ["area_util_m2", "quartos", "suites", "vagas", "iptu"] };
    await expect(gravarFlags(armazem, invalidas as typeof FLAGS_PADRAO, null)).rejects.toThrow();
  });
});
