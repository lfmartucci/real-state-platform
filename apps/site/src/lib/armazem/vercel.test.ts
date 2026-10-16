import { BlobError, BlobPreconditionFailedError } from "@vercel/blob";
import { describe, expect, it } from "vitest";
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
  testarContratoArmazemJson("vercel (store de teste)", async () => {
    rodada += 1;
    const prefixo = `contrato-${Date.now()}-${rodada}/`;
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
