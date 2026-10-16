import { REGEX_CODIGO } from "@/lib/contratos/comum";

const REGEX_DIA = /^\d{4}-\d{2}-\d{2}$/;

function codigoValido(codigo: string): string {
  if (!REGEX_CODIGO.test(codigo)) throw new Error("Código inválido");
  return codigo;
}

function diaValido(dia: string): string {
  if (!REGEX_DIA.test(dia)) throw new Error("Dia inválido");
  return dia;
}

/** Layout do Blob (spec seção 3). Único lugar que monta caminhos. */
export const caminhos = {
  pastaImoveis: "imoveis/",
  imovel: (codigo: string) => `imoveis/${codigoValido(codigo)}/imovel.json`,
  endereco: (codigo: string) => `imoveis/${codigoValido(codigo)}/endereco.json`,
  reserva: (codigo: string) => `imoveis/${codigoValido(codigo)}/reserva.json`,
  lapide: (codigo: string) => `imoveis/${codigoValido(codigo)}/excluido.json`,
  pastaFotos: (codigo: string) => `imoveis/${codigoValido(codigo)}/fotos/`,
  flags: "config/flags.json",
  pastaConfig: "config/",
  pastaEventos: "eventos/",
  pastaEventosDia: (dia: string) => `eventos/${diaValido(dia)}/`,
  evento: (dia: string, id: string) => `eventos/${diaValido(dia)}/${id}.json`,
  pastaResumos: "resumos/",
  resumo: (dia: string) => `resumos/${diaValido(dia)}.json`,
  pastaBackup: "backup/",
  pastaBackupDia: (dia: string) => `backup/${diaValido(dia)}/`,
} as const;
