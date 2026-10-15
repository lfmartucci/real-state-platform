# Frente 4: Medição, jobs, relatório e deploy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a medição (endpoint `/api/eventos` com defesa, banner de cookies, rastreador de cliques e visualizações), todos desligados por `eventos_ativos` até o "de acordo" do Moisés; o job diário (backup, consolidação, limpeza); a aba Relatório; o documento de uma página para o Moisés; e o deploy na Vercel com as verificações de segurança do store público.

**Architecture:** Leia `README.md` desta pasta antes. O navegador nunca manda identificador: o servidor lê o cookie `mcv_visitante` (só existe se o visitante aceitou) e preenche `visitante_id` e `data`. Cada evento é um blob pequeno em `eventos/<dia>/<uuid>.json` (dia no fuso de São Paulo). O job diário consolida os 3 últimos dias fechados em `resumos/<dia>.json`, copia `imoveis/` e `config/` para `backup/<dia>/` e apaga backups com mais de 30 dias e eventos/resumos com mais de 180. O relatório lê só os resumos. O rastreador lê os `data-*` que a frente 1 deixou nos botões de WhatsApp e na página do imóvel.

**Tech Stack:** Next.js 16.4.1 (Route Handlers, Vercel Cron), `navigator.sendBeacon`, `useSyncExternalStore`, zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-site-novo-mc-vieira-design.md` (seções 1 Medidas, 4.5, 6 Relatório, 7, 9, 10, 12).

**Pré-requisito:** frentes 0, 1 e 2 em `main`. **Branch:** `git checkout -b feat/site-novo-medicao`.

**Comandos (em `apps/site/`):** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`.

---

### Task 4.1: Endpoint `/api/eventos` com defesa

**Files:**
- Create: `apps/site/src/lib/eventos/dias.ts`, `apps/site/src/lib/eventos/limitador.ts`, `apps/site/src/lib/api/eventos.ts`, `apps/site/src/app/api/eventos/route.ts`
- Test: `apps/site/src/lib/eventos/dias.test.ts`, `apps/site/src/lib/eventos/limitador.test.ts`, `apps/site/src/lib/api/eventos.test.ts`

**Interfaces:**
- Consumes: `EventoEntradaSchema`, `EventoGravadoSchema`, `COOKIE_VISITANTE`, `caminhos.evento`, `lerCookie`, `origemConfere`, `lerCorpoJson`, `respostaErro`, `Servicos.flags()`, `Servicos.catalogo()`.
- Produces:
  ```ts
  // dias.ts
  diaSaoPaulo(data: Date): string                 // "AAAA-MM-DD"
  somarDias(dia: string, dias: number): string
  diasAte(ultimo: string, quantidade: number): string[]   // do mais antigo ao último
  emLotes<T>(itens: T[], tamanho: number): T[][]
  // limitador.ts
  interface Limitador { permitir(origemDeRede: string, agoraMs: number): boolean }
  criarLimitador(opcoes?: { porOrigemPorMinuto?: number; globalPorMinuto?: number }): Limitador
  ehBot(userAgent: string): boolean
  origemDeRede(req: Request): string
  // api/eventos.ts
  tratarEvento(req: Request, s: Servicos, limitador: Limitador): Promise<Response>   // 202 gravado, 204 descartado (bot)
  ```

- [ ] **Step 1: Testes de dias e do limitador**

`src/lib/eventos/dias.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { diaSaoPaulo, diasAte, emLotes, somarDias } from "./dias";

describe("dias", () => {
  it("usa o fuso de São Paulo", () => {
    expect(diaSaoPaulo(new Date("2026-10-15T02:00:00.000Z"))).toBe("2026-10-14");
    expect(diaSaoPaulo(new Date("2026-10-15T12:00:00.000Z"))).toBe("2026-10-15");
  });

  it("soma dias atravessando o mês", () => {
    expect(somarDias("2026-10-01", -1)).toBe("2026-09-30");
    expect(somarDias("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("lista a janela terminando no último dia", () => {
    expect(diasAte("2026-10-14", 3)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
  });

  it("quebra em lotes", () => {
    expect(emLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
```

`src/lib/eventos/limitador.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { criarLimitador, ehBot, origemDeRede } from "./limitador";

describe("limitador", () => {
  it("libera até o limite por origem em um minuto e volta a liberar depois", () => {
    const limitador = criarLimitador({ porOrigemPorMinuto: 3, globalPorMinuto: 100 });
    const agora = 1_000_000;
    expect([1, 2, 3, 4].map(() => limitador.permitir("1.2.3.4", agora))).toEqual([true, true, true, false]);
    expect(limitador.permitir("5.6.7.8", agora)).toBe(true);
    expect(limitador.permitir("1.2.3.4", agora + 61_000)).toBe(true);
  });

  it("tem teto global por instância", () => {
    const limitador = criarLimitador({ porOrigemPorMinuto: 100, globalPorMinuto: 2 });
    expect(["a", "b", "c"].map((origem) => limitador.permitir(origem, 0))).toEqual([true, true, false]);
  });
});

describe("ehBot", () => {
  it("reconhece robôs e pré-visualizações de link", () => {
    for (const agente of ["Googlebot/2.1", "facebookexternalhit/1.1", "WhatsApp/2.23", "HeadlessChrome/120", "curl/8.4"]) expect(ehBot(agente)).toBe(true);
    expect(ehBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1")).toBe(false);
  });
});

describe("origemDeRede", () => {
  it("usa o IP que a Vercel repassa, sem guardar nada", () => {
    const pedido = new Request("http://x", { headers: { "x-forwarded-for": "200.1.2.3, 10.0.0.1" } });
    expect(origemDeRede(pedido)).toBe("200.1.2.3");
    expect(origemDeRede(new Request("http://x"))).toBe("desconhecida");
  });
});
```

- [ ] **Step 2: Testes do endpoint**

`src/lib/api/eventos.test.ts`:

```ts
import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FLAGS_PADRAO } from "@/lib/contratos/flags";
import { criarLimitador } from "@/lib/eventos/limitador";
import { gravarFlags } from "@/lib/repositorio/flags";
import { gravarImovel } from "@/lib/repositorio/imoveis";
import { imovelDeExemplo } from "@/testes/fixtures";
import { ORIGEM_APP } from "@/testes/requisicoes";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { tratarEvento } from "./eventos";

const NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36";
const VISITANTE = "3f1c2a64-7a5e-4c1f-9b1d-2d7f0f6c9e11";

async function preparar({ ligado = true } = {}) {
  const s = await criarServicosDeTeste();
  await gravarFlags(s.armazem, { ...FLAGS_PADRAO, eventos_ativos: ligado }, null);
  await gravarImovel(s.armazem, imovelDeExemplo({ codigo: "MC001" }));
  await gravarImovel(s.armazem, imovelDeExemplo({ codigo: "MC002", publicacao: "rascunho", publicado_em: undefined }));
  return s;
}

function evento(corpo: unknown, cabecalhos: Record<string, string> = {}) {
  return new Request(`${ORIGEM_APP}/api/eventos`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": NAVEGADOR, origin: ORIGEM_APP, "x-forwarded-for": "200.1.2.3", ...cabecalhos },
    body: JSON.stringify(corpo),
  });
}

async function eventosGravados(s: Awaited<ReturnType<typeof criarServicosDeTeste>>) {
  const itens = await s.armazem.listar("eventos/");
  return Promise.all(itens.map(async (item) => (await s.armazem.ler(item.caminho))!.dados as Record<string, unknown>));
}

describe("POST /api/eventos", () => {
  it("com a medição desligada recusa tudo e não grava nada", async () => {
    const s = await preparar({ ligado: false });
    const resposta = await tratarEvento(evento({ tipo: "visualizacao_imovel", codigo: "MC001" }), s, criarLimitador());
    expect(resposta.status).toBe(403);
    expect(await eventosGravados(s)).toEqual([]);
  });

  it("sem consentimento grava o evento anônimo, sem visitante_id nem IP", async () => {
    const s = await preparar();
    const resposta = await tratarEvento(evento({ tipo: "clique_whatsapp", codigo: "MC001", negocio: "venda", origem: "imovel" }), s, criarLimitador());
    expect(resposta.status).toBe(202);
    const [gravado] = await eventosGravados(s);
    expect(gravado).toEqual({ tipo: "clique_whatsapp", codigo: "MC001", negocio: "venda", origem: "imovel", data: "2026-10-15T12:00:00.000Z" });
    expect(JSON.stringify(gravado)).not.toContain("200.1.2.3");
  });

  it("com o cookie aceito grava o visitante_id lido pelo servidor", async () => {
    const s = await preparar();
    await tratarEvento(evento({ tipo: "visualizacao_imovel", codigo: "MC001" }, { cookie: `mcv_visitante=${VISITANTE}` }), s, criarLimitador());
    expect((await eventosGravados(s))[0].visitante_id).toBe(VISITANTE);
  });

  it("cookie que não é UUID vira evento anônimo", async () => {
    const s = await preparar();
    await tratarEvento(evento({ tipo: "visualizacao_imovel", codigo: "MC001" }, { cookie: "mcv_visitante=qualquer-coisa" }), s, criarLimitador());
    expect((await eventosGravados(s))[0]).not.toHaveProperty("visitante_id");
  });

  it("clique de contato sem código é aceito para origem flutuante e contato (Review Focus 5)", async () => {
    const s = await preparar();
    expect((await tratarEvento(evento({ tipo: "clique_whatsapp", origem: "flutuante" }), s, criarLimitador())).status).toBe(202);
    expect((await tratarEvento(evento({ tipo: "clique_whatsapp", origem: "contato" }), s, criarLimitador())).status).toBe(202);
    expect(await eventosGravados(s)).toHaveLength(2);
  });

  it("exige código de imóvel publicado", async () => {
    const s = await preparar();
    expect((await tratarEvento(evento({ tipo: "visualizacao_imovel", codigo: "MC002" }), s, criarLimitador())).status).toBe(422);
    expect((await tratarEvento(evento({ tipo: "visualizacao_imovel", codigo: "MC999" }), s, criarLimitador())).status).toBe(422);
  });

  it("recusa esquema inválido, visitante_id vindo do navegador e Origin de outro site", async () => {
    const s = await preparar();
    expect((await tratarEvento(evento({ tipo: "outro" }), s, criarLimitador())).status).toBe(400);
    expect((await tratarEvento(evento({ tipo: "visualizacao_imovel", codigo: "MC001", visitante_id: VISITANTE }), s, criarLimitador())).status).toBe(400);
    expect((await tratarEvento(evento({ tipo: "visualizacao_imovel", codigo: "MC001" }, { origin: "https://outro.example" }), s, criarLimitador())).status).toBe(403);
  });

  it("descarta robô sem gravar", async () => {
    const s = await preparar();
    const resposta = await tratarEvento(evento({ tipo: "visualizacao_imovel", codigo: "MC001" }, { "user-agent": "Googlebot/2.1" }), s, criarLimitador());
    expect(resposta.status).toBe(204);
    expect(await eventosGravados(s)).toEqual([]);
  });

  it("1.000 envios seguidos não geram 1.000 blobs (spec seção 10)", async () => {
    const s = await preparar();
    const limitador = criarLimitador();
    const status: number[] = [];
    for (let n = 0; n < 1000; n += 1) status.push((await tratarEvento(evento({ tipo: "visualizacao_imovel", codigo: "MC001" }), s, limitador)).status);
    const dia = path.join(s.raiz, "privado", "eventos", "2026-10-15");
    const arquivos = await readdir(dia);
    expect(arquivos.length).toBeLessThanOrEqual(20);
    expect(status.filter((codigo) => codigo === 429).length).toBeGreaterThanOrEqual(980);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- src/lib/eventos src/lib/api/eventos.test.ts`
Expected: FAIL com `Failed to resolve import "./dias"`, `"./limitador"` e `"./eventos"`.

- [ ] **Step 4: Implementar `dias.ts` e `limitador.ts`**

`src/lib/eventos/dias.ts`:

```ts
const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** Dia civil em São Paulo, no formato AAAA-MM-DD (o en-CA formata assim). */
export function diaSaoPaulo(data: Date): string {
  return formatoDia.format(data);
}

export function somarDias(dia: string, dias: number): string {
  const data = new Date(`${dia}T12:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

export function diasAte(ultimo: string, quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, indice) => somarDias(ultimo, indice - quantidade + 1));
}

export function emLotes<T>(itens: T[], tamanho: number): T[][] {
  return Array.from({ length: Math.ceil(itens.length / tamanho) }, (_, indice) => itens.slice(indice * tamanho, (indice + 1) * tamanho));
}
```

`src/lib/eventos/limitador.ts`:

```ts
import { createHmac, randomBytes } from "node:crypto";

export interface Limitador {
  permitir(origemDeRede: string, agoraMs: number): boolean;
}

const JANELA_MS = 60_000;
const LIMPAR_ACIMA_DE = 5_000;

/**
 * Limite por origem de rede sem guardar o IP (spec 4.5): a chave é um HMAC com sal aleatório que só existe
 * na memória deste processo. Vale por instância; ver risco em tasks/todo.md.
 */
export function criarLimitador({ porOrigemPorMinuto = 20, globalPorMinuto = 600 } = {}): Limitador {
  const sal = randomBytes(16);
  const janelas = new Map<string, number[]>();
  let global: number[] = [];
  const chave = (origem: string) => createHmac("sha256", sal).update(origem).digest("base64url");

  return {
    permitir(origem, agoraMs) {
      const inicio = agoraMs - JANELA_MS;
      global = global.filter((momento) => momento > inicio);
      if (global.length >= globalPorMinuto) return false;
      const k = chave(origem);
      const recentes = (janelas.get(k) ?? []).filter((momento) => momento > inicio);
      if (recentes.length >= porOrigemPorMinuto) {
        janelas.set(k, recentes);
        return false;
      }
      recentes.push(agoraMs);
      janelas.set(k, recentes);
      global.push(agoraMs);
      if (janelas.size > LIMPAR_ACIMA_DE) {
        for (const [chaveAntiga, momentos] of janelas) if (momentos.every((momento) => momento <= inicio)) janelas.delete(chaveAntiga);
      }
      return true;
    },
  };
}

const ROBO = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|httpclient/i;

export function ehBot(userAgent: string): boolean {
  return ROBO.test(userAgent);
}

export function origemDeRede(req: Request): string {
  const encaminhado = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-forwarded-for");
  return encaminhado?.split(",")[0]?.trim() || "desconhecida";
}
```

- [ ] **Step 5: Implementar o endpoint e a rota**

`src/lib/api/eventos.ts`:

```ts
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { caminhos } from "@/lib/armazem/caminhos";
import { lerCookie, origemConfere } from "@/lib/auth/guarda";
import { EventoEntradaSchema, EventoGravadoSchema } from "@/lib/contratos/eventos";
import { COOKIE_VISITANTE } from "@/lib/contratos/sessao";
import { diaSaoPaulo } from "@/lib/eventos/dias";
import { ehBot, origemDeRede, type Limitador } from "@/lib/eventos/limitador";
import type { Servicos } from "@/lib/servicos";
import { lerCorpoJson, respostaErro } from "./respostas";

const UuidSchema = z.uuid();

/** Endpoint público e cada gravação custa (spec 4.5): barreiras baratas primeiro, gravação por último. */
export async function tratarEvento(req: Request, s: Servicos, limitador: Limitador): Promise<Response> {
  if (!(await s.flags()).eventos_ativos) return respostaErro(403, "medicao_desligada", "A medição está desligada.");
  if (!origemConfere(req)) return respostaErro(403, "origem_invalida", "Evento vindo de fora do site.");
  const agente = req.headers.get("user-agent") ?? "";
  if (!agente || ehBot(agente)) return new Response(null, { status: 204 });
  const agora = s.agora();
  if (!limitador.permitir(origemDeRede(req), agora.getTime())) return respostaErro(429, "muitos_eventos", "Muitos eventos em pouco tempo.");

  const leitura = await lerCorpoJson(req, 2_000);
  if (!leitura.ok) return leitura.resposta;
  const evento = EventoEntradaSchema.safeParse(leitura.corpo);
  if (!evento.success) return respostaErro(400, "evento_invalido", "Evento fora do formato.");
  if (evento.data.codigo) {
    const publicado = (await s.catalogo()).some((imovel) => imovel.codigo === evento.data.codigo && imovel.publicacao === "publicado");
    if (!publicado) return respostaErro(422, "imovel_nao_publicado", "Código de imóvel não publicado.");
  }

  // visitante_id só existe se o visitante aceitou o cookie; nada mais do visitante é gravado (spec 7).
  const cookie = lerCookie(req, COOKIE_VISITANTE);
  const visitante_id = cookie && UuidSchema.safeParse(cookie).success ? cookie : undefined;
  const gravado = EventoGravadoSchema.parse({ ...evento.data, ...(visitante_id ? { visitante_id } : {}), data: agora.toISOString() });
  await s.armazem.gravar(caminhos.evento(diaSaoPaulo(agora), randomUUID()), gravado, { criarSomente: true });
  return new Response(null, { status: 202 });
}
```

`src/app/api/eventos/route.ts`:

```ts
import { tratarEvento } from "@/lib/api/eventos";
import { criarLimitador } from "@/lib/eventos/limitador";
import { servicos } from "@/lib/servicos";

const limitador = criarLimitador();

export const POST = (req: Request) => tratarEvento(req, servicos(), limitador);
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- src/lib/eventos src/lib/api/eventos.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/site/src/lib/eventos/dias.ts apps/site/src/lib/eventos/dias.test.ts apps/site/src/lib/eventos/limitador.ts apps/site/src/lib/eventos/limitador.test.ts apps/site/src/lib/api/eventos.ts apps/site/src/lib/api/eventos.test.ts apps/site/src/app/api/eventos
git commit -m "feat(eventos): endpoint público com flag, Origin, filtro de robô, limite por origem e evento anônimo"
```

---

### Task 4.2: Banner de cookies, rastreador e preferência na privacidade

**Files:**
- Create: `apps/site/src/lib/eventos/consentimento.ts`, `apps/site/src/components/site/BannerCookies.tsx`, `apps/site/src/components/site/Rastreador.tsx`, `apps/site/src/components/site/PreferenciaCookies.tsx`
- Modify: `apps/site/src/lib/catalogo.ts` (acrescentar `carregarMedicaoLigada`), `apps/site/src/app/(site)/layout.tsx`, `apps/site/src/app/(site)/privacidade/page.tsx`, `apps/site/src/app/globals.css`
- Test: `apps/site/e2e/painel-medicao.spec.ts` (nome começa com `painel` para rodar só no desktop; usa o painel para ligar a medição)

**Interfaces:**
- Consumes: `COOKIE_VISITANTE`, `carregarFlagsPublicas`, `registrarFalhaCatalogo`, `entrarNoPainel` (frente 2), atributos `data-evento`, `data-origem`, `data-codigo`, `data-negocio`, `data-visualizacao` (frente 1).
- Produces:
  ```ts
  // consentimento.ts (só navegador)
  CHAVE_RECUSA = "mcv_consentimento"; VALIDADE_COOKIE_SEGUNDOS = 15_552_000; EVENTO_CONSENTIMENTO = "mcv:consentimento"
  assinarConsentimento(aviso: () => void): () => void
  visitanteDecidiu(): boolean
  aceitarCookie(): void; recusarCookie(): void; apagarEscolha(): void
  // catalogo.ts
  carregarMedicaoLigada(): Promise<boolean>   // falha de leitura = desligada
  ```

- [ ] **Step 1: Consentimento no navegador**

`src/lib/eventos/consentimento.ts`:

```ts
import { COOKIE_VISITANTE } from "@/lib/contratos/sessao";

export const CHAVE_RECUSA = "mcv_consentimento";
export const VALIDADE_COOKIE_SEGUNDOS = 15_552_000; // 6 meses (spec 7)
export const EVENTO_CONSENTIMENTO = "mcv:consentimento";

function avisar() {
  window.dispatchEvent(new Event(EVENTO_CONSENTIMENTO));
}

export function assinarConsentimento(aviso: () => void): () => void {
  window.addEventListener(EVENTO_CONSENTIMENTO, aviso);
  return () => window.removeEventListener(EVENTO_CONSENTIMENTO, aviso);
}

function temCookieDeVisitante(): boolean {
  return document.cookie.split("; ").some((parte) => parte.startsWith(`${COOKIE_VISITANTE}=`));
}

function recusou(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_RECUSA) === "recusado";
  } catch {
    // Sem acesso ao armazenamento (modo privado): tratamos como "ainda não decidiu" e o banner aparece.
    return false;
  }
}

export function visitanteDecidiu(): boolean {
  return temCookieDeVisitante() || recusou();
}

/** O UUID aleatório só nasce aqui, depois do aceite (spec 7). */
export function aceitarCookie(): void {
  document.cookie = `${COOKIE_VISITANTE}=${crypto.randomUUID()}; Max-Age=${VALIDADE_COOKIE_SEGUNDOS}; Path=/; SameSite=Lax; Secure`;
  avisar();
}

/** Recusa sem cookie: lembra só que recusou, sem identificador (ajuste F). */
export function recusarCookie(): void {
  try {
    window.localStorage.setItem(CHAVE_RECUSA, "recusado");
  } catch {
    // Sem armazenamento: a recusa vale só nesta visita; nenhum cookie é criado.
  }
  avisar();
}

export function apagarEscolha(): void {
  document.cookie = `${COOKIE_VISITANTE}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
  try {
    window.localStorage.removeItem(CHAVE_RECUSA);
  } catch {
    // Sem armazenamento: não havia recusa guardada.
  }
  avisar();
}
```

- [ ] **Step 2: Componentes**

`src/components/site/BannerCookies.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { aceitarCookie, assinarConsentimento, recusarCookie, visitanteDecidiu } from "@/lib/eventos/consentimento";

/** Só existe com a medição ligada. No servidor, considera "decidido" para não piscar o banner. */
export function BannerCookies({ ativo }: { ativo: boolean }) {
  const decidiu = useSyncExternalStore(assinarConsentimento, visitanteDecidiu, () => true);
  if (!ativo || decidiu) return null;
  return (
    <div className="banner-cookies" role="region" aria-label="Aviso de cookies">
      <p>
        Usamos um cookie com um número aleatório para saber quantas pessoas voltam ao site. Ele não diz quem você é e vale por 6
        meses. <Link href="/privacidade">Saiba mais</Link>.
      </p>
      <div className="banner-cookies-acoes">
        <button type="button" className="btn" onClick={recusarCookie}>
          Recusar
        </button>
        <button type="button" className="btn" onClick={aceitarCookie}>
          Aceitar
        </button>
      </div>
    </div>
  );
}
```

`src/components/site/Rastreador.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function enviar(evento: Record<string, string | undefined>) {
  const corpo = JSON.stringify(Object.fromEntries(Object.entries(evento).filter(([, valor]) => valor)));
  const pacote = new Blob([corpo], { type: "application/json" });
  if (navigator.sendBeacon?.("/api/eventos", pacote)) return;
  // Sem sendBeacon: fetch com keepalive. A medição nunca pode atrapalhar a navegação, então a falha é ignorada de propósito.
  fetch("/api/eventos", { method: "POST", body: corpo, headers: { "content-type": "application/json" }, keepalive: true, credentials: "same-origin" }).catch(
    () => undefined,
  );
}

/** Lê os data-* que a frente 1 põe nos botões e na página do imóvel. Desligado, não faz nada. */
export function Rastreador({ ativo }: { ativo: boolean }) {
  const caminho = usePathname();

  useEffect(() => {
    if (!ativo) return;
    const marcador = document.querySelector<HTMLElement>("[data-visualizacao]");
    if (marcador?.dataset.codigo) {
      enviar({ tipo: "visualizacao_imovel", codigo: marcador.dataset.codigo, negocio: marcador.dataset.negocio });
    }
  }, [ativo, caminho]);

  useEffect(() => {
    if (!ativo) return;
    const aoClicar = (evento: MouseEvent) => {
      const alvo = evento.target instanceof Element ? evento.target.closest<HTMLElement>('[data-evento="clique_whatsapp"]') : null;
      if (!alvo) return;
      enviar({ tipo: "clique_whatsapp", codigo: alvo.dataset.codigo, negocio: alvo.dataset.negocio, origem: alvo.dataset.origem });
    };
    document.addEventListener("click", aoClicar, { capture: true });
    return () => document.removeEventListener("click", aoClicar, { capture: true });
  }, [ativo]);

  return null;
}
```

`src/components/site/PreferenciaCookies.tsx`:

```tsx
"use client";

import { useSyncExternalStore } from "react";
import { apagarEscolha, assinarConsentimento, visitanteDecidiu } from "@/lib/eventos/consentimento";

export function PreferenciaCookies({ ativo }: { ativo: boolean }) {
  const decidiu = useSyncExternalStore(assinarConsentimento, visitanteDecidiu, () => false);
  if (!ativo) return <p>Com a medição desligada, não há escolha a mudar.</p>;
  return decidiu ? (
    <button type="button" className="btn" onClick={apagarEscolha}>
      Apagar minha escolha e perguntar de novo
    </button>
  ) : (
    <p>Você ainda não escolheu. O aviso aparece no rodapé da página.</p>
  );
}
```

Acrescente ao fim de `src/app/globals.css`:

```css
.banner-cookies {
  position: fixed; left: 16px; right: 96px; bottom: 16px; z-index: 25; background: var(--noite2); border: 1px solid var(--linha);
  padding: 16px 20px; display: flex; gap: 16px; align-items: center; justify-content: space-between; flex-wrap: wrap; font-size: 14px;
}
.banner-cookies a { text-decoration: underline; text-underline-offset: 3px; }
.banner-cookies-acoes { display: flex; gap: 12px; }
.banner-cookies .btn { padding: 10px 18px; background: transparent; color: var(--off); cursor: pointer; }
@media (max-width: 900px) { .banner-cookies { right: 16px; bottom: 92px; } }
```

- [ ] **Step 3: Ligar no layout do site e na privacidade**

Em `src/lib/catalogo.ts`, acrescente:

```ts
/** Falha ao ler as flags = medição desligada: na dúvida, não coleta nada. */
export async function carregarMedicaoLigada(): Promise<boolean> {
  try {
    return (await carregarFlagsPublicas()).eventos_ativos;
  } catch (erro) {
    registrarFalhaCatalogo(erro);
    return false;
  }
}
```

`src/app/(site)/layout.tsx` (substitui o da frente 1):

```tsx
import type { ReactNode } from "react";
import { BannerCookies } from "@/components/site/BannerCookies";
import { Cabecalho } from "@/components/site/Cabecalho";
import { Rastreador } from "@/components/site/Rastreador";
import { Rodape } from "@/components/site/Rodape";
import { carregarMedicaoLigada } from "@/lib/catalogo";

export default async function LayoutDoSite({ children }: { children: ReactNode }) {
  const medicao = await carregarMedicaoLigada();
  return (
    <>
      <a href="#conteudo" className="pular">
        Pular para o conteúdo
      </a>
      <Cabecalho />
      {children}
      <Rodape />
      <BannerCookies ativo={medicao} />
      <Rastreador ativo={medicao} />
    </>
  );
}
```

Em `src/app/(site)/privacidade/page.tsx`: apague a função local `medicaoLigada` e os imports `carregarFlagsPublicas` e `registrarFalhaCatalogo`; importe `carregarMedicaoLigada` de `@/lib/catalogo` e `PreferenciaCookies` de `@/components/site/PreferenciaCookies`; troque `const ligada = await medicaoLigada();` por `const ligada = await carregarMedicaoLigada();` e troque `<div id="preferencia-cookies" />` por `<PreferenciaCookies ativo={ligada} />`.

- [ ] **Step 4: E2E da medição**

`apps/site/e2e/painel-medicao.spec.ts`:

```ts
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { diaSaoPaulo } from "../src/lib/eventos/dias";
import { entrarNoPainel } from "./sessao";

test.describe.configure({ mode: "serial" });

const PASTA_EVENTOS = path.join(".dados-e2e", "privado", "eventos");

async function eventosDeHoje(): Promise<Record<string, unknown>[]> {
  const pasta = path.join(PASTA_EVENTOS, diaSaoPaulo(new Date()));
  const nomes = await readdir(pasta).catch(() => [] as string[]);
  return Promise.all(nomes.map(async (nome) => JSON.parse(await readFile(path.join(pasta, nome), "utf8"))));
}

async function definirMedicao(request: APIRequestContext, ligada: boolean) {
  const { flags, etag } = await (await request.get("/api/flags")).json();
  const resposta = await request.put("/api/flags", {
    headers: { origin: "http://localhost:3100", ...(etag ? { "if-match": etag } : {}) },
    data: { flags: { primeira_dobra: flags.primeira_dobra, detalhes: flags.detalhes, eventos_ativos: ligada }, ...(ligada ? { confirmacao_medicao: "LIGAR" } : {}) },
  });
  expect(resposta.status()).toBe(200);
}

async function clicarNoWhatsApp(page: Page) {
  await page.context().route("https://wa.me/**", (rota) => rota.fulfill({ status: 200, body: "ok" }));
  const popup = page.waitForEvent("popup");
  await page.locator(".imovel-dobra").getByRole("link", { name: "Falar com o Moisés" }).click();
  await (await popup).close();
}

test.beforeAll(async () => {
  await rm(PASTA_EVENTOS, { recursive: true, force: true });
});

test("medição desligada: sem banner, sem cookie, sem evento", async ({ page }) => {
  await page.goto("/imoveis/MC001");
  await expect(page.getByRole("region", { name: "Aviso de cookies" })).toHaveCount(0);
  await clicarNoWhatsApp(page);
  expect(await page.context().cookies()).toEqual([]);
  expect(await eventosDeHoje()).toEqual([]);
});

test("medição ligada e visitante recusa: nenhum cookie, evento anônimo", async ({ page, browser }) => {
  const painel = await browser.newContext();
  await entrarNoPainel(painel);
  await definirMedicao(painel.request, true);
  await painel.close();

  await page.goto("/imoveis/MC001");
  await page.getByRole("button", { name: "Recusar" }).click();
  await expect(page.getByRole("region", { name: "Aviso de cookies" })).toHaveCount(0);
  await clicarNoWhatsApp(page);
  await expect.poll(async () => (await eventosDeHoje()).filter((evento) => evento.tipo === "clique_whatsapp").length).toBe(1);
  expect((await page.context().cookies()).map((cookie) => cookie.name)).not.toContain("mcv_visitante");
  for (const evento of await eventosDeHoje()) expect(evento).not.toHaveProperty("visitante_id");
});

test("visitante aceita: cookie de 6 meses e eventos com visitante_id", async ({ page }) => {
  await page.goto("/imoveis/MC003?negocio=aluguel");
  await page.getByRole("button", { name: "Aceitar" }).click();
  const cookie = (await page.context().cookies()).find((item) => item.name === "mcv_visitante");
  expect(cookie?.value).toMatch(/^[0-9a-f-]{36}$/);
  expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(15_000_000);
  await page.goto("/imoveis/MC003?negocio=aluguel");
  await expect
    .poll(async () => (await eventosDeHoje()).some((evento) => evento.visitante_id === cookie!.value && evento.codigo === "MC003" && evento.negocio === "aluguel"))
    .toBe(true);
});

test.afterAll(async ({ browser }) => {
  const painel = await browser.newContext();
  await entrarNoPainel(painel);
  await definirMedicao(painel.request, false);
  await painel.close();
});
```

- [ ] **Step 5: Rodar**

Run: `npm run typecheck && npm run lint && npm run test:e2e`
Expected: PASS em tudo, inclusive `painel-medicao.spec.ts` no `desktop` e o axe da frente 1 (o banner não aparece com a medição desligada).

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/lib/eventos/consentimento.ts apps/site/src/components/site/BannerCookies.tsx apps/site/src/components/site/Rastreador.tsx apps/site/src/components/site/PreferenciaCookies.tsx apps/site/src/lib/catalogo.ts "apps/site/src/app/(site)/layout.tsx" "apps/site/src/app/(site)/privacidade/page.tsx" apps/site/src/app/globals.css apps/site/e2e/painel-medicao.spec.ts
git commit -m "feat(medicao): banner de cookies, rastreador por data-* e escolha reversível, tudo atrás de eventos_ativos"
```

---

### Task 4.3: Consolidação diária e relatório

**Files:**
- Create: `apps/site/src/lib/eventos/consolidar.ts`, `apps/site/src/lib/eventos/relatorio.ts`, `apps/site/src/lib/api/relatorio.ts`, `apps/site/src/app/api/relatorio/route.ts`
- Test: `apps/site/src/lib/eventos/consolidar.test.ts`, `apps/site/src/lib/eventos/relatorio.test.ts`

**Interfaces:**
- Consumes: `EventoGravado`, `EventoGravadoSchema`, `ResumoDia`, `ResumoDiaSchema`, `caminhos`, `diaSaoPaulo`, `somarDias`, `diasAte`, `emLotes`, `autenticar`.
- Produces:
  ```ts
  // consolidar.ts
  resumirDia(dia: string, eventos: EventoGravado[], agora: Date): ResumoDia
  consolidarDia(armazem: ArmazemJson, dia: string, agora: Date): Promise<ResumoDia>
  // relatorio.ts
  type Janela = 7 | 30
  interface LinhaRelatorio { codigo: string; negocio: "venda" | "aluguel" | "sem_negocio"; cliques: number; visualizacoes: number; taxa: number | null }
  interface Relatorio { janela: Janela; de: string; ate: string; linhas: LinhaRelatorio[]; porDia: { dia: string; cliques: number; visualizacoes: number }[];
    totalCliques: number; totalVisualizacoes: number; cliquesSemImovel: number; visitantesUnicos: number; visitantesRecorrentes: number; diasSemResumo: string[] }
  montarRelatorio(resumos: ResumoDia[], janela: Janela, ate: string): Relatorio
  carregarRelatorio(armazem: ArmazemJson, janela: Janela, agora: Date): Promise<Relatorio>   // até ontem (dia fechado)
  // api/relatorio.ts
  tratarRelatorio(req: Request, s: Servicos): Promise<Response>   // { eventos_ativos, sete, trinta }
  ```

- [ ] **Step 1: Testes**

`src/lib/eventos/consolidar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { caminhos } from "@/lib/armazem/caminhos";
import type { EventoGravado } from "@/lib/contratos/eventos";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { consolidarDia, resumirDia } from "./consolidar";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const data = "2026-10-14T15:00:00.000Z";
const EVENTOS: EventoGravado[] = [
  { tipo: "visualizacao_imovel", codigo: "MC001", negocio: "venda", visitante_id: A, data },
  { tipo: "visualizacao_imovel", codigo: "MC001", negocio: "venda", data },
  { tipo: "clique_whatsapp", codigo: "MC001", negocio: "venda", origem: "imovel", visitante_id: A, data },
  { tipo: "visualizacao_imovel", codigo: "MC003", visitante_id: B, data },
  { tipo: "clique_whatsapp", origem: "flutuante", data },
];

describe("resumirDia", () => {
  it("conta por imóvel e negócio, cliques sem imóvel e visitantes com ID", () => {
    const resumo = resumirDia("2026-10-14", EVENTOS, new Date("2026-10-15T06:00:00.000Z"));
    expect(resumo.por_imovel.MC001.venda).toEqual({ cliques: 1, visualizacoes: 2 });
    expect(resumo.por_imovel.MC003.sem_negocio).toEqual({ cliques: 0, visualizacoes: 1 });
    expect(resumo.cliques_sem_imovel).toBe(1);
    expect(resumo.total_eventos).toBe(5);
    expect(resumo.visitantes).toEqual([A, B]);
  });
});

describe("consolidarDia", () => {
  it("lê os eventos do dia, grava o resumo e é idempotente", async () => {
    const s = await criarServicosDeTeste();
    for (const [indice, evento] of EVENTOS.entries()) await s.armazem.gravar(caminhos.evento("2026-10-14", `e${indice}`), evento);
    await s.armazem.gravar(caminhos.evento("2026-10-14", "quebrado"), { tipo: "x" });
    const primeiro = await consolidarDia(s.armazem, "2026-10-14", s.agora());
    const segundo = await consolidarDia(s.armazem, "2026-10-14", s.agora());
    expect(segundo).toEqual(primeiro);
    expect(primeiro.total_eventos).toBe(5);
    expect((await s.armazem.ler(caminhos.resumo("2026-10-14")))?.dados).toEqual(primeiro);
  });

  it("dia sem eventos gera resumo zerado", async () => {
    const s = await criarServicosDeTeste();
    expect((await consolidarDia(s.armazem, "2026-10-01", s.agora())).total_eventos).toBe(0);
  });
});
```

`src/lib/eventos/relatorio.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ResumoDia } from "@/lib/contratos/eventos";
import { montarRelatorio } from "./relatorio";

const zero = { cliques: 0, visualizacoes: 0 };
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const resumo = (dia: string, venda: { cliques: number; visualizacoes: number }, visitantes: string[], semImovel = 0): ResumoDia => ({
  dia,
  gerado_em: "2026-10-15T06:00:00.000Z",
  total_eventos: venda.cliques + venda.visualizacoes,
  por_imovel: { MC001: { venda, aluguel: zero, sem_negocio: zero } },
  cliques_sem_imovel: semImovel,
  visitantes,
});

describe("montarRelatorio", () => {
  const resumos = [resumo("2026-10-13", { cliques: 1, visualizacoes: 4 }, [A, B], 2), resumo("2026-10-14", { cliques: 2, visualizacoes: 6 }, [A])];

  it("soma por imóvel e negócio na janela, com taxa de clique", () => {
    const relatorio = montarRelatorio(resumos, 7, "2026-10-14");
    expect(relatorio.linhas).toEqual([{ codigo: "MC001", negocio: "venda", cliques: 3, visualizacoes: 10, taxa: 0.3 }]);
    expect(relatorio.totalCliques).toBe(5);
    expect(relatorio.cliquesSemImovel).toBe(2);
    expect(relatorio.de).toBe("2026-10-08");
  });

  it("únicos e recorrentes contam só visitantes com ID", () => {
    const relatorio = montarRelatorio(resumos, 7, "2026-10-14");
    expect(relatorio.visitantesUnicos).toBe(2);
    expect(relatorio.visitantesRecorrentes).toBe(1);
  });

  it("série por dia e dias sem resumo", () => {
    const relatorio = montarRelatorio(resumos, 7, "2026-10-14");
    expect(relatorio.porDia.at(-1)).toEqual({ dia: "2026-10-14", cliques: 2, visualizacoes: 6 });
    expect(relatorio.diasSemResumo).toHaveLength(5);
  });

  it("resumo fora da janela não entra", () => {
    expect(montarRelatorio(resumos, 7, "2026-10-30").totalCliques).toBe(0);
  });

  it("sem visualização, a taxa é nula (não zero, não infinito)", () => {
    const soClique = resumo("2026-10-14", { cliques: 1, visualizacoes: 0 }, []);
    expect(montarRelatorio([soClique], 7, "2026-10-14").linhas[0].taxa).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/eventos/consolidar.test.ts src/lib/eventos/relatorio.test.ts`
Expected: FAIL com `Failed to resolve import "./consolidar"` e `"./relatorio"`.

- [ ] **Step 3: Implementar**

`src/lib/eventos/consolidar.ts`:

```ts
import { caminhos } from "@/lib/armazem/caminhos";
import type { ArmazemJson } from "@/lib/armazem/tipos";
import { EventoGravadoSchema, ResumoDiaSchema, type EventoGravado, type ResumoDia } from "@/lib/contratos/eventos";
import { emLotes } from "./dias";

const zero = () => ({ cliques: 0, visualizacoes: 0 });

export function resumirDia(dia: string, eventos: EventoGravado[], agora: Date): ResumoDia {
  const por_imovel: ResumoDia["por_imovel"] = {};
  const visitantes = new Set<string>();
  let cliques_sem_imovel = 0;
  for (const evento of eventos) {
    if (evento.visitante_id) visitantes.add(evento.visitante_id);
    if (!evento.codigo) {
      if (evento.tipo === "clique_whatsapp") cliques_sem_imovel += 1;
      continue;
    }
    por_imovel[evento.codigo] ??= { venda: zero(), aluguel: zero(), sem_negocio: zero() };
    const contagem = por_imovel[evento.codigo][evento.negocio ?? "sem_negocio"];
    if (evento.tipo === "clique_whatsapp") contagem.cliques += 1;
    else contagem.visualizacoes += 1;
  }
  return { dia, gerado_em: agora.toISOString(), total_eventos: eventos.length, por_imovel, cliques_sem_imovel, visitantes: [...visitantes].sort() };
}

/** Idempotente: o mesmo dia consolidado de novo dá o mesmo resumo (sobrescreve). */
export async function consolidarDia(armazem: ArmazemJson, dia: string, agora: Date): Promise<ResumoDia> {
  const itens = await armazem.listar(caminhos.pastaEventosDia(dia));
  const eventos: EventoGravado[] = [];
  for (const lote of emLotes(itens, 50)) {
    const lidos = await Promise.all(lote.map((item) => armazem.ler(item.caminho)));
    lidos.forEach((objeto, indice) => {
      if (!objeto) return;
      const resultado = EventoGravadoSchema.safeParse(objeto.dados);
      if (resultado.success) eventos.push(resultado.data);
      else console.error(`[consolidacao] ${lote[indice].caminho} fora do esquema; ignorado`);
    });
  }
  const resumo = ResumoDiaSchema.parse(resumirDia(dia, eventos, agora));
  await armazem.gravar(caminhos.resumo(dia), resumo);
  return resumo;
}
```

`src/lib/eventos/relatorio.ts`:

```ts
import { caminhos } from "@/lib/armazem/caminhos";
import type { ArmazemJson } from "@/lib/armazem/tipos";
import { ResumoDiaSchema, type ResumoDia } from "@/lib/contratos/eventos";
import { diaSaoPaulo, diasAte, somarDias } from "./dias";

export type Janela = 7 | 30;
type NegocioDaLinha = "venda" | "aluguel" | "sem_negocio";
const NEGOCIOS_DA_LINHA: NegocioDaLinha[] = ["venda", "aluguel", "sem_negocio"];

export interface LinhaRelatorio {
  codigo: string;
  negocio: NegocioDaLinha;
  cliques: number;
  visualizacoes: number;
  taxa: number | null;
}

export interface Relatorio {
  janela: Janela;
  de: string;
  ate: string;
  linhas: LinhaRelatorio[];
  porDia: { dia: string; cliques: number; visualizacoes: number }[];
  totalCliques: number;
  totalVisualizacoes: number;
  cliquesSemImovel: number;
  visitantesUnicos: number;
  visitantesRecorrentes: number;
  diasSemResumo: string[];
}

export function montarRelatorio(resumos: ResumoDia[], janela: Janela, ate: string): Relatorio {
  const dias = diasAte(ate, janela);
  const porDiaDoResumo = new Map(resumos.map((resumo) => [resumo.dia, resumo]));
  const acumulado = new Map<string, LinhaRelatorio>();
  const diasPorVisitante = new Map<string, number>();
  const porDia: Relatorio["porDia"] = [];
  const diasSemResumo: string[] = [];
  let cliquesSemImovel = 0;

  for (const dia of dias) {
    const resumo = porDiaDoResumo.get(dia);
    if (!resumo) {
      diasSemResumo.push(dia);
      porDia.push({ dia, cliques: 0, visualizacoes: 0 });
      continue;
    }
    let cliquesDoDia = resumo.cliques_sem_imovel;
    let visualizacoesDoDia = 0;
    cliquesSemImovel += resumo.cliques_sem_imovel;
    for (const [codigo, porNegocio] of Object.entries(resumo.por_imovel)) {
      for (const negocio of NEGOCIOS_DA_LINHA) {
        const { cliques, visualizacoes } = porNegocio[negocio];
        if (cliques === 0 && visualizacoes === 0) continue;
        const chave = `${codigo}|${negocio}`;
        const linha = acumulado.get(chave) ?? { codigo, negocio, cliques: 0, visualizacoes: 0, taxa: null };
        linha.cliques += cliques;
        linha.visualizacoes += visualizacoes;
        acumulado.set(chave, linha);
        cliquesDoDia += cliques;
        visualizacoesDoDia += visualizacoes;
      }
    }
    porDia.push({ dia, cliques: cliquesDoDia, visualizacoes: visualizacoesDoDia });
    for (const visitante of resumo.visitantes) diasPorVisitante.set(visitante, (diasPorVisitante.get(visitante) ?? 0) + 1);
  }

  const linhas = [...acumulado.values()]
    .map((linha) => ({ ...linha, taxa: linha.visualizacoes > 0 ? Math.round((linha.cliques / linha.visualizacoes) * 1000) / 1000 : null }))
    .sort((a, b) => b.cliques - a.cliques || a.codigo.localeCompare(b.codigo));
  const recorrentes = [...diasPorVisitante.values()].filter((quantidade) => quantidade >= 2).length;
  return {
    janela,
    de: dias[0],
    ate,
    linhas,
    porDia,
    totalCliques: linhas.reduce((soma, linha) => soma + linha.cliques, 0) + cliquesSemImovel,
    totalVisualizacoes: linhas.reduce((soma, linha) => soma + linha.visualizacoes, 0),
    cliquesSemImovel,
    visitantesUnicos: diasPorVisitante.size,
    visitantesRecorrentes: recorrentes,
    diasSemResumo,
  };
}

/** Janela termina ontem: o dia de hoje ainda não foi consolidado. */
export async function carregarRelatorio(armazem: ArmazemJson, janela: Janela, agora: Date): Promise<Relatorio> {
  const ate = somarDias(diaSaoPaulo(agora), -1);
  const lidos = await Promise.all(diasAte(ate, janela).map((dia) => armazem.ler(caminhos.resumo(dia))));
  const resumos = lidos.flatMap((objeto) => {
    if (!objeto) return [];
    const resultado = ResumoDiaSchema.safeParse(objeto.dados);
    if (!resultado.success) {
      console.error("[relatorio] resumo fora do esquema; ignorado");
      return [];
    }
    return [resultado.data];
  });
  return montarRelatorio(resumos, janela, ate);
}
```

`src/lib/api/relatorio.ts`:

```ts
import { autenticar } from "@/lib/auth/guarda";
import { carregarRelatorio } from "@/lib/eventos/relatorio";
import { lerFlags } from "@/lib/repositorio/flags";
import type { Servicos } from "@/lib/servicos";

export async function tratarRelatorio(req: Request, s: Servicos): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: false });
  if (ator instanceof Response) return ator;
  const agora = s.agora();
  const [{ flags }, sete, trinta] = await Promise.all([lerFlags(s.armazem), carregarRelatorio(s.armazem, 7, agora), carregarRelatorio(s.armazem, 30, agora)]);
  return Response.json({ eventos_ativos: flags.eventos_ativos, sete, trinta });
}
```

`src/app/api/relatorio/route.ts`:

```ts
import { tratarRelatorio } from "@/lib/api/relatorio";
import { servicos } from "@/lib/servicos";

export const GET = (req: Request) => tratarRelatorio(req, servicos());
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/lib/eventos && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/eventos/consolidar.ts apps/site/src/lib/eventos/consolidar.test.ts apps/site/src/lib/eventos/relatorio.ts apps/site/src/lib/eventos/relatorio.test.ts apps/site/src/lib/api/relatorio.ts apps/site/src/app/api/relatorio
git commit -m "feat(relatorio): consolidação diária idempotente e relatório de 7 e 30 dias com únicos e recorrentes"
```

---

### Task 4.4: Job diário (backup, consolidação, limpeza) e Cron

**Files:**
- Create: `apps/site/src/lib/jobs/backup.ts`, `apps/site/src/lib/jobs/limpeza.ts`, `apps/site/src/lib/api/cron.ts`, `apps/site/src/app/api/cron/diario/route.ts`, `apps/site/vercel.json`
- Modify: `apps/site/src/lib/auth/guarda.ts` (exportar `segredosIguais`)
- Test: `apps/site/src/lib/jobs/jobs.test.ts`, `apps/site/src/lib/api/cron.test.ts`

**Interfaces:**
- Consumes: `ArmazemJson`, `caminhos`, `diaSaoPaulo`, `somarDias`, `emLotes`, `consolidarDia`, `segredosIguais`.
- Produces:
  ```ts
  executarBackup(armazem, agora: Date): Promise<{ dia: string; copiados: number }>
  RETENCAO = { backupDias: 30, eventosDias: 180 }
  limparVencidos(armazem, agora: Date): Promise<{ backups: number; eventos: number; resumos: number }>
  tratarCronDiario(req: Request, s: Servicos): Promise<Response>
  ```

- [ ] **Step 1: Testes**

`src/lib/jobs/jobs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { caminhos } from "@/lib/armazem/caminhos";
import { FLAGS_PADRAO } from "@/lib/contratos/flags";
import { gravarFlags } from "@/lib/repositorio/flags";
import { gravarEndereco, gravarImovel } from "@/lib/repositorio/imoveis";
import { imovelDeExemplo } from "@/testes/fixtures";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { executarBackup } from "./backup";
import { limparVencidos } from "./limpeza";

describe("backup", () => {
  it("copia imoveis/ e config/ para backup/<dia>/ e é idempotente", async () => {
    const s = await criarServicosDeTeste();
    await gravarImovel(s.armazem, imovelDeExemplo());
    await gravarEndereco(s.armazem, { codigo: "MC001", endereco_completo: "Rua A, 1", atualizado_em: s.agora().toISOString() });
    await gravarFlags(s.armazem, FLAGS_PADRAO, null);
    expect(await executarBackup(s.armazem, s.agora())).toEqual({ dia: "2026-10-15", copiados: 3 });
    expect(await executarBackup(s.armazem, s.agora())).toEqual({ dia: "2026-10-15", copiados: 3 });
    const copiados = (await s.armazem.listar("backup/2026-10-15/")).map((item) => item.caminho).sort();
    expect(copiados).toEqual([
      "backup/2026-10-15/config/flags.json",
      "backup/2026-10-15/imoveis/MC001/endereco.json",
      "backup/2026-10-15/imoveis/MC001/imovel.json",
    ]);
  });
});

describe("limpeza", () => {
  it("apaga backup com mais de 30 dias e eventos e resumos com mais de 180", async () => {
    const s = await criarServicosDeTeste(); // hoje = 2026-10-15
    await s.armazem.gravar("backup/2026-09-15/config/flags.json", {}); // 30 dias: fica
    await s.armazem.gravar("backup/2026-09-14/config/flags.json", {}); // 31 dias: sai
    await s.armazem.gravar(caminhos.evento("2026-04-18", "a"), {}); // 180 dias: fica
    await s.armazem.gravar(caminhos.evento("2026-04-17", "b"), {}); // 181 dias: sai
    await s.armazem.gravar(caminhos.resumo("2026-04-17"), {});
    await s.armazem.gravar(caminhos.resumo("2026-04-18"), {});
    expect(await limparVencidos(s.armazem, s.agora())).toEqual({ backups: 1, eventos: 1, resumos: 1 });
    expect(await limparVencidos(s.armazem, s.agora())).toEqual({ backups: 0, eventos: 0, resumos: 0 });
    expect(await s.armazem.ler("backup/2026-09-15/config/flags.json")).not.toBeNull();
    expect(await s.armazem.ler(caminhos.evento("2026-04-18", "a"))).not.toBeNull();
    expect(await s.armazem.ler(caminhos.resumo("2026-04-17"))).toBeNull();
  });
});
```

`src/lib/api/cron.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { caminhos } from "@/lib/armazem/caminhos";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { tratarCronDiario } from "./cron";

const pedido = (segredo?: string) => new Request("http://localhost:3000/api/cron/diario", { headers: segredo ? { authorization: `Bearer ${segredo}` } : {} });

describe("GET /api/cron/diario", () => {
  it("sem o CRON_SECRET é 401", async () => {
    const s = await criarServicosDeTeste();
    expect((await tratarCronDiario(pedido(), s)).status).toBe(401);
    expect((await tratarCronDiario(pedido("errado"), s)).status).toBe(401);
  });

  it("roda backup, consolida os 3 últimos dias fechados e limpa", async () => {
    const s = await criarServicosDeTeste();
    await s.armazem.gravar(caminhos.evento("2026-10-14", "a"), { tipo: "clique_whatsapp", origem: "contato", data: "2026-10-14T15:00:00.000Z" });
    const resposta = await tratarCronDiario(pedido(s.config.cronSecret), s);
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.falhas).toEqual([]);
    expect(corpo.consolidacao).toEqual({ "2026-10-12": 0, "2026-10-13": 0, "2026-10-14": 1 });
    expect(await s.armazem.ler(caminhos.resumo("2026-10-14"))).not.toBeNull();
  });

  it("uma etapa que falha não impede as outras e a resposta é 500", async () => {
    const s = await criarServicosDeTeste();
    // Mesmo armazém, com o copiar quebrado: o backup falha e as outras etapas seguem.
    const armazemQuebrado: typeof s.armazem = Object.assign(Object.create(Object.getPrototypeOf(s.armazem)), s.armazem, {
      copiar: async () => {
        throw new Error("blob fora");
      },
    });
    const quebrado = { ...s, armazem: armazemQuebrado };
    const resposta = await tratarCronDiario(pedido(s.config.cronSecret), quebrado);
    expect(resposta.status).toBe(500);
    const corpo = await resposta.json();
    expect(corpo.falhas).toEqual(["backup"]);
    expect(corpo.consolidacao).toBeDefined();
    expect(corpo.limpeza).toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/jobs src/lib/api/cron.test.ts`
Expected: FAIL com `Failed to resolve import "./backup"`, `"./limpeza"` e `"./cron"`.

- [ ] **Step 3: Implementar**

Em `src/lib/auth/guarda.ts`, troque `function segredosIguais` por `export function segredosIguais` (mesma implementação).

`src/lib/jobs/backup.ts`:

```ts
import { caminhos } from "@/lib/armazem/caminhos";
import type { ArmazemJson } from "@/lib/armazem/tipos";
import { diaSaoPaulo, emLotes } from "@/lib/eventos/dias";

/** Cópia diária dos JSON de imoveis/ e config/ (spec 3). As fotos não entram: depois de excluídas, não voltam (spec 6). */
export async function executarBackup(armazem: ArmazemJson, agora: Date): Promise<{ dia: string; copiados: number }> {
  const dia = diaSaoPaulo(agora);
  const itens = [...(await armazem.listar(caminhos.pastaImoveis)), ...(await armazem.listar(caminhos.pastaConfig))];
  for (const lote of emLotes(itens, 20)) {
    await Promise.all(lote.map((item) => armazem.copiar(item.caminho, `${caminhos.pastaBackupDia(dia)}${item.caminho}`)));
  }
  return { dia, copiados: itens.length };
}
```

`src/lib/jobs/limpeza.ts`:

```ts
import { caminhos } from "@/lib/armazem/caminhos";
import type { ArmazemJson } from "@/lib/armazem/tipos";
import { diaSaoPaulo, emLotes, somarDias } from "@/lib/eventos/dias";

export const RETENCAO = { backupDias: 30, eventosDias: 180 } as const;

async function apagarTudo(armazem: ArmazemJson, lista: string[]): Promise<number> {
  for (const lote of emLotes(lista, 100)) await armazem.apagar(lote);
  return lista.length;
}

/** Pastas de dia (backup/AAAA-MM-DD/, eventos/AAAA-MM-DD/) anteriores ao limite saem inteiras. */
async function apagarPastasAntes(armazem: ArmazemJson, prefixo: string, limite: string): Promise<number> {
  let apagadas = 0;
  for (const pasta of await armazem.listarPastas(prefixo)) {
    const dia = pasta.slice(prefixo.length, -1);
    if (dia >= limite) continue;
    // No adaptador de arquivo a pasta vazia continua listada; só conta quem ainda tinha arquivo.
    const arquivos = (await armazem.listar(pasta)).map((item) => item.caminho);
    if (arquivos.length === 0) continue;
    await apagarTudo(armazem, arquivos);
    apagadas += 1;
  }
  return apagadas;
}

export async function limparVencidos(armazem: ArmazemJson, agora: Date): Promise<{ backups: number; eventos: number; resumos: number }> {
  const hoje = diaSaoPaulo(agora);
  const limiteBackup = somarDias(hoje, -RETENCAO.backupDias);
  const limiteEventos = somarDias(hoje, -RETENCAO.eventosDias);
  const backups = await apagarPastasAntes(armazem, caminhos.pastaBackup, limiteBackup);
  const eventos = await apagarPastasAntes(armazem, caminhos.pastaEventos, limiteEventos);
  const resumosVencidos = (await armazem.listar(caminhos.pastaResumos))
    .map((item) => item.caminho)
    .filter((caminho) => caminho.slice(caminhos.pastaResumos.length, -".json".length) < limiteEventos);
  const resumos = await apagarTudo(armazem, resumosVencidos);
  return { backups, eventos, resumos };
}
```

`src/lib/api/cron.ts`:

```ts
import { segredosIguais } from "@/lib/auth/guarda";
import { consolidarDia } from "@/lib/eventos/consolidar";
import { diaSaoPaulo, somarDias } from "@/lib/eventos/dias";
import { executarBackup } from "@/lib/jobs/backup";
import { limparVencidos } from "@/lib/jobs/limpeza";
import type { Servicos } from "@/lib/servicos";
import { respostaErro } from "./respostas";

/** A Vercel chama com Authorization: Bearer <CRON_SECRET>. Cada etapa roda mesmo se a anterior falhar. */
export async function tratarCronDiario(req: Request, s: Servicos): Promise<Response> {
  const autorizacao = req.headers.get("authorization") ?? "";
  if (!autorizacao.startsWith("Bearer ") || !segredosIguais(autorizacao.slice("Bearer ".length), s.config.cronSecret)) {
    return respostaErro(401, "nao_autenticado", "CRON_SECRET inválido.");
  }
  const agora = s.agora();
  const resultado: Record<string, unknown> = {};
  const falhas: string[] = [];
  const etapa = async (nome: string, tarefa: () => Promise<unknown>) => {
    try {
      resultado[nome] = await tarefa();
    } catch (erro) {
      falhas.push(nome);
      console.error(`[cron] etapa ${nome} falhou:`, erro instanceof Error ? erro.message : String(erro));
    }
  };

  await etapa("backup", () => executarBackup(s.armazem, agora));
  await etapa("consolidacao", async () => {
    const ontem = somarDias(diaSaoPaulo(agora), -1);
    const totais: Record<string, number> = {};
    // Os 3 últimos dias fechados: cobre um dia em que o Cron não rodou.
    for (const dia of [somarDias(ontem, -2), somarDias(ontem, -1), ontem]) totais[dia] = (await consolidarDia(s.armazem, dia, agora)).total_eventos;
    return totais;
  });
  await etapa("limpeza", () => limparVencidos(s.armazem, agora));
  return Response.json({ ...resultado, falhas }, { status: falhas.length > 0 ? 500 : 200 });
}
```

`src/app/api/cron/diario/route.ts`:

```ts
import { tratarCronDiario } from "@/lib/api/cron";
import { servicos } from "@/lib/servicos";

export const maxDuration = 300;

export const GET = (req: Request) => tratarCronDiario(req, servicos());
```

`apps/site/vercel.json` (03:00 em São Paulo = 06:00 UTC):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/diario", "schedule": "0 6 * * *" }]
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/lib/jobs src/lib/api && npm run typecheck && npm run build`
Expected: PASS; o build lista `ƒ /api/cron/diario`.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/jobs apps/site/src/lib/api/cron.ts apps/site/src/lib/api/cron.test.ts apps/site/src/app/api/cron apps/site/vercel.json apps/site/src/lib/auth/guarda.ts
git commit -m "feat(jobs): cron diário com backup de 30 dias, consolidação dos 3 últimos dias e limpeza de 180 dias"
```

---

### Task 4.5: Aba Relatório e chave da medição no painel

**Files:**
- Create: `apps/site/src/app/admin/(painel)/relatorio/page.tsx`, `apps/site/src/components/admin/MedicaoFlag.tsx`
- Modify: `apps/site/src/app/admin/(painel)/layout.tsx` (link "Relatório"), `apps/site/src/app/admin/(painel)/flags/page.tsx` (seção de medição)
- Test: `apps/site/e2e/painel-relatorio.spec.ts`

**Interfaces:**
- Consumes: `carregarRelatorio`, `Relatorio`, `lerFlags`, `listarImoveis`, `api.salvarFlags`, `formatarData`, `entrarNoPainel`.
- Produces: rota `/admin/relatorio`; `MedicaoFlag({ flags, etag })`.

- [ ] **Step 1: Página do relatório**

`src/app/admin/(painel)/relatorio/page.tsx`:

```tsx
import { emailDaSessao } from "@/lib/auth/sessao-servidor";
import { carregarRelatorio, type Relatorio } from "@/lib/eventos/relatorio";
import { lerFlags } from "@/lib/repositorio/flags";
import { listarImoveis } from "@/lib/repositorio/imoveis";
import { servicos } from "@/lib/servicos";

const ROTULO_NEGOCIO = { venda: "Venda", aluguel: "Aluguel", sem_negocio: "Sem contexto" } as const;
const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const porcentagem = (taxa: number | null) => (taxa === null ? "sem visualização" : `${(taxa * 100).toFixed(1).replace(".", ",")}%`);

function TabelaDaJanela({ relatorio, titulos }: { relatorio: Relatorio; titulos: Map<string, string> }) {
  return (
    <section>
      <h2>
        Últimos {relatorio.janela} dias ({diaCurto(relatorio.de)} a {diaCurto(relatorio.ate)})
      </h2>
      <p>
        {relatorio.totalCliques} cliques de contato, {relatorio.totalVisualizacoes} visualizações de imóvel. {relatorio.cliquesSemImovel} cliques vieram
        de botões sem imóvel (flutuante e contato).
        {relatorio.diasSemResumo.length > 0 && ` ${relatorio.diasSemResumo.length} dia(s) ainda sem consolidação.`}
      </p>
      <table className="painel-tabela">
        <thead>
          <tr>
            <th scope="col">Imóvel</th>
            <th scope="col">Negócio</th>
            <th scope="col">Cliques de contato</th>
            <th scope="col">Visualizações</th>
            <th scope="col">Taxa de clique</th>
          </tr>
        </thead>
        <tbody>
          {relatorio.linhas.map((linha) => (
            <tr key={`${linha.codigo}-${linha.negocio}`}>
              <td>
                {linha.codigo} · {titulos.get(linha.codigo) ?? "imóvel excluído"}
              </td>
              <td>{ROTULO_NEGOCIO[linha.negocio]}</td>
              <td>{linha.cliques}</td>
              <td>{linha.visualizacoes}</td>
              <td>{porcentagem(linha.taxa)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {relatorio.linhas.length === 0 && <p>Nenhum clique nem visualização nesta janela.</p>}
      <h3>Por dia</h3>
      <table className="painel-tabela">
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Cliques de contato</th>
            <th scope="col">Visualizações</th>
          </tr>
        </thead>
        <tbody>
          {relatorio.porDia.map((dia) => (
            <tr key={dia.dia}>
              <td>{diaCurto(dia.dia)}</td>
              <td>{dia.cliques}</td>
              <td>{dia.visualizacoes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Visitantes (piso: só quem aceitou cookies)</h3>
      <p>
        {relatorio.visitantesUnicos} visitantes únicos, {relatorio.visitantesRecorrentes} recorrentes (voltaram em mais de um dia). Quem recusou o
        cookie, trocou de navegador ou limpou os dados não entra aqui.
      </p>
    </section>
  );
}

export default async function PainelRelatorio() {
  if (!(await emailDaSessao())) return null;
  const { armazem, agora } = servicos();
  const { flags } = await lerFlags(armazem);
  if (!flags.eventos_ativos) {
    return (
      <main className="painel-conteudo">
        <h1>Relatório</h1>
        <p className="painel-aviso painel-aviso-erro">Medição desligada até a revisão de privacidade.</p>
      </main>
    );
  }
  const [sete, trinta, imoveis] = await Promise.all([carregarRelatorio(armazem, 7, agora()), carregarRelatorio(armazem, 30, agora()), listarImoveis(armazem)]);
  const titulos = new Map(imoveis.map((imovel) => [imovel.codigo, imovel.titulo]));
  return (
    <main className="painel-conteudo">
      <h1>Relatório</h1>
      <p>Lido dos resumos diários. O dia de hoje entra amanhã, depois da consolidação das 3h.</p>
      <TabelaDaJanela relatorio={sete} titulos={titulos} />
      <TabelaDaJanela relatorio={trinta} titulos={titulos} />
    </main>
  );
}
```

No `src/app/admin/(painel)/layout.tsx`, depois do link "Campos visíveis", acrescente `<Link href="/admin/relatorio">Relatório</Link>`.

- [ ] **Step 2: Chave da medição na página de campos visíveis**

`src/components/admin/MedicaoFlag.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { Flags } from "@/lib/contratos/flags";
import { api } from "@/lib/painel/cliente-api";

/** Ligar só com o "de acordo" do Moisés por escrito (spec 7). A API também exige LIGAR. */
export function MedicaoFlag({ flags, etag: etagInicial }: { flags: Flags; etag: string | null }) {
  const [ligada, setLigada] = useState(flags.eventos_ativos);
  const [etag, setEtag] = useState(etagInicial);
  const [digitado, setDigitado] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  async function mudar(novo: boolean) {
    const resultado = await api.salvarFlags(
      { primeira_dobra: flags.primeira_dobra, detalhes: flags.detalhes, eventos_ativos: novo },
      etag,
      novo ? "LIGAR" : undefined,
    );
    if (resultado.ok) {
      setEtag(resultado.dados.etag);
      setLigada(novo);
      setAviso(novo ? "Medição ligada. O banner de cookies já aparece no site." : "Medição desligada. O site parou de contar.");
    } else {
      setAviso(resultado.status === 409 ? "Outra pessoa alterou os campos. Recarregue a página." : resultado.mensagem);
    }
  }

  return (
    <fieldset>
      <legend>Medição de visitas e cliques</legend>
      <p>Hoje: {ligada ? "ligada" : "desligada"}.</p>
      {ligada ? (
        <button type="button" onClick={() => mudar(false)}>
          Desligar medição
        </button>
      ) : (
        <>
          <p>
            Só ligue depois do &quot;de acordo&quot; do Moisés por escrito (e-mail ou WhatsApp), conforme docs/privacidade-medicao-moises.md.
          </p>
          <label>
            Digite LIGAR para confirmar
            <input value={digitado} onChange={(evento) => setDigitado(evento.target.value)} />
          </label>
          <button type="button" className="painel-primario" disabled={digitado.trim() !== "LIGAR"} onClick={() => mudar(true)}>
            Ligar medição
          </button>
        </>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </fieldset>
  );
}
```

Em `src/app/admin/(painel)/flags/page.tsx`, importe `MedicaoFlag` e acrescente, logo depois de `<EditorFlags ... />`:

```tsx
      <h2>Medição</h2>
      <MedicaoFlag flags={flags} etag={etag} />
```

Observação: as duas seções gravam o mesmo `flags.json` com o ETag da carga da página. Depois de salvar uma, a outra recebe 409 e pede para recarregar. Esse é o comportamento esperado de concorrência (spec 3), não um erro.

- [ ] **Step 3: E2E do relatório**

`apps/site/e2e/painel-relatorio.spec.ts`:

```ts
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { diaSaoPaulo, somarDias } from "../src/lib/eventos/dias";
import { entrarNoPainel } from "./sessao";

test.describe.configure({ mode: "serial" });

const PASTA_RESUMOS = path.join(".dados-e2e", "privado", "resumos");
const ontem = somarDias(diaSaoPaulo(new Date()), -1);
const zero = { cliques: 0, visualizacoes: 0 };

test.beforeEach(async ({ context }) => {
  await entrarNoPainel(context);
});

test("com a medição desligada, o relatório avisa", async ({ page }) => {
  await page.goto("/admin/relatorio");
  await expect(page.getByText("Medição desligada até a revisão de privacidade.")).toBeVisible();
});

test("com a medição ligada, mostra os números dos resumos", async ({ page }) => {
  await mkdir(PASTA_RESUMOS, { recursive: true });
  await writeFile(
    path.join(PASTA_RESUMOS, `${ontem}.json`),
    JSON.stringify({
      dia: ontem,
      gerado_em: new Date().toISOString(),
      total_eventos: 7,
      por_imovel: { MC001: { venda: { cliques: 2, visualizacoes: 5 }, aluguel: zero, sem_negocio: zero } },
      cliques_sem_imovel: 0,
      visitantes: ["11111111-1111-4111-8111-111111111111"],
    }),
  );
  await page.goto("/admin/flags");
  await page.getByLabel("Digite LIGAR para confirmar").fill("LIGAR");
  await page.getByRole("button", { name: "Ligar medição" }).click();
  await expect(page.getByText("Medição ligada.")).toBeVisible();

  await page.goto("/admin/relatorio");
  const primeiraTabela = page.locator("section").first().locator("table").first();
  await expect(primeiraTabela.getByRole("row", { name: /MC001/ })).toContainText("40,0%");
  await expect(page.getByText("1 visitantes únicos").first()).toBeVisible();

  await page.goto("/admin/flags");
  await page.getByRole("button", { name: "Desligar medição" }).click();
  await expect(page.getByText("Medição desligada.")).toBeVisible();
  await rm(PASTA_RESUMOS, { recursive: true, force: true });
});
```

- [ ] **Step 4: Rodar**

Run: `npm run typecheck && npm run lint && npm run test:e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/site/src/app/admin/(painel)/relatorio" "apps/site/src/app/admin/(painel)/layout.tsx" "apps/site/src/app/admin/(painel)/flags/page.tsx" apps/site/src/components/admin/MedicaoFlag.tsx apps/site/e2e/painel-relatorio.spec.ts
git commit -m "feat(painel): aba Relatório de 7 e 30 dias e chave da medição com confirmação LIGAR"
```

---

### Task 4.6: Documento de uma página para o Moisés

**Files:**
- Create: `docs/privacidade-medicao-moises.md`

- [ ] **Step 1: Escrever o documento**

`docs/privacidade-medicao-moises.md`:

```markdown
# Medição do site: o que precisamos do seu "de acordo"

Moisés, o site novo pode contar quantas pessoas clicam no WhatsApp e quantas voltam ao site. Hoje essa contagem está **desligada**. Ela só liga com o seu "de acordo" por escrito (e-mail ou WhatsApp). Você é o responsável pelos dados (o "controlador", na LGPD). Se quiser, mostre este papel ao advogado ou ao contador.

## O que o site conta

1. **Cliques no WhatsApp e páginas de imóvel abertas, sem identificar ninguém.** Cada clique vira uma linha com: qual imóvel, se era venda ou aluguel, de qual botão veio e a hora. Sem nome, e-mail, telefone, endereço IP nem cookie. Serve para saber quais imóveis atraem contato.
2. **Quantas pessoas voltam, só para quem aceitar.** Quem aceitar o aviso de cookies recebe no navegador um número sorteado (ex.: `3f1c2a64-...`), válido por 6 meses. Ele diz "este aparelho já veio antes", nunca "quem é". Quem recusar não recebe número nenhum; o navegador guarda só a palavra "recusado", para não perguntar de novo.

As contagens e os números sorteados são apagados depois de 6 meses.

## As três perguntas

1. A contagem do item 1 (sem ID, sem cookie, sem IP) pode ser feita **sem pedir consentimento**?
2. O cookie do item 2 (número sorteado, 6 meses, gravado só depois do aceite, contagens guardadas por 6 meses) está adequado?
3. Os textos abaixo, do aviso e da página de privacidade, estão corretos? Isso inclui guardar "recusado" no navegador de quem recusou.

**Texto do aviso:** "Usamos um cookie com um número aleatório para saber quantas pessoas voltam ao site. Ele não diz quem você é e vale por 6 meses. Saiba mais." Botões: Recusar, Aceitar.

**Página de privacidade:** `/privacidade` no site (a Gabriela manda o link).

## Para responder

Basta responder "de acordo com as três" por e-mail ou WhatsApp, ou dizer o que mudar. Depois do seu "de acordo", a Gabriela liga a medição no painel (é preciso digitar LIGAR) e guarda a sua mensagem.
```

- [ ] **Step 2: Commit**

```bash
git add docs/privacidade-medicao-moises.md
git commit -m "docs(medicao): documento de uma página para o de acordo do Moisés"
```

---

### Task 4.7: Deploy e verificações em produção

Esta task mexe em produção e em contas externas. **Os Steps 1 a 3 e 6 são ação humana**; o agente prepara, confere e registra. Nunca rode `git push` nem `vercel deploy --prod` por conta própria: o deploy vem do push que o humano faz, pela integração Git do projeto.

**Files:**
- Create: `apps/site/scripts/verificar-publico.ts`
- Modify: `apps/site/package.json` (script `verificar:publico`), `docs/verificacoes/2026-10-frente-0-blob.md` (seção "Produção")

**Interfaces:**
- Consumes: `ArmazemJsonVercel`, `ArmazemFotosVercel`, `listarImoveis`, `lerEndereco`.

- [ ] **Step 1: (humano) Variáveis do projeto na Vercel**

No projeto `mc-vieira-site` (Production e Preview): `ARMAZEM_DRIVER=vercel`, `FOTOS_ORIGEM` (origem do `mcv-publico`), `AUTH_JWT_SECRET` (`openssl rand -base64 48`), `AUTH_JWT_TTL_HORAS=8`, `GOOGLE_CLIENT_ID`, `AUTH_ALLOWLIST` (e-mails da Gabriela e do Moisés), `SKILL_API_SECRET` (da frente 3), `CRON_SECRET` (`openssl rand -base64 32`). Os tokens `BLOB_PRIVADO_READ_WRITE_TOKEN` e `BLOB_PUBLICO_READ_WRITE_TOKEN` já vieram ao conectar os stores (frente 0). Confira que `mcv-teste` **não** está conectado a Production.

- [ ] **Step 2: (humano) OAuth no projeto GCP `mc-vieira-site`**

Em APIs e serviços → Credenciais → o OAuth Client ID (tipo Web): acrescente em "Origens JavaScript autorizadas" a URL de produção `https://mc-vieira-site.vercel.app` e `http://localhost:3000`. Tela de consentimento: externa, em produção, só escopo de e-mail (spec 6).

- [ ] **Step 3: (humano) Push e deploy**

Com as frentes mergeadas em `main` (PRs abertos e aprovados pelo humano), a integração Git publica em produção. Confira no painel da Vercel: build verde, Cron `/api/cron/diario` listado em Settings → Cron Jobs.

- [ ] **Step 4: Script de verificação do store público e do HTML**

`apps/site/scripts/verificar-publico.ts`:

```ts
/**
 * Spec seção 9: nenhum JSON e nenhum endereço acessível publicamente.
 * Uso: npm run verificar:publico -- https://mc-vieira-site.vercel.app   (lê tokens de .env.local)
 */
import { ArmazemFotosVercel, ArmazemJsonVercel } from "../src/lib/armazem/vercel";
import { lerEndereco, listarImoveis } from "../src/lib/repositorio/imoveis";

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} em .env.local`);
  return valor;
}

async function principal() {
  const site = process.argv[2]?.replace(/\/$/, "");
  if (!site) throw new Error("Informe a URL do site: npm run verificar:publico -- https://...");
  const privado = new ArmazemJsonVercel(exigir("BLOB_PRIVADO_READ_WRITE_TOKEN"));
  const publico = new ArmazemFotosVercel(exigir("BLOB_PUBLICO_READ_WRITE_TOKEN"), exigir("FOTOS_ORIGEM"));
  const falhas: string[] = [];

  const arquivosPublicos = await publico.listar("");
  const foraDoPadrao = arquivosPublicos.filter((caminho) => !/^imoveis\/MC\d{3}\/fotos\/[A-Za-z0-9._-]+\.webp$/.test(caminho));
  if (foraDoPadrao.length) falhas.push(`Store público tem arquivos que não são foto: ${foraDoPadrao.slice(0, 10).join(", ")}`);
  console.log(`store público: ${arquivosPublicos.length} arquivos, ${foraDoPadrao.length} fora do padrão`);

  const semLogin = await fetch(`${site}/api/imoveis`);
  if (semLogin.status !== 401) falhas.push(`/api/imoveis sem login respondeu ${semLogin.status} (esperado 401)`);

  const allowlist = (process.env.AUTH_ALLOWLIST ?? "").split(/[\s,;]+/).filter(Boolean);
  for (const imovel of (await listarImoveis(privado)).filter((item) => item.publicacao === "publicado")) {
    const html = await (await fetch(`${site}/imoveis/${imovel.codigo}`)).text();
    const endereco = await lerEndereco(privado, imovel.codigo);
    if (endereco && html.includes(endereco.endereco_completo)) falhas.push(`${imovel.codigo}: endereço aparece no HTML público`);
    for (const email of allowlist) if (html.includes(email)) falhas.push(`${imovel.codigo}: e-mail da equipe no HTML público`);
    if (html.includes('"historico"')) falhas.push(`${imovel.codigo}: histórico no HTML público`);
  }

  if (falhas.length) {
    for (const falha of falhas) console.error(`FALHA: ${falha}`);
    process.exitCode = 1;
  } else {
    console.log("OK: store público só com fotos; endereço, e-mails e histórico fora do HTML; API fechada sem login");
  }
}

principal().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
```

No `package.json`: `"verificar:publico": "node --env-file=.env.local --import tsx scripts/verificar-publico.ts"`.

Run: `cd apps/site && npm run verificar:publico -- https://mc-vieira-site.vercel.app`
Expected: `OK: store público só com fotos; ...`. Qualquer `FALHA` bloqueia a estreia: corrija e rode de novo.

- [ ] **Step 5: Conferências no site em produção**

1. Cron: `curl -s -o /dev/null -w "%{http_code}\n" https://mc-vieira-site.vercel.app/api/cron/diario` → `401` (sem o segredo). No dia seguinte, em Settings → Cron Jobs, a última execução aparece com status 200, e `backup/<dia>/` existe no `mcv-privado`.
2. Medição desligada: abrir o site numa janela anônima → sem banner; DevTools → Application → Cookies → nenhum cookie do domínio.
3. LCP em celular: rodar o PageSpeed Insights (pagespeed.web.dev) na home e numa página de imóvel, perfil Mobile. Meta do spec: LCP abaixo de 2,5 s. Registrar o valor; se passar da meta, abrir item em `tasks/todo.md` com a página e o número.
4. Login: entrar em `/admin` com a conta da Gabriela → lista aparece; com uma conta fora da `AUTH_ALLOWLIST` → "Este e-mail não tem acesso ao painel."

- [ ] **Step 6: (humano) Registrar e fechar**

Acrescente a `docs/verificacoes/2026-10-frente-0-blob.md` uma seção "Produção (data)" com: saída do `verificar:publico`, LCP medido nas duas páginas, data da primeira execução do Cron com status 200.

- [ ] **Step 7: Commit e fechamento da frente 4**

```bash
cd /Users/felipemartucci/PycharmProjects/real-state-platform
git status --short
git add apps/site/scripts/verificar-publico.ts apps/site/package.json docs/verificacoes/2026-10-frente-0-blob.md
git commit -m "chore(site): verificação do store público e do HTML em produção"
git pull --rebase origin main
npm --prefix apps/site test
```

Entregue ao humano, como texto (não execute):

```bash
git push -u origin feat/site-novo-medicao
```
