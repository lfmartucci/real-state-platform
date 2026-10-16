import { describe, expect, it } from "vitest";
import { ArmazemJsonIndisponivel } from "./indisponivel";

describe("ArmazemJsonIndisponivel", () => {
  it("falha em toda leitura, como um Blob fora do ar", async () => {
    const armazem = new ArmazemJsonIndisponivel();
    await expect(armazem.ler("x.json")).rejects.toThrow("Armazém indisponível");
    await expect(armazem.listar("imoveis/")).rejects.toThrow("Armazém indisponível");
  });
});
