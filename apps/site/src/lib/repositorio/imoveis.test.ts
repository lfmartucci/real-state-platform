import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ArmazemJsonArquivo } from "@/lib/armazem/arquivo";
import { caminhos } from "@/lib/armazem/caminhos";
import type { ArmazemJson } from "@/lib/armazem/tipos";
import { imovelDeExemplo } from "@/testes/fixtures";
import {
  codigosUsados,
  gravarEndereco,
  gravarImovel,
  lerEndereco,
  lerImovel,
  listarImoveis,
  reservarCodigo,
} from "./imoveis";

const novoArmazem = async () => new ArmazemJsonArquivo(await mkdtemp(path.join(tmpdir(), "mcv-repo-")));
const agora = new Date("2026-10-15T12:00:00.000Z");

describe("repositório de imóveis", () => {
  it("grava e lê o imóvel com ETag", async () => {
    const armazem = await novoArmazem();
    const { etag } = await gravarImovel(armazem, imovelDeExemplo());
    expect(await lerImovel(armazem, "MC001")).toEqual({ imovel: imovelDeExemplo(), etag });
  });

  it("recusa gravar imóvel fora do esquema", async () => {
    const armazem = await novoArmazem();
    await expect(gravarImovel(armazem, imovelDeExemplo({ titulo: "curto" }))).rejects.toThrow();
  });

  it("lista só imovel.json, ordenado por código, e ignora arquivo corrompido com log", async () => {
    const armazem = await novoArmazem();
    await gravarImovel(armazem, imovelDeExemplo({ codigo: "MC002" }));
    await gravarImovel(armazem, imovelDeExemplo({ codigo: "MC001" }));
    await armazem.gravar(caminhos.imovel("MC003"), { quebrado: true });
    await armazem.gravar(caminhos.reserva("MC004"), { codigo: "MC004", reservado_em: agora.toISOString(), por: "skill" });
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const lista = await listarImoveis(armazem);
    expect(lista.map((imovel) => imovel.codigo)).toEqual(["MC001", "MC002"]);
    expect(erro).toHaveBeenCalledWith(expect.stringContaining("imoveis/MC003/imovel.json"));
    erro.mockRestore();
  });

  it("JSON malformado não derruba a listagem nem vaza conteúdo no log", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "mcv-repo-json-"));
    const armazem = new ArmazemJsonArquivo(raiz);
    await gravarImovel(armazem, imovelDeExemplo({ codigo: "MC001" }));
    await mkdir(path.join(raiz, "imoveis/MC002"), { recursive: true });
    await writeFile(path.join(raiz, caminhos.imovel("MC002")), "Rua das Flores, 10", "utf8");
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const lista = await listarImoveis(armazem);
    expect(lista.map((imovel) => imovel.codigo)).toEqual(["MC001"]);
    expect(erro).toHaveBeenCalledWith(expect.stringContaining("imoveis/MC002/imovel.json"));
    expect(JSON.stringify(erro.mock.calls)).not.toContain("Rua");
    erro.mockRestore();
  });

  it("guarda o endereço num arquivo separado do imóvel", async () => {
    const armazem = await novoArmazem();
    await gravarImovel(armazem, imovelDeExemplo());
    await gravarEndereco(armazem, { codigo: "MC001", endereco_completo: "Rua das Flores, 120", atualizado_em: agora.toISOString() });
    expect((await lerEndereco(armazem, "MC001"))?.endereco_completo).toBe("Rua das Flores, 120");
    expect(JSON.stringify(await lerImovel(armazem, "MC001"))).not.toContain("Rua das Flores");
  });
});

describe("reserva de código", () => {
  it("reserva MC001 num armazém vazio e grava reserva.json", async () => {
    const armazem = await novoArmazem();
    expect(await reservarCodigo(armazem, { agora, por: "skill" })).toBe("MC001");
    expect(await codigosUsados(armazem)).toEqual(["MC001"]);
  });

  it("conta imóvel, reserva e lápide como códigos usados", async () => {
    const armazem = await novoArmazem();
    await gravarImovel(armazem, imovelDeExemplo({ codigo: "MC001" }));
    await armazem.gravar(caminhos.reserva("MC002"), { codigo: "MC002", reservado_em: agora.toISOString(), por: "skill" });
    await armazem.gravar(caminhos.lapide("MC003"), { codigo: "MC003", excluido_em: agora.toISOString(), por: "gabriela@exemplo.com" });
    expect(await reservarCodigo(armazem, { agora, por: "skill" })).toBe("MC004");
  });

  it("dez reservas simultâneas recebem dez códigos diferentes (spec seção 10)", async () => {
    const armazem = await novoArmazem();
    const codigos = await Promise.all(Array.from({ length: 10 }, () => reservarCodigo(armazem, { agora, por: "skill" })));
    expect(new Set(codigos).size).toBe(10);
    expect([...codigos].sort()).toEqual(Array.from({ length: 10 }, (_, indice) => `MC${String(indice + 1).padStart(3, "0")}`));
  });

  it("não trava quando a listagem ainda não mostra o código recém-gravado", async () => {
    const armazem = await novoArmazem();
    await reservarCodigo(armazem, { agora, por: "skill" });
    const listagemAtrasada: ArmazemJson = {
      ler: (caminho) => armazem.ler(caminho),
      gravar: (caminho, dados, opcoes) => armazem.gravar(caminho, dados, opcoes),
      listar: (prefixo) => armazem.listar(prefixo),
      listarPastas: async () => [],
      apagar: (lista, opcoes) => armazem.apagar(lista, opcoes),
      copiar: (de, para) => armazem.copiar(de, para),
    };
    expect(await reservarCodigo(listagemAtrasada, { agora, por: "skill" })).toBe("MC002");
  });

  it("não reutiliza código com lápide mesmo sem reserva e com a listagem atrasada", async () => {
    const armazem = await novoArmazem();
    await armazem.gravar(caminhos.lapide("MC002"), { codigo: "MC002", excluido_em: agora.toISOString(), por: "skill" });
    const listagemAtrasada: ArmazemJson = {
      ler: (caminho) => armazem.ler(caminho),
      gravar: (caminho, dados, opcoes) => armazem.gravar(caminho, dados, opcoes),
      listar: (prefixo) => armazem.listar(prefixo),
      listarPastas: async () => ["imoveis/MC001/"],
      apagar: (lista, opcoes) => armazem.apagar(lista, opcoes),
      copiar: (de, para) => armazem.copiar(de, para),
    };
    expect(await reservarCodigo(listagemAtrasada, { agora, por: "skill" })).toBe("MC003");
  });
});
