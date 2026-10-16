export interface ObjetoJson {
  dados: unknown;
  etag: string;
}

export interface ItemListado {
  caminho: string;
  etag: string;
  atualizadoEm: Date;
}

export interface OpcoesGravacao {
  /** Grava só se o ETag atual for este. Falha com ErroConflito. */
  ifMatch?: string;
  /** Grava só se o caminho não existir. Falha com ErroJaExiste. */
  criarSomente?: boolean;
}

/** Store privado: JSON lido só pelo servidor do app. */
export interface ArmazemJson {
  ler(caminho: string): Promise<ObjetoJson | null>;
  gravar(caminho: string, dados: unknown, opcoes?: OpcoesGravacao): Promise<{ etag: string }>;
  /** Só arquivos .json sob o prefixo. */
  listar(prefixo: string): Promise<ItemListado[]>;
  /** Subpastas imediatas do prefixo, com barra final. */
  listarPastas(prefixo: string): Promise<string[]>;
  /** ifMatch só vale com um caminho. */
  apagar(caminhos: string[], opcoes?: { ifMatch?: string }): Promise<void>;
  copiar(de: string, para: string): Promise<void>;
}

/** Store público: só fotos .webp. */
export interface ArmazemFotos {
  /** Origem das URLs, sem barra final. */
  readonly origem: string;
  enviar(caminho: string, conteudo: Buffer, contentType: string): Promise<{ url: string }>;
  listar(prefixo: string): Promise<string[]>;
  apagar(caminhos: string[]): Promise<void>;
}

export class ErroConflito extends Error {
  constructor(caminho: string) {
    super(`ETag não confere em ${caminho}`);
    this.name = "ErroConflito";
  }
}

export class ErroJaExiste extends Error {
  constructor(caminho: string) {
    super(`Já existe ${caminho}`);
    this.name = "ErroJaExiste";
  }
}

/** Sem `cause` de propósito: a mensagem original do JSON.parse ecoa os primeiros caracteres do conteúdo. */
export class ErroJsonInvalido extends Error {
  constructor(caminho: string) {
    super(`${caminho} não é JSON válido`);
    this.name = "ErroJsonInvalido";
  }
}

const REGEX_CAMINHO_FOTO = /^imoveis\/MC\d{3}\/fotos\/[A-Za-z0-9._-]+\.webp$/;

/** Barreira do store público (spec seção 9): nada além de .webp em imoveis/<codigo>/fotos/. */
export function validarEnvioDeFoto(caminho: string, contentType: string): void {
  if (contentType !== "image/webp" || !REGEX_CAMINHO_FOTO.test(caminho)) {
    throw new Error(`Store público aceita só fotos .webp em imoveis/<codigo>/fotos/ (recebido ${caminho}, ${contentType})`);
  }
}

export function interpretarJson(texto: string, caminho: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErroJsonInvalido(caminho);
  }
}
