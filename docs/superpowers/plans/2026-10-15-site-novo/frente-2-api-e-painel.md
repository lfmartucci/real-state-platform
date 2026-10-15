# Frente 2: API e painel `/admin`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o login Google do painel, a API única de gravação (`/api/imoveis` com reserva de código, ETag, histórico, regras de status, destaques e exclusão; `/api/flags`) e o painel `/admin` com lista, edição, publicação, destaques, flags e pré-visualização.

**Architecture:** Leia `README.md` desta pasta antes. As regras de gravação são uma função pura (`aplicarGravacao`). Cada rota é um handler `(req: Request, s: Servicos) => Promise<Response>` em `src/lib/api/`, testado com `Request` de verdade e o armazém de arquivo; o `route.ts` só chama o handler com `servicos()`. O painel é feito de Server Components que leem pelo repositório (sem cache) e de Client Components que gravam só pela API. Autenticação: JWT HMAC-SHA256 em cookie `HttpOnly` (painel) ou `Authorization: Bearer <SKILL_API_SECRET>` (skill e futura API do Moisés, só em `/api/imoveis`).

**Tech Stack:** Next.js 16.4.1, zod 4.6.7, google-auth-library 11.3.0, `node:crypto`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-site-novo-mc-vieira-design.md` (seções 3 Regras, 4.1, 4.2, 4.3, 4.4, 6, 9, 10). Referência do login: `/Users/felipemartucci/PycharmProjects/pep19/api/auth/login.ts`, `/Users/felipemartucci/PycharmProjects/pep19/api/_lib/sessionJwt.ts`, `/Users/felipemartucci/PycharmProjects/pep19/api/_lib/authenticate.ts`, `/Users/felipemartucci/PycharmProjects/pep19/src/auth/gis.ts` (o desenho foi copiado e adaptado abaixo; não há BigQuery aqui).

**Pré-requisito:** frente 0 em `main`. Para a Task 2.10 (e2e), a frente 1 também. **Branch:** `git checkout -b feat/site-novo-api-painel`.

**Comandos (em `apps/site/`):** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`.

**Contrato HTTP desta frente** (a frente 3 e a futura API do Moisés dependem dele):

| Método e rota | Quem | Corpo / cabeçalhos | Resposta |
|---|---|---|---|
| `POST /api/auth/login` | navegador | `{ credential }` (ID token do Google), `Origin` do app | 200 `{ email }` + `Set-Cookie: mcv_sessao=...` |
| `POST /api/auth/logout` | navegador | — | 200 + cookie apagado |
| `GET /api/imoveis` | painel, skill | — | 200 `{ imoveis: Imovel[] }` |
| `POST /api/imoveis/reservas` | painel, skill | — | 201 `{ codigo }` |
| `POST /api/imoveis` | painel, skill | `{ codigo, imovel: ImovelEntrada, endereco_completo? }` | 201 `{ imovel, etag }` + `ETag` |
| `GET /api/imoveis/:codigo` | painel, skill | — | 200 `{ imovel, etag, endereco_completo }` + `ETag` |
| `PUT /api/imoveis/:codigo` | painel, skill | `If-Match: <etag>`, `{ imovel: ImovelEntrada, endereco_completo? }` | 200 `{ imovel, etag }` + `ETag` |
| `DELETE /api/imoveis/:codigo` | só painel | `If-Match`, `{ confirmacao: "<codigo>" }` | 200 `{ excluido }` |
| `GET /api/flags` | só painel | — | 200 `{ flags, etag }` |
| `PUT /api/flags` | só painel | `If-Match` (se já existir), `{ flags: FlagsEntrada, confirmacao_medicao?: "LIGAR" }` | 200 `{ flags, etag }` |

Erros sempre como `{ erro, mensagem, detalhes? }`: 400 `corpo_invalido`, 401 `nao_autenticado`, 403 `origem_invalida` / `skill_nao_permitida` / `nao_autorizado`, 404 `nao_encontrado`, 409 `conflito` / `ja_existe`, 410 `codigo_excluido`, 422 `esquema_invalido` / `foto_fora_do_store` / `sem_reserva` / `so_rascunho` / `confirmacao_invalida` / `fechado_nao_publica` / `destaque_fora_do_ar` / `limite_destaques` / `confirmacao_medicao`, 428 `etag_ausente`.

---

### Task 2.1: Sessão JWT, allowlist e núcleo do login

**Files:**
- Create: `apps/site/src/lib/auth/sessao-jwt.ts`, `apps/site/src/lib/auth/allowlist.ts`, `apps/site/src/lib/auth/google.ts`, `apps/site/src/lib/auth/autenticar-login.ts`
- Test: `apps/site/src/lib/auth/sessao-jwt.test.ts`, `apps/site/src/lib/auth/allowlist.test.ts`, `apps/site/src/lib/auth/autenticar-login.test.ts`

**Interfaces:**
- Consumes: `ISSUER_SESSAO`, `SessaoClaims` (`contratos/sessao.ts`).
- Produces:
  ```ts
  // sessao-jwt.ts
  TAMANHO_MINIMO_SEGREDO = 32
  emitirSessao(email: string, segredo: string, ttlSegundos: number, agoraSeg?: number): { token: string; expiraEm: number }
  verificarSessao(token: string, segredo: string, agoraSeg?: number): SessaoClaims | null
  // allowlist.ts
  normalizarEmail(email): string; lerAllowlist(bruta?: string): Set<string>; estaNaAllowlist(email, bruta?): boolean
  // google.ts
  interface IdentidadeGoogle { email: string; emailVerificado: boolean }
  type VerificadorGoogle = (credential: string) => Promise<IdentidadeGoogle | null>
  criarVerificadorGoogle(clientId: string): VerificadorGoogle
  // autenticar-login.ts
  interface ResultadoLogin { status: number; corpo: { erro?: string; mensagem?: string; email?: string }; token?: string }
  autenticarLogin(corpo: unknown, deps: { verificarGoogle: VerificadorGoogle; allowlist: string; emitir: (email: string) => { token: string } }): Promise<ResultadoLogin>
  ```

- [ ] **Step 1: Testes da sessão**

`src/lib/auth/sessao-jwt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { emitirSessao, verificarSessao } from "./sessao-jwt";

const SEGREDO = "um-segredo-de-teste-com-mais-de-32-caracteres";
const AGORA = 1_760_000_000;

describe("sessão JWT", () => {
  it("emite e verifica com sub em minúsculas, papel admin e validade", () => {
    const { token, expiraEm } = emitirSessao("Gabriela@Exemplo.com", SEGREDO, 8 * 3600, AGORA);
    expect(expiraEm).toBe(AGORA + 8 * 3600);
    expect(verificarSessao(token, SEGREDO, AGORA + 60)).toEqual({
      sub: "gabriela@exemplo.com",
      papel: "admin",
      iss: "mc-vieira-site",
      iat: AGORA,
      exp: AGORA + 8 * 3600,
    });
  });

  it("recusa token expirado", () => {
    const { token } = emitirSessao("a@b.com", SEGREDO, 60, AGORA);
    expect(verificarSessao(token, SEGREDO, AGORA + 61)).toBeNull();
  });

  it("recusa assinatura de outro segredo e token adulterado", () => {
    const { token } = emitirSessao("a@b.com", SEGREDO, 60, AGORA);
    expect(verificarSessao(token, `${SEGREDO}-outro`, AGORA)).toBeNull();
    const [cabecalho, , assinatura] = token.split(".");
    const corpoFalso = Buffer.from(JSON.stringify({ sub: "intruso@x.com", papel: "admin", iss: "mc-vieira-site", iat: AGORA, exp: AGORA + 999 })).toString("base64url");
    expect(verificarSessao(`${cabecalho}.${corpoFalso}.${assinatura}`, SEGREDO, AGORA)).toBeNull();
  });

  it("recusa alg diferente de HS256 e formato quebrado", () => {
    const { token } = emitirSessao("a@b.com", SEGREDO, 60, AGORA);
    const [, corpo, assinatura] = token.split(".");
    const semAlg = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    expect(verificarSessao(`${semAlg}.${corpo}.${assinatura}`, SEGREDO, AGORA)).toBeNull();
    expect(verificarSessao("nao-e-jwt", SEGREDO, AGORA)).toBeNull();
  });

  it("não emite nem verifica com segredo curto", () => {
    expect(() => emitirSessao("a@b.com", "curto", 60, AGORA)).toThrow("32 caracteres");
    const { token } = emitirSessao("a@b.com", SEGREDO, 60, AGORA);
    expect(verificarSessao(token, "", AGORA)).toBeNull();
  });
});
```

- [ ] **Step 2: Testes da allowlist e do login**

`src/lib/auth/allowlist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { estaNaAllowlist, lerAllowlist } from "./allowlist";

describe("allowlist", () => {
  it("aceita vírgula, ponto e vírgula, espaço e quebra de linha, em minúsculas", () => {
    expect(lerAllowlist(" A@x.com, b@x.com;c@x.com\nD@X.com ")).toEqual(new Set(["a@x.com", "b@x.com", "c@x.com", "d@x.com"]));
  });

  it("nega por padrão quando está vazia ou ausente", () => {
    expect(estaNaAllowlist("a@x.com", undefined)).toBe(false);
    expect(estaNaAllowlist("a@x.com", "   ")).toBe(false);
  });

  it("compara em minúsculas", () => {
    expect(estaNaAllowlist("Moises@Exemplo.COM", "moises@exemplo.com")).toBe(true);
    expect(estaNaAllowlist("intruso@x.com", "moises@exemplo.com")).toBe(false);
  });
});
```

`src/lib/auth/autenticar-login.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { autenticarLogin } from "./autenticar-login";
import type { IdentidadeGoogle } from "./google";

const deps = (identidade: IdentidadeGoogle | null) => ({
  verificarGoogle: async () => identidade,
  allowlist: "gabriela@exemplo.com",
  emitir: (email: string) => ({ token: `token-de-${email}` }),
});

describe("autenticarLogin", () => {
  it("corpo sem credential é 400", async () => {
    expect((await autenticarLogin({}, deps(null))).status).toBe(400);
  });

  it("token do Google inválido é 401", async () => {
    expect((await autenticarLogin({ credential: "x" }, deps(null))).corpo.erro).toBe("token_invalido");
  });

  it("e-mail não verificado é 401", async () => {
    const resultado = await autenticarLogin({ credential: "x" }, deps({ email: "gabriela@exemplo.com", emailVerificado: false }));
    expect(resultado).toMatchObject({ status: 401, corpo: { erro: "email_nao_verificado" } });
  });

  it("e-mail fora da lista é 403", async () => {
    const resultado = await autenticarLogin({ credential: "x" }, deps({ email: "intruso@x.com", emailVerificado: true }));
    expect(resultado).toMatchObject({ status: 403, corpo: { erro: "nao_autorizado" } });
  });

  it("e-mail da lista recebe token, com e-mail em minúsculas", async () => {
    const resultado = await autenticarLogin({ credential: "x" }, deps({ email: "Gabriela@Exemplo.com", emailVerificado: true }));
    expect(resultado).toEqual({ status: 200, corpo: { email: "gabriela@exemplo.com" }, token: "token-de-gabriela@exemplo.com" });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- src/lib/auth`
Expected: FAIL com `Failed to resolve import "./sessao-jwt"`, `"./allowlist"` e `"./autenticar-login"`.

- [ ] **Step 4: Implementar `sessao-jwt.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { ISSUER_SESSAO, type SessaoClaims } from "@/lib/contratos/sessao";

export const TAMANHO_MINIMO_SEGREDO = 32;
const CABECALHO = { alg: "HS256", typ: "JWT" } as const;
const agoraEmSegundos = () => Math.floor(Date.now() / 1000);

const base64url = (texto: string) => Buffer.from(texto).toString("base64url");
const assinar = (dados: string, segredo: string) => createHmac("sha256", segredo).update(dados).digest("base64url");

function lerJson(parte: string): unknown {
  try {
    return JSON.parse(Buffer.from(parte, "base64url").toString("utf8"));
  } catch {
    return null; // parte malformada = token inválido; o chamador recebe null
  }
}

export function emitirSessao(email: string, segredo: string, ttlSegundos: number, agoraSeg = agoraEmSegundos()) {
  if (segredo.length < TAMANHO_MINIMO_SEGREDO) throw new Error(`AUTH_JWT_SECRET precisa de ${TAMANHO_MINIMO_SEGREDO} caracteres ou mais`);
  const claims: SessaoClaims = { sub: email.trim().toLowerCase(), papel: "admin", iss: ISSUER_SESSAO, iat: agoraSeg, exp: agoraSeg + ttlSegundos };
  const entrada = `${base64url(JSON.stringify(CABECALHO))}.${base64url(JSON.stringify(claims))}`;
  return { token: `${entrada}.${assinar(entrada, segredo)}`, expiraEm: claims.exp };
}

export function verificarSessao(token: string, segredo: string, agoraSeg = agoraEmSegundos()): SessaoClaims | null {
  if (segredo.length < TAMANHO_MINIMO_SEGREDO) return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [cabecalho, corpo, assinatura] = partes;
  const esperada = Buffer.from(assinar(`${cabecalho}.${corpo}`, segredo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  const cabecalhoLido = lerJson(cabecalho) as { alg?: unknown } | null;
  if (cabecalhoLido?.alg !== "HS256") return null;
  const claims = lerJson(corpo) as Partial<SessaoClaims> | null;
  if (!claims || claims.iss !== ISSUER_SESSAO || claims.papel !== "admin" || typeof claims.sub !== "string") return null;
  if (typeof claims.exp !== "number" || claims.exp <= agoraSeg || typeof claims.iat !== "number") return null;
  return claims as SessaoClaims;
}
```

- [ ] **Step 5: Implementar `allowlist.ts`, `google.ts` e `autenticar-login.ts`**

`src/lib/auth/allowlist.ts`:

```ts
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function lerAllowlist(bruta?: string): Set<string> {
  if (!bruta) return new Set();
  return new Set(bruta.split(/[\s,;]+/).map(normalizarEmail).filter((email) => email.length > 0));
}

/** Nega por padrão: lista vazia não autoriza ninguém (spec seção 6). */
export function estaNaAllowlist(email: string, bruta?: string): boolean {
  const lista = lerAllowlist(bruta);
  return lista.size > 0 && lista.has(normalizarEmail(email));
}
```

`src/lib/auth/google.ts`:

```ts
import { OAuth2Client } from "google-auth-library";

export interface IdentidadeGoogle {
  email: string;
  emailVerificado: boolean;
}

export type VerificadorGoogle = (credential: string) => Promise<IdentidadeGoogle | null>;

/** Único ponto que fala com o Google: valida assinatura, audiência (nosso client id), emissor e validade do ID token. */
export function criarVerificadorGoogle(clientId: string): VerificadorGoogle {
  const cliente = new OAuth2Client(clientId);
  return async (credential) => {
    let payload;
    try {
      payload = (await cliente.verifyIdToken({ idToken: credential, audience: clientId })).getPayload();
    } catch (erro) {
      // Token malformado, expirado ou de outra audiência: o login responde 401.
      console.warn("[login] ID token do Google recusado:", erro instanceof Error ? erro.message : String(erro));
      return null;
    }
    if (!payload?.email) return null;
    return { email: payload.email, emailVerificado: payload.email_verified === true };
  };
}
```

`src/lib/auth/autenticar-login.ts`:

```ts
import { estaNaAllowlist, normalizarEmail } from "./allowlist";
import type { VerificadorGoogle } from "./google";

export interface ResultadoLogin {
  status: number;
  corpo: { erro?: string; mensagem?: string; email?: string };
  token?: string;
}

interface Dependencias {
  verificarGoogle: VerificadorGoogle;
  allowlist: string;
  emitir: (email: string) => { token: string };
}

/** Núcleo puro do login, no desenho do pep19 (api/_lib/authenticate.ts), sem papéis no banco. */
export async function autenticarLogin(corpo: unknown, deps: Dependencias): Promise<ResultadoLogin> {
  const credential =
    typeof corpo === "object" && corpo !== null && typeof (corpo as { credential?: unknown }).credential === "string"
      ? (corpo as { credential: string }).credential
      : null;
  if (!credential) return { status: 400, corpo: { erro: "corpo_invalido", mensagem: "Envie { credential }." } };

  const identidade = await deps.verificarGoogle(credential);
  if (!identidade) return { status: 401, corpo: { erro: "token_invalido", mensagem: "Login do Google inválido ou expirado." } };
  if (!identidade.emailVerificado) {
    return { status: 401, corpo: { erro: "email_nao_verificado", mensagem: "A conta Google precisa ter e-mail verificado." } };
  }
  if (!estaNaAllowlist(identidade.email, deps.allowlist)) {
    return { status: 403, corpo: { erro: "nao_autorizado", mensagem: "Este e-mail não tem acesso ao painel." } };
  }
  const email = normalizarEmail(identidade.email);
  return { status: 200, corpo: { email }, token: deps.emitir(email).token };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- src/lib/auth && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/site/src/lib/auth
git commit -m "feat(auth): sessão JWT HS256, allowlist que nega por padrão e núcleo do login Google"
```

---

### Task 2.2: Guarda das rotas, respostas e rotas de login

**Files:**
- Create: `apps/site/src/lib/auth/guarda.ts`, `apps/site/src/lib/auth/sessao-servidor.ts`, `apps/site/src/lib/api/respostas.ts`, `apps/site/src/lib/api/login.ts`
- Create: `apps/site/src/app/api/auth/login/route.ts`, `apps/site/src/app/api/auth/logout/route.ts`
- Create: `apps/site/src/testes/requisicoes.ts`
- Test: `apps/site/src/lib/auth/guarda.test.ts`, `apps/site/src/lib/api/login.test.ts`

**Interfaces:**
- Consumes: `Config`, `Servicos`, `verificarSessao`, `emitirSessao`, `estaNaAllowlist`, `autenticarLogin`, `criarVerificadorGoogle`, `COOKIE_SESSAO`.
- Produces:
  ```ts
  // guarda.ts
  type Ator = { tipo: "admin"; email: string } | { tipo: "skill"; nome: "skill" | "api" }
  lerCookie(req: Request, nome: string): string | null
  origemConfere(req: Request): boolean
  autenticar(req: Request, config: Config, opcoes: { aceitaSkill: boolean }, agoraSeg?: number): Ator | Response
  nomeDoAtor(ator: Ator): string                     // e-mail, "skill" ou "api"
  cookieDeSessao(token: string, ttlSegundos: number): string
  COOKIE_SESSAO_APAGADO: string
  // respostas.ts
  respostaErro(status: number, erro: string, mensagem: string, extra?: Record<string, unknown>): Response
  lerCorpoJson(req: Request, limiteBytes?: number): Promise<{ ok: true; corpo: unknown } | { ok: false; resposta: Response }>
  detalhesZod(erro: z.ZodError): { caminho: string; mensagem: string }[]
  // login.ts
  tratarLogin(req: Request, s: Servicos, verificarGoogle?: VerificadorGoogle): Promise<Response>
  tratarLogout(): Response
  // sessao-servidor.ts (Server Components)
  emailDaSessao(): Promise<string | null>
  // src/testes/requisicoes.ts
  ORIGEM_APP = "http://localhost:3000"
  type ComoAutenticar = "skill" | "api" | "admin" | "nenhum" | { email: string }
  requisicao(metodo: string, caminho: string, opcoes?: { corpo?: unknown; autenticacao?: ComoAutenticar; cabecalhos?: Record<string, string> }): Request
  ```

- [ ] **Step 1: Ajudante de requisições para os testes**

`src/testes/requisicoes.ts`:

```ts
import { emitirSessao } from "@/lib/auth/sessao-jwt";
import { COOKIE_SESSAO } from "@/lib/contratos/sessao";
import { CONFIG_TESTE } from "./servicos-de-teste";

export const ORIGEM_APP = "http://localhost:3000";

export type ComoAutenticar = "skill" | "api" | "admin" | "nenhum" | { email: string };

/** Monta um Request como o Next entrega ao handler. Padrão: autenticado como a skill. */
export function requisicao(
  metodo: string,
  caminho: string,
  opcoes: { corpo?: unknown; autenticacao?: ComoAutenticar; cabecalhos?: Record<string, string> } = {},
): Request {
  const cabecalhos = new Headers(opcoes.cabecalhos);
  const autenticacao = opcoes.autenticacao ?? "skill";
  if (autenticacao === "skill" || autenticacao === "api") {
    cabecalhos.set("authorization", `Bearer ${CONFIG_TESTE.skillApiSecret}`);
    if (autenticacao === "api") cabecalhos.set("x-mcv-ator", "api");
  } else if (autenticacao !== "nenhum") {
    const email = autenticacao === "admin" ? "gabriela@exemplo.com" : autenticacao.email;
    const { token } = emitirSessao(email, CONFIG_TESTE.authJwtSecret, 3600);
    cabecalhos.set("cookie", `${COOKIE_SESSAO}=${token}`);
    if (!cabecalhos.has("origin")) cabecalhos.set("origin", ORIGEM_APP);
  }
  if (opcoes.corpo !== undefined) cabecalhos.set("content-type", "application/json");
  return new Request(`${ORIGEM_APP}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
}
```

- [ ] **Step 2: Testes da guarda**

`src/lib/auth/guarda.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CONFIG_TESTE } from "@/testes/servicos-de-teste";
import { ORIGEM_APP, requisicao } from "@/testes/requisicoes";
import { autenticar, cookieDeSessao, lerCookie } from "./guarda";

const status = (resultado: unknown) => (resultado instanceof Response ? resultado.status : 200);

describe("autenticar", () => {
  it("sem cookie nem segredo é 401", () => {
    expect(status(autenticar(requisicao("GET", "/api/imoveis", { autenticacao: "nenhum" }), CONFIG_TESTE, { aceitaSkill: true }))).toBe(401);
  });

  it("segredo da skill certo vira ator skill; com x-mcv-ator=api vira api", () => {
    expect(autenticar(requisicao("POST", "/api/imoveis"), CONFIG_TESTE, { aceitaSkill: true })).toEqual({ tipo: "skill", nome: "skill" });
    expect(autenticar(requisicao("POST", "/api/imoveis", { autenticacao: "api" }), CONFIG_TESTE, { aceitaSkill: true })).toEqual({ tipo: "skill", nome: "api" });
  });

  it("segredo errado é 401; segredo vazio no servidor nega tudo", () => {
    const errado = requisicao("POST", "/api/imoveis", { autenticacao: "nenhum", cabecalhos: { authorization: "Bearer outro" } });
    expect(status(autenticar(errado, CONFIG_TESTE, { aceitaSkill: true }))).toBe(401);
    expect(status(autenticar(requisicao("POST", "/api/imoveis"), { ...CONFIG_TESTE, skillApiSecret: "" }, { aceitaSkill: true }))).toBe(401);
  });

  it("skill em rota só do painel é 403", () => {
    expect(status(autenticar(requisicao("PUT", "/api/flags"), CONFIG_TESTE, { aceitaSkill: false }))).toBe(403);
  });

  it("admin válido vira ator admin", () => {
    expect(autenticar(requisicao("GET", "/api/flags", { autenticacao: "admin" }), CONFIG_TESTE, { aceitaSkill: false })).toEqual({
      tipo: "admin",
      email: "gabriela@exemplo.com",
    });
  });

  it("e-mail que saiu da allowlist perde acesso mesmo com JWT válido", () => {
    const pedido = requisicao("GET", "/api/flags", { autenticacao: { email: "ex-editor@exemplo.com" } });
    expect(status(autenticar(pedido, CONFIG_TESTE, { aceitaSkill: false }))).toBe(401);
  });

  it("escrita do painel sem Origin, ou com Origin de outro site, é 403", () => {
    const outroSite = requisicao("PUT", "/api/flags", { autenticacao: "admin", cabecalhos: { origin: "https://malicioso.example" } });
    expect(status(autenticar(outroSite, CONFIG_TESTE, { aceitaSkill: false }))).toBe(403);
    const semOrigem = new Request(`${ORIGEM_APP}/api/flags`, {
      method: "PUT",
      headers: { cookie: requisicao("GET", "/", { autenticacao: "admin" }).headers.get("cookie")! },
    });
    expect(status(autenticar(semOrigem, CONFIG_TESTE, { aceitaSkill: false }))).toBe(403);
  });

  it("leitura do painel não exige Origin", () => {
    const leitura = new Request(`${ORIGEM_APP}/api/flags`, { headers: { cookie: requisicao("GET", "/", { autenticacao: "admin" }).headers.get("cookie")! } });
    expect(status(autenticar(leitura, CONFIG_TESTE, { aceitaSkill: false }))).toBe(200);
  });
});

describe("cookies", () => {
  it("lê um cookie entre vários", () => {
    const pedido = new Request(ORIGEM_APP, { headers: { cookie: "a=1; mcv_sessao=abc.def.ghi; b=2" } });
    expect(lerCookie(pedido, "mcv_sessao")).toBe("abc.def.ghi");
    expect(lerCookie(pedido, "nao")).toBeNull();
  });

  it("cookie de sessão é HttpOnly, Secure, SameSite=Lax", () => {
    expect(cookieDeSessao("tok", 28_800)).toBe("mcv_sessao=tok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800");
  });
});
```

- [ ] **Step 3: Testes da rota de login**

`src/lib/api/login.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { IdentidadeGoogle } from "@/lib/auth/google";
import { verificarSessao } from "@/lib/auth/sessao-jwt";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { ORIGEM_APP } from "@/testes/requisicoes";
import { tratarLogin, tratarLogout } from "./login";

const google = (identidade: IdentidadeGoogle | null) => async () => identidade;
const pedidoDeLogin = (cabecalhos: Record<string, string> = { origin: ORIGEM_APP }) =>
  new Request(`${ORIGEM_APP}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabecalhos },
    body: JSON.stringify({ credential: "id-token" }),
  });

describe("POST /api/auth/login", () => {
  it("token inválido é 401 e não cria cookie", async () => {
    const resposta = await tratarLogin(pedidoDeLogin(), await criarServicosDeTeste(), google(null));
    expect(resposta.status).toBe(401);
    expect(resposta.headers.get("set-cookie")).toBeNull();
  });

  it("e-mail fora da lista é 403", async () => {
    const resposta = await tratarLogin(pedidoDeLogin(), await criarServicosDeTeste(), google({ email: "x@y.com", emailVerificado: true }));
    expect(resposta.status).toBe(403);
  });

  it("login válido grava cookie de sessão de 8 horas", async () => {
    const s = await criarServicosDeTeste();
    const resposta = await tratarLogin(pedidoDeLogin(), s, google({ email: "moises@exemplo.com", emailVerificado: true }));
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ email: "moises@exemplo.com" });
    const cookie = resposta.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^mcv_sessao=[^;]+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800$/);
    const token = cookie.split(";")[0].split("=")[1];
    expect(verificarSessao(token, s.config.authJwtSecret)?.sub).toBe("moises@exemplo.com");
  });

  it("login vindo de outro site é 403", async () => {
    const resposta = await tratarLogin(pedidoDeLogin({ origin: "https://outro.example" }), await criarServicosDeTeste(), google({ email: "moises@exemplo.com", emailVerificado: true }));
    expect(resposta.status).toBe(403);
  });

  it("sem GOOGLE_CLIENT_ID ou segredo curto é 500 config_ausente", async () => {
    const s = await criarServicosDeTeste();
    const resposta = await tratarLogin(pedidoDeLogin(), { ...s, config: { ...s.config, googleClientId: "" } }, google(null));
    expect(resposta.status).toBe(500);
    expect((await resposta.json()).erro).toBe("config_ausente");
  });

  it("Google fora do ar é 502", async () => {
    const resposta = await tratarLogin(pedidoDeLogin(), await criarServicosDeTeste(), async () => {
      throw new Error("rede");
    });
    expect(resposta.status).toBe(502);
  });
});

describe("POST /api/auth/logout", () => {
  it("apaga o cookie", () => {
    expect(tratarLogout().headers.get("set-cookie")).toBe("mcv_sessao=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test -- src/lib/auth/guarda.test.ts src/lib/api/login.test.ts`
Expected: FAIL com `Failed to resolve import "./guarda"` e `"./login"`.

- [ ] **Step 5: Implementar `respostas.ts` e `guarda.ts`**

`src/lib/api/respostas.ts`:

```ts
import type { z } from "zod";

export function respostaErro(status: number, erro: string, mensagem: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ erro, mensagem, ...extra }, { status });
}

const LIMITE_PADRAO = 200_000;

export async function lerCorpoJson(
  req: Request,
  limiteBytes = LIMITE_PADRAO,
): Promise<{ ok: true; corpo: unknown } | { ok: false; resposta: Response }> {
  const texto = await req.text();
  if (Buffer.byteLength(texto) > limiteBytes) {
    return { ok: false, resposta: respostaErro(413, "corpo_grande_demais", `O corpo passa de ${limiteBytes} bytes.`) };
  }
  try {
    return { ok: true, corpo: JSON.parse(texto) };
  } catch {
    return { ok: false, resposta: respostaErro(400, "corpo_invalido", "O corpo precisa ser JSON válido.") };
  }
}

export function detalhesZod(erro: z.ZodError): { caminho: string; mensagem: string }[] {
  return erro.issues.map((issue) => ({ caminho: issue.path.join("."), mensagem: issue.message }));
}
```

`src/lib/auth/guarda.ts`:

```ts
import { createHash, timingSafeEqual } from "node:crypto";
import { respostaErro } from "@/lib/api/respostas";
import type { Config } from "@/lib/config";
import { COOKIE_SESSAO } from "@/lib/contratos/sessao";
import { estaNaAllowlist } from "./allowlist";
import { verificarSessao } from "./sessao-jwt";

export type Ator = { tipo: "admin"; email: string } | { tipo: "skill"; nome: "skill" | "api" };

const METODOS_DE_ESCRITA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function lerCookie(req: Request, nome: string): string | null {
  const cabecalho = req.headers.get("cookie");
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(";")) {
    const [chave, ...valor] = parte.trim().split("=");
    if (chave === nome) return valor.join("=");
  }
  return null;
}

/** Spec 4.3: escrita do painel confere Origin contra a própria origem do app. */
export function origemConfere(req: Request): boolean {
  const origem = req.headers.get("origin");
  return origem !== null && origem === new URL(req.url).origin;
}

function segredosIguais(recebido: string, esperado: string): boolean {
  if (!esperado) return false;
  const digerir = (texto: string) => createHash("sha256").update(texto).digest();
  return timingSafeEqual(digerir(recebido), digerir(esperado));
}

export function autenticar(req: Request, config: Config, opcoes: { aceitaSkill: boolean }, agoraSeg?: number): Ator | Response {
  const autorizacao = req.headers.get("authorization");
  if (autorizacao?.startsWith("Bearer ")) {
    if (!opcoes.aceitaSkill) return respostaErro(403, "skill_nao_permitida", "Esta rota é só do painel.");
    if (!segredosIguais(autorizacao.slice("Bearer ".length), config.skillApiSecret)) {
      return respostaErro(401, "nao_autenticado", "Segredo da API inválido.");
    }
    return { tipo: "skill", nome: req.headers.get("x-mcv-ator") === "api" ? "api" : "skill" };
  }
  const token = lerCookie(req, COOKIE_SESSAO);
  const claims = token ? verificarSessao(token, config.authJwtSecret, agoraSeg) : null;
  if (!claims || !estaNaAllowlist(claims.sub, config.authAllowlist)) {
    return respostaErro(401, "nao_autenticado", "Sessão ausente ou expirada. Entre de novo no painel.");
  }
  if (METODOS_DE_ESCRITA.has(req.method) && !origemConfere(req)) {
    return respostaErro(403, "origem_invalida", "Pedido vindo de fora do painel.");
  }
  return { tipo: "admin", email: claims.sub };
}

export function nomeDoAtor(ator: Ator): string {
  return ator.tipo === "admin" ? ator.email : ator.nome;
}

export function cookieDeSessao(token: string, ttlSegundos: number): string {
  return `${COOKIE_SESSAO}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttlSegundos}`;
}

export const COOKIE_SESSAO_APAGADO = `${COOKIE_SESSAO}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
```

- [ ] **Step 6: Implementar `login.ts`, as rotas e a sessão no servidor**

`src/lib/api/login.ts`:

```ts
import { autenticarLogin } from "@/lib/auth/autenticar-login";
import { criarVerificadorGoogle, type VerificadorGoogle } from "@/lib/auth/google";
import { COOKIE_SESSAO_APAGADO, cookieDeSessao, origemConfere } from "@/lib/auth/guarda";
import { emitirSessao, TAMANHO_MINIMO_SEGREDO } from "@/lib/auth/sessao-jwt";
import type { Servicos } from "@/lib/servicos";
import { lerCorpoJson, respostaErro } from "./respostas";

export async function tratarLogin(req: Request, s: Servicos, verificarGoogle?: VerificadorGoogle): Promise<Response> {
  const { googleClientId, authJwtSecret, authJwtTtlHoras, authAllowlist } = s.config;
  if (!googleClientId || authJwtSecret.length < TAMANHO_MINIMO_SEGREDO) {
    return respostaErro(500, "config_ausente", "GOOGLE_CLIENT_ID ou AUTH_JWT_SECRET não configurados.");
  }
  if (!origemConfere(req)) return respostaErro(403, "origem_invalida", "Pedido vindo de fora do painel.");
  const leitura = await lerCorpoJson(req, 10_000);
  if (!leitura.ok) return leitura.resposta;
  const ttlSegundos = Math.round(authJwtTtlHoras * 3600);
  let resultado;
  try {
    resultado = await autenticarLogin(leitura.corpo, {
      verificarGoogle: verificarGoogle ?? criarVerificadorGoogle(googleClientId),
      allowlist: authAllowlist,
      emitir: (email) => emitirSessao(email, authJwtSecret, ttlSegundos),
    });
  } catch (erro) {
    console.error("[login] falha ao validar com o Google:", erro instanceof Error ? erro.message : String(erro));
    return respostaErro(502, "falha_upstream", "Não foi possível validar o login agora.");
  }
  const resposta = Response.json(resultado.corpo, { status: resultado.status });
  if (resultado.token) resposta.headers.set("set-cookie", cookieDeSessao(resultado.token, ttlSegundos));
  return resposta;
}

export function tratarLogout(): Response {
  const resposta = Response.json({ saiu: true });
  resposta.headers.set("set-cookie", COOKIE_SESSAO_APAGADO);
  return resposta;
}
```

`src/app/api/auth/login/route.ts`:

```ts
import { tratarLogin } from "@/lib/api/login";
import { servicos } from "@/lib/servicos";

export const POST = (req: Request) => tratarLogin(req, servicos());
```

`src/app/api/auth/logout/route.ts`:

```ts
import { tratarLogout } from "@/lib/api/login";

export const POST = () => tratarLogout();
```

`src/lib/auth/sessao-servidor.ts`:

```ts
import { cookies } from "next/headers";
import { COOKIE_SESSAO } from "@/lib/contratos/sessao";
import { servicos } from "@/lib/servicos";
import { estaNaAllowlist } from "./allowlist";
import { verificarSessao } from "./sessao-jwt";

/** Para Server Components do painel: o e-mail da sessão válida, ou null. */
export async function emailDaSessao(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const { authJwtSecret, authAllowlist } = servicos().config;
  const claims = verificarSessao(token, authJwtSecret);
  return claims && estaNaAllowlist(claims.sub, authAllowlist) ? claims.sub : null;
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test -- src/lib/auth src/lib/api && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/site/src/lib/auth/guarda.ts apps/site/src/lib/auth/guarda.test.ts apps/site/src/lib/auth/sessao-servidor.ts apps/site/src/lib/api apps/site/src/app/api/auth apps/site/src/testes/requisicoes.ts
git commit -m "feat(api): guarda por JWT ou segredo da skill, conferência de Origin e rotas de login"
```

---

### Task 2.3: Regras de gravação e histórico

**Files:**
- Create: `apps/site/src/lib/dominio/historico.ts`, `apps/site/src/lib/dominio/regras.ts`
- Test: `apps/site/src/lib/dominio/historico.test.ts`, `apps/site/src/lib/dominio/regras.test.ts`

**Interfaces:**
- Consumes: `Imovel`, `ImovelEntrada`, `HistoricoItem`, `CAMPOS_DE_ENTRADA`, `STATUS_FECHADOS`.
- Produces:
  ```ts
  // historico.ts
  LIMITE_HISTORICO = 20
  diferencas(antes: ImovelEntrada, depois: ImovelEntrada, por: string, em: string): HistoricoItem[]
  acrescentar(historico: HistoricoItem[], novos: HistoricoItem[]): HistoricoItem[]
  // regras.ts
  LIMITE_DESTAQUES = 5
  type ErroDeRegra = "fechado_nao_publica" | "destaque_fora_do_ar" | "limite_destaques"
  type ResultadoGravacao = { ok: true; imovel: Imovel } | { ok: false; erro: ErroDeRegra; mensagem: string }
  interface ContextoGravacao { codigo: string; atual: Imovel | null; entrada: ImovelEntrada; por: string; agora: Date; destaquesDeOutros: number }
  aplicarGravacao(ctx: ContextoGravacao): ResultadoGravacao
  ```

- [ ] **Step 1: Testes do histórico**

`src/lib/dominio/historico.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { entradaDeExemplo, fotosDeExemplo } from "@/testes/fixtures";
import { acrescentar, diferencas } from "./historico";

const EM = "2026-10-15T12:00:00.000Z";

describe("histórico", () => {
  it("registra só os campos que mudaram, com de e para", () => {
    const antes = entradaDeExemplo();
    const depois = { ...antes, titulo: "Casa em condomínio com piscina aquecida", status: "reservado" as const };
    expect(diferencas(antes, depois, "gabriela@exemplo.com", EM)).toEqual([
      { em: EM, por: "gabriela@exemplo.com", campo: "status", de: "disponivel", para: "reservado" },
      { em: EM, por: "gabriela@exemplo.com", campo: "titulo", de: antes.titulo, para: "Casa em condomínio com piscina aquecida" },
    ]);
  });

  it("resume fotos pela quantidade e campos ausentes como null", () => {
    const antes = entradaDeExemplo();
    const depois = { ...antes, fotos: fotosDeExemplo("MC001", 5), vagas: undefined };
    const itens = diferencas(antes, depois, "skill", EM);
    expect(itens).toContainEqual({ em: EM, por: "skill", campo: "fotos", de: "3 fotos", para: "5 fotos" });
    expect(itens).toContainEqual({ em: EM, por: "skill", campo: "vagas", de: "3", para: null });
  });

  it("corta textos longos em 200 caracteres", () => {
    const antes = entradaDeExemplo();
    const [item] = diferencas(antes, { ...antes, descricao: "a".repeat(500) }, "skill", EM);
    expect(item.para).toHaveLength(200);
  });

  it("mantém só as últimas 20 alterações", () => {
    const item = (n: number) => ({ em: EM, por: "skill", campo: `c${n}`, de: null, para: null });
    const resultado = acrescentar(Array.from({ length: 19 }, (_, n) => item(n)), [item(19), item(20), item(21)]);
    expect(resultado).toHaveLength(20);
    expect(resultado[0].campo).toBe("c2");
    expect(resultado.at(-1)?.campo).toBe("c21");
  });
});
```

- [ ] **Step 2: Testes das regras**

`src/lib/dominio/regras.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Imovel } from "@/lib/contratos/imovel";
import { ImovelSchema } from "@/lib/contratos/imovel";
import { entradaDeExemplo, imovelDeExemplo } from "@/testes/fixtures";
import { aplicarGravacao, type ContextoGravacao } from "./regras";

const AGORA = new Date("2026-10-15T12:00:00.000Z");
const ctx = (sobrescrever: Partial<ContextoGravacao>): ContextoGravacao => ({
  codigo: "MC001",
  atual: null,
  entrada: entradaDeExemplo(),
  por: "gabriela@exemplo.com",
  agora: AGORA,
  destaquesDeOutros: 0,
  ...sobrescrever,
});
const gravado = (resultado: ReturnType<typeof aplicarGravacao>): Imovel => {
  if (!resultado.ok) throw new Error(`esperava ok, veio ${resultado.erro}`);
  expect(ImovelSchema.safeParse(resultado.imovel).success).toBe(true);
  return resultado.imovel;
};

describe("criação", () => {
  it("preenche código, datas, autor e histórico de criação", () => {
    const imovel = gravado(aplicarGravacao(ctx({})));
    expect(imovel).toMatchObject({
      codigo: "MC001",
      criado_em: AGORA.toISOString(),
      atualizado_em: AGORA.toISOString(),
      status_desde: AGORA.toISOString(),
      publicado_em: AGORA.toISOString(),
      atualizado_por: "gabriela@exemplo.com",
    });
    expect(imovel.historico).toEqual([{ em: AGORA.toISOString(), por: "gabriela@exemplo.com", campo: "criacao", de: null, para: "publicado" }]);
  });

  it("rascunho do lote nasce sem publicado_em", () => {
    const imovel = gravado(aplicarGravacao(ctx({ entrada: entradaDeExemplo({ publicacao: "rascunho" }), por: "skill" })));
    expect(imovel.publicado_em).toBeUndefined();
  });
});

describe("status e publicação", () => {
  const atual = imovelDeExemplo({ status_desde: "2026-10-01T12:00:00.000Z", publicado_em: "2026-10-01T12:00:00.000Z" });

  it("marcar vendido devolve a rascunho na mesma gravação e grava status_desde", () => {
    const imovel = gravado(aplicarGravacao(ctx({ atual, entrada: entradaDeExemplo({ status: "vendido" }) })));
    expect(imovel.publicacao).toBe("rascunho");
    expect(imovel.status_desde).toBe(AGORA.toISOString());
    // diferencas() ordena os campos em ordem alfabética
    expect(imovel.historico.map((item) => item.campo)).toEqual(["publicacao", "status"]);
  });

  it("publicar um imóvel que já estava vendido é recusado", () => {
    const vendido = imovelDeExemplo({ status: "vendido", publicacao: "rascunho" });
    const resultado = aplicarGravacao(ctx({ atual: vendido, entrada: entradaDeExemplo({ status: "vendido", publicacao: "publicado" }) }));
    expect(resultado).toMatchObject({ ok: false, erro: "fechado_nao_publica" });
  });

  it("status igual mantém status_desde", () => {
    const imovel = gravado(aplicarGravacao(ctx({ atual, entrada: entradaDeExemplo({ titulo: "Outro título bem descritivo" }) })));
    expect(imovel.status_desde).toBe("2026-10-01T12:00:00.000Z");
  });

  it("aluguel que acaba volta a disponível com as ofertas que tinha", () => {
    const ofertas = [{ negocio: "aluguel" as const, preco: 3_000 }];
    const alugado = imovelDeExemplo({ status: "alugado", publicacao: "rascunho", ofertas });
    const imovel = gravado(aplicarGravacao(ctx({ atual: alugado, entrada: entradaDeExemplo({ status: "disponivel", publicacao: "rascunho", ofertas }) })));
    expect(imovel.status).toBe("disponivel");
    expect(imovel.ofertas).toEqual(ofertas);
  });

  it("republicar mantém a data da primeira publicação", () => {
    const retirado = imovelDeExemplo({ publicacao: "rascunho", publicado_em: "2026-09-01T12:00:00.000Z" });
    const imovel = gravado(aplicarGravacao(ctx({ atual: retirado, entrada: entradaDeExemplo({ publicacao: "publicado" }) })));
    expect(imovel.publicado_em).toBe("2026-09-01T12:00:00.000Z");
  });
});

describe("destaques", () => {
  it("o sexto destaque é recusado", () => {
    const atual = imovelDeExemplo({ destaque: false });
    const resultado = aplicarGravacao(ctx({ atual, entrada: entradaDeExemplo({ destaque: true }), destaquesDeOutros: 5 }));
    expect(resultado).toMatchObject({ ok: false, erro: "limite_destaques" });
  });

  it("o quinto destaque entra", () => {
    const atual = imovelDeExemplo({ destaque: false });
    expect(gravado(aplicarGravacao(ctx({ atual, entrada: entradaDeExemplo({ destaque: true }), destaquesDeOutros: 4 }))).destaque).toBe(true);
  });

  it("voltar a rascunho limpa o destaque e libera a vaga (Review Focus 4)", () => {
    const emDestaque = imovelDeExemplo({ destaque: true });
    const retirado = gravado(aplicarGravacao(ctx({ atual: emDestaque, entrada: entradaDeExemplo({ destaque: true, publicacao: "rascunho" }), destaquesDeOutros: 4 })));
    expect(retirado.destaque).toBe(false);
    // Com a vaga livre, outro imóvel publicado pode ser destacado (agora são 4 outros com destaque).
    const outro = imovelDeExemplo({ codigo: "MC002", destaque: false });
    const destacado = aplicarGravacao(ctx({ codigo: "MC002", atual: outro, entrada: entradaDeExemplo({ destaque: true }), destaquesDeOutros: 4 }));
    expect(destacado.ok).toBe(true);
  });

  it("destacar um rascunho é recusado", () => {
    const rascunho = imovelDeExemplo({ publicacao: "rascunho", destaque: false });
    const resultado = aplicarGravacao(ctx({ atual: rascunho, entrada: entradaDeExemplo({ publicacao: "rascunho", destaque: true }) }));
    expect(resultado).toMatchObject({ ok: false, erro: "destaque_fora_do_ar" });
  });

  it("marcar vendido um destaque limpa o destaque", () => {
    const emDestaque = imovelDeExemplo({ destaque: true });
    const imovel = gravado(aplicarGravacao(ctx({ atual: emDestaque, entrada: entradaDeExemplo({ destaque: true, status: "vendido" }) })));
    expect(imovel).toMatchObject({ destaque: false, publicacao: "rascunho" });
  });
});

describe("histórico na gravação", () => {
  it("acumula e corta em 20", () => {
    const item = { em: "2026-10-01T12:00:00.000Z", por: "skill", campo: "titulo", de: "a", para: "b" };
    const atual = imovelDeExemplo({ historico: Array.from({ length: 20 }, () => item) });
    const imovel = gravado(aplicarGravacao(ctx({ atual, entrada: entradaDeExemplo({ status: "reservado" }) })));
    expect(imovel.historico).toHaveLength(20);
    expect(imovel.historico.at(-1)).toMatchObject({ campo: "status", para: "reservado" });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- src/lib/dominio`
Expected: FAIL com `Failed to resolve import "./historico"` e `"./regras"`.

- [ ] **Step 4: Implementar `historico.ts`**

```ts
import { CAMPOS_DE_ENTRADA, type HistoricoItem, type ImovelEntrada } from "@/lib/contratos/imovel";

export const LIMITE_HISTORICO = 20;
const LIMITE_TEXTO = 200;

function resumir(campo: string, valor: unknown): string | null {
  if (valor === undefined) return null;
  if (campo === "fotos" && Array.isArray(valor)) return `${valor.length} fotos`;
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
  return texto.length > LIMITE_TEXTO ? texto.slice(0, LIMITE_TEXTO) : texto;
}

/** Só campos do imóvel entram: o endereço vive em outro arquivo e nunca chega aqui (spec 4.1). Ordem alfabética do campo. */
export function diferencas(antes: ImovelEntrada, depois: ImovelEntrada, por: string, em: string): HistoricoItem[] {
  return [...CAMPOS_DE_ENTRADA]
    .sort()
    .filter((campo) => JSON.stringify(antes[campo]) !== JSON.stringify(depois[campo]))
    .map((campo) => ({ em, por, campo, de: resumir(campo, antes[campo]), para: resumir(campo, depois[campo]) }));
}

export function acrescentar(historico: HistoricoItem[], novos: HistoricoItem[]): HistoricoItem[] {
  return [...historico, ...novos].slice(-LIMITE_HISTORICO);
}
```

- [ ] **Step 5: Implementar `regras.ts`**

```ts
import { STATUS_FECHADOS } from "@/lib/contratos/comum";
import type { HistoricoItem, Imovel, ImovelEntrada } from "@/lib/contratos/imovel";
import { acrescentar, diferencas } from "./historico";

export const LIMITE_DESTAQUES = 5;

export type ErroDeRegra = "fechado_nao_publica" | "destaque_fora_do_ar" | "limite_destaques";
export type ResultadoGravacao = { ok: true; imovel: Imovel } | { ok: false; erro: ErroDeRegra; mensagem: string };

export interface ContextoGravacao {
  codigo: string;
  atual: Imovel | null;
  entrada: ImovelEntrada;
  /** e-mail do editor, "skill" ou "api" */
  por: string;
  agora: Date;
  /** quantos OUTROS imóveis já têm destaque */
  destaquesDeOutros: number;
}

/** Único lugar das regras de gravação (ADR 0001). O esquema já garantiu ofertas x status. */
export function aplicarGravacao(ctx: ContextoGravacao): ResultadoGravacao {
  const { atual, entrada } = ctx;
  const em = ctx.agora.toISOString();
  const statusMudou = !atual || atual.status !== entrada.status;

  let publicacao = entrada.publicacao;
  if (STATUS_FECHADOS.has(entrada.status)) {
    if (statusMudou) publicacao = "rascunho";
    else if (publicacao === "publicado") {
      return { ok: false, erro: "fechado_nao_publica", mensagem: "Imóvel vendido ou alugado não pode ir ao ar. Troque o status antes." };
    }
  }

  let destaque = entrada.destaque;
  if (publicacao === "rascunho" && destaque) {
    if (!atual?.destaque) return { ok: false, erro: "destaque_fora_do_ar", mensagem: "Só imóvel publicado pode ser destaque." };
    destaque = false; // saiu do ar: libera a vaga (ajuste E)
  }
  if (destaque && !atual?.destaque && ctx.destaquesDeOutros >= LIMITE_DESTAQUES) {
    return { ok: false, erro: "limite_destaques", mensagem: `Já há ${LIMITE_DESTAQUES} destaques. Desmarque um antes.` };
  }

  const conteudo: ImovelEntrada = { ...entrada, publicacao, destaque };
  const publicadoEm = atual?.publicado_em ?? (publicacao === "publicado" ? em : undefined);
  const novos: HistoricoItem[] = atual
    ? diferencas(atual, conteudo, ctx.por, em)
    : [{ em, por: ctx.por, campo: "criacao", de: null, para: publicacao }];

  const imovel: Imovel = {
    codigo: ctx.codigo,
    ...conteudo,
    status_desde: statusMudou || !atual ? em : atual.status_desde,
    ...(publicadoEm ? { publicado_em: publicadoEm } : {}),
    criado_em: atual?.criado_em ?? em,
    atualizado_em: em,
    atualizado_por: ctx.por,
    historico: acrescentar(atual?.historico ?? [], novos),
  };
  return { ok: true, imovel };
}
```

Observação: `diferencas(atual, conteudo, ...)` recebe o `Imovel` atual no lugar de `ImovelEntrada`; o TypeScript aceita porque `Imovel` tem todos os campos de entrada, e `diferencas` só olha `CAMPOS_DE_ENTRADA`.

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- src/lib/dominio && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/site/src/lib/dominio/historico.ts apps/site/src/lib/dominio/historico.test.ts apps/site/src/lib/dominio/regras.ts apps/site/src/lib/dominio/regras.test.ts
git commit -m "feat(dominio): regras de status, publicação, destaques e histórico das últimas 20 alterações"
```

---

### Task 2.4: `/api/imoveis` (listar, reservar, criar, ler, atualizar)

**Files:**
- Create: `apps/site/src/lib/api/imoveis.ts`, `apps/site/src/testes/cadastro.ts`
- Create: `apps/site/src/app/api/imoveis/route.ts`, `apps/site/src/app/api/imoveis/reservas/route.ts`, `apps/site/src/app/api/imoveis/[codigo]/route.ts`
- Test: `apps/site/src/lib/api/imoveis.test.ts`

**Interfaces:**
- Consumes: `autenticar`, `nomeDoAtor`, `respostaErro`, `lerCorpoJson`, `detalhesZod`, `aplicarGravacao`, repositório (`lerImovel`, `listarImoveis`, `gravarImovel`, `lerEndereco`, `gravarEndereco`, `lerReserva`, `lerLapide`, `reservarCodigo`), `ErroConflito`, `ErroJaExiste`.
- Produces:
  ```ts
  tratarListarImoveis(req, s): Promise<Response>
  tratarReservarCodigo(req, s): Promise<Response>
  tratarCriarImovel(req, s): Promise<Response>
  tratarLerImovel(req, s, codigo: string): Promise<Response>
  tratarAtualizarImovel(req, s, codigo: string): Promise<Response>
  // src/testes/cadastro.ts
  cadastrar(s: Servicos, entrada?: Partial<ImovelEntrada>, extras?: { endereco_completo?: string; autenticacao?: ComoAutenticar }): Promise<{ codigo: string; etag: string; imovel: Imovel }>
  ```

- [ ] **Step 1: Ajudante de cadastro para testes**

`src/testes/cadastro.ts`:

```ts
import { tratarCriarImovel, tratarReservarCodigo } from "@/lib/api/imoveis";
import type { Imovel, ImovelEntrada } from "@/lib/contratos/imovel";
import type { Servicos } from "@/lib/servicos";
import { entradaDeExemplo, fotosDeExemplo } from "./fixtures";
import { requisicao, type ComoAutenticar } from "./requisicoes";

/** Fluxo da skill: reserva o código e cria o imóvel com fotos na pasta desse código. */
export async function cadastrar(
  s: Servicos,
  entrada: Partial<ImovelEntrada> = {},
  extras: { endereco_completo?: string; autenticacao?: ComoAutenticar } = {},
): Promise<{ codigo: string; etag: string; imovel: Imovel }> {
  const autenticacao = extras.autenticacao ?? "skill";
  const reserva = await tratarReservarCodigo(requisicao("POST", "/api/imoveis/reservas", { autenticacao }), s);
  const { codigo } = (await reserva.json()) as { codigo: string };
  const corpo = {
    codigo,
    imovel: entradaDeExemplo({ fotos: fotosDeExemplo(codigo), ...entrada }),
    ...(extras.endereco_completo ? { endereco_completo: extras.endereco_completo } : {}),
  };
  const resposta = await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo, autenticacao }), s);
  if (resposta.status !== 201) throw new Error(`cadastro falhou: ${resposta.status} ${await resposta.text()}`);
  const { imovel, etag } = (await resposta.json()) as { imovel: Imovel; etag: string };
  return { codigo, etag, imovel };
}
```

- [ ] **Step 2: Testes de integração**

`src/lib/api/imoveis.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Imovel } from "@/lib/contratos/imovel";
import { cadastrar } from "@/testes/cadastro";
import { entradaDeExemplo, fotosDeExemplo } from "@/testes/fixtures";
import { requisicao } from "@/testes/requisicoes";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { tratarAtualizarImovel, tratarCriarImovel, tratarLerImovel, tratarListarImoveis, tratarReservarCodigo } from "./imoveis";

const ENDERECO = "Rua das Palmeiras, 45, Embu-Guaçu";
const json = async (resposta: Response) => resposta.json() as Promise<Record<string, unknown>>;
const atualizar = (s: Awaited<ReturnType<typeof criarServicosDeTeste>>, codigo: string, imovel: unknown, etag: string | null, autenticacao: "skill" | "admin" = "admin") =>
  tratarAtualizarImovel(
    requisicao("PUT", `/api/imoveis/${codigo}`, { corpo: { imovel }, autenticacao, cabecalhos: etag ? { "if-match": etag } : {} }),
    s,
    codigo,
  );

describe("autenticação das rotas de imóvel", () => {
  it("gravação sem login nem segredo falha", async () => {
    const s = await criarServicosDeTeste();
    const corpo = { codigo: "MC001", imovel: entradaDeExemplo() };
    expect((await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo, autenticacao: "nenhum" }), s)).status).toBe(401);
    expect((await tratarReservarCodigo(requisicao("POST", "/api/imoveis/reservas", { autenticacao: "nenhum" }), s)).status).toBe(401);
    expect((await tratarListarImoveis(requisicao("GET", "/api/imoveis", { autenticacao: "nenhum" }), s)).status).toBe(401);
  });
});

describe("criação", () => {
  it("reserva e cria; grava atualizado_por da skill e revalida o cache", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, imovel, etag } = await cadastrar(s);
    expect(codigo).toBe("MC001");
    expect(etag).toMatch(/^".+"$/);
    expect(imovel).toMatchObject({ codigo: "MC001", atualizado_por: "skill", publicacao: "publicado" });
    expect(s.tagsRevalidadas).toContain("imoveis");
  });

  it("pela API do Moisés o autor fica 'api'", async () => {
    const s = await criarServicosDeTeste();
    expect((await cadastrar(s, {}, { autenticacao: "api" })).imovel.atualizado_por).toBe("api");
  });

  it("duas reservas simultâneas recebem códigos diferentes", async () => {
    const s = await criarServicosDeTeste();
    const respostas = await Promise.all([1, 2].map(() => tratarReservarCodigo(requisicao("POST", "/api/imoveis/reservas"), s)));
    const codigos = await Promise.all(respostas.map(async (resposta) => (await json(resposta)).codigo));
    expect(new Set(codigos).size).toBe(2);
  });

  it("criar sem reserva é 422 sem_reserva", async () => {
    const s = await criarServicosDeTeste();
    const resposta = await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo: { codigo: "MC001", imovel: entradaDeExemplo() } }), s);
    expect(resposta.status).toBe(422);
    expect((await json(resposta)).erro).toBe("sem_reserva");
  });

  it("criar duas vezes no mesmo código é 409", async () => {
    const s = await criarServicosDeTeste();
    const { codigo } = await cadastrar(s);
    const corpo = { codigo, imovel: entradaDeExemplo({ fotos: fotosDeExemplo(codigo) }) };
    expect((await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo }), s)).status).toBe(409);
  });

  it("esquema inválido é 422 com detalhes por campo", async () => {
    const s = await criarServicosDeTeste();
    await tratarReservarCodigo(requisicao("POST", "/api/imoveis/reservas"), s);
    const corpo = { codigo: "MC001", imovel: { ...entradaDeExemplo(), tipo: "sobrado" } };
    const resposta = await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo }), s);
    expect(resposta.status).toBe(422);
    expect((await json(resposta)).detalhes).toContainEqual(expect.objectContaining({ caminho: "tipo" }));
  });

  it("foto fora do store público ou de outro imóvel é 422", async () => {
    const s = await criarServicosDeTeste();
    await tratarReservarCodigo(requisicao("POST", "/api/imoveis/reservas"), s);
    const deFora = { codigo: "MC001", imovel: entradaDeExemplo({ fotos: fotosDeExemplo("MC001", 1, "https://outro.example") }) };
    expect((await json(await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo: deFora }), s))).erro).toBe("foto_fora_do_store");
    const deOutro = { codigo: "MC001", imovel: entradaDeExemplo({ fotos: fotosDeExemplo("MC009", 1) }) };
    expect((await json(await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo: deOutro }), s))).erro).toBe("foto_fora_do_store");
  });
});

describe("endereço", () => {
  it("vai num arquivo separado e só volta na leitura individual", async () => {
    const s = await criarServicosDeTeste();
    const { codigo } = await cadastrar(s, {}, { endereco_completo: ENDERECO });
    const lido = await json(await tratarLerImovel(requisicao("GET", `/api/imoveis/${codigo}`), s, codigo));
    expect(lido.endereco_completo).toBe(ENDERECO);
    expect(JSON.stringify(lido.imovel)).not.toContain("Palmeiras");
    const lista = await (await tratarListarImoveis(requisicao("GET", "/api/imoveis"), s)).text();
    expect(lista).not.toContain("Palmeiras");
  });

  it("nunca entra no histórico", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s);
    const corpo = { imovel: entradaDeExemplo({ fotos: fotosDeExemplo(codigo) }), endereco_completo: ENDERECO };
    const resposta = await tratarAtualizarImovel(requisicao("PUT", `/api/imoveis/${codigo}`, { corpo, cabecalhos: { "if-match": etag } }), s, codigo);
    expect(resposta.status).toBe(200);
    expect(JSON.stringify(await json(resposta))).not.toContain("Palmeiras");
  });
});

describe("leitura", () => {
  it("código inexistente ou inválido é 404", async () => {
    const s = await criarServicosDeTeste();
    expect((await tratarLerImovel(requisicao("GET", "/api/imoveis/MC404"), s, "MC404")).status).toBe(404);
    expect((await tratarLerImovel(requisicao("GET", "/api/imoveis/..%2Fconfig"), s, "../config")).status).toBe(404);
  });

  it("devolve o ETag no corpo e no cabeçalho", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s);
    const resposta = await tratarLerImovel(requisicao("GET", `/api/imoveis/${codigo}`), s, codigo);
    expect(resposta.headers.get("etag")).toBe(etag);
    expect((await json(resposta)).etag).toBe(etag);
  });
});

describe("atualização", () => {
  it("sem If-Match é 428", async () => {
    const s = await criarServicosDeTeste();
    const { codigo } = await cadastrar(s);
    expect((await atualizar(s, codigo, entradaDeExemplo({ fotos: fotosDeExemplo(codigo) }), null)).status).toBe(428);
  });

  it("gravação concorrente do mesmo imóvel: uma vence, a outra recebe 409", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s);
    const base = entradaDeExemplo({ fotos: fotosDeExemplo(codigo) });
    const [primeira, segunda] = await Promise.all([
      atualizar(s, codigo, { ...base, titulo: "Título da Gabriela para a casa" }, etag),
      atualizar(s, codigo, { ...base, titulo: "Título do Moisés para a casa" }, etag),
    ]);
    expect([primeira.status, segunda.status].sort()).toEqual([200, 409]);
    const perdedora = primeira.status === 409 ? primeira : segunda;
    expect((await json(perdedora)).erro).toBe("conflito");
  });

  it("marcar vendido tira do ar na hora e revalida", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s);
    s.tagsRevalidadas.length = 0;
    const resposta = await atualizar(s, codigo, entradaDeExemplo({ fotos: fotosDeExemplo(codigo), status: "vendido" }), etag);
    expect(((await json(resposta)).imovel as Imovel).publicacao).toBe("rascunho");
    expect(s.tagsRevalidadas).toEqual(["imoveis"]);
  });

  it("sexto destaque é recusado com 422", async () => {
    const s = await criarServicosDeTeste();
    for (let n = 0; n < 5; n += 1) await cadastrar(s, { destaque: true });
    const { codigo, etag } = await cadastrar(s);
    const resposta = await atualizar(s, codigo, entradaDeExemplo({ fotos: fotosDeExemplo(codigo), destaque: true }), etag);
    expect(resposta.status).toBe(422);
    expect((await json(resposta)).erro).toBe("limite_destaques");
  });

  it("o painel grava com o e-mail do editor", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s);
    const resposta = await atualizar(s, codigo, entradaDeExemplo({ fotos: fotosDeExemplo(codigo), status: "reservado" }), etag, "admin");
    expect(((await json(resposta)).imovel as Imovel).atualizado_por).toBe("gabriela@exemplo.com");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- src/lib/api/imoveis.test.ts`
Expected: FAIL com `Failed to resolve import "./imoveis"`.

- [ ] **Step 4: Implementar os handlers**

`src/lib/api/imoveis.ts`:

```ts
import { z } from "zod";
import { ErroConflito, ErroJaExiste } from "@/lib/armazem/tipos";
import { autenticar, nomeDoAtor, type Ator } from "@/lib/auth/guarda";
import { CodigoSchema, REGEX_CODIGO } from "@/lib/contratos/comum";
import { ImovelEntradaSchema, type Imovel, type ImovelEntrada } from "@/lib/contratos/imovel";
import { aplicarGravacao } from "@/lib/dominio/regras";
import {
  gravarEndereco,
  gravarImovel,
  lerEndereco,
  lerImovel,
  lerLapide,
  lerReserva,
  listarImoveis,
  reservarCodigo,
} from "@/lib/repositorio/imoveis";
import type { Servicos } from "@/lib/servicos";
import { detalhesZod, lerCorpoJson, respostaErro } from "./respostas";

const EnderecoEntrada = z.string().trim().min(5).max(300);
const CorpoCriacao = z.strictObject({ codigo: CodigoSchema, imovel: z.unknown(), endereco_completo: EnderecoEntrada.optional() });
const CorpoAtualizacao = z.strictObject({ imovel: z.unknown(), endereco_completo: EnderecoEntrada.optional() });

const MENSAGEM_CONFLITO = "Outra pessoa alterou este imóvel. Recarregue e tente de novo.";

function respostaImovel(imovel: Imovel, etag: string, status = 200, extra: Record<string, unknown> = {}): Response {
  return Response.json({ imovel, etag, ...extra }, { status, headers: { ETag: etag } });
}

function naoEncontrado(): Response {
  return respostaErro(404, "nao_encontrado", "Imóvel não encontrado.");
}

async function validarEntrada(bruto: unknown, codigo: string, s: Servicos): Promise<{ entrada: ImovelEntrada } | { resposta: Response }> {
  const resultado = ImovelEntradaSchema.safeParse(bruto);
  if (!resultado.success) {
    return { resposta: respostaErro(422, "esquema_invalido", "O imóvel não passou na validação.", { detalhes: detalhesZod(resultado.error) }) };
  }
  if (!s.config.fotosOrigem) return { resposta: respostaErro(500, "config_ausente", "FOTOS_ORIGEM não configurada no servidor.") };
  const prefixo = `${s.config.fotosOrigem}/imoveis/${codigo}/fotos/`;
  const foraDoStore = resultado.data.fotos.some((foto) => Object.values(foto.larguras).some((url) => !url.startsWith(prefixo)));
  if (foraDoStore) {
    return { resposta: respostaErro(422, "foto_fora_do_store", `Toda foto precisa estar em ${prefixo}`) };
  }
  return { entrada: resultado.data };
}

async function contarDestaquesDeOutros(s: Servicos, codigo: string): Promise<number> {
  return (await listarImoveis(s.armazem)).filter((imovel) => imovel.destaque && imovel.codigo !== codigo).length;
}

async function aplicar(s: Servicos, ator: Ator, codigo: string, atual: Imovel | null, entrada: ImovelEntrada) {
  return aplicarGravacao({
    codigo,
    atual,
    entrada,
    por: nomeDoAtor(ator),
    agora: s.agora(),
    destaquesDeOutros: await contarDestaquesDeOutros(s, codigo),
  });
}

export async function tratarListarImoveis(req: Request, s: Servicos): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: true });
  if (ator instanceof Response) return ator;
  return Response.json({ imoveis: await listarImoveis(s.armazem) });
}

export async function tratarReservarCodigo(req: Request, s: Servicos): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: true });
  if (ator instanceof Response) return ator;
  const codigo = await reservarCodigo(s.armazem, { agora: s.agora(), por: nomeDoAtor(ator) });
  return Response.json({ codigo }, { status: 201 });
}

export async function tratarCriarImovel(req: Request, s: Servicos): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: true });
  if (ator instanceof Response) return ator;
  const leitura = await lerCorpoJson(req);
  if (!leitura.ok) return leitura.resposta;
  const pedido = CorpoCriacao.safeParse(leitura.corpo);
  if (!pedido.success) return respostaErro(400, "corpo_invalido", "Envie { codigo, imovel, endereco_completo? }.", { detalhes: detalhesZod(pedido.error) });
  const { codigo, endereco_completo } = pedido.data;

  if (await lerLapide(s.armazem, codigo)) return respostaErro(410, "codigo_excluido", "Este código foi excluído e não volta a ser usado.");
  if (!(await lerReserva(s.armazem, codigo))) return respostaErro(422, "sem_reserva", "Reserve o código antes (POST /api/imoveis/reservas).");
  if (await lerImovel(s.armazem, codigo)) return respostaErro(409, "ja_existe", "Este código já tem imóvel. Use PUT para editar.");

  const validacao = await validarEntrada(pedido.data.imovel, codigo, s);
  if ("resposta" in validacao) return validacao.resposta;
  const resultado = await aplicar(s, ator, codigo, null, validacao.entrada);
  if (!resultado.ok) return respostaErro(422, resultado.erro, resultado.mensagem);

  let etag: string;
  try {
    ({ etag } = await gravarImovel(s.armazem, resultado.imovel, { criarSomente: true }));
  } catch (erro) {
    if (erro instanceof ErroJaExiste) return respostaErro(409, "ja_existe", "Este código já tem imóvel. Use PUT para editar.");
    throw erro;
  }
  if (endereco_completo) {
    await gravarEndereco(s.armazem, { codigo, endereco_completo, atualizado_em: s.agora().toISOString() });
  }
  await s.revalidar("imoveis");
  return respostaImovel(resultado.imovel, etag, 201);
}

export async function tratarLerImovel(req: Request, s: Servicos, codigo: string): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: true });
  if (ator instanceof Response) return ator;
  if (!REGEX_CODIGO.test(codigo)) return naoEncontrado();
  const lido = await lerImovel(s.armazem, codigo);
  if (!lido) {
    return (await lerLapide(s.armazem, codigo)) ? respostaErro(410, "codigo_excluido", "Este imóvel foi excluído.") : naoEncontrado();
  }
  const endereco = await lerEndereco(s.armazem, codigo);
  return respostaImovel(lido.imovel, lido.etag, 200, { endereco_completo: endereco?.endereco_completo ?? null });
}

export async function tratarAtualizarImovel(req: Request, s: Servicos, codigo: string): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: true });
  if (ator instanceof Response) return ator;
  if (!REGEX_CODIGO.test(codigo)) return naoEncontrado();
  const ifMatch = req.headers.get("if-match");
  if (!ifMatch) return respostaErro(428, "etag_ausente", "Envie o cabeçalho If-Match com o ETag da última leitura.");
  const leitura = await lerCorpoJson(req);
  if (!leitura.ok) return leitura.resposta;
  const pedido = CorpoAtualizacao.safeParse(leitura.corpo);
  if (!pedido.success) return respostaErro(400, "corpo_invalido", "Envie { imovel, endereco_completo? }.", { detalhes: detalhesZod(pedido.error) });

  const lido = await lerImovel(s.armazem, codigo);
  if (!lido) return naoEncontrado();
  if (lido.etag !== ifMatch) return respostaErro(409, "conflito", MENSAGEM_CONFLITO);

  const validacao = await validarEntrada(pedido.data.imovel, codigo, s);
  if ("resposta" in validacao) return validacao.resposta;
  const resultado = await aplicar(s, ator, codigo, lido.imovel, validacao.entrada);
  if (!resultado.ok) return respostaErro(422, resultado.erro, resultado.mensagem);

  let etag: string;
  try {
    ({ etag } = await gravarImovel(s.armazem, resultado.imovel, { ifMatch }));
  } catch (erro) {
    if (erro instanceof ErroConflito) return respostaErro(409, "conflito", MENSAGEM_CONFLITO);
    throw erro;
  }
  if (pedido.data.endereco_completo) {
    await gravarEndereco(s.armazem, { codigo, endereco_completo: pedido.data.endereco_completo, atualizado_em: s.agora().toISOString() });
  }
  await s.revalidar("imoveis");
  return respostaImovel(resultado.imovel, etag);
}
```

- [ ] **Step 5: Rotas**

`src/app/api/imoveis/route.ts`:

```ts
import { tratarCriarImovel, tratarListarImoveis } from "@/lib/api/imoveis";
import { servicos } from "@/lib/servicos";

export const GET = (req: Request) => tratarListarImoveis(req, servicos());
export const POST = (req: Request) => tratarCriarImovel(req, servicos());
```

`src/app/api/imoveis/reservas/route.ts`:

```ts
import { tratarReservarCodigo } from "@/lib/api/imoveis";
import { servicos } from "@/lib/servicos";

export const POST = (req: Request) => tratarReservarCodigo(req, servicos());
```

`src/app/api/imoveis/[codigo]/route.ts`:

```ts
import { tratarAtualizarImovel, tratarLerImovel } from "@/lib/api/imoveis";
import { servicos } from "@/lib/servicos";

interface Contexto {
  params: Promise<{ codigo: string }>;
}

export async function GET(req: Request, { params }: Contexto) {
  return tratarLerImovel(req, servicos(), (await params).codigo);
}

export async function PUT(req: Request, { params }: Contexto) {
  return tratarAtualizarImovel(req, servicos(), (await params).codigo);
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- src/lib/api && npm run typecheck && npm run lint && npm run build`
Expected: PASS; o build lista `ƒ /api/imoveis`, `ƒ /api/imoveis/reservas`, `ƒ /api/imoveis/[codigo]`.

- [ ] **Step 7: Commit**

```bash
git add apps/site/src/lib/api/imoveis.ts apps/site/src/lib/api/imoveis.test.ts apps/site/src/testes/cadastro.ts apps/site/src/app/api/imoveis
git commit -m "feat(api): /api/imoveis com reserva de código, ETag, endereço separado e revalidação"
```

---

### Task 2.5: Exclusão definitiva

**Files:**
- Modify: `apps/site/src/lib/api/imoveis.ts` (acrescentar `tratarExcluirImovel`), `apps/site/src/app/api/imoveis/[codigo]/route.ts` (acrescentar `DELETE`)
- Test: `apps/site/src/lib/api/exclusao.test.ts`

**Interfaces:**
- Consumes: `caminhos`, `LapideSchema`, `ArmazemFotos.listar/apagar`.
- Produces: `tratarExcluirImovel(req, s, codigo): Promise<Response>`.

- [ ] **Step 1: Testes**

`src/lib/api/exclusao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { caminhos } from "@/lib/armazem/caminhos";
import { cadastrar } from "@/testes/cadastro";
import { entradaDeExemplo, fotosDeExemplo } from "@/testes/fixtures";
import { requisicao } from "@/testes/requisicoes";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { tratarCriarImovel, tratarExcluirImovel, tratarLerImovel, tratarReservarCodigo } from "./imoveis";

const excluir = (s: Awaited<ReturnType<typeof criarServicosDeTeste>>, codigo: string, etag: string, confirmacao = codigo, autenticacao: "admin" | "skill" = "admin") =>
  tratarExcluirImovel(
    requisicao("DELETE", `/api/imoveis/${codigo}`, { autenticacao, corpo: { confirmacao }, cabecalhos: { "if-match": etag } }),
    s,
    codigo,
  );

describe("DELETE /api/imoveis/:codigo", () => {
  it("só exclui rascunho", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s);
    const resposta = await excluir(s, codigo, etag);
    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toBe("so_rascunho");
  });

  it("exige digitar o código", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s, { publicacao: "rascunho" });
    expect((await excluir(s, codigo, etag, "MC999")).status).toBe(422);
  });

  it("a skill não exclui", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s, { publicacao: "rascunho" });
    expect((await excluir(s, codigo, etag, codigo, "skill")).status).toBe(403);
  });

  it("apaga JSON, endereço e fotos, e o código passa a responder 410", async () => {
    const s = await criarServicosDeTeste();
    const { codigo, etag } = await cadastrar(s, { publicacao: "rascunho" }, { endereco_completo: "Rua Um, 100, Centro" });
    await s.fotos.enviar(`imoveis/${codigo}/fotos/1-abcdef0123-800.webp`, Buffer.from("x"), "image/webp");
    const resposta = await excluir(s, codigo, etag);
    expect(resposta.status).toBe(200);
    expect(await s.armazem.ler(caminhos.imovel(codigo))).toBeNull();
    expect(await s.armazem.ler(caminhos.endereco(codigo))).toBeNull();
    expect(await s.fotos.listar(caminhos.pastaFotos(codigo))).toEqual([]);
    expect((await tratarLerImovel(requisicao("GET", `/api/imoveis/${codigo}`), s, codigo)).status).toBe(410);
    expect(s.tagsRevalidadas.at(-1)).toBe("imoveis");
  });

  it("reserva depois de excluir o maior código não reaproveita (Review Focus 1)", async () => {
    const s = await criarServicosDeTeste();
    await cadastrar(s);
    const { codigo, etag } = await cadastrar(s, { publicacao: "rascunho" });
    expect(codigo).toBe("MC002");
    await excluir(s, codigo, etag);
    const nova = await tratarReservarCodigo(requisicao("POST", "/api/imoveis/reservas"), s);
    expect((await nova.json()).codigo).toBe("MC003");
    const corpo = { codigo: "MC002", imovel: entradaDeExemplo({ fotos: fotosDeExemplo("MC002") }) };
    expect((await tratarCriarImovel(requisicao("POST", "/api/imoveis", { corpo }), s)).status).toBe(410);
  });

  it("ETag velho é 409 e nada é apagado", async () => {
    const s = await criarServicosDeTeste();
    const { codigo } = await cadastrar(s, { publicacao: "rascunho" });
    expect((await excluir(s, codigo, '"velho"')).status).toBe(409);
    expect(await s.armazem.ler(caminhos.imovel(codigo))).not.toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/api/exclusao.test.ts`
Expected: FAIL com `tratarExcluirImovel is not a function` (ou erro de import).

- [ ] **Step 3: Implementar**

Acrescente a `src/lib/api/imoveis.ts` (e os imports `caminhos` de `@/lib/armazem/caminhos` e `LapideSchema` de `@/lib/contratos/imovel`):

```ts
const CorpoExclusao = z.strictObject({ confirmacao: z.string() });

async function apagarRestos(s: Servicos, codigo: string): Promise<void> {
  await s.armazem.apagar([caminhos.endereco(codigo), caminhos.reserva(codigo)]);
  await s.fotos.apagar(await s.fotos.listar(caminhos.pastaFotos(codigo)));
}

/** Só rascunho, só painel, com o código digitado. Os backups guardam os JSON por 30 dias; as fotos não voltam (spec 6). */
export async function tratarExcluirImovel(req: Request, s: Servicos, codigo: string): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: false });
  if (ator instanceof Response) return ator;
  if (!REGEX_CODIGO.test(codigo)) return naoEncontrado();
  const ifMatch = req.headers.get("if-match");
  if (!ifMatch) return respostaErro(428, "etag_ausente", "Envie o cabeçalho If-Match com o ETag da última leitura.");
  const leitura = await lerCorpoJson(req, 1_000);
  if (!leitura.ok) return leitura.resposta;
  const pedido = CorpoExclusao.safeParse(leitura.corpo);
  if (!pedido.success || pedido.data.confirmacao !== codigo) {
    return respostaErro(422, "confirmacao_invalida", `Digite ${codigo} para confirmar a exclusão.`);
  }

  const lido = await lerImovel(s.armazem, codigo);
  if (!lido) {
    // Exclusão que parou no meio: termina de limpar o que sobrou.
    if (await lerLapide(s.armazem, codigo)) {
      await apagarRestos(s, codigo);
      return Response.json({ excluido: codigo });
    }
    return naoEncontrado();
  }
  if (lido.imovel.publicacao !== "rascunho") return respostaErro(422, "so_rascunho", "Retire o imóvel do ar antes de excluir.");
  if (lido.etag !== ifMatch) return respostaErro(409, "conflito", MENSAGEM_CONFLITO);

  // A lápide vem primeiro: mesmo que algo falhe depois, o código nunca volta a ser usado.
  const lapide = LapideSchema.parse({ codigo, excluido_em: s.agora().toISOString(), por: nomeDoAtor(ator) });
  await s.armazem.gravar(caminhos.lapide(codigo), lapide);
  try {
    await s.armazem.apagar([caminhos.imovel(codigo)], { ifMatch });
  } catch (erro) {
    if (erro instanceof ErroConflito) return respostaErro(409, "conflito", MENSAGEM_CONFLITO);
    throw erro;
  }
  await apagarRestos(s, codigo);
  await s.revalidar("imoveis");
  return Response.json({ excluido: codigo });
}
```

Em `src/app/api/imoveis/[codigo]/route.ts`, acrescente o import de `tratarExcluirImovel` e:

```ts
export async function DELETE(req: Request, { params }: Contexto) {
  return tratarExcluirImovel(req, servicos(), (await params).codigo);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/lib/api && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/api/imoveis.ts apps/site/src/lib/api/exclusao.test.ts "apps/site/src/app/api/imoveis/[codigo]/route.ts"
git commit -m "feat(api): exclusão definitiva só de rascunho, com lápide que impede reaproveitar o código"
```

---

### Task 2.6: `/api/flags`

**Files:**
- Create: `apps/site/src/lib/api/flags.ts`, `apps/site/src/app/api/flags/route.ts`
- Test: `apps/site/src/lib/api/flags.test.ts`

**Interfaces:**
- Consumes: `FlagsEntradaSchema`, `lerFlags`, `gravarFlags`, `autenticar`.
- Produces: `tratarLerFlags(req, s)`, `tratarGravarFlags(req, s)`.

- [ ] **Step 1: Testes**

`src/lib/api/flags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FLAGS_PADRAO } from "@/lib/contratos/flags";
import { requisicao } from "@/testes/requisicoes";
import { criarServicosDeTeste } from "@/testes/servicos-de-teste";
import { tratarGravarFlags, tratarLerFlags } from "./flags";

const gravar = (s: Awaited<ReturnType<typeof criarServicosDeTeste>>, corpo: unknown, etag?: string | null, autenticacao: "admin" | "skill" = "admin") =>
  tratarGravarFlags(requisicao("PUT", "/api/flags", { corpo, autenticacao, cabecalhos: etag ? { "if-match": etag } : {} }), s);

describe("/api/flags", () => {
  it("lê o padrão com ETag nulo", async () => {
    const s = await criarServicosDeTeste();
    expect(await (await tratarLerFlags(requisicao("GET", "/api/flags", { autenticacao: "admin" }), s)).json()).toEqual({ flags: FLAGS_PADRAO, etag: null });
  });

  it("grava com o e-mail do editor e revalida o cache das flags", async () => {
    const s = await criarServicosDeTeste();
    const resposta = await gravar(s, { flags: { ...FLAGS_PADRAO, detalhes: ["vagas", "iptu"] } });
    expect(resposta.status).toBe(200);
    const { flags } = await resposta.json();
    expect(flags).toMatchObject({ detalhes: ["vagas", "iptu"], atualizado_por: "gabriela@exemplo.com" });
    expect(s.tagsRevalidadas).toEqual(["flags"]);
  });

  it("recusa o quinto campo na primeira dobra e chave de endereço", async () => {
    const s = await criarServicosDeTeste();
    expect((await gravar(s, { flags: { ...FLAGS_PADRAO, primeira_dobra: ["area_util_m2", "quartos", "suites", "vagas", "iptu"] } })).status).toBe(422);
    expect((await gravar(s, { flags: { ...FLAGS_PADRAO, detalhes: ["endereco_completo"] } })).status).toBe(422);
  });

  it("segunda gravação exige o ETag atual", async () => {
    const s = await criarServicosDeTeste();
    const { etag } = await (await gravar(s, { flags: FLAGS_PADRAO })).json();
    expect((await gravar(s, { flags: FLAGS_PADRAO })).status).toBe(428);
    expect((await gravar(s, { flags: FLAGS_PADRAO }, '"velho"')).status).toBe(409);
    expect((await gravar(s, { flags: FLAGS_PADRAO }, etag)).status).toBe(200);
  });

  it("ligar a medição exige a confirmação LIGAR", async () => {
    const s = await criarServicosDeTeste();
    const ligar = { ...FLAGS_PADRAO, eventos_ativos: true };
    const sem = await gravar(s, { flags: ligar });
    expect(sem.status).toBe(422);
    expect((await sem.json()).erro).toBe("confirmacao_medicao");
    expect((await gravar(s, { flags: ligar, confirmacao_medicao: "LIGAR" })).status).toBe(200);
  });

  it("a skill não mexe nas flags", async () => {
    const s = await criarServicosDeTeste();
    expect((await gravar(s, { flags: FLAGS_PADRAO }, null, "skill")).status).toBe(403);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/api/flags.test.ts`
Expected: FAIL com `Failed to resolve import "./flags"`.

- [ ] **Step 3: Implementar**

`src/lib/api/flags.ts`:

```ts
import { z } from "zod";
import { ErroConflito, ErroJaExiste } from "@/lib/armazem/tipos";
import { autenticar } from "@/lib/auth/guarda";
import { FlagsEntradaSchema, type Flags } from "@/lib/contratos/flags";
import { gravarFlags, lerFlags } from "@/lib/repositorio/flags";
import type { Servicos } from "@/lib/servicos";
import { detalhesZod, lerCorpoJson, respostaErro } from "./respostas";

const CorpoFlags = z.strictObject({ flags: FlagsEntradaSchema, confirmacao_medicao: z.literal("LIGAR").optional() });
const MENSAGEM_CONFLITO = "Outra pessoa alterou os campos visíveis. Recarregue e tente de novo.";

export async function tratarLerFlags(req: Request, s: Servicos): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: false });
  if (ator instanceof Response) return ator;
  return Response.json(await lerFlags(s.armazem));
}

export async function tratarGravarFlags(req: Request, s: Servicos): Promise<Response> {
  const ator = autenticar(req, s.config, { aceitaSkill: false });
  if (ator instanceof Response) return ator;
  if (ator.tipo !== "admin") return respostaErro(403, "skill_nao_permitida", "Esta rota é só do painel.");
  const leitura = await lerCorpoJson(req, 10_000);
  if (!leitura.ok) return leitura.resposta;
  const pedido = CorpoFlags.safeParse(leitura.corpo);
  if (!pedido.success) {
    return respostaErro(422, "esquema_invalido", "Campos visíveis inválidos (máximo de 4 na primeira dobra).", { detalhes: detalhesZod(pedido.error) });
  }

  const atual = await lerFlags(s.armazem);
  const ifMatch = req.headers.get("if-match");
  if (atual.etag && !ifMatch) return respostaErro(428, "etag_ausente", "Envie o cabeçalho If-Match com o ETag da última leitura.");
  if (atual.etag && ifMatch !== atual.etag) return respostaErro(409, "conflito", MENSAGEM_CONFLITO);
  if (!atual.flags.eventos_ativos && pedido.data.flags.eventos_ativos && pedido.data.confirmacao_medicao !== "LIGAR") {
    return respostaErro(422, "confirmacao_medicao", "Para ligar a medição, digite LIGAR. Só ligue com o de acordo do Moisés por escrito.");
  }

  const flags: Flags = { ...pedido.data.flags, atualizado_em: s.agora().toISOString(), atualizado_por: ator.email };
  let etag: string;
  try {
    ({ etag } = await gravarFlags(s.armazem, flags, atual.etag));
  } catch (erro) {
    if (erro instanceof ErroConflito || erro instanceof ErroJaExiste) return respostaErro(409, "conflito", MENSAGEM_CONFLITO);
    throw erro;
  }
  await s.revalidar("flags");
  return Response.json({ flags, etag });
}
```

`src/app/api/flags/route.ts`:

```ts
import { tratarGravarFlags, tratarLerFlags } from "@/lib/api/flags";
import { servicos } from "@/lib/servicos";

export const GET = (req: Request) => tratarLerFlags(req, servicos());
export const PUT = (req: Request) => tratarGravarFlags(req, servicos());
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/lib/api && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/api/flags.ts apps/site/src/lib/api/flags.test.ts apps/site/src/app/api/flags
git commit -m "feat(api): /api/flags com ETag, limite de 4 campos e confirmação para ligar a medição"
```

---

### Task 2.7: Painel: entrada com Google e lista de imóveis

**Files:**
- Create: `apps/site/src/lib/painel/lista.ts`, `apps/site/src/lib/painel/cliente-api.ts`
- Create: `apps/site/src/app/admin/(painel)/layout.tsx`, `apps/site/src/app/admin/(painel)/page.tsx`, `apps/site/src/app/admin/(painel)/admin.css`
- Create: `apps/site/src/components/admin/EntrarComGoogle.tsx`, `apps/site/src/components/admin/BotaoSair.tsx`
- Test: `apps/site/src/lib/painel/lista.test.ts`

**Interfaces:**
- Consumes: `emailDaSessao`, `servicos`, `listarImoveis`, `formatarData`, `formatarDiaMes`, `ParametrosDeBusca`.
- Produces:
  ```ts
  // painel/lista.ts
  interface FiltrosPainel { publicacao?: Publicacao; status?: Status; esteveNoAr?: boolean }
  lerFiltrosPainel(p: ParametrosDeBusca): FiltrosPainel
  filtrarPainel(imoveis: Imovel[], f: FiltrosPainel): Imovel[]
  esteveNoAr(imovel: Imovel): boolean
  seloEsteveNoAr(imovel: Imovel): string | null
  // painel/cliente-api.ts (navegador)
  type ResultadoApi<T> = { ok: true; dados: T } | { ok: false; status: number; erro: string; mensagem: string; detalhes?: { caminho: string; mensagem: string }[] }
  api.entrar(credential), api.sair(), api.salvarImovel(codigo, entrada, etag, endereco?), api.excluirImovel(codigo, etag, confirmacao), api.salvarFlags(flags, etag, confirmacaoMedicao?)
  ```

- [ ] **Step 1: Testes da lista**

`src/lib/painel/lista.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { imovelDeExemplo } from "@/testes/fixtures";
import { esteveNoAr, filtrarPainel, lerFiltrosPainel, seloEsteveNoAr } from "./lista";

const novoDoLote = imovelDeExemplo({ codigo: "MC001", publicacao: "rascunho", publicado_em: undefined });
const retirado = imovelDeExemplo({
  codigo: "MC002",
  publicacao: "rascunho",
  publicado_em: "2026-09-01T12:00:00.000Z",
  historico: [{ em: "2026-10-12T15:00:00.000Z", por: "moises@exemplo.com", campo: "publicacao", de: "publicado", para: "rascunho" }],
});
const noAr = imovelDeExemplo({ codigo: "MC003", status: "reservado" });

describe("lista do painel", () => {
  it("lê filtros da URL e ignora valores inválidos", () => {
    expect(lerFiltrosPainel({ publicacao: "rascunho", status: "vendido", esteve_no_ar: "1" })).toEqual({ publicacao: "rascunho", status: "vendido", esteveNoAr: true });
    expect(lerFiltrosPainel({ publicacao: "x", status: "y" })).toEqual({});
  });

  it("filtra por publicação, status e 'esteve no ar'", () => {
    const todos = [novoDoLote, retirado, noAr];
    expect(filtrarPainel(todos, { publicacao: "rascunho" }).map((imovel) => imovel.codigo)).toEqual(["MC001", "MC002"]);
    expect(filtrarPainel(todos, { status: "reservado" }).map((imovel) => imovel.codigo)).toEqual(["MC003"]);
    expect(filtrarPainel(todos, { esteveNoAr: true }).map((imovel) => imovel.codigo)).toEqual(["MC002"]);
  });

  it("rascunho com publicado_em tem selo com a data de retirada; novo do lote não tem", () => {
    expect(esteveNoAr(novoDoLote)).toBe(false);
    expect(seloEsteveNoAr(novoDoLote)).toBeNull();
    expect(seloEsteveNoAr(retirado)).toBe("Esteve no ar até 12/10");
    expect(seloEsteveNoAr({ ...retirado, historico: [] })).toBe("Esteve no ar");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/painel/lista.test.ts`
Expected: FAIL com `Failed to resolve import "./lista"`.

- [ ] **Step 3: Implementar `lista.ts` e `cliente-api.ts`**

`src/lib/painel/lista.ts`:

```ts
import type { ParametrosDeBusca } from "@/lib/apresentacao/filtros";
import { formatarDiaMes } from "@/lib/apresentacao/formatar";
import { PublicacaoSchema, StatusSchema, type Publicacao, type Status } from "@/lib/contratos/comum";
import type { Imovel } from "@/lib/contratos/imovel";

export interface FiltrosPainel {
  publicacao?: Publicacao;
  status?: Status;
  esteveNoAr?: boolean;
}

const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);

export function lerFiltrosPainel(parametros: ParametrosDeBusca): FiltrosPainel {
  const filtros: FiltrosPainel = {};
  const publicacao = PublicacaoSchema.safeParse(primeiro(parametros.publicacao));
  if (publicacao.success) filtros.publicacao = publicacao.data;
  const status = StatusSchema.safeParse(primeiro(parametros.status));
  if (status.success) filtros.status = status.data;
  if (primeiro(parametros.esteve_no_ar) === "1") filtros.esteveNoAr = true;
  return filtros;
}

export function esteveNoAr(imovel: Imovel): boolean {
  return imovel.publicacao === "rascunho" && imovel.publicado_em !== undefined;
}

/** Ajuste G: a data de retirada vem do histórico. */
export function seloEsteveNoAr(imovel: Imovel): string | null {
  if (!esteveNoAr(imovel)) return null;
  const retirada = [...imovel.historico].reverse().find((item) => item.campo === "publicacao" && item.para === "rascunho");
  return retirada ? `Esteve no ar até ${formatarDiaMes(retirada.em)}` : "Esteve no ar";
}

export function filtrarPainel(imoveis: Imovel[], filtros: FiltrosPainel): Imovel[] {
  return imoveis.filter(
    (imovel) =>
      (!filtros.publicacao || imovel.publicacao === filtros.publicacao) &&
      (!filtros.status || imovel.status === filtros.status) &&
      (!filtros.esteveNoAr || esteveNoAr(imovel)),
  );
}
```

`src/lib/painel/cliente-api.ts`:

```ts
import type { Flags, FlagsEntrada } from "@/lib/contratos/flags";
import type { Imovel, ImovelEntrada } from "@/lib/contratos/imovel";

export type ResultadoApi<T> =
  | { ok: true; dados: T }
  | { ok: false; status: number; erro: string; mensagem: string; detalhes?: { caminho: string; mensagem: string }[] };

async function chamar<T>(url: string, init: RequestInit): Promise<ResultadoApi<T>> {
  const resposta = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init.headers as Record<string, string>) },
  });
  const texto = await resposta.text();
  let corpo: Record<string, unknown> = {};
  if (texto) {
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = { mensagem: `Resposta inesperada do servidor (${resposta.status}).` };
    }
  }
  if (resposta.ok) return { ok: true, dados: corpo as T };
  return {
    ok: false,
    status: resposta.status,
    erro: typeof corpo.erro === "string" ? corpo.erro : "erro_desconhecido",
    mensagem: typeof corpo.mensagem === "string" ? corpo.mensagem : `Erro ${resposta.status}.`,
    detalhes: Array.isArray(corpo.detalhes) ? (corpo.detalhes as { caminho: string; mensagem: string }[]) : undefined,
  };
}

/** Todas as gravações do painel passam por aqui e pela API (ADR 0001). */
export const api = {
  entrar: (credential: string) => chamar<{ email: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ credential }) }),
  sair: () => chamar<{ saiu: true }>("/api/auth/logout", { method: "POST" }),
  salvarImovel: (codigo: string, entrada: ImovelEntrada, etag: string, endereco?: string) =>
    chamar<{ imovel: Imovel; etag: string }>(`/api/imoveis/${codigo}`, {
      method: "PUT",
      headers: { "if-match": etag },
      body: JSON.stringify({ imovel: entrada, ...(endereco ? { endereco_completo: endereco } : {}) }),
    }),
  excluirImovel: (codigo: string, etag: string, confirmacao: string) =>
    chamar<{ excluido: string }>(`/api/imoveis/${codigo}`, { method: "DELETE", headers: { "if-match": etag }, body: JSON.stringify({ confirmacao }) }),
  salvarFlags: (flags: FlagsEntrada, etag: string | null, confirmacaoMedicao?: "LIGAR") =>
    chamar<{ flags: Flags; etag: string }>("/api/flags", {
      method: "PUT",
      headers: etag ? { "if-match": etag } : {},
      body: JSON.stringify({ flags, ...(confirmacaoMedicao ? { confirmacao_medicao: confirmacaoMedicao } : {}) }),
    }),
};
```

- [ ] **Step 4: Entrada com Google e botão de sair**

`src/components/admin/EntrarComGoogle.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/painel/cliente-api";

interface ContaGoogle {
  initialize(config: { client_id: string; callback: (resposta: { credential: string }) => void }): void;
  renderButton(elemento: HTMLElement, opcoes: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: ContaGoogle } };
  }
}

const SCRIPT_GIS = "https://accounts.google.com/gsi/client";
let carga: Promise<void> | null = null;

/** Carga única do script, no desenho de pep19/src/auth/gis.ts: na falha, esquece a promessa para tentar de novo. */
function carregarGis(): Promise<void> {
  if (carga) return carga;
  carga = new Promise((resolver, rejeitar) => {
    const script = document.createElement("script");
    script.src = SCRIPT_GIS;
    script.async = true;
    script.addEventListener("load", () => resolver(), { once: true });
    script.addEventListener(
      "error",
      () => {
        script.remove();
        carga = null;
        rejeitar(new Error("Falha ao carregar o Google"));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });
  return carga;
}

export function EntrarComGoogle({ clientId }: { clientId: string }) {
  const router = useRouter();
  const lugar = useRef<HTMLDivElement>(null);
  const [mensagem, setMensagem] = useState<string | null>(clientId ? null : "Login indisponível: GOOGLE_CLIENT_ID não configurado.");

  useEffect(() => {
    if (!clientId) return;
    let cancelado = false;
    carregarGis()
      .then(() => {
        const id = window.google?.accounts?.id;
        if (cancelado || !id || !lugar.current) return;
        id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            const resultado = await api.entrar(credential);
            if (resultado.ok) router.refresh();
            else setMensagem(resultado.mensagem);
          },
        });
        id.renderButton(lugar.current, { theme: "outline", size: "large", shape: "pill", locale: "pt-BR", width: 300 });
      })
      .catch(() => {
        if (!cancelado) setMensagem("Não foi possível carregar o botão do Google. Recarregue a página.");
      });
    return () => {
      cancelado = true;
    };
  }, [clientId, router]);

  return (
    <main className="painel-entrar">
      <h1>Painel M.C. Vieira</h1>
      <p>Entre com a conta Google autorizada.</p>
      <div ref={lugar} />
      {mensagem && <p role="alert">{mensagem}</p>}
    </main>
  );
}
```

`src/components/admin/BotaoSair.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/painel/cliente-api";

export function BotaoSair() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await api.sair();
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}
```

- [ ] **Step 5: Layout, lista e CSS do painel**

`src/app/admin/(painel)/layout.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BotaoSair } from "@/components/admin/BotaoSair";
import { EntrarComGoogle } from "@/components/admin/EntrarComGoogle";
import { emailDaSessao } from "@/lib/auth/sessao-servidor";
import { servicos } from "@/lib/servicos";
import "./admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel", robots: { index: false, follow: false } };

export default async function LayoutDoPainel({ children }: { children: ReactNode }) {
  const email = await emailDaSessao();
  return (
    <div className="painel">
      {email ? (
        <>
          <nav className="painel-nav" aria-label="Painel">
            <Link href="/admin">Imóveis</Link>
            <Link href="/admin/flags">Campos visíveis</Link>
            <span className="painel-usuario">{email}</span>
            <BotaoSair />
          </nav>
          {children}
        </>
      ) : (
        <EntrarComGoogle clientId={servicos().config.googleClientId} />
      )}
    </div>
  );
}
```

`src/app/admin/(painel)/page.tsx`:

```tsx
import Link from "next/link";
import type { ParametrosDeBusca } from "@/lib/apresentacao/filtros";
import { formatarData } from "@/lib/apresentacao/formatar";
import { emailDaSessao } from "@/lib/auth/sessao-servidor";
import { filtrarPainel, lerFiltrosPainel, seloEsteveNoAr } from "@/lib/painel/lista";
import { listarImoveis } from "@/lib/repositorio/imoveis";
import { servicos } from "@/lib/servicos";

const ROTULO_STATUS = { disponivel: "Disponível", reservado: "Reservado", vendido: "Vendido", alugado: "Alugado" } as const;

export default async function PainelImoveis({ searchParams }: { searchParams: Promise<ParametrosDeBusca> }) {
  // O layout já mostra o login sem sessão; aqui só evitamos ler o Blob à toa.
  if (!(await emailDaSessao())) return null;
  const parametros = await searchParams;
  const filtros = lerFiltrosPainel(parametros);
  const imoveis = filtrarPainel(await listarImoveis(servicos().armazem), filtros);
  const excluido = typeof parametros.excluido === "string" ? parametros.excluido : null;
  return (
    <main className="painel-conteudo">
      <h1>Imóveis</h1>
      {excluido && <p className="painel-aviso painel-aviso-ok">{excluido} excluído definitivamente.</p>}
      <form method="get" className="painel-filtros">
        <label>
          Publicação
          <select name="publicacao" defaultValue={filtros.publicacao ?? ""}>
            <option value="">Todas</option>
            <option value="rascunho">Rascunho</option>
            <option value="publicado">Publicado</option>
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={filtros.status ?? ""}>
            <option value="">Todos</option>
            {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="painel-caixa">
          <input type="checkbox" name="esteve_no_ar" value="1" defaultChecked={filtros.esteveNoAr} /> Esteve no ar
        </label>
        <button type="submit">Filtrar</button>
      </form>
      <table className="painel-tabela">
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Título</th>
            <th scope="col">Publicação</th>
            <th scope="col">Status</th>
            <th scope="col">Destaque</th>
            <th scope="col">Atualizado</th>
            <th scope="col">Prévia</th>
          </tr>
        </thead>
        <tbody>
          {imoveis.map((imovel) => {
            const selo = seloEsteveNoAr(imovel);
            return (
              <tr key={imovel.codigo}>
                <td>
                  <Link href={`/admin/imoveis/${imovel.codigo}`}>{imovel.codigo}</Link>
                </td>
                <td>{imovel.titulo}</td>
                <td>
                  {imovel.publicacao === "publicado" ? "Publicado" : "Rascunho"}
                  {selo && <span className="painel-selo">{selo}</span>}
                </td>
                <td>{ROTULO_STATUS[imovel.status]}</td>
                <td>{imovel.destaque ? "Sim" : ""}</td>
                <td>{formatarData(imovel.atualizado_em)}</td>
                <td>
                  <Link href={`/admin/previa/${imovel.codigo}`} target="_blank">
                    Ver
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {imoveis.length === 0 && <p>Nenhum imóvel com esses filtros.</p>}
    </main>
  );
}
```

`src/app/admin/(painel)/admin.css`:

```css
.painel { min-height: 100vh; background: #f6f5f2; color: #1d1d1f; font-size: 15px; }
.painel a { color: #1f3a68; text-decoration: underline; text-underline-offset: 2px; }
.painel h1 { font-size: 30px; margin-bottom: 20px; color: #1d1d1f; }
.painel h2 { font-size: 20px; margin: 28px 0 12px; color: #1d1d1f; }
.painel-nav { display: flex; gap: 24px; align-items: center; padding: 16px 32px; background: #0e1726; color: #faf8f4; }
.painel-nav a { color: #faf8f4; }
.painel-usuario { margin-left: auto; font-size: 13px; opacity: 0.85; }
.painel-conteudo { padding: 32px; max-width: 1200px; margin: 0 auto; }
.painel-entrar { min-height: 100vh; display: grid; place-content: center; gap: 16px; text-align: center; }
.painel button { font: inherit; padding: 8px 16px; border: 1px solid #1f3a68; background: #fff; color: #1f3a68; cursor: pointer; border-radius: 4px; }
.painel button:disabled { opacity: 0.5; cursor: not-allowed; }
.painel button.painel-primario { background: #1f3a68; color: #fff; }
.painel button.painel-perigo-botao { border-color: #8b1e2d; color: #8b1e2d; }
.painel input, .painel select, .painel textarea { font: inherit; padding: 8px; border: 1px solid #b9b6ae; border-radius: 4px; background: #fff; color: #1d1d1f; }
.painel label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 500; }
.painel-caixa { flex-direction: row !important; align-items: center; gap: 8px !important; }
.painel-filtros { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 20px; }
.painel-tabela { width: 100%; border-collapse: collapse; background: #fff; }
.painel-tabela th, .painel-tabela td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e3e0d8; vertical-align: top; }
.painel-selo { display: inline-block; margin-left: 8px; font-size: 12px; padding: 2px 8px; background: #f2d6da; color: #5b1320; border-radius: 10px; }
.painel-aviso { padding: 12px 16px; border-radius: 4px; margin: 12px 0; }
.painel-aviso-ok { background: #e3f1e8; color: #154d2b; }
.painel-aviso-erro { background: #f8e1e4; color: #5b1320; }
.painel-grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.painel fieldset { border: 1px solid #e3e0d8; padding: 16px; margin-bottom: 16px; background: #fff; border-radius: 4px; }
.painel legend { font-weight: 600; padding: 0 6px; }
.painel-acoes { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin: 16px 0; }
.painel-confirmacao { border: 2px solid #8b1e2d; background: #fff; padding: 16px; margin: 12px 0; display: grid; gap: 12px; }
.painel-perigo { border: 1px solid #8b1e2d; padding: 16px; margin-top: 32px; background: #fff; display: grid; gap: 12px; }
.painel-historico { font-size: 13px; display: grid; gap: 6px; padding-left: 18px; }
.painel-previa { width: 100%; height: 720px; border: 1px solid #e3e0d8; background: #0e1726; }
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- src/lib/painel && npm run typecheck && npm run lint && npm run build`
Expected: PASS; o build lista `ƒ /admin`.

Com `npm run dev`, abra `http://localhost:3000/admin`.
Expected: tela "Painel M.C. Vieira" com "Entre com a conta Google autorizada." (sem `GOOGLE_CLIENT_ID` local, aparece "Login indisponível: GOOGLE_CLIENT_ID não configurado.").

- [ ] **Step 7: Commit**

```bash
git add apps/site/src/lib/painel/lista.ts apps/site/src/lib/painel/lista.test.ts apps/site/src/lib/painel/cliente-api.ts "apps/site/src/app/admin/(painel)" apps/site/src/components/admin
git commit -m "feat(painel): login com Google e lista de imóveis com filtros e selo 'esteve no ar'"
```

---

### Task 2.8: Painel: edição, ações e exclusão

**Files:**
- Create: `apps/site/src/lib/painel/entrada.ts`, `apps/site/src/lib/painel/confirmacoes.ts`
- Create: `apps/site/src/components/admin/EditorImovel.tsx`, `apps/site/src/app/admin/(painel)/imoveis/[codigo]/page.tsx`
- Test: `apps/site/src/lib/painel/entrada.test.ts`, `apps/site/src/lib/painel/confirmacoes.test.ts`

**Interfaces:**
- Consumes: `api` (`cliente-api.ts`), `CAMPOS_DE_ENTRADA`, `LIMITE_DESTAQUES`, `STATUS_FECHADOS`, `ROTULO_TIPO`, `formatarData`, `lerImovel`, `lerEndereco`, `listarImoveis`.
- Produces:
  ```ts
  // entrada.ts
  entradaDe(imovel: Imovel): ImovelEntrada
  numeroOpcional(texto: string): number | undefined     // "85,5" → 85.5; "" → undefined
  reaisOpcional(texto: string): number | undefined      // "R$ 1.200.000" → 1200000
  alternarOferta(ofertas: Oferta[], negocio: Negocio, ligado: boolean): Oferta[]
  mudarPreco(ofertas: Oferta[], negocio: Negocio, texto: string): Oferta[]
  mudarInclusaoCondominio(ofertas: Oferta[], inclui: boolean | undefined): Oferta[]
  linhasParaLista(texto: string): string[]
  // confirmacoes.ts
  type Confirmacao = { tipo: "digitar_codigo" | "confirmar"; mensagem: string } | null
  confirmacaoDeStatus(atual: Status, novo: Status, codigo: string): Confirmacao
  codigoConfere(digitado: string, codigo: string): boolean
  ```

- [ ] **Step 1: Testes**

`src/lib/painel/entrada.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ImovelEntradaSchema } from "@/lib/contratos/imovel";
import { imovelDeExemplo } from "@/testes/fixtures";
import { alternarOferta, entradaDe, linhasParaLista, mudarInclusaoCondominio, mudarPreco, numeroOpcional, reaisOpcional } from "./entrada";

describe("entrada do formulário", () => {
  it("entradaDe tira os campos calculados pela API e passa no esquema de entrada", () => {
    const entrada = entradaDe(imovelDeExemplo());
    expect(entrada).not.toHaveProperty("codigo");
    expect(entrada).not.toHaveProperty("historico");
    expect(ImovelEntradaSchema.safeParse(entrada).success).toBe(true);
  });

  it("números com vírgula e reais com pontos", () => {
    expect(numeroOpcional("85,5")).toBe(85.5);
    expect(numeroOpcional(" ")).toBeUndefined();
    expect(reaisOpcional("R$ 1.200.000")).toBe(1_200_000);
    expect(reaisOpcional("6.000,00")).toBe(6_000);
    expect(reaisOpcional("")).toBeUndefined();
  });

  it("liga e desliga ofertas sem duplicar", () => {
    const venda = [{ negocio: "venda" as const, preco: 1 }];
    expect(alternarOferta(venda, "aluguel", true)).toEqual([...venda, { negocio: "aluguel" }]);
    expect(alternarOferta(venda, "venda", true)).toEqual(venda);
    expect(alternarOferta(venda, "venda", false)).toEqual([]);
  });

  it("preço vazio vira 'sob consulta' (sem a chave preco)", () => {
    const ofertas = [{ negocio: "venda" as const, preco: 10 }];
    expect(mudarPreco(ofertas, "venda", "")).toEqual([{ negocio: "venda" }]);
    expect(mudarPreco(ofertas, "venda", "900.000")).toEqual([{ negocio: "venda", preco: 900_000 }]);
  });

  it("inclui_condominio só mexe na oferta de aluguel", () => {
    const ofertas = [{ negocio: "venda" as const }, { negocio: "aluguel" as const, preco: 3_000 }];
    expect(mudarInclusaoCondominio(ofertas, true)).toEqual([{ negocio: "venda" }, { negocio: "aluguel", preco: 3_000, inclui_condominio: true }]);
    expect(mudarInclusaoCondominio(mudarInclusaoCondominio(ofertas, true), undefined)).toEqual(ofertas);
  });

  it("comodidades: uma por linha, sem linhas vazias", () => {
    expect(linhasParaLista("Piscina\n\n  Churrasqueira \n")).toEqual(["Piscina", "Churrasqueira"]);
  });
});
```

`src/lib/painel/confirmacoes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { codigoConfere, confirmacaoDeStatus } from "./confirmacoes";

describe("confirmações do painel", () => {
  it("marcar vendido ou alugado pede o código digitado", () => {
    expect(confirmacaoDeStatus("disponivel", "vendido", "MC007")).toEqual({
      tipo: "digitar_codigo",
      mensagem: "Marcar como vendido tira o imóvel do ar na hora. Digite MC007 para confirmar.",
    });
    expect(confirmacaoDeStatus("reservado", "alugado", "MC007")?.tipo).toBe("digitar_codigo");
  });

  it("sair de vendido ou alugado pede confirmação simples", () => {
    expect(confirmacaoDeStatus("vendido", "disponivel", "MC007")).toEqual({
      tipo: "confirmar",
      mensagem: "Este imóvel volta a aparecer na lista. Confirmar?",
    });
  });

  it("disponível ↔ reservado não pede nada", () => {
    expect(confirmacaoDeStatus("disponivel", "reservado", "MC007")).toBeNull();
  });

  it("confere o código sem diferenciar maiúsculas e espaços", () => {
    expect(codigoConfere(" mc007 ", "MC007")).toBe(true);
    expect(codigoConfere("MC008", "MC007")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/painel`
Expected: FAIL com `Failed to resolve import "./entrada"` e `"./confirmacoes"`.

- [ ] **Step 3: Implementar `entrada.ts` e `confirmacoes.ts`**

`src/lib/painel/entrada.ts`:

```ts
import type { Negocio } from "@/lib/contratos/comum";
import { CAMPOS_DE_ENTRADA, type Imovel, type ImovelEntrada, type Oferta } from "@/lib/contratos/imovel";

export function entradaDe(imovel: Imovel): ImovelEntrada {
  const entrada: Record<string, unknown> = {};
  for (const campo of CAMPOS_DE_ENTRADA) if (imovel[campo] !== undefined) entrada[campo] = imovel[campo];
  return entrada as ImovelEntrada;
}

/** Para medidas (input type=number manda ponto; aceitamos vírgula também). */
export function numeroOpcional(texto: string): number | undefined {
  const limpo = texto.trim().replace(",", ".");
  if (!limpo) return undefined;
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : undefined;
}

/** Para preços em reais digitados como "1.200.000" ou "6.000,00": inteiro, sem centavos. */
export function reaisOpcional(texto: string): number | undefined {
  const semCentavos = texto.split(",")[0];
  const digitos = semCentavos.replace(/\D/g, "");
  return digitos ? Number(digitos) : undefined;
}

export function alternarOferta(ofertas: Oferta[], negocio: Negocio, ligado: boolean): Oferta[] {
  if (!ligado) return ofertas.filter((oferta) => oferta.negocio !== negocio);
  return ofertas.some((oferta) => oferta.negocio === negocio) ? ofertas : [...ofertas, { negocio } as Oferta];
}

export function mudarPreco(ofertas: Oferta[], negocio: Negocio, texto: string): Oferta[] {
  const preco = reaisOpcional(texto);
  return ofertas.map((oferta) => {
    if (oferta.negocio !== negocio) return oferta;
    const { preco: _anterior, ...resto } = oferta;
    return (preco === undefined ? resto : { ...resto, preco }) as Oferta;
  });
}

export function mudarInclusaoCondominio(ofertas: Oferta[], inclui: boolean | undefined): Oferta[] {
  return ofertas.map((oferta) => {
    if (oferta.negocio !== "aluguel") return oferta;
    const { inclui_condominio: _anterior, ...resto } = oferta;
    return inclui === undefined ? resto : { ...resto, inclui_condominio: inclui };
  });
}

export function linhasParaLista(texto: string): string[] {
  return texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0);
}
```

`src/lib/painel/confirmacoes.ts`:

```ts
import { STATUS_FECHADOS, type Status } from "@/lib/contratos/comum";

export type Confirmacao = { tipo: "digitar_codigo" | "confirmar"; mensagem: string } | null;

const ROTULO_FECHADO: Partial<Record<Status, string>> = { vendido: "vendido", alugado: "alugado" };

/** Spec seção 6: fechar pede o código digitado; reabrir pede confirmação. */
export function confirmacaoDeStatus(atual: Status, novo: Status, codigo: string): Confirmacao {
  if (STATUS_FECHADOS.has(novo) && !STATUS_FECHADOS.has(atual)) {
    return { tipo: "digitar_codigo", mensagem: `Marcar como ${ROTULO_FECHADO[novo]} tira o imóvel do ar na hora. Digite ${codigo} para confirmar.` };
  }
  if (STATUS_FECHADOS.has(atual) && !STATUS_FECHADOS.has(novo)) {
    return { tipo: "confirmar", mensagem: "Este imóvel volta a aparecer na lista. Confirmar?" };
  }
  return null;
}

export function codigoConfere(digitado: string, codigo: string): boolean {
  return digitado.trim().toUpperCase() === codigo;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- src/lib/painel`
Expected: PASS.

- [ ] **Step 5: Editor (Client Component)**

`src/components/admin/EditorImovel.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatarData, ROTULO_TIPO } from "@/lib/apresentacao/formatar";
import { STATUS, STATUS_FECHADOS, TIPOS, type Status, type Tipo } from "@/lib/contratos/comum";
import type { Imovel, ImovelEntrada } from "@/lib/contratos/imovel";
import { LIMITE_DESTAQUES } from "@/lib/dominio/regras";
import { api } from "@/lib/painel/cliente-api";
import { codigoConfere, confirmacaoDeStatus } from "@/lib/painel/confirmacoes";
import { alternarOferta, entradaDe, linhasParaLista, mudarInclusaoCondominio, mudarPreco, numeroOpcional } from "@/lib/painel/entrada";

const ROTULO_STATUS: Record<Status, string> = { disponivel: "Disponível", reservado: "Reservado", vendido: "Vendido", alugado: "Alugado" };
const MEDIDAS = [
  ["area_util_m2", "Área útil (m²)"],
  ["area_total_m2", "Área total (m²)"],
  ["quartos", "Quartos"],
  ["suites", "Suítes"],
  ["banheiros", "Banheiros"],
  ["vagas", "Vagas"],
  ["condominio", "Condomínio (R$/mês)"],
  ["iptu", "IPTU (R$/mês)"],
] as const;

type Aviso = { tipo: "ok" | "erro" | "conflito"; texto: string; detalhes?: string[] };

interface Props {
  imovel: Imovel;
  etag: string;
  endereco: string | null;
  destaquesDeOutros: number;
}

export function EditorImovel({ imovel: inicial, etag: etagInicial, endereco: enderecoInicial, destaquesDeOutros }: Props) {
  const router = useRouter();
  const [imovel, setImovel] = useState(inicial);
  const [etag, setEtag] = useState(etagInicial);
  const [entrada, setEntrada] = useState<ImovelEntrada>(() => entradaDe(inicial));
  const [endereco, setEndereco] = useState(enderecoInicial ?? "");
  const [enderecoSalvo, setEnderecoSalvo] = useState(enderecoInicial ?? "");
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [statusPendente, setStatusPendente] = useState<Status | null>(null);
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState("");

  const mudar = <K extends keyof ImovelEntrada>(campo: K, valor: ImovelEntrada[K]) => setEntrada((atual) => ({ ...atual, [campo]: valor }));

  async function salvar(mudanca: Partial<ImovelEntrada> = {}) {
    setOcupado(true);
    setAviso(null);
    const novoEndereco = endereco.trim() && endereco.trim() !== enderecoSalvo ? endereco.trim() : undefined;
    const resultado = await api.salvarImovel(imovel.codigo, { ...entrada, ...mudanca }, etag, novoEndereco);
    setOcupado(false);
    if (resultado.ok) {
      setImovel(resultado.dados.imovel);
      setEtag(resultado.dados.etag);
      setEntrada(entradaDe(resultado.dados.imovel));
      if (novoEndereco) setEnderecoSalvo(novoEndereco);
      setAviso({ tipo: "ok", texto: "Salvo." });
      return;
    }
    if (resultado.status === 409) {
      setAviso({ tipo: "conflito", texto: "Outra pessoa alterou este imóvel antes de você. Recarregue para ver a versão nova e refaça a sua mudança." });
      return;
    }
    setAviso({ tipo: "erro", texto: resultado.mensagem, detalhes: resultado.detalhes?.map((detalhe) => `${detalhe.caminho}: ${detalhe.mensagem}`) });
  }

  function pedirStatus(novo: Status) {
    if (novo === entrada.status) return;
    if (confirmacaoDeStatus(entrada.status, novo, imovel.codigo)) {
      setStatusPendente(novo);
      setCodigoDigitado("");
      return;
    }
    void salvar({ status: novo });
  }

  async function excluir() {
    setOcupado(true);
    const resultado = await api.excluirImovel(imovel.codigo, etag, confirmacaoExclusao.trim().toUpperCase());
    setOcupado(false);
    if (resultado.ok) {
      router.push(`/admin?excluido=${imovel.codigo}`);
      return;
    }
    setAviso({ tipo: resultado.status === 409 ? "conflito" : "erro", texto: resultado.mensagem });
  }

  const confirmacao = statusPendente ? confirmacaoDeStatus(entrada.status, statusPendente, imovel.codigo) : null;
  const publicado = imovel.publicacao === "publicado";
  const fechado = STATUS_FECHADOS.has(imovel.status);
  const venda = entrada.ofertas.find((oferta) => oferta.negocio === "venda");
  const aluguel = entrada.ofertas.find((oferta) => oferta.negocio === "aluguel");
  const destaquesEmUso = destaquesDeOutros + (imovel.destaque ? 1 : 0);

  return (
    <main className="painel-conteudo">
      <p>
        <Link href="/admin">Voltar para a lista</Link> · <Link href={`/admin/previa/${imovel.codigo}`} target="_blank">Ver prévia</Link>
      </p>
      <h1>
        {imovel.codigo} · {publicado ? "Publicado" : "Rascunho"} · {ROTULO_STATUS[imovel.status]}
      </h1>

      {aviso && (
        <div className={aviso.tipo === "ok" ? "painel-aviso painel-aviso-ok" : "painel-aviso painel-aviso-erro"} role={aviso.tipo === "ok" ? "status" : "alert"}>
          <p>{aviso.texto}</p>
          {aviso.detalhes && (
            <ul>
              {aviso.detalhes.map((detalhe) => (
                <li key={detalhe}>{detalhe}</li>
              ))}
            </ul>
          )}
          {aviso.tipo === "conflito" && (
            <button type="button" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          )}
        </div>
      )}

      <section className="painel-acoes" aria-label="Ações">
        {publicado ? (
          <button type="button" disabled={ocupado} onClick={() => salvar({ publicacao: "rascunho" })}>
            Retirar do ar
          </button>
        ) : (
          !fechado && (
            <button type="button" className="painel-primario" disabled={ocupado} onClick={() => salvar({ publicacao: "publicado" })}>
              Publicar
            </button>
          )
        )}
        <label>
          Status
          <select value={entrada.status} disabled={ocupado} onChange={(evento) => pedirStatus(evento.target.value as Status)}>
            {STATUS.map((status) => (
              <option key={status} value={status}>
                {ROTULO_STATUS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="painel-caixa">
          <input type="checkbox" checked={entrada.destaque} disabled={!publicado || ocupado} onChange={(evento) => salvar({ destaque: evento.target.checked })} />
          Destaque na home ({destaquesEmUso} de {LIMITE_DESTAQUES} em uso)
        </label>
        <span>As ações também salvam o que estiver alterado no formulário.</span>
      </section>

      {confirmacao && statusPendente && (
        <div className="painel-confirmacao" role="group" aria-label="Confirmar troca de status">
          <p>{confirmacao.mensagem}</p>
          {confirmacao.tipo === "digitar_codigo" && (
            <label>
              Digite {imovel.codigo}
              <input value={codigoDigitado} onChange={(evento) => setCodigoDigitado(evento.target.value)} />
            </label>
          )}
          <div className="painel-acoes">
            <button
              type="button"
              className="painel-primario"
              disabled={ocupado || (confirmacao.tipo === "digitar_codigo" && !codigoConfere(codigoDigitado, imovel.codigo))}
              onClick={async () => {
                const novo = statusPendente;
                setStatusPendente(null);
                await salvar({ status: novo });
              }}
            >
              Confirmar
            </button>
            <button type="button" onClick={() => setStatusPendente(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          void salvar();
        }}
      >
        <fieldset>
          <legend>Ofertas</legend>
          <div className="painel-grade">
            <label className="painel-caixa">
              <input type="checkbox" checked={Boolean(venda)} onChange={(evento) => mudar("ofertas", alternarOferta(entrada.ofertas, "venda", evento.target.checked))} />
              Venda
            </label>
            {venda && (
              <label>
                Preço de venda (R$, vazio = sob consulta)
                <input inputMode="numeric" defaultValue={venda.preco ?? ""} onChange={(evento) => mudar("ofertas", mudarPreco(entrada.ofertas, "venda", evento.target.value))} />
              </label>
            )}
            <label className="painel-caixa">
              <input type="checkbox" checked={Boolean(aluguel)} onChange={(evento) => mudar("ofertas", alternarOferta(entrada.ofertas, "aluguel", evento.target.checked))} />
              Aluguel
            </label>
            {aluguel && (
              <>
                <label>
                  Aluguel por mês (R$, vazio = sob consulta)
                  <input inputMode="numeric" defaultValue={aluguel.preco ?? ""} onChange={(evento) => mudar("ofertas", mudarPreco(entrada.ofertas, "aluguel", evento.target.value))} />
                </label>
                <label>
                  Condomínio no aluguel
                  <select
                    value={aluguel.inclui_condominio === undefined ? "" : String(aluguel.inclui_condominio)}
                    onChange={(evento) => mudar("ofertas", mudarInclusaoCondominio(entrada.ofertas, evento.target.value === "" ? undefined : evento.target.value === "true"))}
                  >
                    <option value="">Não informar</option>
                    <option value="true">Incluso</option>
                    <option value="false">À parte</option>
                  </select>
                </label>
              </>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend>Texto</legend>
          <label>
            Tipo
            <select value={entrada.tipo} onChange={(evento) => mudar("tipo", evento.target.value as Tipo)}>
              {TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ROTULO_TIPO[tipo]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Título (a tese do imóvel em uma frase)
            <input value={entrada.titulo} onChange={(evento) => mudar("titulo", evento.target.value)} />
          </label>
          <label>
            Descrição (parágrafos separados por linha em branco)
            <textarea rows={8} value={entrada.descricao} onChange={(evento) => mudar("descricao", evento.target.value)} />
          </label>
          <label>
            Comodidades (uma por linha)
            <textarea rows={5} defaultValue={entrada.comodidades.join("\n")} onChange={(evento) => mudar("comodidades", linhasParaLista(evento.target.value))} />
          </label>
        </fieldset>

        <fieldset>
          <legend>Local público</legend>
          <div className="painel-grade">
            <label>
              Bairro
              <input value={entrada.bairro} onChange={(evento) => mudar("bairro", evento.target.value)} />
            </label>
            <label>
              Cidade
              <input value={entrada.cidade} onChange={(evento) => mudar("cidade", evento.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Medidas e custos</legend>
          <div className="painel-grade">
            {MEDIDAS.map(([campo, rotulo]) => (
              <label key={campo}>
                {rotulo}
                <input type="number" min={0} step="any" value={entrada[campo] ?? ""} onChange={(evento) => mudar(campo, numeroOpcional(evento.target.value))} />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Endereço completo (só no painel; nunca aparece no site)</legend>
          <label>
            Endereço
            <input value={endereco} onChange={(evento) => setEndereco(evento.target.value)} autoComplete="off" />
          </label>
        </fieldset>

        <button type="submit" className="painel-primario" disabled={ocupado}>
          {ocupado ? "Salvando..." : "Salvar"}
        </button>
      </form>

      <h2>Histórico (últimas 20 alterações)</h2>
      <ol className="painel-historico" reversed>
        {[...imovel.historico].reverse().map((item, indice) => (
          <li key={`${item.em}-${item.campo}-${indice}`}>
            {formatarData(item.em)} · {item.por} · {item.campo}: {item.de ?? "vazio"} → {item.para ?? "vazio"}
          </li>
        ))}
      </ol>

      {!publicado && (
        <section className="painel-perigo" aria-label="Excluir definitivamente">
          <h2>Excluir definitivamente</h2>
          <p>
            Apaga o imóvel, o endereço e as fotos. As fotos não voltam. Os dados ficam no backup por 30 dias. O código {imovel.codigo} não será usado de
            novo.
          </p>
          <label>
            Digite {imovel.codigo} para confirmar
            <input value={confirmacaoExclusao} onChange={(evento) => setConfirmacaoExclusao(evento.target.value)} />
          </label>
          <button type="button" className="painel-perigo-botao" disabled={ocupado || !codigoConfere(confirmacaoExclusao, imovel.codigo)} onClick={excluir}>
            Excluir {imovel.codigo}
          </button>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Página do editor**

`src/app/admin/(painel)/imoveis/[codigo]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { EditorImovel } from "@/components/admin/EditorImovel";
import { emailDaSessao } from "@/lib/auth/sessao-servidor";
import { REGEX_CODIGO } from "@/lib/contratos/comum";
import { lerEndereco, lerImovel, listarImoveis } from "@/lib/repositorio/imoveis";
import { servicos } from "@/lib/servicos";

export default async function PainelEditarImovel({ params }: { params: Promise<{ codigo: string }> }) {
  if (!(await emailDaSessao())) return null;
  const { codigo } = await params;
  if (!REGEX_CODIGO.test(codigo)) notFound();
  const { armazem } = servicos();
  const [lido, endereco, todos] = await Promise.all([lerImovel(armazem, codigo), lerEndereco(armazem, codigo), listarImoveis(armazem)]);
  if (!lido) notFound();
  const destaquesDeOutros = todos.filter((imovel) => imovel.destaque && imovel.codigo !== codigo).length;
  return <EditorImovel imovel={lido.imovel} etag={lido.etag} endereco={endereco?.endereco_completo ?? null} destaquesDeOutros={destaquesDeOutros} />;
}
```

- [ ] **Step 7: Rodar**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS; `ƒ /admin/imoveis/[codigo]` no build. O comportamento no navegador é verificado no e2e da Task 2.10.

- [ ] **Step 8: Commit**

```bash
git add apps/site/src/lib/painel/entrada.ts apps/site/src/lib/painel/entrada.test.ts apps/site/src/lib/painel/confirmacoes.ts apps/site/src/lib/painel/confirmacoes.test.ts apps/site/src/components/admin/EditorImovel.tsx "apps/site/src/app/admin/(painel)/imoveis"
git commit -m "feat(painel): edição de imóvel com publicação, status confirmado, destaque, endereço, histórico e exclusão"
```

---

### Task 2.9: Painel: pré-visualização e campos visíveis

**Files:**
- Create: `apps/site/src/lib/painel/previa.ts`, `apps/site/src/app/admin/previa/[codigo]/page.tsx`
- Create: `apps/site/src/components/admin/EditorFlags.tsx`, `apps/site/src/app/admin/(painel)/flags/page.tsx`
- Test: `apps/site/src/lib/painel/previa.test.ts`

**Interfaces:**
- Consumes: `PaginaImovel` (frente 1), `paraPublico`, `paraFlagsPublicas`, `CampoPublicoSchema`, `LIMITE_PRIMEIRA_DOBRA`, `CAMPOS_PUBLICOS`, `lerFlags`, `lerImovel`, `api.salvarFlags`.
- Produces: `flagsDaPrevia(salvas: FlagsPublicas, parametros: ParametrosDeBusca): FlagsPublicas`; rota `/admin/previa/:codigo?primeira_dobra=a,b&detalhes=c`; `EditorFlags({ flags, etag, codigoPrevia })`; `ROTULO_CAMPO: Record<CampoPublico, string>` exportado por `EditorFlags.tsx` (a frente 4 reaproveita o componente).

- [ ] **Step 1: Teste da sobreposição de flags na prévia**

`src/lib/painel/previa.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FLAGS_PADRAO } from "@/lib/contratos/flags";
import { flagsDaPrevia } from "./previa";

describe("flagsDaPrevia", () => {
  it("sem parâmetros usa as flags salvas", () => {
    expect(flagsDaPrevia(FLAGS_PADRAO, {})).toEqual(FLAGS_PADRAO);
  });

  it("aplica as listas da URL para pré-visualizar antes de salvar", () => {
    expect(flagsDaPrevia(FLAGS_PADRAO, { primeira_dobra: "vagas,iptu", detalhes: "" })).toEqual({ ...FLAGS_PADRAO, primeira_dobra: ["vagas", "iptu"], detalhes: [] });
  });

  it("ignora lista inválida (campo fora do enum ou mais de 4)", () => {
    expect(flagsDaPrevia(FLAGS_PADRAO, { primeira_dobra: "endereco_completo" }).primeira_dobra).toEqual(FLAGS_PADRAO.primeira_dobra);
    expect(flagsDaPrevia(FLAGS_PADRAO, { primeira_dobra: "quartos,suites,vagas,iptu,tipo" }).primeira_dobra).toEqual(FLAGS_PADRAO.primeira_dobra);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/painel/previa.test.ts`
Expected: FAIL com `Failed to resolve import "./previa"`.

- [ ] **Step 3: Implementar `previa.ts`**

```ts
import type { ParametrosDeBusca } from "@/lib/apresentacao/filtros";
import { FlagsEntradaSchema, type FlagsPublicas } from "@/lib/contratos/flags";

const lista = (valor: string | string[] | undefined): string[] | undefined => {
  if (typeof valor !== "string") return undefined;
  return valor.split(",").filter((item) => item.length > 0);
};

/** Só para a prévia do painel: listas da URL por cima das flags salvas, validadas pelo mesmo esquema. */
export function flagsDaPrevia(salvas: FlagsPublicas, parametros: ParametrosDeBusca): FlagsPublicas {
  const resultado = { ...salvas };
  for (const chave of ["primeira_dobra", "detalhes"] as const) {
    const pedida = lista(parametros[chave]);
    if (!pedida) continue;
    const validada = FlagsEntradaSchema.shape[chave].safeParse(pedida);
    if (validada.success) resultado[chave] = validada.data;
  }
  return resultado;
}
```

- [ ] **Step 4: Rota da prévia**

`src/app/admin/previa/[codigo]/page.tsx` (fora do grupo `(painel)` de propósito: renderiza a página do site sem o CSS nem o menu do painel):

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaginaImovel } from "@/components/site/PaginaImovel";
import type { ParametrosDeBusca } from "@/lib/apresentacao/filtros";
import { emailDaSessao } from "@/lib/auth/sessao-servidor";
import { REGEX_CODIGO } from "@/lib/contratos/comum";
import { paraFlagsPublicas } from "@/lib/contratos/flags";
import { paraPublico } from "@/lib/contratos/publico";
import { flagsDaPrevia } from "@/lib/painel/previa";
import { lerFlags } from "@/lib/repositorio/flags";
import { lerImovel } from "@/lib/repositorio/imoveis";
import { servicos } from "@/lib/servicos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Prévia", robots: { index: false, follow: false } };

interface Props {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<ParametrosDeBusca>;
}

export default async function PreviaDoImovel({ params, searchParams }: Props) {
  if (!(await emailDaSessao())) {
    return (
      <main className="pagina">
        <p>
          Entre no <Link href="/admin">painel</Link> para ver a prévia.
        </p>
      </main>
    );
  }
  const { codigo } = await params;
  if (!REGEX_CODIGO.test(codigo)) notFound();
  const { armazem } = servicos();
  const [lido, { flags }] = await Promise.all([lerImovel(armazem, codigo), lerFlags(armazem)]);
  if (!lido) notFound();
  return <PaginaImovel imovel={paraPublico(lido.imovel)} flags={flagsDaPrevia(paraFlagsPublicas(flags), await searchParams)} previa />;
}
```

- [ ] **Step 5: Editor de flags e página**

`src/components/admin/EditorFlags.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CAMPOS_PUBLICOS, LIMITE_PRIMEIRA_DOBRA, type CampoPublico, type Flags } from "@/lib/contratos/flags";
import { api } from "@/lib/painel/cliente-api";

export const ROTULO_CAMPO: Record<CampoPublico, string> = {
  area_util_m2: "Área útil",
  area_total_m2: "Área total",
  quartos: "Quartos (com suítes)",
  suites: "Suítes",
  banheiros: "Banheiros",
  vagas: "Vagas",
  condominio: "Condomínio",
  iptu: "IPTU",
  tipo: "Tipo",
};

interface Props {
  flags: Flags;
  etag: string | null;
  codigoPrevia: string | null;
}

export function EditorFlags({ flags, etag: etagInicial, codigoPrevia }: Props) {
  const [primeira, setPrimeira] = useState<CampoPublico[]>(flags.primeira_dobra);
  const [detalhes, setDetalhes] = useState<CampoPublico[]>(flags.detalhes);
  const [etag, setEtag] = useState(etagInicial);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const cheia = primeira.length >= LIMITE_PRIMEIRA_DOBRA;

  const alternar = (lista: CampoPublico[], definir: (nova: CampoPublico[]) => void, campo: CampoPublico, ligado: boolean) =>
    definir(ligado ? [...lista, campo] : lista.filter((item) => item !== campo));

  async function salvar() {
    setOcupado(true);
    const resultado = await api.salvarFlags({ primeira_dobra: primeira, detalhes, eventos_ativos: flags.eventos_ativos }, etag);
    setOcupado(false);
    if (resultado.ok) {
      setEtag(resultado.dados.etag);
      setAviso({ ok: true, texto: "Salvo. O site já mostra os campos novos." });
    } else {
      setAviso({ ok: false, texto: resultado.status === 409 ? "Outra pessoa alterou os campos antes de você. Recarregue a página." : resultado.mensagem });
    }
  }

  const srcPrevia = codigoPrevia ? `/admin/previa/${codigoPrevia}?primeira_dobra=${primeira.join(",")}&detalhes=${detalhes.join(",")}` : null;

  return (
    <>
      {aviso && (
        <p className={aviso.ok ? "painel-aviso painel-aviso-ok" : "painel-aviso painel-aviso-erro"} role={aviso.ok ? "status" : "alert"}>
          {aviso.texto}
        </p>
      )}
      <div className="painel-grade">
        <fieldset>
          <legend>
            Primeira dobra (máximo {LIMITE_PRIMEIRA_DOBRA}; o preço já aparece sempre)
          </legend>
          {CAMPOS_PUBLICOS.map((campo) => {
            const marcado = primeira.includes(campo);
            return (
              <label key={campo} className="painel-caixa">
                <input
                  type="checkbox"
                  name={`primeira-${campo}`}
                  checked={marcado}
                  disabled={!marcado && cheia}
                  onChange={(evento) => alternar(primeira, setPrimeira, campo, evento.target.checked)}
                />
                {ROTULO_CAMPO[campo]}
              </label>
            );
          })}
          {cheia && <p>Já são {LIMITE_PRIMEIRA_DOBRA} campos. Desmarque um para trocar.</p>}
        </fieldset>
        <fieldset>
          <legend>Detalhes</legend>
          {CAMPOS_PUBLICOS.map((campo) => (
            <label key={campo} className="painel-caixa">
              <input
                type="checkbox"
                name={`detalhes-${campo}`}
                checked={detalhes.includes(campo)}
                onChange={(evento) => alternar(detalhes, setDetalhes, campo, evento.target.checked)}
              />
              {ROTULO_CAMPO[campo]}
            </label>
          ))}
        </fieldset>
      </div>
      <button type="button" className="painel-primario" disabled={ocupado} onClick={salvar}>
        {ocupado ? "Salvando..." : "Salvar campos visíveis"}
      </button>
      {srcPrevia && (
        <>
          <h2>Pré-visualização ({codigoPrevia})</h2>
          <iframe className="painel-previa" title={`Prévia do imóvel ${codigoPrevia}`} src={srcPrevia} />
        </>
      )}
    </>
  );
}
```

`src/app/admin/(painel)/flags/page.tsx`:

```tsx
import { EditorFlags } from "@/components/admin/EditorFlags";
import { emailDaSessao } from "@/lib/auth/sessao-servidor";
import { lerFlags } from "@/lib/repositorio/flags";
import { listarImoveis } from "@/lib/repositorio/imoveis";
import { servicos } from "@/lib/servicos";

export default async function PainelFlags() {
  if (!(await emailDaSessao())) return null;
  const { armazem } = servicos();
  const [{ flags, etag }, imoveis] = await Promise.all([lerFlags(armazem), listarImoveis(armazem)]);
  const exemplo = imoveis.find((imovel) => imovel.publicacao === "publicado") ?? imoveis[0];
  return (
    <main className="painel-conteudo">
      <h1>Campos visíveis</h1>
      <EditorFlags flags={flags} etag={etag} codigoPrevia={exemplo?.codigo ?? null} />
    </main>
  );
}
```

- [ ] **Step 6: Rodar**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS; o build lista `ƒ /admin/flags` e `ƒ /admin/previa/[codigo]`.

- [ ] **Step 7: Commit**

```bash
git add apps/site/src/lib/painel/previa.ts apps/site/src/lib/painel/previa.test.ts "apps/site/src/app/admin/previa" apps/site/src/components/admin/EditorFlags.tsx "apps/site/src/app/admin/(painel)/flags"
git commit -m "feat(painel): pré-visualização de qualquer imóvel e edição dos campos visíveis com prévia ao vivo"
```

---

### Task 2.10: E2E do painel refletido no site

Pré-requisito: frente 1 em `main` (fixtures `MC010` e `MC011`, `e2e/ambiente.ts`, Playwright configurado).

**Files:**
- Create: `apps/site/e2e/painel.spec.ts`, `apps/site/e2e/sessao.ts`
- Modify: `apps/site/playwright.config.ts` (o projeto `celular` ignora os specs do painel)

**Interfaces:**
- Consumes: `emitirSessao`, `SEGREDO_JWT_E2E`, fixtures `MC010` (apartamento publicado, venda) e `MC011` (rascunho).
- Produces: `entrarNoPainel(context: BrowserContext, email?: string): Promise<void>` (a frente 4 reutiliza). Convenção: spec cujo nome começa com `painel` roda só no desktop.

- [ ] **Step 1: Sessão forjada com o segredo de teste e painel só no desktop**

Em `apps/site/playwright.config.ts`, troque a linha do projeto `celular` por:

```ts
    { name: "celular", use: { ...devices["Pixel 7"] }, testIgnore: /painel.*\.spec\.ts/ },
```

`apps/site/e2e/sessao.ts`:

```ts
import type { BrowserContext } from "@playwright/test";
import { emitirSessao } from "../src/lib/auth/sessao-jwt";
import { SEGREDO_JWT_E2E } from "./ambiente";

/**
 * O Google não entra no e2e: emitimos o mesmo JWT que o login emitiria, com o segredo do servidor de teste.
 * secure: false porque o servidor de teste é http e o APIRequestContext do Playwright também precisa mandar o cookie.
 */
export async function entrarNoPainel(context: BrowserContext, email = "gabriela@exemplo.com"): Promise<void> {
  const { token } = emitirSessao(email, SEGREDO_JWT_E2E, 3600);
  await context.addCookies([{ name: "mcv_sessao", value: token, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" }]);
}
```

- [ ] **Step 2: Testes**

`apps/site/e2e/painel.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { entrarNoPainel } from "./sessao";

test.describe.configure({ mode: "serial" });

async function abrirEditor(page: Page, codigo: string) {
  await page.goto(`/admin/imoveis/${codigo}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(codigo);
}

test.beforeEach(async ({ context }) => {
  await entrarNoPainel(context);
});

test("sem sessão, o painel pede login do Google", async ({ browser }) => {
  const anonimo = await browser.newPage();
  await anonimo.goto("/admin");
  await expect(anonimo.getByText("Entre com a conta Google autorizada.")).toBeVisible();
  await anonimo.close();
});

test("lista mostra rascunho e publicado", async ({ page }) => {
  await page.goto("/admin?publicacao=rascunho");
  await expect(page.getByRole("link", { name: "MC011" })).toBeVisible();
  await expect(page.getByRole("link", { name: "MC010" })).toHaveCount(0);
});

test("flag alterada no painel aparece no site", async ({ page }) => {
  await page.goto("/admin/flags");
  await page.locator('input[name="primeira-vagas"]').check();
  await page.getByRole("button", { name: "Salvar campos visíveis" }).click();
  await expect(page.getByRole("status")).toHaveText("Salvo. O site já mostra os campos novos.");
  await page.goto("/imoveis/MC010");
  await expect(page.locator(".imovel-dobra")).toContainText("vagas");
  // volta ao padrão
  await page.goto("/admin/flags");
  await page.locator('input[name="primeira-vagas"]').uncheck();
  await page.getByRole("button", { name: "Salvar campos visíveis" }).click();
  await expect(page.getByRole("status")).toBeVisible();
});

test("retirar do ar e publicar refletem no site", async ({ page }) => {
  await abrirEditor(page, "MC010");
  await page.getByRole("button", { name: "Retirar do ar" }).click();
  await expect(page.getByRole("status")).toHaveText("Salvo.");
  expect((await page.request.get("/imoveis/MC010")).status()).toBe(404);
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByRole("status")).toHaveText("Salvo.");
  expect((await page.request.get("/imoveis/MC010")).status()).toBe(200);
});

test("marcar vendido pede o código, tira do ar e mostra 'esteve no ar'", async ({ page }) => {
  await abrirEditor(page, "MC010");
  await page.getByLabel("Status").selectOption("vendido");
  const confirmar = page.getByRole("button", { name: "Confirmar" });
  await expect(confirmar).toBeDisabled();
  await page.getByLabel("Digite MC010").fill("mc010");
  await confirmar.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("MC010 · Rascunho · Vendido");
  expect((await page.request.get("/imoveis/MC010")).status()).toBe(404);
  await page.goto("/admin?esteve_no_ar=1");
  await expect(page.getByRole("row", { name: /MC010/ })).toContainText("Esteve no ar até");

  // restaura: volta a disponível (confirmação simples) e publica
  await abrirEditor(page, "MC010");
  await page.getByLabel("Status").selectOption("disponivel");
  await expect(page.getByText("Este imóvel volta a aparecer na lista. Confirmar?")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("status")).toHaveText("Salvo.");
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByRole("status")).toHaveText("Salvo.");
});

test("edição concorrente mostra o aviso de conflito", async ({ page, context }) => {
  const outra = await context.newPage();
  await abrirEditor(page, "MC010");
  await abrirEditor(outra, "MC010");
  await page.getByLabel("Título (a tese do imóvel em uma frase)").fill("Apartamento usado nos testes do painel, versão A");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("status")).toHaveText("Salvo.");
  await outra.getByLabel("Título (a tese do imóvel em uma frase)").fill("Apartamento usado nos testes do painel, versão B");
  await outra.getByRole("button", { name: "Salvar" }).click();
  await expect(outra.getByRole("alert")).toContainText("Outra pessoa alterou este imóvel");
  await outra.close();
});

test("prévia de um rascunho mostra a página como ficaria", async ({ page }) => {
  await page.goto("/admin/previa/MC011");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Casa em rascunho usada nos testes do painel");
  expect((await page.request.get("/imoveis/MC011")).status()).toBe(404);
});
```

- [ ] **Step 3: Rodar**

Run: `npm run test:e2e`
Expected: PASS em todos os specs (os da frente 1 e o `painel.spec.ts`, este só no projeto `desktop`).

- [ ] **Step 4: Commit e fechamento da frente 2**

```bash
cd /Users/felipemartucci/PycharmProjects/real-state-platform
git status --short
git add apps/site/e2e/painel.spec.ts apps/site/e2e/sessao.ts apps/site/playwright.config.ts
git commit -m "test(painel): e2e de flags, publicação, vendido e conflito refletidos no site"
git pull --rebase origin main
npm --prefix apps/site test
```

Entregue ao humano, como texto (não execute):

```bash
git push -u origin feat/site-novo-api-painel
```
