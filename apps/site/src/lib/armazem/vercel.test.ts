import { BlobError, BlobPreconditionFailedError } from "@vercel/blob";
import { afterAll, describe, expect, it } from "vitest";
import { testarContratoArmazemJson } from "./contrato-armazem";
import { ErroConflito, ErroJaExiste } from "./tipos";
import { ArmazemJsonVercel, traduzirErroBlob } from "./vercel";

describe("traduzirErroBlob", () => {
  it("precondition failed vira ErroConflito", () => {
    expect(traduzirErroBlob(new BlobPreconditionFailedError(), "x.json")).toBeInstanceOf(ErroConflito);
  });

  it("blob que já existe vira ErroJaExiste", () => {
    expect(traduzirErroBlob(new BlobError("This blob already exists"), "x.json")).toBeInstanceOf(ErroJaExiste);
  });

  it("outros erros passam sem tradução", () => {
    const erro = new Error("rede");
    expect(traduzirErroBlob(erro, "x.json")).toBe(erro);
  });
});

const tokenDeTeste = process.env.BLOB_TESTE_READ_WRITE_TOKEN;
if (tokenDeTeste) {
  let rodada = 0;
  const prefixosCriados: string[] = [];
  // O store de teste não deve acumular lixo entre execuções.
  afterAll(async () => {
    const armazem = new ArmazemJsonVercel(tokenDeTeste);
    for (const prefixo of prefixosCriados) {
      const restantes = await armazem.listar(prefixo);
      if (restantes.length > 0) await armazem.apagar(restantes.map((item) => item.caminho));
    }
  });
  testarContratoArmazemJson("vercel (store de teste)", async () => {
    rodada += 1;
    const prefixo = `contrato-${Date.now()}-${rodada}/`;
    prefixosCriados.push(prefixo);
    const armazem = new ArmazemJsonVercel(tokenDeTeste);
    return {
      ler: (caminho) => armazem.ler(prefixo + caminho),
      gravar: (caminho, dados, opcoes) => armazem.gravar(prefixo + caminho, dados, opcoes),
      listar: async (p) => (await armazem.listar(prefixo + p)).map((item) => ({ ...item, caminho: item.caminho.slice(prefixo.length) })),
      listarPastas: async (p) => (await armazem.listarPastas(prefixo + p)).map((pasta) => pasta.slice(prefixo.length)),
      apagar: (lista, opcoes) => armazem.apagar(lista.map((caminho) => prefixo + caminho), opcoes),
      copiar: (de, para) => armazem.copiar(prefixo + de, prefixo + para),
    };
  });
}
