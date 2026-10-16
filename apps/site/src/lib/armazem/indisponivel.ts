import type { ArmazemFotos, ArmazemJson } from "./tipos";

const falhar = (): never => {
  throw new Error("Armazém indisponível (ARMAZEM_DRIVER=indisponivel)");
};

/** Simula o Blob fora do ar, para o estado de erro do site (e2e na porta 3101). */
export class ArmazemJsonIndisponivel implements ArmazemJson {
  ler: ArmazemJson["ler"] = async () => falhar();
  gravar: ArmazemJson["gravar"] = async () => falhar();
  listar: ArmazemJson["listar"] = async () => falhar();
  listarPastas: ArmazemJson["listarPastas"] = async () => falhar();
  apagar: ArmazemJson["apagar"] = async () => falhar();
  copiar: ArmazemJson["copiar"] = async () => falhar();
}

export class ArmazemFotosIndisponivel implements ArmazemFotos {
  constructor(readonly origem: string) {}
  enviar: ArmazemFotos["enviar"] = async () => falhar();
  listar: ArmazemFotos["listar"] = async () => falhar();
  apagar: ArmazemFotos["apagar"] = async () => falhar();
}
