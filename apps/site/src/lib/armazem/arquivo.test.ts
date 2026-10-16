import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ArmazemFotosArquivo, ArmazemJsonArquivo } from "./arquivo";
import { testarContratoArmazemJson } from "./contrato-armazem";

const diretorioTemporario = () => mkdtemp(path.join(tmpdir(), "mcv-armazem-"));

testarContratoArmazemJson("arquivo", async () => new ArmazemJsonArquivo(await diretorioTemporario()));

describe("ArmazemJsonArquivo", () => {
  it("recusa caminho com ..", async () => {
    const armazem = new ArmazemJsonArquivo(await diretorioTemporario());
    await expect(armazem.gravar("../fora.json", {})).rejects.toThrow("Caminho inválido");
  });
});

describe("ArmazemFotosArquivo", () => {
  const origem = "http://localhost:3100/e2e-fotos";

  it("envia WebP no caminho de fotos e devolve a URL com a origem", async () => {
    const fotos = new ArmazemFotosArquivo(await diretorioTemporario(), origem);
    const { url } = await fotos.enviar("imoveis/MC001/fotos/1-abc-800.webp", Buffer.from("webp"), "image/webp");
    expect(url).toBe(`${origem}/imoveis/MC001/fotos/1-abc-800.webp`);
    expect(await fotos.listar("imoveis/MC001/fotos/")).toEqual(["imoveis/MC001/fotos/1-abc-800.webp"]);
  });

  it("recusa qualquer coisa que não seja WebP em caminho de foto (store público só tem fotos)", async () => {
    const fotos = new ArmazemFotosArquivo(await diretorioTemporario(), origem);
    await expect(fotos.enviar("imoveis/MC001/imovel.json", Buffer.from("{}"), "application/json")).rejects.toThrow(
      "Store público aceita só fotos .webp",
    );
    await expect(fotos.enviar("imoveis/MC001/fotos/1.webp", Buffer.from("x"), "image/jpeg")).rejects.toThrow(
      "Store público aceita só fotos .webp",
    );
  });

  it("apaga as fotos listadas", async () => {
    const fotos = new ArmazemFotosArquivo(await diretorioTemporario(), origem);
    await fotos.enviar("imoveis/MC001/fotos/1-abc-800.webp", Buffer.from("a"), "image/webp");
    await fotos.apagar(["imoveis/MC001/fotos/1-abc-800.webp"]);
    expect(await fotos.listar("imoveis/MC001/fotos/")).toEqual([]);
  });
});
