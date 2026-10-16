import { describe, expect, it } from "vitest";
import { ErroConflito, ErroJaExiste, type ArmazemJson } from "./tipos";

/** Comportamento que todo adaptador precisa ter igual ao Vercel Blob. */
export function testarContratoArmazemJson(nome: string, criar: () => Promise<ArmazemJson>) {
  describe(`contrato ArmazemJson: ${nome}`, () => {
    it("ler devolve null para caminho inexistente", async () => {
      const armazem = await criar();
      expect(await armazem.ler("teste/nao-existe.json")).toBeNull();
    });

    it("grava, lê o mesmo conteúdo e devolve o mesmo ETag", async () => {
      const armazem = await criar();
      const { etag } = await armazem.gravar("teste/a.json", { valor: 1 });
      const lido = await armazem.ler("teste/a.json");
      expect(lido).toEqual({ dados: { valor: 1 }, etag });
    });

    it("criarSomente recusa sobrescrever com ErroJaExiste", async () => {
      const armazem = await criar();
      await armazem.gravar("teste/b.json", { valor: 1 }, { criarSomente: true });
      await expect(armazem.gravar("teste/b.json", { valor: 2 }, { criarSomente: true })).rejects.toBeInstanceOf(ErroJaExiste);
      expect((await armazem.ler("teste/b.json"))?.dados).toEqual({ valor: 1 });
    });

    it("criarSomente concorrente: exatamente uma gravação vence", async () => {
      const armazem = await criar();
      const resultados = await Promise.allSettled(
        Array.from({ length: 5 }, (_, indice) => armazem.gravar("teste/c.json", { indice }, { criarSomente: true })),
      );
      expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
      const recusas = resultados.filter((resultado) => resultado.status === "rejected");
      expect(recusas.every((recusa) => recusa.reason instanceof ErroJaExiste)).toBe(true);
    });

    it("ifMatch com ETag atual grava; com ETag velho lança ErroConflito", async () => {
      const armazem = await criar();
      const primeiro = await armazem.gravar("teste/d.json", { versao: 1 });
      const segundo = await armazem.gravar("teste/d.json", { versao: 2 }, { ifMatch: primeiro.etag });
      expect(segundo.etag).not.toBe(primeiro.etag);
      await expect(armazem.gravar("teste/d.json", { versao: 3 }, { ifMatch: primeiro.etag })).rejects.toBeInstanceOf(ErroConflito);
      expect((await armazem.ler("teste/d.json"))?.dados).toEqual({ versao: 2 });
    });

    it("listar devolve só os .json do prefixo; listarPastas devolve as subpastas", async () => {
      const armazem = await criar();
      await armazem.gravar("lista/MC001/imovel.json", {});
      await armazem.gravar("lista/MC002/reserva.json", {});
      await armazem.gravar("outra/x.json", {});
      const caminhosListados = (await armazem.listar("lista/")).map((item) => item.caminho).sort();
      expect(caminhosListados).toEqual(["lista/MC001/imovel.json", "lista/MC002/reserva.json"]);
      expect((await armazem.listarPastas("lista/")).sort()).toEqual(["lista/MC001/", "lista/MC002/"]);
    });

    it("apagar remove; apagar com ifMatch velho lança ErroConflito", async () => {
      const armazem = await criar();
      const { etag } = await armazem.gravar("teste/e.json", { versao: 1 });
      await armazem.gravar("teste/e.json", { versao: 2 });
      await expect(armazem.apagar(["teste/e.json"], { ifMatch: etag })).rejects.toBeInstanceOf(ErroConflito);
      await armazem.apagar(["teste/e.json"]);
      expect(await armazem.ler("teste/e.json")).toBeNull();
    });

    it("copiar duplica o conteúdo e sobrescreve o destino", async () => {
      const armazem = await criar();
      await armazem.gravar("teste/origem.json", { valor: "novo" });
      await armazem.gravar("copia/origem.json", { valor: "velho" });
      await armazem.copiar("teste/origem.json", "copia/origem.json");
      expect((await armazem.ler("copia/origem.json"))?.dados).toEqual({ valor: "novo" });
    });
  });
}
