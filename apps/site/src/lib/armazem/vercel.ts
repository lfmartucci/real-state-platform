import { BlobError, BlobPreconditionFailedError, copy, del, get, list, put } from "@vercel/blob";
import {
  ErroConflito,
  ErroJaExiste,
  validarEnvioDeFoto,
  type ArmazemFotos,
  type ArmazemJson,
  type ItemListado,
  type ObjetoJson,
  type OpcoesGravacao,
} from "./tipos";

/**
 * A mensagem de "já existe" é confirmada pelo script verificar-blob (Task 0.9).
 * Se ele mostrar outro texto, ajuste esta expressão e o teste de traduzirErroBlob.
 */
const MENSAGEM_JA_EXISTE = /already exists/i;

export function traduzirErroBlob(erro: unknown, caminho: string): unknown {
  if (erro instanceof BlobPreconditionFailedError) return new ErroConflito(caminho);
  if (erro instanceof BlobError && MENSAGEM_JA_EXISTE.test(erro.message)) return new ErroJaExiste(caminho);
  return erro;
}

async function listarTudo(token: string, prefixo: string): Promise<ItemListado[]> {
  const itens: ItemListado[] = [];
  let cursor: string | undefined;
  do {
    const pagina = await list({ prefix: prefixo, cursor, limit: 1000, token });
    for (const blob of pagina.blobs) {
      itens.push({ caminho: blob.pathname, etag: blob.etag, atualizadoEm: blob.uploadedAt });
    }
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor);
  return itens;
}

export class ArmazemJsonVercel implements ArmazemJson {
  constructor(private readonly token: string) {
    if (!token) throw new Error("BLOB_PRIVADO_READ_WRITE_TOKEN ausente");
  }

  async ler(caminho: string): Promise<ObjetoJson | null> {
    // useCache: false lê da origem; o cache do app fica no Next (unstable_cache), não no CDN.
    const resultado = await get(caminho, { access: "private", token: this.token, useCache: false });
    if (!resultado || resultado.statusCode !== 200) return null;
    const texto = await new Response(resultado.stream).text();
    return { dados: JSON.parse(texto), etag: resultado.blob.etag };
  }

  async gravar(caminho: string, dados: unknown, opcoes: OpcoesGravacao = {}): Promise<{ etag: string }> {
    try {
      const resultado = await put(caminho, JSON.stringify(dados, null, 2), {
        access: "private",
        token: this.token,
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: !opcoes.criarSomente,
        cacheControlMaxAge: 60,
        ...(opcoes.ifMatch ? { ifMatch: opcoes.ifMatch } : {}),
      });
      return { etag: resultado.etag };
    } catch (erro) {
      throw traduzirErroBlob(erro, caminho);
    }
  }

  async listar(prefixo: string): Promise<ItemListado[]> {
    return (await listarTudo(this.token, prefixo)).filter((item) => item.caminho.endsWith(".json"));
  }

  async listarPastas(prefixo: string): Promise<string[]> {
    const pastas: string[] = [];
    let cursor: string | undefined;
    do {
      const pagina = await list({ prefix: prefixo, mode: "folded", cursor, limit: 1000, token: this.token });
      pastas.push(...pagina.folders);
      cursor = pagina.hasMore ? pagina.cursor : undefined;
    } while (cursor);
    return pastas.sort();
  }

  async apagar(caminhosParaApagar: string[], opcoes: { ifMatch?: string } = {}): Promise<void> {
    if (caminhosParaApagar.length === 0) return;
    try {
      await del(caminhosParaApagar, { token: this.token, ...(opcoes.ifMatch ? { ifMatch: opcoes.ifMatch } : {}) });
    } catch (erro) {
      throw traduzirErroBlob(erro, caminhosParaApagar.join(", "));
    }
  }

  async copiar(de: string, para: string): Promise<void> {
    await copy(de, para, {
      access: "private",
      token: this.token,
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }
}

export class ArmazemFotosVercel implements ArmazemFotos {
  constructor(
    private readonly token: string,
    readonly origem: string,
  ) {
    if (!token) throw new Error("BLOB_PUBLICO_READ_WRITE_TOKEN ausente");
  }

  async enviar(caminho: string, conteudo: Buffer, contentType: string): Promise<{ url: string }> {
    validarEnvioDeFoto(caminho, contentType);
    const resultado = await put(caminho, conteudo, {
      access: "public",
      token: this.token,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      // O nome do arquivo leva o hash do conteúdo (ajuste C), então pode ficar em cache por um ano.
      cacheControlMaxAge: 31_536_000,
    });
    return { url: resultado.url };
  }

  async listar(prefixo: string): Promise<string[]> {
    return (await listarTudo(this.token, prefixo)).map((item) => item.caminho);
  }

  async apagar(caminhosParaApagar: string[]): Promise<void> {
    if (caminhosParaApagar.length > 0) await del(caminhosParaApagar, { token: this.token });
  }
}
