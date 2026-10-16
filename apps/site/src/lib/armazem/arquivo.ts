import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ErroConflito,
  ErroJaExiste,
  interpretarJson,
  validarEnvioDeFoto,
  type ArmazemFotos,
  type ArmazemJson,
  type ItemListado,
  type ObjetoJson,
  type OpcoesGravacao,
} from "./tipos";

function codigoDoErro(erro: unknown): string | undefined {
  return typeof erro === "object" && erro !== null && "code" in erro ? String((erro as { code: unknown }).code) : undefined;
}

function etagDe(texto: string): string {
  return `"${createHash("sha1").update(texto).digest("hex")}"`;
}

function resolverDentro(raiz: string, caminho: string): string {
  if (caminho.split("/").includes("..") || path.isAbsolute(caminho)) throw new Error("Caminho inválido");
  return path.join(raiz, caminho);
}

async function listarArquivos(raiz: string, prefixo: string): Promise<string[]> {
  const encontrados: string[] = [];
  async function andar(diretorio: string) {
    let entradas;
    try {
      entradas = await readdir(diretorio, { withFileTypes: true });
    } catch (erro) {
      if (codigoDoErro(erro) === "ENOENT") return;
      throw erro;
    }
    for (const entrada of entradas) {
      const completo = path.join(diretorio, entrada.name);
      if (entrada.isDirectory()) await andar(completo);
      else encontrados.push(path.relative(raiz, completo).split(path.sep).join("/"));
    }
  }
  await andar(raiz);
  return encontrados.filter((caminho) => caminho.startsWith(prefixo) && !caminho.endsWith(".tmp")).sort();
}

/**
 * Adaptador local que imita o Vercel Blob: criação exclusiva (flag "wx") e ifMatch por ETag (sha1 do conteúdo).
 * As gravações num mesmo caminho entram numa fila, para o ifMatch não ter corrida dentro do processo.
 */
export class ArmazemJsonArquivo implements ArmazemJson {
  private readonly filas = new Map<string, Promise<unknown>>();

  constructor(private readonly raiz: string) {}

  private emFila<T>(caminho: string, tarefa: () => Promise<T>): Promise<T> {
    const anterior = this.filas.get(caminho) ?? Promise.resolve();
    const atual = anterior.then(tarefa, tarefa);
    this.filas.set(caminho, atual.catch(() => undefined));
    return atual;
  }

  async ler(caminho: string): Promise<ObjetoJson | null> {
    try {
      const texto = await readFile(resolverDentro(this.raiz, caminho), "utf8");
      return { dados: interpretarJson(texto, caminho), etag: etagDe(texto) };
    } catch (erro) {
      if (codigoDoErro(erro) === "ENOENT") return null;
      throw erro;
    }
  }

  async gravar(caminho: string, dados: unknown, opcoes: OpcoesGravacao = {}): Promise<{ etag: string }> {
    const destino = resolverDentro(this.raiz, caminho);
    return this.emFila(caminho, async () => {
      const texto = JSON.stringify(dados, null, 2);
      await mkdir(path.dirname(destino), { recursive: true });
      if (opcoes.ifMatch !== undefined) {
        const atual = await this.ler(caminho);
        if (!atual || atual.etag !== opcoes.ifMatch) throw new ErroConflito(caminho);
      }
      if (opcoes.criarSomente) {
        try {
          await writeFile(destino, texto, { flag: "wx" });
        } catch (erro) {
          if (codigoDoErro(erro) === "EEXIST") throw new ErroJaExiste(caminho);
          throw erro;
        }
        return { etag: etagDe(texto) };
      }
      const temporario = `${destino}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temporario, texto);
      await rename(temporario, destino);
      return { etag: etagDe(texto) };
    });
  }

  async listar(prefixo: string): Promise<ItemListado[]> {
    const arquivos = (await listarArquivos(this.raiz, prefixo)).filter((caminho) => caminho.endsWith(".json"));
    return Promise.all(
      arquivos.map(async (caminho) => {
        const completo = resolverDentro(this.raiz, caminho);
        const [texto, informacoes] = await Promise.all([readFile(completo, "utf8"), stat(completo)]);
        return { caminho, etag: etagDe(texto), atualizadoEm: informacoes.mtime };
      }),
    );
  }

  async listarPastas(prefixo: string): Promise<string[]> {
    try {
      const entradas = await readdir(resolverDentro(this.raiz, prefixo), { withFileTypes: true });
      return entradas.filter((entrada) => entrada.isDirectory()).map((entrada) => `${prefixo}${entrada.name}/`).sort();
    } catch (erro) {
      if (codigoDoErro(erro) === "ENOENT") return [];
      throw erro;
    }
  }

  async apagar(caminhosParaApagar: string[], opcoes: { ifMatch?: string } = {}): Promise<void> {
    if (opcoes.ifMatch !== undefined && caminhosParaApagar.length !== 1) {
      throw new Error("ifMatch só vale para apagar um caminho");
    }
    await Promise.all(
      caminhosParaApagar.map((caminho) =>
        this.emFila(caminho, async () => {
          if (opcoes.ifMatch !== undefined) {
            const atual = await this.ler(caminho);
            if (!atual || atual.etag !== opcoes.ifMatch) throw new ErroConflito(caminho);
          }
          await rm(resolverDentro(this.raiz, caminho), { force: true });
        }),
      ),
    );
  }

  async copiar(de: string, para: string): Promise<void> {
    const destino = resolverDentro(this.raiz, para);
    return this.emFila(para, async () => {
      await mkdir(path.dirname(destino), { recursive: true });
      await copyFile(resolverDentro(this.raiz, de), destino);
    });
  }
}

export class ArmazemFotosArquivo implements ArmazemFotos {
  constructor(
    private readonly raiz: string,
    readonly origem: string,
  ) {}

  async enviar(caminho: string, conteudo: Buffer, contentType: string): Promise<{ url: string }> {
    validarEnvioDeFoto(caminho, contentType);
    const destino = resolverDentro(this.raiz, caminho);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, conteudo);
    return { url: `${this.origem}/${caminho}` };
  }

  listar(prefixo: string): Promise<string[]> {
    return listarArquivos(this.raiz, prefixo);
  }

  async apagar(caminhosParaApagar: string[]): Promise<void> {
    await Promise.all(caminhosParaApagar.map((caminho) => rm(resolverDentro(this.raiz, caminho), { force: true })));
  }
}
