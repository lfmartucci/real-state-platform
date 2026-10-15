# Frente 3: Contrato com a skill "publicar imóvel"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o código que o repositório mantém para a skill: preparo das fotos (3 larguras WebP, placeholder, nome com hash), envio ao store público e limpeza de órfãs, cliente da API com o segredo da skill, linha de comando (`npm run skill:*`) e a planilha do modo lote com validação. Mais o documento do contrato.

**Architecture:** Leia `README.md` desta pasta antes. A skill (spec próprio, fora deste repositório) roda o `grade.py`, aplica o logo e decide o texto; o que chega aqui são JPEGs já tratados e com marca d'água. Este repositório garante o formato: larguras, WebP, placeholder, caminho no store público, gravação **só** pela API (ADR 0001) e validação da planilha contra os enums. A ordem é sempre: reservar código → subir fotos → gravar o imóvel pela API → limpar fotos órfãs. Os testes de contrato rodam o cliente contra os handlers reais da frente 2, sem servidor, por um `fetch` que chama os handlers.

**Tech Stack:** sharp 0.35.5, papaparse 5.7.0, `node:util` `parseArgs`, tsx, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-15-site-novo-mc-vieira-design.md` (seções 3 Regras, 4.1 Fotos, 4.4, 8, 11 item 3).

**Pré-requisito:** frentes 0 e 2 (Tasks 2.1 a 2.5) em `main`. **Branch:** `git checkout -b feat/site-novo-contrato-skill`.

**Comandos (em `apps/site/`):** `npm test`, `npm run typecheck`, `npm run lint`.

---

### Task 3.1: Preparo das fotos

**Files:**
- Create: `apps/site/src/lib/fotos/preparar.ts`
- Test: `apps/site/src/lib/fotos/preparar.test.ts`

**Interfaces:**
- Consumes: `LARGURAS_FOTO`, `Largura`, `caminhos.pastaFotos`.
- Produces:
  ```ts
  LARGURA_MINIMA = 800
  class ErroFotoPequena extends Error { largura: number }
  interface FotoPreparada { ordem: number; hash: string; arquivos: Record<Largura, Buffer>; placeholder: string }
  hashDoConteudo(conteudo: Buffer): string                         // 10 caracteres hex
  caminhoDaFoto(codigo: string, ordem: number, hash: string, largura: Largura): string
  prepararFoto(original: Buffer, ordem: number, nome?: string): Promise<FotoPreparada>
  ```

- [ ] **Step 1: Testes**

`src/lib/fotos/preparar.test.ts`:

```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { caminhoDaFoto, ErroFotoPequena, hashDoConteudo, prepararFoto } from "./preparar";

const jpeg = (largura: number, altura: number, cor = "#2f5d50") =>
  sharp({ create: { width: largura, height: altura, channels: 3, background: cor } }).jpeg({ quality: 90 }).toBuffer();

describe("prepararFoto", () => {
  it("gera WebP em 800, 1600 e 2560 sem ampliar além do original", async () => {
    const preparada = await prepararFoto(await jpeg(2000, 1333), 1);
    const larguras = await Promise.all(
      ([800, 1600, 2560] as const).map(async (largura) => (await sharp(preparada.arquivos[largura]).metadata()).width),
    );
    expect(larguras).toEqual([800, 1600, 2000]);
    expect((await sharp(preparada.arquivos[800]).metadata()).format).toBe("webp");
  });

  it("placeholder é um data URI WebP pequeno", async () => {
    const { placeholder } = await prepararFoto(await jpeg(1200, 800), 1);
    expect(placeholder.startsWith("data:image/webp;base64,")).toBe(true);
    expect(placeholder.length).toBeLessThan(4000);
  });

  it("recusa foto com menos de 800 px de largura", async () => {
    await expect(prepararFoto(await jpeg(640, 480), 1, "sala.jpg")).rejects.toBeInstanceOf(ErroFotoPequena);
    await expect(prepararFoto(await jpeg(640, 480), 1, "sala.jpg")).rejects.toThrow("sala.jpg tem 640 px de largura");
  });

  it("hash muda quando o conteúdo muda, e o caminho muda junto (Review Focus 2)", async () => {
    const antes = await jpeg(1200, 800, "#2f5d50");
    const depois = await jpeg(1200, 800, "#8b1e2d");
    expect(hashDoConteudo(antes)).toBe(hashDoConteudo(Buffer.from(antes)));
    expect(hashDoConteudo(antes)).not.toBe(hashDoConteudo(depois));
    const caminhoAntes = caminhoDaFoto("MC012", 1, hashDoConteudo(antes), 800);
    const caminhoDepois = caminhoDaFoto("MC012", 1, hashDoConteudo(depois), 800);
    expect(caminhoAntes).toMatch(/^imoveis\/MC012\/fotos\/1-[0-9a-f]{10}-800\.webp$/);
    expect(caminhoDepois).not.toBe(caminhoAntes);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/fotos/preparar.test.ts`
Expected: FAIL com `Failed to resolve import "./preparar"`.

- [ ] **Step 3: Implementar**

`src/lib/fotos/preparar.ts`:

```ts
import { createHash } from "node:crypto";
import sharp from "sharp";
import { caminhos } from "@/lib/armazem/caminhos";
import { LARGURAS_FOTO, type Largura } from "@/lib/contratos/imovel";

export const LARGURA_MINIMA = 800;
const LARGURA_PLACEHOLDER = 24;
const QUALIDADE_WEBP = 82;

export class ErroFotoPequena extends Error {
  constructor(
    nome: string,
    readonly largura: number,
  ) {
    super(`${nome} tem ${largura} px de largura; o mínimo é ${LARGURA_MINIMA} px`);
    this.name = "ErroFotoPequena";
  }
}

export interface FotoPreparada {
  ordem: number;
  hash: string;
  arquivos: Record<Largura, Buffer>;
  placeholder: string;
}

/** O hash entra no nome do arquivo: foto nova = URL nova, e o CDN nunca serve a foto velha (ajuste C). */
export function hashDoConteudo(conteudo: Buffer): string {
  return createHash("sha256").update(conteudo).digest("hex").slice(0, 10);
}

export function caminhoDaFoto(codigo: string, ordem: number, hash: string, largura: Largura): string {
  return `${caminhos.pastaFotos(codigo)}${ordem}-${hash}-${largura}.webp`;
}

async function larguraOrientada(original: Buffer): Promise<number> {
  const { width = 0, height = 0, orientation } = await sharp(original).metadata();
  return orientation && orientation >= 5 ? height : width;
}

/** Recebe o JPEG já tratado pela skill (grade.py + logo). Não corrige nada: só redimensiona e converte. */
export async function prepararFoto(original: Buffer, ordem: number, nome = `foto ${ordem}`): Promise<FotoPreparada> {
  const largura = await larguraOrientada(original);
  if (largura < LARGURA_MINIMA) throw new ErroFotoPequena(nome, largura);
  const arquivos = {} as Record<Largura, Buffer>;
  for (const alvo of LARGURAS_FOTO) {
    arquivos[alvo] = await sharp(original).rotate().resize({ width: alvo, withoutEnlargement: true }).webp({ quality: QUALIDADE_WEBP }).toBuffer();
  }
  const miniatura = await sharp(original).rotate().resize({ width: LARGURA_PLACEHOLDER }).webp({ quality: 40 }).toBuffer();
  return { ordem, hash: hashDoConteudo(original), arquivos, placeholder: `data:image/webp;base64,${miniatura.toString("base64")}` };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/lib/fotos/preparar.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/fotos/preparar.ts apps/site/src/lib/fotos/preparar.test.ts
git commit -m "feat(fotos): três larguras WebP, placeholder e nome com hash do conteúdo"
```

---

### Task 3.2: Envio ao store público e limpeza de órfãs

**Files:**
- Create: `apps/site/src/lib/fotos/subir.ts`
- Test: `apps/site/src/lib/fotos/subir.test.ts`

**Interfaces:**
- Consumes: `ArmazemFotos`, `FotoPreparada`, `caminhoDaFoto`, `Foto`.
- Produces:
  ```ts
  subirFotos(fotos: ArmazemFotos, codigo: string, preparadas: FotoPreparada[], legendas?: Record<number, string>): Promise<Foto[]>
  caminhoDaUrl(fotos: ArmazemFotos, url: string): string | null
  limparFotosOrfas(fotos: ArmazemFotos, codigo: string, emUso: Foto[]): Promise<string[]>   // devolve os caminhos apagados
  ```

- [ ] **Step 1: Testes**

`src/lib/fotos/subir.test.ts`:

```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ArmazemFotosArquivo } from "@/lib/armazem/arquivo";
import { FotoSchema } from "@/lib/contratos/imovel";
import { ORIGEM_FOTOS_TESTE } from "@/testes/fixtures";
import { prepararFoto } from "./preparar";
import { limparFotosOrfas, subirFotos } from "./subir";

const jpeg = (cor: string) => sharp({ create: { width: 1000, height: 700, channels: 3, background: cor } }).jpeg().toBuffer();
const novoStore = async () => new ArmazemFotosArquivo(await mkdtemp(path.join(tmpdir(), "mcv-fotos-")), ORIGEM_FOTOS_TESTE);

describe("subirFotos", () => {
  it("envia as três larguras e devolve fotos no formato do contrato", async () => {
    const store = await novoStore();
    const preparadas = [await prepararFoto(await jpeg("#111111"), 1), await prepararFoto(await jpeg("#222222"), 2)];
    const fotos = await subirFotos(store, "MC012", preparadas, { 2: "Varanda" });
    expect(fotos).toHaveLength(2);
    for (const foto of fotos) expect(FotoSchema.safeParse(foto).success).toBe(true);
    expect(fotos[1].legenda).toBe("Varanda");
    expect(fotos[0].larguras["800"]).toBe(`${ORIGEM_FOTOS_TESTE}/imoveis/MC012/fotos/1-${preparadas[0].hash}-800.webp`);
    expect(await store.listar("imoveis/MC012/fotos/")).toHaveLength(6);
  });
});

describe("limparFotosOrfas", () => {
  it("apaga só o que o imóvel gravado não usa", async () => {
    const store = await novoStore();
    const velhas = await subirFotos(store, "MC012", [await prepararFoto(await jpeg("#111111"), 1)]);
    const novas = await subirFotos(store, "MC012", [await prepararFoto(await jpeg("#333333"), 1)]);
    // Antes de o imóvel ser regravado com as novas, as velhas continuam no ar: nenhuma página quebra.
    expect(await store.listar("imoveis/MC012/fotos/")).toHaveLength(6);
    const apagadas = await limparFotosOrfas(store, "MC012", novas);
    expect(apagadas.sort()).toEqual(Object.values(velhas[0].larguras).map((url) => url.slice(ORIGEM_FOTOS_TESTE.length + 1)).sort());
    expect(await store.listar("imoveis/MC012/fotos/")).toHaveLength(3);
  });

  it("repetir o envio das mesmas fotos não cria órfãs (caminho determinístico)", async () => {
    const store = await novoStore();
    const original = await jpeg("#444444");
    await subirFotos(store, "MC012", [await prepararFoto(original, 1)]);
    const segunda = await subirFotos(store, "MC012", [await prepararFoto(original, 1)]);
    expect(await limparFotosOrfas(store, "MC012", segunda)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/fotos/subir.test.ts`
Expected: FAIL com `Failed to resolve import "./subir"`.

- [ ] **Step 3: Implementar**

`src/lib/fotos/subir.ts`:

```ts
import { caminhos } from "@/lib/armazem/caminhos";
import type { ArmazemFotos } from "@/lib/armazem/tipos";
import { LARGURAS_FOTO, type Foto } from "@/lib/contratos/imovel";
import { caminhoDaFoto, type FotoPreparada } from "./preparar";

/** Passo 1 da gravação (spec seção 3): fotos no store público antes do imóvel na API. */
export async function subirFotos(
  fotos: ArmazemFotos,
  codigo: string,
  preparadas: FotoPreparada[],
  legendas: Record<number, string> = {},
): Promise<Foto[]> {
  const resultado: Foto[] = [];
  for (const preparada of preparadas) {
    const larguras = {} as Foto["larguras"];
    for (const largura of LARGURAS_FOTO) {
      const caminho = caminhoDaFoto(codigo, preparada.ordem, preparada.hash, largura);
      larguras[String(largura) as keyof Foto["larguras"]] = (await fotos.enviar(caminho, preparada.arquivos[largura], "image/webp")).url;
    }
    const legenda = legendas[preparada.ordem]?.trim();
    resultado.push({ ordem: preparada.ordem, ...(legenda ? { legenda } : {}), larguras, placeholder: preparada.placeholder });
  }
  return resultado;
}

export function caminhoDaUrl(fotos: ArmazemFotos, url: string): string | null {
  const prefixo = `${fotos.origem}/`;
  return url.startsWith(prefixo) ? url.slice(prefixo.length) : null;
}

/** Passo 3: depois que a API gravou o imóvel, apaga o que ele não usa mais (inclusive restos de tentativas que falharam). */
export async function limparFotosOrfas(fotos: ArmazemFotos, codigo: string, emUso: Foto[]): Promise<string[]> {
  const usados = new Set(
    emUso.flatMap((foto) => Object.values(foto.larguras).map((url) => caminhoDaUrl(fotos, url))).filter((caminho): caminho is string => caminho !== null),
  );
  const orfas = (await fotos.listar(caminhos.pastaFotos(codigo))).filter((caminho) => !usados.has(caminho));
  await fotos.apagar(orfas);
  return orfas;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/lib/fotos && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/fotos/subir.ts apps/site/src/lib/fotos/subir.test.ts
git commit -m "feat(fotos): envio ao store público e limpeza de fotos órfãs depois da gravação"
```

---

### Task 3.3: Cliente da API para a skill (teste de contrato)

**Files:**
- Create: `apps/site/src/lib/skill/cliente.ts`, `apps/site/src/testes/fetch-do-app.ts`
- Test: `apps/site/src/lib/skill/cliente.test.ts`

**Interfaces:**
- Consumes: handlers da frente 2 (`tratarReservarCodigo`, `tratarCriarImovel`, `tratarListarImoveis`, `tratarLerImovel`, `tratarAtualizarImovel`), `prepararFoto`, `subirFotos`, `limparFotosOrfas`.
- Produces:
  ```ts
  class ErroApi extends Error { status: number; erro: string; detalhes?: { caminho: string; mensagem: string }[] }
  interface LeituraImovel { imovel: Imovel; etag: string; endereco_completo: string | null }
  interface OpcoesCliente { baseUrl: string; segredo: string; ator?: "skill" | "api"; fetch?: typeof fetch }
  criarClienteApi(opcoes: OpcoesCliente): {
    reservarCodigo(): Promise<string>;
    listarImoveis(): Promise<Imovel[]>;
    lerImovel(codigo: string): Promise<LeituraImovel | null>;
    criarImovel(codigo: string, entrada: ImovelEntrada, endereco?: string): Promise<{ imovel: Imovel; etag: string }>;
    atualizarImovel(codigo: string, entrada: ImovelEntrada, etag: string, endereco?: string): Promise<{ imovel: Imovel; etag: string }>;
    gravarImovel(codigo: string, entrada: ImovelEntrada, endereco?: string): Promise<{ imovel: Imovel; etag: string; criado: boolean }>;
  }
  // src/testes/fetch-do-app.ts
  fetchDoApp(s: Servicos): typeof fetch
  ```

- [ ] **Step 1: `fetch` que chama os handlers (só para testes)**

`src/testes/fetch-do-app.ts`:

```ts
import {
  tratarAtualizarImovel,
  tratarCriarImovel,
  tratarLerImovel,
  tratarListarImoveis,
  tratarReservarCodigo,
} from "@/lib/api/imoveis";
import type { Servicos } from "@/lib/servicos";

/** Liga um cliente HTTP aos handlers reais, sem servidor: o teste exercita o mesmo contrato que a skill usa em produção. */
export function fetchDoApp(s: Servicos): typeof fetch {
  return async (entrada, init) => {
    const req = new Request(entrada instanceof Request ? entrada : String(entrada), init);
    const { pathname } = new URL(req.url);
    if (pathname === "/api/imoveis/reservas" && req.method === "POST") return tratarReservarCodigo(req, s);
    if (pathname === "/api/imoveis" && req.method === "POST") return tratarCriarImovel(req, s);
    if (pathname === "/api/imoveis" && req.method === "GET") return tratarListarImoveis(req, s);
    const codigo = /^\/api\/imoveis\/([^/]+)$/.exec(pathname)?.[1];
    if (codigo && req.method === "GET") return tratarLerImovel(req, s, codigo);
    if (codigo && req.method === "PUT") return tratarAtualizarImovel(req, s, codigo);
    return new Response(JSON.stringify({ erro: "rota_nao_mapeada", mensagem: `${req.method} ${pathname}` }), { status: 404 });
  };
}
```

- [ ] **Step 2: Testes do contrato (modo unitário: cadastro e edição)**

`src/lib/skill/cliente.test.ts`:

```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { prepararFoto } from "@/lib/fotos/preparar";
import { limparFotosOrfas, subirFotos } from "@/lib/fotos/subir";
import { fetchDoApp } from "@/testes/fetch-do-app";
import { entradaDeExemplo } from "@/testes/fixtures";
import { CONFIG_TESTE, criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { criarClienteApi, ErroApi } from "./cliente";

const jpeg = (cor: string) => sharp({ create: { width: 1200, height: 800, channels: 3, background: cor } }).jpeg().toBuffer();

async function montar() {
  const s = await criarServicosDeTeste();
  const cliente = criarClienteApi({ baseUrl: "http://localhost:3000", segredo: CONFIG_TESTE.skillApiSecret, fetch: fetchDoApp(s) });
  return { s, cliente };
}

describe("contrato da skill, modo unitário", () => {
  it("cadastro novo: reserva, fotos, gravação como rascunho e endereço separado", async () => {
    const { s, cliente } = await montar();
    const codigo = await cliente.reservarCodigo();
    const fotos = await subirFotos(s.fotos, codigo, [await prepararFoto(await jpeg("#2f5d50"), 1)]);
    const { imovel, criado } = await cliente.gravarImovel(codigo, entradaDeExemplo({ fotos, publicacao: "rascunho" }), "Rua do Lote, 10, Centro");
    expect(criado).toBe(true);
    expect(imovel).toMatchObject({ codigo, publicacao: "rascunho", atualizado_por: "skill" });
    expect((await cliente.lerImovel(codigo))?.endereco_completo).toBe("Rua do Lote, 10, Centro");
  });

  it("edição: lê o atual, troca as fotos, grava com ETag e limpa as velhas", async () => {
    const { s, cliente } = await montar();
    const codigo = await cliente.reservarCodigo();
    const velhas = await subirFotos(s.fotos, codigo, [await prepararFoto(await jpeg("#111111"), 1)]);
    await cliente.gravarImovel(codigo, entradaDeExemplo({ fotos: velhas }));
    const novas = await subirFotos(s.fotos, codigo, [await prepararFoto(await jpeg("#999999"), 1)]);
    const { imovel, criado } = await cliente.gravarImovel(codigo, entradaDeExemplo({ fotos: novas, titulo: "Casa em condomínio com fotos novas da sala" }));
    expect(criado).toBe(false);
    expect(imovel.fotos).toEqual(novas);
    expect(await limparFotosOrfas(s.fotos, codigo, imovel.fotos)).toHaveLength(3);
  });

  it("falha da API no meio deixa fotos órfãs, nunca imóvel sem foto; a próxima tentativa limpa", async () => {
    const { s, cliente } = await montar();
    const codigo = await cliente.reservarCodigo();
    const fotos = await subirFotos(s.fotos, codigo, [await prepararFoto(await jpeg("#555555"), 1)]);
    const invalida = { ...entradaDeExemplo({ fotos }), tipo: "sobrado" } as unknown as Parameters<typeof cliente.gravarImovel>[1];
    await expect(cliente.gravarImovel(codigo, invalida)).rejects.toMatchObject({ status: 422, erro: "esquema_invalido" });
    expect(await cliente.lerImovel(codigo)).toBeNull();
    // segunda tentativa, com outra foto
    const outra = await subirFotos(s.fotos, codigo, [await prepararFoto(await jpeg("#666666"), 1)]);
    const { imovel } = await cliente.gravarImovel(codigo, entradaDeExemplo({ fotos: outra }));
    expect(await limparFotosOrfas(s.fotos, codigo, imovel.fotos)).toHaveLength(3);
  });

  it("segredo errado vira ErroApi 401", async () => {
    const { s } = await montar();
    const intruso = criarClienteApi({ baseUrl: "http://localhost:3000", segredo: "errado", fetch: fetchDoApp(s) });
    await expect(intruso.reservarCodigo()).rejects.toBeInstanceOf(ErroApi);
    await expect(intruso.reservarCodigo()).rejects.toMatchObject({ status: 401 });
  });

  it("como API do Moisés (fase 2), o autor fica 'api'", async () => {
    const { s } = await montar();
    const moises = criarClienteApi({ baseUrl: "http://localhost:3000", segredo: CONFIG_TESTE.skillApiSecret, ator: "api", fetch: fetchDoApp(s) });
    const codigo = await moises.reservarCodigo();
    const fotos = await subirFotos(s.fotos, codigo, [await prepararFoto(await jpeg("#777777"), 1)]);
    expect((await moises.gravarImovel(codigo, entradaDeExemplo({ fotos }))).imovel.atualizado_por).toBe("api");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- src/lib/skill/cliente.test.ts`
Expected: FAIL com `Failed to resolve import "./cliente"`.

- [ ] **Step 4: Implementar o cliente**

`src/lib/skill/cliente.ts`:

```ts
import type { Imovel, ImovelEntrada } from "@/lib/contratos/imovel";

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly erro: string,
    mensagem: string,
    readonly detalhes?: { caminho: string; mensagem: string }[],
  ) {
    super(mensagem);
    this.name = "ErroApi";
  }
}

export interface LeituraImovel {
  imovel: Imovel;
  etag: string;
  endereco_completo: string | null;
}

export interface OpcoesCliente {
  baseUrl: string;
  segredo: string;
  ator?: "skill" | "api";
  fetch?: typeof fetch;
}

/** Cliente da skill e da futura API do Moisés: grava só pela API (ADR 0001), com o segredo no cabeçalho (spec 4.4). */
export function criarClienteApi(opcoes: OpcoesCliente) {
  const buscar = opcoes.fetch ?? fetch;
  const base = opcoes.baseUrl.replace(/\/$/, "");

  async function chamar<T>(metodo: string, caminho: string, extras: { corpo?: unknown; etag?: string } = {}): Promise<T> {
    const resposta = await buscar(`${base}${caminho}`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${opcoes.segredo}`,
        "x-mcv-ator": opcoes.ator ?? "skill",
        ...(extras.corpo !== undefined ? { "content-type": "application/json" } : {}),
        ...(extras.etag ? { "if-match": extras.etag } : {}),
      },
      body: extras.corpo === undefined ? undefined : JSON.stringify(extras.corpo),
    });
    const texto = await resposta.text();
    let dados: Record<string, unknown> = {};
    if (texto) {
      try {
        dados = JSON.parse(texto);
      } catch {
        dados = { mensagem: `Resposta não JSON (${resposta.status}): ${texto.slice(0, 200)}` };
      }
    }
    if (!resposta.ok) {
      throw new ErroApi(
        resposta.status,
        typeof dados.erro === "string" ? dados.erro : "erro_desconhecido",
        typeof dados.mensagem === "string" ? dados.mensagem : `HTTP ${resposta.status}`,
        Array.isArray(dados.detalhes) ? (dados.detalhes as { caminho: string; mensagem: string }[]) : undefined,
      );
    }
    return dados as T;
  }

  const comEndereco = (endereco?: string) => (endereco ? { endereco_completo: endereco } : {});

  const cliente = {
    async reservarCodigo(): Promise<string> {
      return (await chamar<{ codigo: string }>("POST", "/api/imoveis/reservas")).codigo;
    },
    async listarImoveis(): Promise<Imovel[]> {
      return (await chamar<{ imoveis: Imovel[] }>("GET", "/api/imoveis")).imoveis;
    },
    async lerImovel(codigo: string): Promise<LeituraImovel | null> {
      try {
        return await chamar<LeituraImovel>("GET", `/api/imoveis/${codigo}`);
      } catch (erro) {
        if (erro instanceof ErroApi && erro.status === 404) return null;
        throw erro;
      }
    },
    criarImovel(codigo: string, entrada: ImovelEntrada, endereco?: string) {
      return chamar<{ imovel: Imovel; etag: string }>("POST", "/api/imoveis", { corpo: { codigo, imovel: entrada, ...comEndereco(endereco) } });
    },
    atualizarImovel(codigo: string, entrada: ImovelEntrada, etag: string, endereco?: string) {
      return chamar<{ imovel: Imovel; etag: string }>("PUT", `/api/imoveis/${codigo}`, { corpo: { imovel: entrada, ...comEndereco(endereco) }, etag });
    },
    /** Cria se o código ainda não tem imóvel; senão lê o ETag atual e atualiza. Um 409 sobe para quem chamou reler e tentar de novo. */
    async gravarImovel(codigo: string, entrada: ImovelEntrada, endereco?: string) {
      const atual = await cliente.lerImovel(codigo);
      if (!atual) return { ...(await cliente.criarImovel(codigo, entrada, endereco)), criado: true };
      return { ...(await cliente.atualizarImovel(codigo, entrada, atual.etag, endereco)), criado: false };
    },
  };
  return cliente;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- src/lib/skill && npm run typecheck`
Expected: PASS, 5 testes.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/lib/skill/cliente.ts apps/site/src/lib/skill/cliente.test.ts apps/site/src/testes/fetch-do-app.ts
git commit -m "feat(skill): cliente da API com segredo da skill e teste de contrato contra os handlers"
```

---

### Task 3.4: Planilha do modo lote

**Files:**
- Create: `apps/site/src/lib/skill/planilha.ts`
- Test: `apps/site/src/lib/skill/planilha.test.ts`

**Interfaces:**
- Consumes: `TIPOS`, `ImovelEntradaSchema`, `ImovelEntrada`, `Foto`, papaparse.
- Produces:
  ```ts
  COLUNAS_PLANILHA: readonly string[]
  interface LinhaPlanilha { numero: number; pasta_fotos: string; url_tokko?: string; endereco_completo?: string; dados: Omit<ImovelEntrada, "fotos"> }
  interface ErroPlanilha { linha: number; coluna: string; mensagem: string }
  lerPlanilha(csv: string): { linhas: LinhaPlanilha[]; erros: ErroPlanilha[] }
  linhaParaEntrada(linha: LinhaPlanilha, fotos: Foto[]): ImovelEntrada     // sempre rascunho, disponível, sem destaque
  ```

Formato da planilha (CSV UTF-8, separado por vírgula, primeira linha com estes cabeçalhos; Google Planilhas → Arquivo → Fazer download → CSV):

| Coluna | Obrigatória | Formato |
|---|---|---|
| `pasta_fotos` | sim | caminho da pasta com os originais do imóvel |
| `url_tokko` | não | página pública da Tokko de onde veio (só referência) |
| `tipo` | sim | um de: `apartamento`, `casa`, `casa_condominio`, `terreno`, `cobertura`, `sala_comercial`, `galpao`, `chacara` |
| `titulo`, `descricao`, `bairro`, `cidade` | sim | texto, sem emoji |
| `tem_venda`, `tem_aluguel` | ao menos um "sim" | `sim` ou `não` |
| `venda_preco`, `aluguel_preco` | não | reais (`1.200.000` ou `R$ 6.000,00`); vazio ou `sob consulta` = Preço sob consulta |
| `aluguel_inclui_condominio` | não | `sim`, `não` ou vazio |
| `condominio`, `iptu` | não | reais por mês |
| `area_util_m2`, `area_total_m2` | não | número; vírgula para decimal (`85,5`) |
| `quartos`, `suites`, `banheiros`, `vagas` | não | inteiro |
| `comodidades` | não | separadas por `;` |
| `endereco_completo` | não | só vai para `endereco.json` |

- [ ] **Step 1: Testes**

`src/lib/skill/planilha.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ImovelEntradaSchema } from "@/lib/contratos/imovel";
import { fotosDeExemplo } from "@/testes/fixtures";
import { COLUNAS_PLANILHA, lerPlanilha, linhaParaEntrada } from "./planilha";

const cabecalho = COLUNAS_PLANILHA.join(",");
const linha = (valores: Partial<Record<(typeof COLUNAS_PLANILHA)[number], string>>) =>
  COLUNAS_PLANILHA.map((coluna) => {
    const valor = valores[coluna] ?? "";
    return /[",\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
  }).join(",");

const base = {
  pasta_fotos: "originais/casa-fazenda-da-ilha",
  tipo: "casa_condominio",
  titulo: "Casa em condomínio com piscina e vista para a mata",
  descricao: "Casa térrea com quatro quartos.\n\nPiscina aquecida e jardim.",
  bairro: "Fazenda da Ilha",
  cidade: "Embu-Guaçu",
  tem_venda: "sim",
  venda_preco: "R$ 1.900.000,00",
  tem_aluguel: "não",
  area_util_m2: "440,5",
  quartos: "4",
  suites: "2",
  comodidades: "Piscina; Churrasqueira ;Jardim",
  endereco_completo: "Rua das Palmeiras, 45",
};

describe("lerPlanilha", () => {
  it("converte uma linha válida em dados de rascunho", () => {
    const { linhas, erros } = lerPlanilha(`${cabecalho}\n${linha(base)}\n`);
    expect(erros).toEqual([]);
    expect(linhas[0]).toMatchObject({
      numero: 2,
      pasta_fotos: "originais/casa-fazenda-da-ilha",
      endereco_completo: "Rua das Palmeiras, 45",
      dados: {
        tipo: "casa_condominio",
        status: "disponivel",
        publicacao: "rascunho",
        destaque: false,
        ofertas: [{ negocio: "venda", preco: 1_900_000 }],
        area_util_m2: 440.5,
        quartos: 4,
        comodidades: ["Piscina", "Churrasqueira", "Jardim"],
      },
    });
  });

  it("venda e aluguel, com aluguel sob consulta e condomínio incluso", () => {
    const { linhas, erros } = lerPlanilha(`${cabecalho}\n${linha({ ...base, tem_aluguel: "sim", aluguel_preco: "sob consulta", aluguel_inclui_condominio: "sim" })}`);
    expect(erros).toEqual([]);
    expect(linhas[0].dados.ofertas).toEqual([{ negocio: "venda", preco: 1_900_000 }, { negocio: "aluguel", inclui_condominio: true }]);
  });

  it("valida tipo e negócio contra os enums antes de rodar (spec 8, item 5)", () => {
    const { erros } = lerPlanilha(`${cabecalho}\n${linha({ ...base, tipo: "sobrado" })}\n${linha({ ...base, tem_venda: "não" })}`);
    expect(erros).toContainEqual({ linha: 2, coluna: "tipo", mensagem: expect.stringContaining("casa_condominio") });
    expect(erros).toContainEqual({ linha: 3, coluna: "tem_venda", mensagem: "Marque 'sim' em tem_venda, tem_aluguel ou nos dois" });
  });

  it("aponta preço, número e sim/não ilegíveis pela coluna", () => {
    const { erros } = lerPlanilha(`${cabecalho}\n${linha({ ...base, venda_preco: "um milhão", quartos: "três", tem_aluguel: "talvez" })}`);
    expect(erros.map((erro) => erro.coluna).sort()).toEqual(["quartos", "tem_aluguel", "venda_preco"]);
  });

  it("aponta título curto, emoji e pasta de fotos ausente", () => {
    const { erros } = lerPlanilha(`${cabecalho}\n${linha({ ...base, titulo: "Casa 🏠", pasta_fotos: "" })}`);
    expect(erros.map((erro) => erro.coluna).sort()).toEqual(["pasta_fotos", "titulo"]);
  });

  it("recusa cabeçalho diferente do formato", () => {
    const { erros } = lerPlanilha("tipo,titulo\ncasa,Casa boa");
    expect(erros[0]).toMatchObject({ linha: 1, coluna: "cabecalho" });
  });
});

describe("linhaParaEntrada", () => {
  it("junta as fotos e passa no esquema de entrada", () => {
    const { linhas } = lerPlanilha(`${cabecalho}\n${linha(base)}`);
    const entrada = linhaParaEntrada(linhas[0], fotosDeExemplo("MC020", 2));
    expect(ImovelEntradaSchema.safeParse(entrada).success).toBe(true);
    expect(entrada.publicacao).toBe("rascunho");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/skill/planilha.test.ts`
Expected: FAIL com `Failed to resolve import "./planilha"`.

- [ ] **Step 3: Implementar**

`src/lib/skill/planilha.ts`:

```ts
import Papa from "papaparse";
import { TIPOS, type Tipo } from "@/lib/contratos/comum";
import { ImovelEntradaSchema, type Foto, type ImovelEntrada, type Oferta } from "@/lib/contratos/imovel";

export const COLUNAS_PLANILHA = [
  "pasta_fotos",
  "url_tokko",
  "tipo",
  "titulo",
  "descricao",
  "bairro",
  "cidade",
  "tem_venda",
  "venda_preco",
  "tem_aluguel",
  "aluguel_preco",
  "aluguel_inclui_condominio",
  "condominio",
  "iptu",
  "area_util_m2",
  "area_total_m2",
  "quartos",
  "suites",
  "banheiros",
  "vagas",
  "comodidades",
  "endereco_completo",
] as const;
type Coluna = (typeof COLUNAS_PLANILHA)[number];

export interface LinhaPlanilha {
  numero: number;
  pasta_fotos: string;
  url_tokko?: string;
  endereco_completo?: string;
  dados: Omit<ImovelEntrada, "fotos">;
}

export interface ErroPlanilha {
  linha: number;
  coluna: string;
  mensagem: string;
}

/** Foto só para validar a linha antes de haver fotos; nunca é gravada. */
const FOTO_DE_VALIDACAO: Foto = {
  ordem: 1,
  larguras: {
    "800": "https://validacao.invalid/imoveis/MC000/fotos/1-0000000000-800.webp",
    "1600": "https://validacao.invalid/imoveis/MC000/fotos/1-0000000000-1600.webp",
    "2560": "https://validacao.invalid/imoveis/MC000/fotos/1-0000000000-2560.webp",
  },
  placeholder: "data:image/webp;base64,AA==",
};

/** Caminho do erro no esquema → coluna da planilha. */
const COLUNA_DO_CAMPO: Record<string, Coluna> = { ofertas: "tem_venda", status: "tem_venda" };

class ErroDeCelula extends Error {
  constructor(
    readonly coluna: Coluna,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

function simOuNao(texto: string, coluna: Coluna): boolean | undefined {
  const valor = texto.trim().toLowerCase();
  if (valor === "") return undefined;
  if (["sim", "s", "x", "1"].includes(valor)) return true;
  if (["não", "nao", "n", "0"].includes(valor)) return false;
  throw new ErroDeCelula(coluna, `Use 'sim' ou 'não' (veio '${texto}')`);
}

function reais(texto: string, coluna: Coluna): number | undefined {
  const valor = texto.trim().toLowerCase();
  if (valor === "" || valor === "sob consulta") return undefined;
  const semCentavos = valor.replace(/^r\$\s*/, "").split(",")[0].replace(/\./g, "").trim();
  if (!/^\d+$/.test(semCentavos)) throw new ErroDeCelula(coluna, `Valor em reais ilegível: '${texto}'`);
  return Number(semCentavos);
}

function decimal(texto: string, coluna: Coluna): number | undefined {
  const valor = texto.trim();
  if (valor === "") return undefined;
  const normalizado = valor.replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) throw new ErroDeCelula(coluna, `Número ilegível: '${texto}'`);
  return numero;
}

function inteiro(texto: string, coluna: Coluna): number | undefined {
  const valor = texto.trim();
  if (valor === "") return undefined;
  if (!/^\d+$/.test(valor)) throw new ErroDeCelula(coluna, `Use um número inteiro (veio '${texto}')`);
  return Number(valor);
}

const opcional = <T>(chave: string, valor: T | undefined) => (valor === undefined ? {} : { [chave]: valor });

function lerLinha(celulas: Record<Coluna, string>, numero: number): { linha?: LinhaPlanilha; erros: ErroPlanilha[] } {
  const erros: ErroPlanilha[] = [];
  const tentar = <T>(funcao: () => T): T | undefined => {
    try {
      return funcao();
    } catch (erro) {
      if (!(erro instanceof ErroDeCelula)) throw erro;
      erros.push({ linha: numero, coluna: erro.coluna, mensagem: erro.message });
      return undefined;
    }
  };

  const pasta = celulas.pasta_fotos.trim();
  if (!pasta) erros.push({ linha: numero, coluna: "pasta_fotos", mensagem: "Informe a pasta com as fotos originais" });
  const tipo = celulas.tipo.trim();
  if (!(TIPOS as readonly string[]).includes(tipo)) {
    erros.push({ linha: numero, coluna: "tipo", mensagem: `Tipo '${tipo}' não existe. Use um de: ${TIPOS.join(", ")}` });
  }
  const temVenda = tentar(() => simOuNao(celulas.tem_venda, "tem_venda"));
  const temAluguel = tentar(() => simOuNao(celulas.tem_aluguel, "tem_aluguel"));
  if (temVenda !== true && temAluguel !== true && !erros.some((erro) => erro.coluna.startsWith("tem_"))) {
    erros.push({ linha: numero, coluna: "tem_venda", mensagem: "Marque 'sim' em tem_venda, tem_aluguel ou nos dois" });
  }

  const ofertas: Oferta[] = [];
  if (temVenda) {
    const preco = tentar(() => reais(celulas.venda_preco, "venda_preco"));
    ofertas.push(preco === undefined ? { negocio: "venda" } : { negocio: "venda", preco });
  }
  if (temAluguel) {
    const aluguel: Extract<Oferta, { negocio: "aluguel" }> = { negocio: "aluguel" };
    const preco = tentar(() => reais(celulas.aluguel_preco, "aluguel_preco"));
    const incluiCondominio = tentar(() => simOuNao(celulas.aluguel_inclui_condominio, "aluguel_inclui_condominio"));
    if (preco !== undefined) aluguel.preco = preco;
    if (incluiCondominio !== undefined) aluguel.inclui_condominio = incluiCondominio;
    ofertas.push(aluguel);
  }

  const dados = {
    tipo: tipo as Tipo,
    status: "disponivel" as const,
    publicacao: "rascunho" as const,
    destaque: false,
    ofertas,
    titulo: celulas.titulo.trim(),
    descricao: celulas.descricao.trim(),
    bairro: celulas.bairro.trim(),
    cidade: celulas.cidade.trim(),
    comodidades: celulas.comodidades.split(";").map((item) => item.trim()).filter(Boolean),
    ...opcional("condominio", tentar(() => reais(celulas.condominio, "condominio"))),
    ...opcional("iptu", tentar(() => reais(celulas.iptu, "iptu"))),
    ...opcional("area_util_m2", tentar(() => decimal(celulas.area_util_m2, "area_util_m2"))),
    ...opcional("area_total_m2", tentar(() => decimal(celulas.area_total_m2, "area_total_m2"))),
    ...opcional("quartos", tentar(() => inteiro(celulas.quartos, "quartos"))),
    ...opcional("suites", tentar(() => inteiro(celulas.suites, "suites"))),
    ...opcional("banheiros", tentar(() => inteiro(celulas.banheiros, "banheiros"))),
    ...opcional("vagas", tentar(() => inteiro(celulas.vagas, "vagas"))),
  };
  // O esquema roda sempre, para apontar tudo de uma vez; cada coluna aparece uma vez só.
  const validacao = ImovelEntradaSchema.safeParse({ ...dados, fotos: [FOTO_DE_VALIDACAO] });
  if (!validacao.success) {
    for (const issue of validacao.error.issues) {
      const campo = String(issue.path[0] ?? "linha");
      const coluna = COLUNA_DO_CAMPO[campo] ?? campo;
      if (!erros.some((erro) => erro.coluna === coluna)) erros.push({ linha: numero, coluna, mensagem: issue.message });
    }
  }
  if (erros.length > 0 || !validacao.success) return { erros };
  const { fotos: _fotos, ...semFotos } = validacao.data;
  const endereco = celulas.endereco_completo.trim();
  const tokko = celulas.url_tokko.trim();
  return {
    linha: { numero, pasta_fotos: pasta, ...(tokko ? { url_tokko: tokko } : {}), ...(endereco ? { endereco_completo: endereco } : {}), dados: semFotos },
    erros,
  };
}

export function lerPlanilha(csv: string): { linhas: LinhaPlanilha[]; erros: ErroPlanilha[] } {
  const lido = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy" });
  const colunas = lido.meta.fields ?? [];
  const faltando = COLUNAS_PLANILHA.filter((coluna) => !colunas.includes(coluna));
  if (faltando.length > 0) {
    return { linhas: [], erros: [{ linha: 1, coluna: "cabecalho", mensagem: `Faltam as colunas: ${faltando.join(", ")}` }] };
  }
  const linhas: LinhaPlanilha[] = [];
  const erros: ErroPlanilha[] = [];
  lido.data.forEach((registro, indice) => {
    const celulas = Object.fromEntries(COLUNAS_PLANILHA.map((coluna) => [coluna, registro[coluna] ?? ""])) as Record<Coluna, string>;
    const resultado = lerLinha(celulas, indice + 2);
    erros.push(...resultado.erros);
    if (resultado.linha) linhas.push(resultado.linha);
  });
  return { linhas, erros };
}

/** O lote sempre entra como rascunho; a Gabriela publica no painel depois de conferir (spec 8). */
export function linhaParaEntrada(linha: LinhaPlanilha, fotos: Foto[]): ImovelEntrada {
  return ImovelEntradaSchema.parse({ ...linha.dados, fotos });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/lib/skill && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/skill/planilha.ts apps/site/src/lib/skill/planilha.test.ts
git commit -m "feat(skill): planilha do lote validada contra os enums, sempre como rascunho"
```

---

### Task 3.5: Linha de comando da skill, segredo e documento do contrato

**Files:**
- Create: `apps/site/scripts/skill/ambiente.ts`, `apps/site/scripts/skill/reservar.ts`, `apps/site/scripts/skill/fotos.ts`, `apps/site/scripts/skill/gravar.ts`, `apps/site/scripts/skill/ler.ts`, `apps/site/scripts/skill/validar-planilha.ts`, `apps/site/scripts/skill/montar.ts`
- Create: `apps/site/.env.skill.exemplo`, `docs/contrato-skill-publicar-imovel.md`
- Modify: `apps/site/package.json` (scripts `skill:*`), `apps/site/.gitignore` (`!.env.skill.exemplo`)

**Interfaces:**
- Consumes: `criarClienteApi`, `prepararFoto`, `subirFotos`, `limparFotosOrfas`, `lerPlanilha`, `linhaParaEntrada`, `ArmazemFotosVercel`, `ArmazemFotosArquivo`, `FotoSchema`.
- Produces (comandos, todos em `apps/site/`):
  - `npm run skill:reservar` → imprime o código reservado.
  - `npm run skill:fotos -- --codigo MC012 --pasta <dir> [--legendas legendas.json] --saida fotos.json`
  - `npm run skill:montar -- --planilha lote.csv --linha 2 --codigo MC012 --fotos fotos.json --saida imovel.json`
  - `npm run skill:gravar -- --arquivo imovel.json` (cria ou atualiza; depois limpa órfãs)
  - `npm run skill:ler -- --codigo MC012`
  - `npm run skill:validar-planilha -- --arquivo lote.csv`
  - Arquivo `imovel.json` aceito por `skill:gravar`: `{ "codigo": "MC012", "imovel": ImovelEntrada, "endereco_completo"?: string }`.

- [ ] **Step 1: Ambiente da skill**

`apps/site/.env.skill.exemplo`:

```
# Copie para .env.skill (ignorado pelo git).
# URL do site no ar (ou http://localhost:3000 com `npm run dev`).
SITE_URL=https://mc-vieira-site.vercel.app
# Mesmo valor de SKILL_API_SECRET nas variáveis da Vercel.
SKILL_API_SECRET=
# Store público (só fotos). Token com permissão de escrita e a origem das URLs.
BLOB_PUBLICO_READ_WRITE_TOKEN=
FOTOS_ORIGEM=https://<id>.public.blob.vercel-storage.com
# Só para testar contra o dev local: grava as fotos numa pasta em vez do Blob.
# FOTOS_DRIVER=arquivo
# FOTOS_DIR=.dados-local/publico
```

Acrescente ao fim de `apps/site/.gitignore`: `!.env.skill.exemplo`.

`apps/site/scripts/skill/ambiente.ts`:

```ts
import path from "node:path";
import { parseArgs } from "node:util";
import { ArmazemFotosArquivo } from "../../src/lib/armazem/arquivo";
import type { ArmazemFotos } from "../../src/lib/armazem/tipos";
import { ArmazemFotosVercel } from "../../src/lib/armazem/vercel";
import { criarClienteApi, ErroApi } from "../../src/lib/skill/cliente";

export function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} em apps/site/.env.skill (veja .env.skill.exemplo)`);
  return valor;
}

export function clienteDaSkill() {
  return criarClienteApi({ baseUrl: exigir("SITE_URL"), segredo: exigir("SKILL_API_SECRET") });
}

export function storeDeFotos(): ArmazemFotos {
  const origem = exigir("FOTOS_ORIGEM").replace(/\/$/, "");
  if (process.env.FOTOS_DRIVER === "arquivo") return new ArmazemFotosArquivo(path.resolve(exigir("FOTOS_DIR")), origem);
  return new ArmazemFotosVercel(exigir("BLOB_PUBLICO_READ_WRITE_TOKEN"), origem);
}

export function argumentos<T extends Record<string, { type: "string"; short?: string }>>(opcoes: T) {
  return parseArgs({ options: opcoes, strict: true }).values as { [K in keyof T]?: string };
}

/** Saída padrão dos comandos: mensagem clara e código de saída 1, sem pilha para erro esperado da API. */
export function rodar(principal: () => Promise<void>) {
  principal().catch((erro) => {
    if (erro instanceof ErroApi) {
      console.error(`Erro da API (${erro.status} ${erro.erro}): ${erro.message}`);
      for (const detalhe of erro.detalhes ?? []) console.error(`  - ${detalhe.caminho}: ${detalhe.mensagem}`);
    } else {
      console.error(erro instanceof Error ? erro.message : erro);
    }
    process.exitCode = 1;
  });
}
```

- [ ] **Step 2: Comandos**

`apps/site/scripts/skill/reservar.ts`:

```ts
import { clienteDaSkill, rodar } from "./ambiente";

rodar(async () => {
  console.log(await clienteDaSkill().reservarCodigo());
});
```

`apps/site/scripts/skill/fotos.ts`:

```ts
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prepararFoto } from "../../src/lib/fotos/preparar";
import { subirFotos } from "../../src/lib/fotos/subir";
import { argumentos, rodar, storeDeFotos } from "./ambiente";

const EXTENSOES = new Set([".jpg", ".jpeg", ".png", ".webp"]);

rodar(async () => {
  const { codigo, pasta, legendas, saida } = argumentos({ codigo: { type: "string" }, pasta: { type: "string" }, legendas: { type: "string" }, saida: { type: "string" } });
  if (!codigo || !pasta || !saida) throw new Error("Uso: npm run skill:fotos -- --codigo MC012 --pasta <dir> [--legendas legendas.json] --saida fotos.json");
  const nomes = (await readdir(pasta))
    .filter((nome) => EXTENSOES.has(path.extname(nome).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  if (nomes.length === 0) throw new Error(`Nenhuma foto em ${pasta}`);
  const preparadas = [];
  for (const [indice, nome] of nomes.entries()) {
    preparadas.push(await prepararFoto(await readFile(path.join(pasta, nome)), indice + 1, nome));
    console.log(`preparada ${indice + 1}/${nomes.length}: ${nome}`);
  }
  const mapaLegendas = legendas ? (JSON.parse(await readFile(legendas, "utf8")) as Record<number, string>) : {};
  const fotos = await subirFotos(storeDeFotos(), codigo, preparadas, mapaLegendas);
  await writeFile(saida, JSON.stringify(fotos, null, 2));
  console.log(`${fotos.length} fotos enviadas para ${codigo}; manifesto em ${saida}`);
});
```

`apps/site/scripts/skill/montar.ts`:

```ts
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { FotoSchema } from "../../src/lib/contratos/imovel";
import { lerPlanilha, linhaParaEntrada } from "../../src/lib/skill/planilha";
import { argumentos, rodar } from "./ambiente";

rodar(async () => {
  const { planilha, linha, codigo, fotos, saida } = argumentos({
    planilha: { type: "string" },
    linha: { type: "string" },
    codigo: { type: "string" },
    fotos: { type: "string" },
    saida: { type: "string" },
  });
  if (!planilha || !linha || !codigo || !fotos || !saida) {
    throw new Error("Uso: npm run skill:montar -- --planilha lote.csv --linha 2 --codigo MC012 --fotos fotos.json --saida imovel.json");
  }
  const { linhas, erros } = lerPlanilha(await readFile(planilha, "utf8"));
  const alvo = linhas.find((item) => item.numero === Number(linha));
  if (!alvo) {
    const daLinha = erros.filter((erro) => erro.linha === Number(linha));
    throw new Error(`Linha ${linha} inválida ou inexistente: ${daLinha.map((erro) => `${erro.coluna}: ${erro.mensagem}`).join("; ")}`);
  }
  const listaDeFotos = z.array(FotoSchema).parse(JSON.parse(await readFile(fotos, "utf8")));
  const corpo = { codigo, imovel: linhaParaEntrada(alvo, listaDeFotos), ...(alvo.endereco_completo ? { endereco_completo: alvo.endereco_completo } : {}) };
  await writeFile(saida, JSON.stringify(corpo, null, 2));
  console.log(`Imóvel ${codigo} montado em ${saida} (rascunho)`);
});
```

`apps/site/scripts/skill/gravar.ts`:

```ts
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { CodigoSchema } from "../../src/lib/contratos/comum";
import { ImovelEntradaSchema } from "../../src/lib/contratos/imovel";
import { limparFotosOrfas } from "../../src/lib/fotos/subir";
import { argumentos, clienteDaSkill, rodar, storeDeFotos } from "./ambiente";

const ArquivoImovel = z.strictObject({ codigo: CodigoSchema, imovel: ImovelEntradaSchema, endereco_completo: z.string().optional() });

rodar(async () => {
  const { arquivo } = argumentos({ arquivo: { type: "string" } });
  if (!arquivo) throw new Error("Uso: npm run skill:gravar -- --arquivo imovel.json");
  const { codigo, imovel, endereco_completo } = ArquivoImovel.parse(JSON.parse(await readFile(arquivo, "utf8")));
  const resultado = await clienteDaSkill().gravarImovel(codigo, imovel, endereco_completo);
  console.log(`${resultado.criado ? "Criado" : "Atualizado"}: ${codigo} (${resultado.imovel.publicacao}, ETag ${resultado.etag})`);
  const apagadas = await limparFotosOrfas(storeDeFotos(), codigo, resultado.imovel.fotos);
  if (apagadas.length) console.log(`Fotos órfãs apagadas: ${apagadas.length}`);
});
```

`apps/site/scripts/skill/ler.ts`:

```ts
import { argumentos, clienteDaSkill, rodar } from "./ambiente";

rodar(async () => {
  const { codigo } = argumentos({ codigo: { type: "string" } });
  if (!codigo) throw new Error("Uso: npm run skill:ler -- --codigo MC012");
  const lido = await clienteDaSkill().lerImovel(codigo);
  if (!lido) throw new Error(`${codigo} não tem imóvel gravado`);
  console.log(JSON.stringify(lido, null, 2));
});
```

`apps/site/scripts/skill/validar-planilha.ts`:

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { lerPlanilha } from "../../src/lib/skill/planilha";
import { argumentos, rodar } from "./ambiente";

rodar(async () => {
  const { arquivo } = argumentos({ arquivo: { type: "string" } });
  if (!arquivo) throw new Error("Uso: npm run skill:validar-planilha -- --arquivo lote.csv");
  const { linhas, erros } = lerPlanilha(await readFile(arquivo, "utf8"));
  const base = path.dirname(path.resolve(arquivo));
  for (const linha of linhas) {
    const pasta = path.resolve(base, linha.pasta_fotos);
    const fotos = await readdir(pasta).catch(() => null);
    if (!fotos || !fotos.some((nome) => /\.(jpe?g|png|webp)$/i.test(nome))) {
      erros.push({ linha: linha.numero, coluna: "pasta_fotos", mensagem: `Sem fotos originais em ${pasta}. Só migra imóvel com original (spec 8).` });
    }
  }
  for (const erro of erros.sort((a, b) => a.linha - b.linha)) console.error(`linha ${erro.linha}, ${erro.coluna}: ${erro.mensagem}`);
  console.log(`${linhas.length} linha(s) lida(s), ${erros.length} problema(s).`);
  if (erros.length > 0) process.exitCode = 1;
});
```

No `package.json`, acrescente aos scripts:

```json
    "skill:reservar": "node --env-file-if-exists=.env.skill --import tsx scripts/skill/reservar.ts",
    "skill:fotos": "node --env-file-if-exists=.env.skill --import tsx scripts/skill/fotos.ts",
    "skill:montar": "node --env-file-if-exists=.env.skill --import tsx scripts/skill/montar.ts",
    "skill:gravar": "node --env-file-if-exists=.env.skill --import tsx scripts/skill/gravar.ts",
    "skill:ler": "node --env-file-if-exists=.env.skill --import tsx scripts/skill/ler.ts",
    "skill:validar-planilha": "node --env-file-if-exists=.env.skill --import tsx scripts/skill/validar-planilha.ts"
```

- [ ] **Step 3: Verificar o fluxo de ponta a ponta contra o dev local**

Terminal 1 (em `apps/site/`), com `.env.local` contendo `ARMAZEM_DRIVER=arquivo`, `ARMAZEM_DIR=.dados-local`, `ARMAZEM_FOTOS_DIR=public/dev-fotos`, `FOTOS_ORIGEM=http://localhost:3000/dev-fotos`, `SKILL_API_SECRET=segredo-local-de-teste`, `AUTH_JWT_SECRET` com 32+ caracteres:

```bash
npm run dev
```

Terminal 2, com `apps/site/.env.skill` contendo `SITE_URL=http://localhost:3000`, `SKILL_API_SECRET=segredo-local-de-teste`, `FOTOS_ORIGEM=http://localhost:3000/dev-fotos`, `FOTOS_DRIVER=arquivo`, `FOTOS_DIR=public/dev-fotos`:

```bash
mkdir -p /tmp/mcv-skill/fotos
npx tsx -e "import sharp from 'sharp'; for (const [i,c] of ['#2f5d50','#8b1e2d'].entries()) await sharp({create:{width:1600,height:1066,channels:3,background:c}}).jpeg().toFile('/tmp/mcv-skill/fotos/'+(i+1)+'.jpg')"
CODIGO=$(npm run -s skill:reservar)
echo "$CODIGO"
npm run skill:fotos -- --codigo "$CODIGO" --pasta /tmp/mcv-skill/fotos --saida /tmp/mcv-skill/fotos.json
```

Crie `/tmp/mcv-skill/lote.csv` com o cabeçalho de `COLUNAS_PLANILHA` e uma linha (`pasta_fotos` = `fotos`), depois:

```bash
npm run skill:validar-planilha -- --arquivo /tmp/mcv-skill/lote.csv
npm run skill:montar -- --planilha /tmp/mcv-skill/lote.csv --linha 2 --codigo "$CODIGO" --fotos /tmp/mcv-skill/fotos.json --saida /tmp/mcv-skill/imovel.json
npm run skill:gravar -- --arquivo /tmp/mcv-skill/imovel.json
npm run skill:ler -- --codigo "$CODIGO"
```

Expected: `skill:reservar` imprime `MC001` (dev local vazio); `skill:fotos` termina com `2 fotos enviadas para MC001`; `skill:validar-planilha` diz `1 linha(s) lida(s), 0 problema(s).`; `skill:gravar` diz `Criado: MC001 (rascunho, ETag "...")`; `skill:ler` mostra o imóvel com `endereco_completo`. Em `http://localhost:3000/imoveis/MC001` a resposta é 404 (rascunho), como manda o spec.

Esses arquivos ficam em `/tmp/mcv-skill/` (fora do repositório) só para esta verificação.

- [ ] **Step 4: Segredo da skill na Vercel (humano)**

Gere o segredo e cadastre nas variáveis do projeto `mc-vieira-site` (Production e Preview), com o nome `SKILL_API_SECRET`:

```bash
openssl rand -base64 32
```

O mesmo valor vai no `.env.skill` da máquina da Gabriela. Nunca em arquivo versionado.

- [ ] **Step 5: Documento do contrato**

`docs/contrato-skill-publicar-imovel.md`:

```markdown
# Contrato: skill "publicar imóvel" ↔ site M.C. Vieira

A skill tem spec próprio. Este documento é o que o site garante e exige. Fonte: spec do site novo, seções 4.4 e 8, e ADR 0001.

## O que a skill entrega ao repositório

JPEGs já tratados pelo `grade.py` e com a marca d'água da M.C. Vieira. O original sem marca nunca vai para o Blob. O repositório não corrige foto: só confere largura mínima (800 px), gera WebP em 800, 1600 e 2560 px e o placeholder.

## Ordem obrigatória

1. `npm run skill:reservar` → código `MCnnn`. Guarde o código na pasta de trabalho do imóvel: uma nova tentativa usa o MESMO código.
2. `npm run skill:fotos -- --codigo MCnnn --pasta <originais tratados> --saida fotos.json` → sobe as fotos para `imoveis/MCnnn/fotos/<ordem>-<hash>-<largura>.webp` no store público.
3. Monte o `imovel.json` (`{ codigo, imovel, endereco_completo? }`), à mão ou com `skill:montar` a partir da planilha.
4. `npm run skill:gravar -- --arquivo imovel.json` → grava pela API (`POST` se novo, `PUT` com ETag se já existe) e apaga as fotos órfãs.

Uma falha no passo 4 deixa fotos órfãs, nunca um imóvel sem foto. Repetir o passo 4 limpa as órfãs.

## Regras

- A skill nunca grava JSON no Blob. Só a API grava (`/api/imoveis`).
- Autenticação: `Authorization: Bearer <SKILL_API_SECRET>`. O histórico registra `skill` (ou `api` com `x-mcv-ator: api`, para a API do Moisés na fase 2).
- Modo lote: sempre `publicacao: rascunho`. A Gabriela confere na pré-visualização do painel e publica.
- Só migra imóvel com fotos originais. Fotos baixadas da Tokko não servem.
- Edição concorrente: um `409 conflito` significa que alguém gravou antes. Rode `skill:ler`, refaça a mudança e grave de novo.

## Planilha do lote

Formato e colunas: `apps/site/src/lib/skill/planilha.ts` (`COLUNAS_PLANILHA`) e a tabela da Task 3.4 do plano. Valide antes de rodar: `npm run skill:validar-planilha -- --arquivo lote.csv`.

## Erros da API que a skill deve tratar

| Código | Significado | O que fazer |
|---|---|---|
| 401 `nao_autenticado` | segredo errado | conferir `.env.skill` |
| 409 `conflito` | alguém gravou antes | reler e refazer |
| 409 `ja_existe` | o código já tem imóvel | usar `PUT` (o `skill:gravar` já decide) |
| 410 `codigo_excluido` | código excluído no painel | reservar outro |
| 422 `sem_reserva` | código não reservado | rodar `skill:reservar` |
| 422 `esquema_invalido` | campo fora do contrato | ler `detalhes` (campo e motivo) |
| 422 `foto_fora_do_store` | foto fora de `imoveis/<codigo>/fotos/` | subir de novo pelo `skill:fotos` |
```

- [ ] **Step 6: Rodar tudo**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit e fechamento da frente 3**

```bash
cd /Users/felipemartucci/PycharmProjects/real-state-platform
git status --short
git add apps/site/scripts/skill apps/site/.env.skill.exemplo apps/site/.gitignore apps/site/package.json docs/contrato-skill-publicar-imovel.md
git commit -m "feat(skill): linha de comando para reservar, subir fotos, montar e gravar, e documento do contrato"
git pull --rebase origin main
npm --prefix apps/site test
```

Entregue ao humano, como texto (não execute):

```bash
git push -u origin feat/site-novo-contrato-skill
```
