# Frente 0: Fundação (estrutura, contratos, armazém, repositório)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar pronto o app Next.js em `apps/site/` com os contratos (esquemas zod), a porta de armazenamento com adaptadores arquivo/Vercel/indisponível, o repositório de imóveis e flags, a geração de código e as verificações reais do Blob. Isso desbloqueia as frentes 1 a 4.

**Architecture:** Leia `README.md` desta pasta antes (Global Constraints, Ajustes ao spec, Review Focus). Os contratos são a fonte de tipos de todo o app. O armazenamento é uma interface (`ArmazemJson`, `ArmazemFotos`); os testes usam o adaptador de arquivo num diretório temporário, que reproduz `ifMatch` e `allowOverwrite: false` do Blob.

**Tech Stack:** Next.js 16.4.1, TypeScript 5.9.3, zod 4.6.7, @vercel/blob 2.8.2, Vitest 4.1.12, tsx 4.23.15.

**Spec:** `docs/superpowers/specs/2026-10-15-site-novo-mc-vieira-design.md` (seções 3, 4, 11 item 0, 12, 14)

**Branch:** `git checkout -b feat/site-novo-fundacao` a partir de `main` atualizado.

**Comandos (sempre dentro de `apps/site/`):** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

---

### Task 0.1: Scaffold do app e ferramentas de teste

**Files:**
- Create: `apps/site/` (via create-next-app)
- Modify: `apps/site/package.json`, `apps/site/next.config.ts`, `apps/site/.gitignore`, `apps/site/src/app/layout.tsx`, `apps/site/src/app/page.tsx`, `apps/site/src/app/globals.css`
- Create: `apps/site/vitest.config.ts`, `apps/site/.env.exemplo`, `apps/site/public/marca/logo-horizontal-branco.svg`, `apps/site/public/marca/simbolo-branco.svg`, `apps/site/src/lib/sanidade.test.ts`
- Modify: `.gitignore` (raiz)

**Interfaces:**
- Produces: scripts npm `test`, `typecheck`, `lint`, `build`, `dev`, `start`; alias `@/` → `src/`.

- [ ] **Step 1: Gerar o app**

```bash
cd /Users/felipemartucci/PycharmProjects/real-state-platform
mkdir -p apps && cd apps
npx -y create-next-app@16.4.1 site --ts --eslint --app --src-dir --import-alias "@/*" --use-npm --no-tailwind --no-react-compiler --no-agent-feedback --disable-git --yes
```

Expected: `Success! Created site at .../apps/site`. Confira que existem `apps/site/AGENTS.md`, `eslint.config.mjs`, `next.config.ts`, `src/app/layout.tsx`. O `AGENTS.md` avisa que esta versão do Next mudou APIs: a documentação certa está em `apps/site/node_modules/next/dist/docs/`. Consulte-a antes de usar qualquer API do Next que não esteja escrita neste plano.

- [ ] **Step 2: Remover o boilerplate**

```bash
cd /Users/felipemartucci/PycharmProjects/real-state-platform/apps/site
rm -f public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg src/app/page.module.css README.md
mkdir -p public/marca
cp "../../Site MC Vieira/01-logo/logo-horizontal-branco.svg" public/marca/
cp "../../Site MC Vieira/01-logo/simbolo-branco.svg" public/marca/
```

- [ ] **Step 3: Instalar dependências com versão exata**

```bash
cd /Users/felipemartucci/PycharmProjects/real-state-platform/apps/site
npm i --save-exact zod@4.6.7 @vercel/blob@2.8.2 google-auth-library@11.3.0
npm i -D --save-exact vitest@4.1.12 typescript@5.9.3 @types/node@22.20.5 tsx@4.23.15 sharp@0.35.5 papaparse@5.7.0 @types/papaparse@5.5.2 @playwright/test@1.64.1 @axe-core/playwright@4.14.0
```

Depois, edite `package.json` e troque qualquer `^` restante (`@types/react`, `@types/react-dom`, `eslint`) pela versão instalada que aparece em `package-lock.json`.

- [ ] **Step 4: Scripts e engines no `package.json`**

Substitua o bloco `"scripts"` e acrescente `"engines"`:

```json
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "verificar:blob": "node --env-file=.env.local --import tsx scripts/verificar-blob.ts"
  },
```

- [ ] **Step 5: `next.config.ts` sem Cache Components**

```ts
import type { NextConfig } from "next";

// Sem cacheComponents/partialPrefetching: o app usa o modelo unstable_cache + revalidateTag,
// documentado em node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 6: `vitest.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
  },
});
```

- [ ] **Step 7: Layout, página e CSS mínimos**

`src/app/layout.tsx` (a frente 1 substitui por completo):

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "M.C. Vieira Imóveis",
  description: "Imóveis selecionados em Embu-Guaçu e região.",
};

// Tipos explícitos em vez de LayoutProps<"/">: o `tsc --noEmit` roda sem os tipos que só o build gera.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx` (a frente 1, Task 1.6, substitui):

```tsx
export default function Home() {
  return (
    <main>
      <h1>M.C. Vieira Imóveis</h1>
    </main>
  );
}
```

`src/app/globals.css`:

```css
:root {
  --noite: #0e1726;
  --off: #faf8f4;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--noite); color: var(--off); }
```

- [ ] **Step 8: `.gitignore` do app e da raiz, e `.env.exemplo`**

Acrescente ao fim de `apps/site/.gitignore`:

```
!.env.exemplo
.dados-local/
.dados-e2e/
public/e2e-fotos/
test-results/
playwright-report/
```

Crie `/Users/felipemartucci/PycharmProjects/real-state-platform/.gitignore` (raiz):

```
.DS_Store
# Material de marca e fotos originais: fica fora do git (decisão 8 do spec). Logos usados pelo app são copiados para apps/site/public/marca/.
Site MC Vieira/
```

Crie `apps/site/.env.exemplo` (valores fictícios; copie para `.env.local` e preencha):

```
# Armazém: vercel (produção) | arquivo (dev e testes) | indisponivel (simula Blob fora do ar)
ARMAZEM_DRIVER=arquivo
ARMAZEM_DIR=.dados-local
# Opcional: diretório das fotos no driver arquivo (padrão: $ARMAZEM_DIR/publico)
ARMAZEM_FOTOS_DIR=
# Tokens dos dois stores (criados ao conectar cada store com o prefixo indicado)
BLOB_PRIVADO_READ_WRITE_TOKEN=
BLOB_PUBLICO_READ_WRITE_TOKEN=
# Origem das URLs de foto, sem barra final. Ex.: https://abc123.public.blob.vercel-storage.com
FOTOS_ORIGEM=http://localhost:3000/dev-fotos
AUTH_JWT_SECRET=troque-por-32-ou-mais-caracteres-aleatorios
AUTH_JWT_TTL_HORAS=8
GOOGLE_CLIENT_ID=
AUTH_ALLOWLIST=
SKILL_API_SECRET=
CRON_SECRET=
```

- [ ] **Step 9: Teste de sanidade do Vitest**

`src/lib/sanidade.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("ambiente de teste", () => {
  it("resolve o alias @/", async () => {
    const modulo = await import("@/lib/sanidade-alvo");
    expect(modulo.NOME_DO_SITE).toBe("M.C. Vieira Imóveis");
  });
});
```

Run: `npm test`
Expected: FAIL com `Failed to resolve import "@/lib/sanidade-alvo"`.

Crie `src/lib/sanidade-alvo.ts`:

```ts
export const NOME_DO_SITE = "M.C. Vieira Imóveis";
```

Run: `npm test`
Expected: PASS, 1 teste.

- [ ] **Step 10: Build, typecheck e lint verdes**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: os três sem erro. O build lista `○ /` como rota.

- [ ] **Step 11: Commit**

```bash
cd /Users/felipemartucci/PycharmProjects/real-state-platform
git status --short
git add .gitignore apps/site/.gitignore apps/site/.env.exemplo apps/site/AGENTS.md apps/site/eslint.config.mjs apps/site/next.config.ts apps/site/package.json apps/site/package-lock.json apps/site/tsconfig.json apps/site/vitest.config.ts apps/site/public/marca apps/site/src
git commit -m "chore(site): cria app Next.js em apps/site com Vitest e versões fixas"
```

---

### Task 0.2: Contratos do imóvel

**Files:**
- Create: `apps/site/src/lib/contratos/comum.ts`, `apps/site/src/lib/contratos/imovel.ts`
- Create: `apps/site/src/testes/fixtures.ts`
- Test: `apps/site/src/lib/contratos/imovel.test.ts`

**Interfaces:**
- Produces (`comum.ts`): `REGEX_CODIGO`, `CodigoSchema`, `TIPOS`, `TipoSchema`, `Tipo`, `STATUS`, `StatusSchema`, `Status`, `STATUS_FECHADOS`, `PUBLICACOES`, `PublicacaoSchema`, `Publicacao`, `NEGOCIOS`, `NegocioSchema`, `Negocio`, `DataIsoSchema`, `textoSemEmoji(min, max)`.
- Produces (`imovel.ts`): `LARGURAS_FOTO = [800, 1600, 2560]`, `Largura`, `REGEX_URL_FOTO`, `FotoSchema`/`Foto`, `OfertaSchema`/`Oferta`, `HistoricoItemSchema`/`HistoricoItem`, `ImovelEntradaSchema`/`ImovelEntrada`, `ImovelSchema`/`Imovel`, `EnderecoSchema`/`Endereco`, `ReservaSchema`/`Reserva`, `LapideSchema`/`Lapide`, `CAMPOS_DE_ENTRADA`.
- Produces (`src/testes/fixtures.ts`): `ORIGEM_FOTOS_TESTE`, `PLACEHOLDER_TESTE`, `fotosDeExemplo(codigo, quantidade?, origem?)`, `entradaDeExemplo(sobrescrever?)`, `imovelDeExemplo(sobrescrever?)`.

- [ ] **Step 1: Escrever os testes do contrato**

`src/lib/contratos/imovel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EnderecoSchema, ImovelEntradaSchema, ImovelSchema } from "./imovel";
import { entradaDeExemplo, fotosDeExemplo, imovelDeExemplo } from "@/testes/fixtures";

const mensagens = (resultado: { success: boolean; error?: { issues: { message: string }[] } }) =>
  resultado.error?.issues.map((issue) => issue.message) ?? [];

describe("ImovelEntradaSchema", () => {
  it("aceita a entrada de exemplo", () => {
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo()).success).toBe(true);
  });

  it("recusa tipo fora do enum", () => {
    const resultado = ImovelEntradaSchema.safeParse({ ...entradaDeExemplo(), tipo: "sobrado" });
    expect(resultado.success).toBe(false);
  });

  it("recusa chave desconhecida (esquema fechado)", () => {
    const resultado = ImovelEntradaSchema.safeParse({ ...entradaDeExemplo(), endereco: "Rua X, 10" });
    expect(resultado.success).toBe(false);
  });

  it("aceita uma oferta de venda e uma de aluguel", () => {
    const entrada = entradaDeExemplo({
      ofertas: [
        { negocio: "venda", preco: 1_200_000 },
        { negocio: "aluguel", preco: 6_000, inclui_condominio: true },
      ],
    });
    expect(ImovelEntradaSchema.safeParse(entrada).success).toBe(true);
  });

  it("recusa duas ofertas do mesmo negócio", () => {
    const entrada = entradaDeExemplo({
      ofertas: [
        { negocio: "venda", preco: 1 },
        { negocio: "venda", preco: 2 },
      ],
    });
    expect(mensagens(ImovelEntradaSchema.safeParse(entrada))).toContain("No máximo uma oferta de cada negócio");
  });

  it("recusa lista de ofertas vazia", () => {
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo({ ofertas: [] })).success).toBe(false);
  });

  it("aceita oferta sem preço (preço sob consulta)", () => {
    const entrada = entradaDeExemplo({ ofertas: [{ negocio: "venda" }] });
    expect(ImovelEntradaSchema.safeParse(entrada).success).toBe(true);
  });

  it("recusa inclui_condominio na oferta de venda", () => {
    const entrada = { ...entradaDeExemplo(), ofertas: [{ negocio: "venda", preco: 1, inclui_condominio: true }] };
    expect(ImovelEntradaSchema.safeParse(entrada).success).toBe(false);
  });

  it("recusa preço não inteiro", () => {
    const entrada = entradaDeExemplo({ ofertas: [{ negocio: "venda", preco: 10.5 }] });
    expect(ImovelEntradaSchema.safeParse(entrada).success).toBe(false);
  });

  it("recusa vendido sem oferta de venda", () => {
    const entrada = entradaDeExemplo({ status: "vendido", ofertas: [{ negocio: "aluguel", preco: 3_000 }] });
    expect(mensagens(ImovelEntradaSchema.safeParse(entrada))).toContain(
      "Vendido só vale para imóvel com oferta de venda",
    );
  });

  it("recusa alugado sem oferta de aluguel", () => {
    const entrada = entradaDeExemplo({ status: "alugado", ofertas: [{ negocio: "venda", preco: 3_000 }] });
    expect(mensagens(ImovelEntradaSchema.safeParse(entrada))).toContain(
      "Alugado só vale para imóvel com oferta de aluguel",
    );
  });

  it("recusa emoji no título e na descrição", () => {
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo({ titulo: "Casa linda com piscina 🏠" })).success).toBe(false);
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo({ descricao: "Ótima ✨" })).success).toBe(false);
  });

  it("aceita acentos, travessão e números no título", () => {
    expect(
      ImovelEntradaSchema.safeParse(entradaDeExemplo({ titulo: "Casa térrea – 3 quartos e jardim amplo" })).success,
    ).toBe(true);
  });

  it("recusa mais suítes que quartos", () => {
    expect(mensagens(ImovelEntradaSchema.safeParse(entradaDeExemplo({ quartos: 2, suites: 3 })))).toContain(
      "Suítes não podem passar do número de quartos",
    );
  });

  it("recusa fotos com ordem repetida ou fora de sequência", () => {
    const fotos = fotosDeExemplo("MC001", 2);
    fotos[1] = { ...fotos[1], ordem: 1 };
    expect(mensagens(ImovelEntradaSchema.safeParse(entradaDeExemplo({ fotos })))).toContain(
      "As fotos precisam de ordem 1, 2, 3... sem repetir",
    );
  });

  it("recusa imóvel sem foto", () => {
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo({ fotos: [] })).success).toBe(false);
  });

  it("recusa URL de foto que não é .webp no caminho de fotos de um imóvel", () => {
    const fotos = fotosDeExemplo("MC001", 1);
    fotos[0] = { ...fotos[0], larguras: { ...fotos[0].larguras, "800": "https://x.com/foto.jpg" } };
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo({ fotos })).success).toBe(false);
  });

  it("recusa placeholder que não é data URI WebP", () => {
    const fotos = fotosDeExemplo("MC001", 1);
    fotos[0] = { ...fotos[0], placeholder: "https://x.com/p.webp" };
    expect(ImovelEntradaSchema.safeParse(entradaDeExemplo({ fotos })).success).toBe(false);
  });
});

describe("ImovelSchema (persistido)", () => {
  it("aceita o imóvel de exemplo", () => {
    const resultado = ImovelSchema.safeParse(imovelDeExemplo());
    expect(resultado.error?.issues ?? []).toEqual([]);
  });

  it("recusa código fora do formato MC + 3 dígitos", () => {
    expect(ImovelSchema.safeParse(imovelDeExemplo({ codigo: "MC12" })).success).toBe(false);
    expect(ImovelSchema.safeParse(imovelDeExemplo({ codigo: "mc012" })).success).toBe(false);
    expect(ImovelSchema.safeParse(imovelDeExemplo({ codigo: "MC0123" })).success).toBe(false);
  });

  it("recusa foto de outro imóvel", () => {
    const imovel = imovelDeExemplo({ codigo: "MC002", fotos: fotosDeExemplo("MC001", 1) });
    expect(mensagens(ImovelSchema.safeParse(imovel))).toContain("Foto aponta para outro imóvel");
  });

  it("recusa vendido publicado (vendido sai do ar)", () => {
    const imovel = imovelDeExemplo({ status: "vendido", publicacao: "publicado" });
    expect(mensagens(ImovelSchema.safeParse(imovel))).toContain("Vendido ou alugado fica em rascunho");
  });

  it("recusa destaque em rascunho", () => {
    const imovel = imovelDeExemplo({ publicacao: "rascunho", destaque: true });
    expect(mensagens(ImovelSchema.safeParse(imovel))).toContain("Destaque só vale para imóvel publicado");
  });

  it("recusa histórico com mais de 20 itens", () => {
    const item = { em: "2026-10-15T12:00:00.000Z", por: "skill", campo: "titulo", de: "a", para: "b" };
    const imovel = imovelDeExemplo({ historico: Array.from({ length: 21 }, () => item) });
    expect(ImovelSchema.safeParse(imovel).success).toBe(false);
  });
});

describe("EnderecoSchema", () => {
  it("aceita endereço completo com código", () => {
    const endereco = { codigo: "MC001", endereco_completo: "Rua das Flores, 120, Embu-Guaçu", atualizado_em: "2026-10-15T12:00:00.000Z" };
    expect(EnderecoSchema.safeParse(endereco).success).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/contratos/imovel.test.ts`
Expected: FAIL com `Failed to resolve import "./imovel"`.

- [ ] **Step 3: Implementar `comum.ts`**

```ts
import { z } from "zod";

export const REGEX_CODIGO = /^MC\d{3}$/;
export const CodigoSchema = z.string().regex(REGEX_CODIGO, "Código deve ser MC seguido de 3 dígitos");

export const TIPOS = [
  "apartamento",
  "casa",
  "casa_condominio",
  "terreno",
  "cobertura",
  "sala_comercial",
  "galpao",
  "chacara",
] as const;
export const TipoSchema = z.enum(TIPOS);
export type Tipo = z.infer<typeof TipoSchema>;

export const STATUS = ["disponivel", "reservado", "vendido", "alugado"] as const;
export const StatusSchema = z.enum(STATUS);
export type Status = z.infer<typeof StatusSchema>;
/** Status que tiram o imóvel do mercado: o imóvel volta a rascunho na mesma gravação. */
export const STATUS_FECHADOS: ReadonlySet<Status> = new Set(["vendido", "alugado"]);

export const PUBLICACOES = ["rascunho", "publicado"] as const;
export const PublicacaoSchema = z.enum(PUBLICACOES);
export type Publicacao = z.infer<typeof PublicacaoSchema>;

export const NEGOCIOS = ["venda", "aluguel"] as const;
export const NegocioSchema = z.enum(NEGOCIOS);
export type Negocio = z.infer<typeof NegocioSchema>;

export const DataIsoSchema = z.iso.datetime();

const EMOJI = /\p{Extended_Pictographic}/u;

/** Texto livre do site: aparado, com limites, e sem emoji (regra do spec, seção 4.1). */
export function textoSemEmoji(minimo: number, maximo: number) {
  return z
    .string()
    .trim()
    .min(minimo)
    .max(maximo)
    .refine((texto) => !EMOJI.test(texto), "Sem emoji");
}
```

- [ ] **Step 4: Implementar `imovel.ts`**

```ts
import { z } from "zod";
import {
  CodigoSchema,
  DataIsoSchema,
  PublicacaoSchema,
  STATUS_FECHADOS,
  StatusSchema,
  TipoSchema,
  textoSemEmoji,
} from "./comum";

export const LARGURAS_FOTO = [800, 1600, 2560] as const;
export type Largura = (typeof LARGURAS_FOTO)[number];

/** Caminho de foto no store público: imoveis/<codigo>/fotos/<arquivo>.webp. O grupo 1 é o código. */
export const REGEX_URL_FOTO = /\/imoveis\/(MC\d{3})\/fotos\/[A-Za-z0-9._-]+\.webp$/;

const UrlFotoSchema = z.url().refine((url) => REGEX_URL_FOTO.test(url), "URL de foto fora do padrão");

export const FotoSchema = z.strictObject({
  ordem: z.int().min(1),
  legenda: z.string().trim().max(140).optional(),
  larguras: z.strictObject({ "800": UrlFotoSchema, "1600": UrlFotoSchema, "2560": UrlFotoSchema }),
  placeholder: z.string().startsWith("data:image/webp;base64,").max(4000),
});
export type Foto = z.infer<typeof FotoSchema>;

const PrecoSchema = z.int().positive();

export const OfertaSchema = z.discriminatedUnion("negocio", [
  z.strictObject({ negocio: z.literal("venda"), preco: PrecoSchema.optional() }),
  z.strictObject({
    negocio: z.literal("aluguel"),
    preco: PrecoSchema.optional(),
    inclui_condominio: z.boolean().optional(),
  }),
]);
export type Oferta = z.infer<typeof OfertaSchema>;

export const HistoricoItemSchema = z.strictObject({
  em: DataIsoSchema,
  por: z.string().min(1),
  campo: z.string().min(1),
  de: z.string().nullable(),
  para: z.string().nullable(),
});
export type HistoricoItem = z.infer<typeof HistoricoItemSchema>;

const Contagem = z.int().min(0).max(50);
const Area = z.number().positive().max(1_000_000);
const ReaisPorMes = z.int().min(0);

/** Campos que quem grava envia. O resto do imóvel (código, datas, histórico) é a API que calcula. */
const camposDeEntrada = {
  tipo: TipoSchema,
  status: StatusSchema,
  publicacao: PublicacaoSchema,
  ofertas: z.array(OfertaSchema).min(1).max(2),
  titulo: textoSemEmoji(10, 120),
  descricao: textoSemEmoji(1, 5000),
  bairro: z.string().trim().min(2).max(80),
  cidade: z.string().trim().min(2).max(80),
  condominio: ReaisPorMes.optional(),
  iptu: ReaisPorMes.optional(),
  area_util_m2: Area.optional(),
  area_total_m2: Area.optional(),
  quartos: Contagem.optional(),
  suites: Contagem.optional(),
  banheiros: Contagem.optional(),
  vagas: Contagem.optional(),
  comodidades: z.array(z.string().trim().min(2).max(60)).max(30),
  fotos: z.array(FotoSchema).min(1).max(60),
  destaque: z.boolean(),
};
export const CAMPOS_DE_ENTRADA = Object.keys(camposDeEntrada) as (keyof typeof camposDeEntrada)[];

type Conteudo = z.infer<z.ZodObject<typeof camposDeEntrada>>;

function regrasDeConteudo(imovel: Conteudo, ctx: z.RefinementCtx) {
  const negocios = imovel.ofertas.map((oferta) => oferta.negocio);
  if (new Set(negocios).size !== negocios.length) {
    ctx.addIssue({ code: "custom", path: ["ofertas"], message: "No máximo uma oferta de cada negócio" });
  }
  if (imovel.status === "vendido" && !negocios.includes("venda")) {
    ctx.addIssue({ code: "custom", path: ["status"], message: "Vendido só vale para imóvel com oferta de venda" });
  }
  if (imovel.status === "alugado" && !negocios.includes("aluguel")) {
    ctx.addIssue({ code: "custom", path: ["status"], message: "Alugado só vale para imóvel com oferta de aluguel" });
  }
  if (imovel.suites !== undefined && imovel.quartos !== undefined && imovel.suites > imovel.quartos) {
    ctx.addIssue({ code: "custom", path: ["suites"], message: "Suítes não podem passar do número de quartos" });
  }
  const ordens = imovel.fotos.map((foto) => foto.ordem).sort((a, b) => a - b);
  if (ordens.some((ordem, indice) => ordem !== indice + 1)) {
    ctx.addIssue({ code: "custom", path: ["fotos"], message: "As fotos precisam de ordem 1, 2, 3... sem repetir" });
  }
}

export const ImovelEntradaSchema = z.strictObject(camposDeEntrada).superRefine(regrasDeConteudo);
export type ImovelEntrada = z.infer<typeof ImovelEntradaSchema>;

export const ImovelSchema = z
  .strictObject({
    codigo: CodigoSchema,
    ...camposDeEntrada,
    status_desde: DataIsoSchema,
    publicado_em: DataIsoSchema.optional(),
    criado_em: DataIsoSchema,
    atualizado_em: DataIsoSchema,
    atualizado_por: z.string().min(1),
    historico: z.array(HistoricoItemSchema).max(20),
  })
  .superRefine((imovel, ctx) => {
    regrasDeConteudo(imovel, ctx);
    for (const foto of imovel.fotos) {
      for (const url of Object.values(foto.larguras)) {
        if (REGEX_URL_FOTO.exec(url)?.[1] !== imovel.codigo) {
          ctx.addIssue({ code: "custom", path: ["fotos"], message: "Foto aponta para outro imóvel" });
          return;
        }
      }
    }
    if (STATUS_FECHADOS.has(imovel.status) && imovel.publicacao !== "rascunho") {
      ctx.addIssue({ code: "custom", path: ["publicacao"], message: "Vendido ou alugado fica em rascunho" });
    }
    if (imovel.destaque && imovel.publicacao !== "publicado") {
      ctx.addIssue({ code: "custom", path: ["destaque"], message: "Destaque só vale para imóvel publicado" });
    }
  });
export type Imovel = z.infer<typeof ImovelSchema>;

/** imoveis/<codigo>/endereco.json: arquivo separado de propósito (seção 3 do spec). */
export const EnderecoSchema = z.strictObject({
  codigo: CodigoSchema,
  endereco_completo: z.string().trim().min(5).max(300),
  atualizado_em: DataIsoSchema,
});
export type Endereco = z.infer<typeof EnderecoSchema>;

/** imoveis/<codigo>/reserva.json: o código existe antes das fotos (ajuste A do plano). */
export const ReservaSchema = z.strictObject({ codigo: CodigoSchema, reservado_em: DataIsoSchema, por: z.string().min(1) });
export type Reserva = z.infer<typeof ReservaSchema>;

/** imoveis/<codigo>/excluido.json: impede reaproveitar o código (ajuste B do plano). */
export const LapideSchema = z.strictObject({ codigo: CodigoSchema, excluido_em: DataIsoSchema, por: z.string().min(1) });
export type Lapide = z.infer<typeof LapideSchema>;
```

- [ ] **Step 5: Implementar as fixtures de teste**

`src/testes/fixtures.ts`:

```ts
import type { Foto, Imovel, ImovelEntrada } from "@/lib/contratos/imovel";

export const ORIGEM_FOTOS_TESTE = "https://teste.public.blob.vercel-storage.com";
/** WebP 1x1 válido, usado como placeholder nos testes. */
export const PLACEHOLDER_TESTE = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

export function fotosDeExemplo(codigo: string, quantidade = 3, origem = ORIGEM_FOTOS_TESTE): Foto[] {
  return Array.from({ length: quantidade }, (_, indice) => {
    const ordem = indice + 1;
    const url = (largura: number) => `${origem}/imoveis/${codigo}/fotos/${ordem}-abcdef0123-${largura}.webp`;
    return { ordem, larguras: { "800": url(800), "1600": url(1600), "2560": url(2560) }, placeholder: PLACEHOLDER_TESTE };
  });
}

export function entradaDeExemplo(sobrescrever: Partial<ImovelEntrada> = {}): ImovelEntrada {
  return {
    tipo: "casa_condominio",
    status: "disponivel",
    publicacao: "publicado",
    ofertas: [{ negocio: "venda", preco: 1_900_000 }],
    titulo: "Casa em condomínio com piscina e vista para a mata",
    descricao: "Casa térrea com quatro quartos, piscina aquecida e jardim.",
    bairro: "Fazenda da Ilha",
    cidade: "Embu-Guaçu",
    condominio: 900,
    iptu: 350,
    area_util_m2: 440,
    area_total_m2: 1000,
    quartos: 4,
    suites: 2,
    banheiros: 4,
    vagas: 3,
    comodidades: ["Piscina", "Churrasqueira", "Jardim", "Portaria 24h"],
    fotos: fotosDeExemplo("MC001"),
    destaque: false,
    ...sobrescrever,
  };
}

export function imovelDeExemplo(sobrescrever: Partial<Imovel> = {}): Imovel {
  const codigo = sobrescrever.codigo ?? "MC001";
  return {
    codigo,
    ...entradaDeExemplo({ fotos: fotosDeExemplo(codigo) }),
    status_desde: "2026-10-01T12:00:00.000Z",
    publicado_em: "2026-10-01T12:00:00.000Z",
    criado_em: "2026-10-01T12:00:00.000Z",
    atualizado_em: "2026-10-10T12:00:00.000Z",
    atualizado_por: "gabriela@exemplo.com",
    historico: [],
    ...sobrescrever,
  };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- src/lib/contratos/imovel.test.ts`
Expected: PASS, todos os testes.

- [ ] **Step 7: Commit**

```bash
git add apps/site/src/lib/contratos/comum.ts apps/site/src/lib/contratos/imovel.ts apps/site/src/lib/contratos/imovel.test.ts apps/site/src/testes/fixtures.ts
git commit -m "feat(contratos): esquema do imóvel com ofertas, status, fotos e endereço separado"
```

---

### Task 0.3: Contratos de flags, eventos e sessão

**Files:**
- Create: `apps/site/src/lib/contratos/flags.ts`, `apps/site/src/lib/contratos/eventos.ts`, `apps/site/src/lib/contratos/sessao.ts`
- Test: `apps/site/src/lib/contratos/flags.test.ts`, `apps/site/src/lib/contratos/eventos.test.ts`

**Interfaces:**
- Consumes: `CodigoSchema`, `NegocioSchema`, `DataIsoSchema` (`comum.ts`).
- Produces (`flags.ts`): `CAMPOS_PUBLICOS`, `CampoPublicoSchema`, `CampoPublico`, `LIMITE_PRIMEIRA_DOBRA = 4`, `FlagsSchema`/`Flags`, `FlagsEntradaSchema`/`FlagsEntrada`, `FLAGS_PADRAO`, `FlagsPublicas`, `paraFlagsPublicas(flags)`.
- Produces (`eventos.ts`): `ORIGENS_CLIQUE = ["lista","imovel","flutuante","contato"]`, `EventoEntradaSchema`/`EventoEntrada`, `EventoGravadoSchema`/`EventoGravado`, `ContagemSchema`, `ResumoDiaSchema`/`ResumoDia`.
- Produces (`sessao.ts`): `ISSUER_SESSAO = "mc-vieira-site"`, `Papel = "admin"`, `SessaoClaims`, `COOKIE_SESSAO = "mcv_sessao"`, `COOKIE_VISITANTE = "mcv_visitante"`.

- [ ] **Step 1: Testes de flags**

`src/lib/contratos/flags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FLAGS_PADRAO, FlagsEntradaSchema, FlagsSchema, paraFlagsPublicas } from "./flags";

describe("FlagsSchema", () => {
  it("padrão: área útil e quartos na primeira dobra, detalhes vazio, medição desligada", () => {
    expect(FLAGS_PADRAO).toEqual({ primeira_dobra: ["area_util_m2", "quartos"], detalhes: [], eventos_ativos: false });
    expect(FlagsSchema.safeParse(FLAGS_PADRAO).success).toBe(true);
  });

  it("recusa o quinto campo na primeira dobra", () => {
    const flags = { ...FLAGS_PADRAO, primeira_dobra: ["area_util_m2", "quartos", "suites", "vagas", "iptu"] };
    expect(FlagsEntradaSchema.safeParse(flags).success).toBe(false);
  });

  it("aceita exatamente quatro campos", () => {
    const flags = { ...FLAGS_PADRAO, primeira_dobra: ["area_util_m2", "quartos", "suites", "vagas"] };
    expect(FlagsEntradaSchema.safeParse(flags).success).toBe(true);
  });

  it("recusa chave de endereço ou qualquer campo fora do enum", () => {
    expect(FlagsEntradaSchema.safeParse({ ...FLAGS_PADRAO, detalhes: ["endereco_completo"] }).success).toBe(false);
    expect(FlagsEntradaSchema.safeParse({ ...FLAGS_PADRAO, primeira_dobra: ["bairro"] }).success).toBe(false);
  });

  it("recusa campo repetido", () => {
    expect(FlagsEntradaSchema.safeParse({ ...FLAGS_PADRAO, detalhes: ["vagas", "vagas"] }).success).toBe(false);
  });

  it("recusa chave extra no objeto", () => {
    expect(FlagsEntradaSchema.safeParse({ ...FLAGS_PADRAO, mostrar_endereco: true }).success).toBe(false);
  });

  it("flags públicas não levam quem editou", () => {
    const publicas = paraFlagsPublicas({ ...FLAGS_PADRAO, atualizado_em: "2026-10-15T12:00:00.000Z", atualizado_por: "gabriela@exemplo.com" });
    expect(JSON.stringify(publicas)).not.toContain("@");
  });
});
```

- [ ] **Step 2: Testes de eventos**

`src/lib/contratos/eventos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EventoEntradaSchema, EventoGravadoSchema, ResumoDiaSchema } from "./eventos";

describe("EventoEntradaSchema", () => {
  it("aceita clique com código, negócio e origem", () => {
    const evento = { tipo: "clique_whatsapp", codigo: "MC001", negocio: "aluguel", origem: "imovel" };
    expect(EventoEntradaSchema.safeParse(evento).success).toBe(true);
  });

  it("aceita clique sem código vindo do botão flutuante ou da seção de contato", () => {
    expect(EventoEntradaSchema.safeParse({ tipo: "clique_whatsapp", origem: "flutuante" }).success).toBe(true);
    expect(EventoEntradaSchema.safeParse({ tipo: "clique_whatsapp", origem: "contato" }).success).toBe(true);
  });

  it("recusa clique sem código vindo da lista ou do imóvel", () => {
    expect(EventoEntradaSchema.safeParse({ tipo: "clique_whatsapp", origem: "lista" }).success).toBe(false);
    expect(EventoEntradaSchema.safeParse({ tipo: "clique_whatsapp", origem: "imovel" }).success).toBe(false);
  });

  it("recusa visualização sem código", () => {
    expect(EventoEntradaSchema.safeParse({ tipo: "visualizacao_imovel" }).success).toBe(false);
  });

  it("recusa visitante_id vindo do navegador (o servidor lê do cookie)", () => {
    const evento = { tipo: "visualizacao_imovel", codigo: "MC001", visitante_id: crypto.randomUUID() };
    expect(EventoEntradaSchema.safeParse(evento).success).toBe(false);
  });

  it("recusa campos extras como IP ou user agent", () => {
    const evento = { tipo: "visualizacao_imovel", codigo: "MC001", ip: "1.2.3.4" };
    expect(EventoEntradaSchema.safeParse(evento).success).toBe(false);
  });
});

describe("EventoGravadoSchema", () => {
  it("exige data ISO e aceita visitante_id UUID opcional", () => {
    const base = { tipo: "visualizacao_imovel", codigo: "MC001", data: "2026-10-15T12:00:00.000Z" };
    expect(EventoGravadoSchema.safeParse(base).success).toBe(true);
    expect(EventoGravadoSchema.safeParse({ ...base, visitante_id: crypto.randomUUID() }).success).toBe(true);
    expect(EventoGravadoSchema.safeParse({ ...base, visitante_id: "abc" }).success).toBe(false);
  });
});

describe("ResumoDiaSchema", () => {
  it("aceita um resumo diário", () => {
    const zero = { cliques: 0, visualizacoes: 0 };
    const resumo = {
      dia: "2026-10-14",
      gerado_em: "2026-10-15T06:00:00.000Z",
      total_eventos: 3,
      por_imovel: { MC001: { venda: { cliques: 1, visualizacoes: 2 }, aluguel: zero, sem_negocio: zero } },
      cliques_sem_imovel: 0,
      visitantes: [crypto.randomUUID()],
    };
    expect(ResumoDiaSchema.safeParse(resumo).success).toBe(true);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- src/lib/contratos/flags.test.ts src/lib/contratos/eventos.test.ts`
Expected: FAIL com `Failed to resolve import "./flags"` e `"./eventos"`.

- [ ] **Step 4: Implementar `flags.ts`**

```ts
import { z } from "zod";
import { DataIsoSchema } from "./comum";

/** Enum fechado de campos públicos que podem aparecer na página do imóvel (spec 4.2). Endereço nunca entra. */
export const CAMPOS_PUBLICOS = [
  "area_util_m2",
  "area_total_m2",
  "quartos",
  "suites",
  "banheiros",
  "vagas",
  "condominio",
  "iptu",
  "tipo",
] as const;
export const CampoPublicoSchema = z.enum(CAMPOS_PUBLICOS);
export type CampoPublico = z.infer<typeof CampoPublicoSchema>;

export const LIMITE_PRIMEIRA_DOBRA = 4;

const listaSemRepetir = (maximo: number) =>
  z
    .array(CampoPublicoSchema)
    .max(maximo)
    .refine((lista) => new Set(lista).size === lista.length, "Campo repetido");

const camposDeEntrada = {
  primeira_dobra: listaSemRepetir(LIMITE_PRIMEIRA_DOBRA),
  detalhes: listaSemRepetir(CAMPOS_PUBLICOS.length),
  eventos_ativos: z.boolean(),
};

export const FlagsEntradaSchema = z.strictObject(camposDeEntrada);
export type FlagsEntrada = z.infer<typeof FlagsEntradaSchema>;

export const FlagsSchema = z.strictObject({
  ...camposDeEntrada,
  atualizado_em: DataIsoSchema.optional(),
  atualizado_por: z.string().min(1).optional(),
});
export type Flags = z.infer<typeof FlagsSchema>;

export const FLAGS_PADRAO: Flags = { primeira_dobra: ["area_util_m2", "quartos"], detalhes: [], eventos_ativos: false };

export type FlagsPublicas = Pick<Flags, "primeira_dobra" | "detalhes" | "eventos_ativos">;

export function paraFlagsPublicas(flags: Flags): FlagsPublicas {
  return { primeira_dobra: flags.primeira_dobra, detalhes: flags.detalhes, eventos_ativos: flags.eventos_ativos };
}
```

- [ ] **Step 5: Implementar `eventos.ts`**

```ts
import { z } from "zod";
import { CodigoSchema, DataIsoSchema, NegocioSchema } from "./comum";

/** `contato` cobre botões sem imóvel (seção "Prazer", estado de erro). Ajuste D do plano. */
export const ORIGENS_CLIQUE = ["lista", "imovel", "flutuante", "contato"] as const;
const ORIGENS_SEM_IMOVEL = new Set(["flutuante", "contato"]);

const Clique = z.strictObject({
  tipo: z.literal("clique_whatsapp"),
  codigo: CodigoSchema.optional(),
  negocio: NegocioSchema.optional(),
  origem: z.enum(ORIGENS_CLIQUE),
});

const Visualizacao = z.strictObject({
  tipo: z.literal("visualizacao_imovel"),
  codigo: CodigoSchema,
  negocio: NegocioSchema.optional(),
});

/** O que o navegador envia. Não tem visitante_id nem data: o servidor preenche os dois. */
export const EventoEntradaSchema = z.discriminatedUnion("tipo", [Clique, Visualizacao]).superRefine((evento, ctx) => {
  if (evento.tipo === "clique_whatsapp" && !evento.codigo && !ORIGENS_SEM_IMOVEL.has(evento.origem)) {
    ctx.addIssue({ code: "custom", path: ["codigo"], message: "Clique da lista ou do imóvel precisa do código" });
  }
});
export type EventoEntrada = z.infer<typeof EventoEntradaSchema>;

const extrasGravados = { visitante_id: z.uuid().optional(), data: DataIsoSchema };

export const EventoGravadoSchema = z.discriminatedUnion("tipo", [
  Clique.extend(extrasGravados),
  Visualizacao.extend(extrasGravados),
]);
export type EventoGravado = z.infer<typeof EventoGravadoSchema>;

export const ContagemSchema = z.strictObject({ cliques: z.int().min(0), visualizacoes: z.int().min(0) });
export type Contagem = z.infer<typeof ContagemSchema>;

export const ResumoDiaSchema = z.strictObject({
  dia: z.iso.date(),
  gerado_em: DataIsoSchema,
  total_eventos: z.int().min(0),
  por_imovel: z.record(
    CodigoSchema,
    z.strictObject({ venda: ContagemSchema, aluguel: ContagemSchema, sem_negocio: ContagemSchema }),
  ),
  cliques_sem_imovel: z.int().min(0),
  visitantes: z.array(z.uuid()),
});
export type ResumoDia = z.infer<typeof ResumoDiaSchema>;
```

- [ ] **Step 6: Implementar `sessao.ts`**

```ts
export const ISSUER_SESSAO = "mc-vieira-site";
export const COOKIE_SESSAO = "mcv_sessao";
export const COOKIE_VISITANTE = "mcv_visitante";

/** Um papel só (spec 4.3). */
export type Papel = "admin";

export interface SessaoClaims {
  /** e-mail do editor, em minúsculas */
  sub: string;
  papel: Papel;
  iss: typeof ISSUER_SESSAO;
  /** emitido em (segundos epoch) */
  iat: number;
  /** expira em (segundos epoch) */
  exp: number;
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test -- src/lib/contratos`
Expected: PASS em `imovel.test.ts`, `flags.test.ts` e `eventos.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add apps/site/src/lib/contratos/flags.ts apps/site/src/lib/contratos/flags.test.ts apps/site/src/lib/contratos/eventos.ts apps/site/src/lib/contratos/eventos.test.ts apps/site/src/lib/contratos/sessao.ts
git commit -m "feat(contratos): flags com enum fechado, eventos anônimos e claims da sessão"
```

---

### Task 0.4: Visão pública do imóvel

**Files:**
- Create: `apps/site/src/lib/contratos/publico.ts`
- Test: `apps/site/src/lib/contratos/publico.test.ts`

**Interfaces:**
- Consumes: `Imovel` (`imovel.ts`).
- Produces: `CAMPOS_DO_IMOVEL_PUBLICO`, `ImovelPublico`, `paraPublico(imovel: Imovel): ImovelPublico`. Toda página pública e todo componente do site recebem só `ImovelPublico`.

- [ ] **Step 1: Teste (Review Focus 3)**

`src/lib/contratos/publico.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { paraPublico } from "./publico";
import { imovelDeExemplo } from "@/testes/fixtures";

describe("paraPublico", () => {
  const imovel = imovelDeExemplo({
    atualizado_por: "gabriela@exemplo.com",
    historico: [{ em: "2026-10-10T12:00:00.000Z", por: "moises@exemplo.com", campo: "titulo", de: "a", para: "b" }],
  });

  it("descarta histórico e e-mails da equipe", () => {
    const publico = paraPublico(imovel);
    const serializado = JSON.stringify(publico);
    expect(serializado).not.toContain("@exemplo.com");
    expect(publico).not.toHaveProperty("historico");
    expect(publico).not.toHaveProperty("atualizado_por");
    expect(publico).not.toHaveProperty("criado_em");
  });

  it("mantém o que o visitante vê", () => {
    const publico = paraPublico(imovel);
    expect(publico.codigo).toBe("MC001");
    expect(publico.titulo).toBe(imovel.titulo);
    expect(publico.fotos).toEqual(imovel.fotos);
    expect(publico.atualizado_em).toBe(imovel.atualizado_em);
  });

  it("não inventa campos ausentes", () => {
    const { vagas: _vagas, ...semVagas } = imovelDeExemplo();
    expect(paraPublico(semVagas)).not.toHaveProperty("vagas");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/contratos/publico.test.ts`
Expected: FAIL com `Failed to resolve import "./publico"`.

- [ ] **Step 3: Implementar**

`src/lib/contratos/publico.ts`:

```ts
import type { Imovel } from "./imovel";

/** Única lista do que sai do servidor para o navegador. Histórico, e-mails e datas internas ficam de fora. */
export const CAMPOS_DO_IMOVEL_PUBLICO = [
  "codigo",
  "tipo",
  "status",
  "ofertas",
  "titulo",
  "descricao",
  "bairro",
  "cidade",
  "condominio",
  "iptu",
  "area_util_m2",
  "area_total_m2",
  "quartos",
  "suites",
  "banheiros",
  "vagas",
  "comodidades",
  "fotos",
  "destaque",
  "publicado_em",
  "atualizado_em",
] as const satisfies readonly (keyof Imovel)[];

export type ImovelPublico = Pick<Imovel, (typeof CAMPOS_DO_IMOVEL_PUBLICO)[number]>;

export function paraPublico(imovel: Imovel): ImovelPublico {
  const publico: Record<string, unknown> = {};
  for (const campo of CAMPOS_DO_IMOVEL_PUBLICO) {
    if (imovel[campo] !== undefined) publico[campo] = imovel[campo];
  }
  return publico as ImovelPublico;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/lib/contratos/publico.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/contratos/publico.ts apps/site/src/lib/contratos/publico.test.ts
git commit -m "feat(contratos): visão pública do imóvel sem histórico nem e-mails"
```

---

### Task 0.5: Porta de armazenamento e adaptador de arquivo

**Files:**
- Create: `apps/site/src/lib/armazem/tipos.ts`, `apps/site/src/lib/armazem/caminhos.ts`, `apps/site/src/lib/armazem/arquivo.ts`
- Create: `apps/site/src/lib/armazem/contrato-armazem.ts` (bateria de testes reaproveitada pelo adaptador Vercel na Task 0.6)
- Test: `apps/site/src/lib/armazem/arquivo.test.ts`, `apps/site/src/lib/armazem/caminhos.test.ts`

**Interfaces:**
- Produces (`tipos.ts`):
  ```ts
  interface ObjetoJson { dados: unknown; etag: string }
  interface ItemListado { caminho: string; etag: string; atualizadoEm: Date }
  interface OpcoesGravacao { ifMatch?: string; criarSomente?: boolean }
  interface ArmazemJson {
    ler(caminho: string): Promise<ObjetoJson | null>;
    gravar(caminho: string, dados: unknown, opcoes?: OpcoesGravacao): Promise<{ etag: string }>;
    listar(prefixo: string): Promise<ItemListado[]>;       // só .json
    listarPastas(prefixo: string): Promise<string[]>;      // ex.: "imoveis/MC001/"
    apagar(caminhos: string[], opcoes?: { ifMatch?: string }): Promise<void>;
    copiar(de: string, para: string): Promise<void>;
  }
  interface ArmazemFotos {
    readonly origem: string;
    enviar(caminho: string, conteudo: Buffer, contentType: string): Promise<{ url: string }>;
    listar(prefixo: string): Promise<string[]>;
    apagar(caminhos: string[]): Promise<void>;
  }
  class ErroConflito, class ErroJaExiste, function validarEnvioDeFoto(caminho, contentType): void
  ```
- Produces (`caminhos.ts`): `caminhos.{ pastaImoveis, imovel(c), endereco(c), reserva(c), lapide(c), pastaFotos(c), flags, pastaEventos, pastaEventosDia(d), evento(d, id), pastaResumos, resumo(d), pastaBackup, pastaBackupDia(d) }`. Toda função com código valida `REGEX_CODIGO` e lança `Error("Código inválido")`; toda função com dia valida `AAAA-MM-DD`.
- Produces (`arquivo.ts`): `ArmazemJsonArquivo(raiz)`, `ArmazemFotosArquivo(raiz, origem)`.
- Produces (`contrato-armazem.ts`): `testarContratoArmazemJson(nome, criar: () => Promise<ArmazemJson>)`.

- [ ] **Step 1: Teste dos caminhos**

`src/lib/armazem/caminhos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { caminhos } from "./caminhos";

describe("caminhos", () => {
  it("monta os caminhos do layout do Blob (spec seção 3)", () => {
    expect(caminhos.imovel("MC007")).toBe("imoveis/MC007/imovel.json");
    expect(caminhos.endereco("MC007")).toBe("imoveis/MC007/endereco.json");
    expect(caminhos.reserva("MC007")).toBe("imoveis/MC007/reserva.json");
    expect(caminhos.lapide("MC007")).toBe("imoveis/MC007/excluido.json");
    expect(caminhos.pastaFotos("MC007")).toBe("imoveis/MC007/fotos/");
    expect(caminhos.flags).toBe("config/flags.json");
    expect(caminhos.evento("2026-10-15", "abc")).toBe("eventos/2026-10-15/abc.json");
    expect(caminhos.resumo("2026-10-15")).toBe("resumos/2026-10-15.json");
    expect(caminhos.pastaBackupDia("2026-10-15")).toBe("backup/2026-10-15/");
  });

  it("recusa código que poderia escapar do diretório", () => {
    expect(() => caminhos.imovel("../config")).toThrow("Código inválido");
    expect(() => caminhos.imovel("MC001/../../x")).toThrow("Código inválido");
  });

  it("recusa dia fora do formato", () => {
    expect(() => caminhos.resumo("15/10/2026")).toThrow("Dia inválido");
  });
});
```

- [ ] **Step 2: Bateria de contrato do armazém**

`src/lib/armazem/contrato-armazem.ts` (não é arquivo `.test.ts`; é importado pelos testes de cada adaptador):

```ts
import { describe, expect, it } from "vitest";
import { ErroConflito, ErroJaExiste, type ArmazemJson } from "./tipos";

/** Comportamento que todo adaptador precisa ter igual ao Vercel Blob. */
export function testarContratoArmazemJson(nome: string, criar: () => Promise<ArmazemJson>) {
  describe(`contrato ArmazemJson: ${nome}`, () => {
    it("ler devolve null para caminho inexistente", async () => {
      const armazem = await criar();
      expect(await armazem.ler("teste/nao-existe.json")).toBeNull();
    });

    it("grava, lê o mesmo conteúdo e devolve o mesmo ETag", async () => {
      const armazem = await criar();
      const { etag } = await armazem.gravar("teste/a.json", { valor: 1 });
      const lido = await armazem.ler("teste/a.json");
      expect(lido).toEqual({ dados: { valor: 1 }, etag });
    });

    it("criarSomente recusa sobrescrever com ErroJaExiste", async () => {
      const armazem = await criar();
      await armazem.gravar("teste/b.json", { valor: 1 }, { criarSomente: true });
      await expect(armazem.gravar("teste/b.json", { valor: 2 }, { criarSomente: true })).rejects.toBeInstanceOf(ErroJaExiste);
      expect((await armazem.ler("teste/b.json"))?.dados).toEqual({ valor: 1 });
    });

    it("criarSomente concorrente: exatamente uma gravação vence", async () => {
      const armazem = await criar();
      const resultados = await Promise.allSettled(
        Array.from({ length: 5 }, (_, indice) => armazem.gravar("teste/c.json", { indice }, { criarSomente: true })),
      );
      expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
      const recusas = resultados.filter((resultado) => resultado.status === "rejected");
      expect(recusas.every((recusa) => recusa.reason instanceof ErroJaExiste)).toBe(true);
    });

    it("ifMatch com ETag atual grava; com ETag velho lança ErroConflito", async () => {
      const armazem = await criar();
      const primeiro = await armazem.gravar("teste/d.json", { versao: 1 });
      const segundo = await armazem.gravar("teste/d.json", { versao: 2 }, { ifMatch: primeiro.etag });
      expect(segundo.etag).not.toBe(primeiro.etag);
      await expect(armazem.gravar("teste/d.json", { versao: 3 }, { ifMatch: primeiro.etag })).rejects.toBeInstanceOf(ErroConflito);
      expect((await armazem.ler("teste/d.json"))?.dados).toEqual({ versao: 2 });
    });

    it("listar devolve só os .json do prefixo; listarPastas devolve as subpastas", async () => {
      const armazem = await criar();
      await armazem.gravar("lista/MC001/imovel.json", {});
      await armazem.gravar("lista/MC002/reserva.json", {});
      await armazem.gravar("outra/x.json", {});
      const caminhosListados = (await armazem.listar("lista/")).map((item) => item.caminho).sort();
      expect(caminhosListados).toEqual(["lista/MC001/imovel.json", "lista/MC002/reserva.json"]);
      expect((await armazem.listarPastas("lista/")).sort()).toEqual(["lista/MC001/", "lista/MC002/"]);
    });

    it("apagar remove; apagar com ifMatch velho lança ErroConflito", async () => {
      const armazem = await criar();
      const { etag } = await armazem.gravar("teste/e.json", { versao: 1 });
      await armazem.gravar("teste/e.json", { versao: 2 });
      await expect(armazem.apagar(["teste/e.json"], { ifMatch: etag })).rejects.toBeInstanceOf(ErroConflito);
      await armazem.apagar(["teste/e.json"]);
      expect(await armazem.ler("teste/e.json")).toBeNull();
    });

    it("copiar duplica o conteúdo e sobrescreve o destino", async () => {
      const armazem = await criar();
      await armazem.gravar("teste/origem.json", { valor: "novo" });
      await armazem.gravar("copia/origem.json", { valor: "velho" });
      await armazem.copiar("teste/origem.json", "copia/origem.json");
      expect((await armazem.ler("copia/origem.json"))?.dados).toEqual({ valor: "novo" });
    });
  });
}
```

- [ ] **Step 3: Teste do adaptador de arquivo**

`src/lib/armazem/arquivo.test.ts`:

```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ArmazemFotosArquivo, ArmazemJsonArquivo } from "./arquivo";
import { testarContratoArmazemJson } from "./contrato-armazem";

const diretorioTemporario = () => mkdtemp(path.join(tmpdir(), "mcv-armazem-"));

testarContratoArmazemJson("arquivo", async () => new ArmazemJsonArquivo(await diretorioTemporario()));

describe("ArmazemJsonArquivo", () => {
  it("recusa caminho com ..", async () => {
    const armazem = new ArmazemJsonArquivo(await diretorioTemporario());
    await expect(armazem.gravar("../fora.json", {})).rejects.toThrow("Caminho inválido");
  });
});

describe("ArmazemFotosArquivo", () => {
  const origem = "http://localhost:3100/e2e-fotos";

  it("envia WebP no caminho de fotos e devolve a URL com a origem", async () => {
    const fotos = new ArmazemFotosArquivo(await diretorioTemporario(), origem);
    const { url } = await fotos.enviar("imoveis/MC001/fotos/1-abc-800.webp", Buffer.from("webp"), "image/webp");
    expect(url).toBe(`${origem}/imoveis/MC001/fotos/1-abc-800.webp`);
    expect(await fotos.listar("imoveis/MC001/fotos/")).toEqual(["imoveis/MC001/fotos/1-abc-800.webp"]);
  });

  it("recusa qualquer coisa que não seja WebP em caminho de foto (store público só tem fotos)", async () => {
    const fotos = new ArmazemFotosArquivo(await diretorioTemporario(), origem);
    await expect(fotos.enviar("imoveis/MC001/imovel.json", Buffer.from("{}"), "application/json")).rejects.toThrow(
      "Store público aceita só fotos .webp",
    );
    await expect(fotos.enviar("imoveis/MC001/fotos/1.webp", Buffer.from("x"), "image/jpeg")).rejects.toThrow(
      "Store público aceita só fotos .webp",
    );
  });

  it("apaga as fotos listadas", async () => {
    const fotos = new ArmazemFotosArquivo(await diretorioTemporario(), origem);
    await fotos.enviar("imoveis/MC001/fotos/1-abc-800.webp", Buffer.from("a"), "image/webp");
    await fotos.apagar(["imoveis/MC001/fotos/1-abc-800.webp"]);
    expect(await fotos.listar("imoveis/MC001/fotos/")).toEqual([]);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test -- src/lib/armazem`
Expected: FAIL com `Failed to resolve import "./caminhos"`, `"./tipos"` e `"./arquivo"`.

- [ ] **Step 5: Implementar `tipos.ts`**

```ts
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

const REGEX_CAMINHO_FOTO = /^imoveis\/MC\d{3}\/fotos\/[A-Za-z0-9._-]+\.webp$/;

/** Barreira do store público (spec seção 9): nada além de .webp em imoveis/<codigo>/fotos/. */
export function validarEnvioDeFoto(caminho: string, contentType: string): void {
  if (contentType !== "image/webp" || !REGEX_CAMINHO_FOTO.test(caminho)) {
    throw new Error(`Store público aceita só fotos .webp em imoveis/<codigo>/fotos/ (recebido ${caminho}, ${contentType})`);
  }
}
```

- [ ] **Step 6: Implementar `caminhos.ts`**

```ts
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
```

- [ ] **Step 7: Implementar `arquivo.ts`**

```ts
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
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
      return { dados: JSON.parse(texto), etag: etagDe(texto) };
    } catch (erro) {
      if (codigoDoErro(erro) === "ENOENT") return null;
      throw erro;
    }
  }

  gravar(caminho: string, dados: unknown, opcoes: OpcoesGravacao = {}): Promise<{ etag: string }> {
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

  copiar(de: string, para: string): Promise<void> {
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
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm test -- src/lib/armazem`
Expected: PASS em `caminhos.test.ts` e `arquivo.test.ts` (contrato com 8 testes, mais 4 específicos).

- [ ] **Step 9: Commit**

```bash
git add apps/site/src/lib/armazem
git commit -m "feat(armazem): porta de armazenamento com adaptador de arquivo e bateria de contrato"
```

---

### Task 0.6: Adaptadores Vercel Blob e indisponível

**Files:**
- Create: `apps/site/src/lib/armazem/vercel.ts`, `apps/site/src/lib/armazem/indisponivel.ts`
- Test: `apps/site/src/lib/armazem/vercel.test.ts`, `apps/site/src/lib/armazem/indisponivel.test.ts`

**Interfaces:**
- Consumes: `ArmazemJson`, `ArmazemFotos`, `ErroConflito`, `ErroJaExiste`, `validarEnvioDeFoto`, `testarContratoArmazemJson`.
- Produces: `ArmazemJsonVercel(token)`, `ArmazemFotosVercel(token, origem)`, `traduzirErroBlob(erro, caminho)`, `ArmazemJsonIndisponivel`, `ArmazemFotosIndisponivel(origem)`.

- [ ] **Step 1: Testes**

`src/lib/armazem/vercel.test.ts`. A bateria de contrato só roda contra o Blob real quando existe um token de **store de teste** (nunca o de produção). Sem token, só roda o teste de tradução de erros:

```ts
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
```

`src/lib/armazem/indisponivel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ArmazemJsonIndisponivel } from "./indisponivel";

describe("ArmazemJsonIndisponivel", () => {
  it("falha em toda leitura, como um Blob fora do ar", async () => {
    const armazem = new ArmazemJsonIndisponivel();
    await expect(armazem.ler("x.json")).rejects.toThrow("Armazém indisponível");
    await expect(armazem.listar("imoveis/")).rejects.toThrow("Armazém indisponível");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/armazem/vercel.test.ts src/lib/armazem/indisponivel.test.ts`
Expected: FAIL com `Failed to resolve import "./vercel"` e `"./indisponivel"`.

- [ ] **Step 3: Implementar `vercel.ts`**

```ts
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
```

- [ ] **Step 4: Implementar `indisponivel.ts`**

```ts
import type { ArmazemFotos, ArmazemJson } from "./tipos";

const falhar = (): never => {
  throw new Error("Armazém indisponível (ARMAZEM_DRIVER=indisponivel)");
};

/** Simula o Blob fora do ar, para o estado de erro do site (e2e na porta 3101). */
export class ArmazemJsonIndisponivel implements ArmazemJson {
  ler = async () => falhar();
  gravar = async () => falhar();
  listar = async () => falhar();
  listarPastas = async () => falhar();
  apagar = async () => falhar();
  copiar = async () => falhar();
}

export class ArmazemFotosIndisponivel implements ArmazemFotos {
  constructor(readonly origem: string) {}
  enviar = async () => falhar();
  listar = async () => falhar();
  apagar = async () => falhar();
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- src/lib/armazem && npm run typecheck`
Expected: PASS. Sem `BLOB_TESTE_READ_WRITE_TOKEN`, a bateria "vercel (store de teste)" não aparece; isso é esperado. Ela roda na Task 0.9.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/lib/armazem/vercel.ts apps/site/src/lib/armazem/vercel.test.ts apps/site/src/lib/armazem/indisponivel.ts apps/site/src/lib/armazem/indisponivel.test.ts
git commit -m "feat(armazem): adaptadores Vercel Blob (privado e público) e indisponível"
```

---

### Task 0.7: Repositório, geração de código e reserva

**Files:**
- Create: `apps/site/src/lib/dominio/codigo.ts`, `apps/site/src/lib/repositorio/imoveis.ts`, `apps/site/src/lib/repositorio/flags.ts`
- Test: `apps/site/src/lib/dominio/codigo.test.ts`, `apps/site/src/lib/repositorio/imoveis.test.ts`, `apps/site/src/lib/repositorio/flags.test.ts`

**Interfaces:**
- Consumes: `ArmazemJson`, `ErroJaExiste`, `caminhos`, `ImovelSchema`, `EnderecoSchema`, `ReservaSchema`, `LapideSchema`, `FlagsSchema`, `FLAGS_PADRAO`.
- Produces (`codigo.ts`): `numeroDoCodigo(codigo): number`, `formatarCodigo(numero): string`, `proximoCodigo(usados: string[], minimo?: number): string`.
- Produces (`repositorio/imoveis.ts`):
  ```ts
  class ErroDadosInvalidos extends Error
  lerImovel(armazem, codigo): Promise<{ imovel: Imovel; etag: string } | null>
  listarImoveis(armazem): Promise<Imovel[]>                       // ordenado por código; ignora e loga arquivo fora do esquema
  gravarImovel(armazem, imovel: Imovel, opcoes?: OpcoesGravacao): Promise<{ etag: string }>
  lerEndereco(armazem, codigo): Promise<Endereco | null>
  gravarEndereco(armazem, endereco: Endereco): Promise<void>
  lerReserva(armazem, codigo): Promise<Reserva | null>
  lerLapide(armazem, codigo): Promise<Lapide | null>
  codigosUsados(armazem): Promise<string[]>                       // pastas de imoveis/ (imóvel, reserva ou lápide)
  reservarCodigo(armazem, { agora: Date; por: string }): Promise<string>
  ```
- Produces (`repositorio/flags.ts`): `lerFlags(armazem): Promise<{ flags: Flags; etag: string | null }>`, `gravarFlags(armazem, flags: Flags, etagAtual: string | null): Promise<{ etag: string }>`.

- [ ] **Step 1: Testes do código**

`src/lib/dominio/codigo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatarCodigo, numeroDoCodigo, proximoCodigo } from "./codigo";

describe("código do imóvel", () => {
  it("formata com 3 dígitos", () => {
    expect(formatarCodigo(7)).toBe("MC007");
    expect(formatarCodigo(123)).toBe("MC123");
  });

  it("lê o número do código", () => {
    expect(numeroDoCodigo("MC042")).toBe(42);
  });

  it("começa em MC001 sem nenhum código usado", () => {
    expect(proximoCodigo([])).toBe("MC001");
  });

  it("usa o maior + 1, mesmo com buracos", () => {
    expect(proximoCodigo(["MC001", "MC005", "MC003"])).toBe("MC006");
  });

  it("respeita o mínimo pedido (retentativa depois de colisão)", () => {
    expect(proximoCodigo(["MC001"], 9)).toBe("MC009");
  });

  it("falha ao passar de MC999", () => {
    expect(() => proximoCodigo(["MC999"])).toThrow("Códigos esgotados");
  });
});
```

- [ ] **Step 2: Testes do repositório de imóveis**

`src/lib/repositorio/imoveis.test.ts`:

```ts
import { mkdtemp } from "node:fs/promises";
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
});
```

- [ ] **Step 3: Testes do repositório de flags**

`src/lib/repositorio/flags.test.ts`:

```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ArmazemJsonArquivo } from "@/lib/armazem/arquivo";
import { ErroConflito, ErroJaExiste } from "@/lib/armazem/tipos";
import { FLAGS_PADRAO } from "@/lib/contratos/flags";
import { gravarFlags, lerFlags } from "./flags";

const novoArmazem = async () => new ArmazemJsonArquivo(await mkdtemp(path.join(tmpdir(), "mcv-flags-")));

describe("repositório de flags", () => {
  it("sem arquivo, devolve o padrão e ETag nulo", async () => {
    expect(await lerFlags(await novoArmazem())).toEqual({ flags: FLAGS_PADRAO, etag: null });
  });

  it("primeira gravação cria; a segunda exige o ETag", async () => {
    const armazem = await novoArmazem();
    const { etag } = await gravarFlags(armazem, { ...FLAGS_PADRAO, detalhes: ["vagas"] }, null);
    await expect(gravarFlags(armazem, FLAGS_PADRAO, null)).rejects.toBeInstanceOf(ErroJaExiste);
    await expect(gravarFlags(armazem, FLAGS_PADRAO, '"velho"')).rejects.toBeInstanceOf(ErroConflito);
    await gravarFlags(armazem, FLAGS_PADRAO, etag);
    expect((await lerFlags(armazem)).flags.detalhes).toEqual([]);
  });

  it("recusa gravar flags fora do esquema", async () => {
    const armazem = await novoArmazem();
    const invalidas = { ...FLAGS_PADRAO, primeira_dobra: ["area_util_m2", "quartos", "suites", "vagas", "iptu"] };
    await expect(gravarFlags(armazem, invalidas as typeof FLAGS_PADRAO, null)).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test -- src/lib/dominio/codigo.test.ts src/lib/repositorio`
Expected: FAIL com `Failed to resolve import "./codigo"`, `"./imoveis"` e `"./flags"`.

- [ ] **Step 5: Implementar `dominio/codigo.ts`**

```ts
import { REGEX_CODIGO } from "@/lib/contratos/comum";

const MAIOR_NUMERO = 999;

export function numeroDoCodigo(codigo: string): number {
  if (!REGEX_CODIGO.test(codigo)) throw new Error("Código inválido");
  return Number(codigo.slice(2));
}

export function formatarCodigo(numero: number): string {
  return `MC${String(numero).padStart(3, "0")}`;
}

/** Maior código usado + 1, nunca abaixo de `minimo`. Usados incluem reservas e lápides (ajustes A e B). */
export function proximoCodigo(usados: string[], minimo = 1): string {
  const maior = usados.reduce((atual, codigo) => Math.max(atual, numeroDoCodigo(codigo)), 0);
  const proximo = Math.max(maior + 1, minimo);
  if (proximo > MAIOR_NUMERO) throw new Error("Códigos esgotados (MC999)");
  return formatarCodigo(proximo);
}
```

- [ ] **Step 6: Implementar `repositorio/imoveis.ts`**

```ts
import { z } from "zod";
import { caminhos } from "@/lib/armazem/caminhos";
import { ErroJaExiste, type ArmazemJson, type OpcoesGravacao } from "@/lib/armazem/tipos";
import { REGEX_CODIGO } from "@/lib/contratos/comum";
import {
  EnderecoSchema,
  ImovelSchema,
  LapideSchema,
  ReservaSchema,
  type Endereco,
  type Imovel,
  type Lapide,
  type Reserva,
} from "@/lib/contratos/imovel";
import { numeroDoCodigo, proximoCodigo } from "@/lib/dominio/codigo";

export class ErroDadosInvalidos extends Error {
  constructor(caminho: string, detalhe: string) {
    super(`${caminho} fora do esquema: ${detalhe}`);
    this.name = "ErroDadosInvalidos";
  }
}

async function lerValidado<T>(armazem: ArmazemJson, caminho: string, esquema: z.ZodType<T>) {
  const objeto = await armazem.ler(caminho);
  if (!objeto) return null;
  const resultado = esquema.safeParse(objeto.dados);
  if (!resultado.success) throw new ErroDadosInvalidos(caminho, z.prettifyError(resultado.error));
  return { dados: resultado.data, etag: objeto.etag };
}

export async function lerImovel(armazem: ArmazemJson, codigo: string): Promise<{ imovel: Imovel; etag: string } | null> {
  const lido = await lerValidado(armazem, caminhos.imovel(codigo), ImovelSchema);
  return lido ? { imovel: lido.dados, etag: lido.etag } : null;
}

export async function listarImoveis(armazem: ArmazemJson): Promise<Imovel[]> {
  const arquivos = (await armazem.listar(caminhos.pastaImoveis)).filter((item) => item.caminho.endsWith("/imovel.json"));
  const lidos = await Promise.all(
    arquivos.map(async (item) => {
      const objeto = await armazem.ler(item.caminho);
      if (!objeto) return null;
      const resultado = ImovelSchema.safeParse(objeto.dados);
      if (!resultado.success) {
        // Só o caminho vai para o log: o conteúdo pode ter dados que não devem sair do store.
        console.error(`[catalogo] ${item.caminho} fora do esquema; ignorado na listagem`);
        return null;
      }
      return resultado.data;
    }),
  );
  return lidos.filter((imovel): imovel is Imovel => imovel !== null).sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export async function gravarImovel(armazem: ArmazemJson, imovel: Imovel, opcoes: OpcoesGravacao = {}) {
  const valido = ImovelSchema.parse(imovel);
  return armazem.gravar(caminhos.imovel(valido.codigo), valido, opcoes);
}

export async function lerEndereco(armazem: ArmazemJson, codigo: string): Promise<Endereco | null> {
  return (await lerValidado(armazem, caminhos.endereco(codigo), EnderecoSchema))?.dados ?? null;
}

export async function gravarEndereco(armazem: ArmazemJson, endereco: Endereco): Promise<void> {
  const valido = EnderecoSchema.parse(endereco);
  await armazem.gravar(caminhos.endereco(valido.codigo), valido);
}

export async function lerReserva(armazem: ArmazemJson, codigo: string): Promise<Reserva | null> {
  return (await lerValidado(armazem, caminhos.reserva(codigo), ReservaSchema))?.dados ?? null;
}

export async function lerLapide(armazem: ArmazemJson, codigo: string): Promise<Lapide | null> {
  return (await lerValidado(armazem, caminhos.lapide(codigo), LapideSchema))?.dados ?? null;
}

export async function codigosUsados(armazem: ArmazemJson): Promise<string[]> {
  const pastas = await armazem.listarPastas(caminhos.pastaImoveis);
  return pastas
    .map((pasta) => pasta.slice(caminhos.pastaImoveis.length).replace(/\/$/, ""))
    .filter((codigo) => REGEX_CODIGO.test(codigo))
    .sort();
}

const TENTATIVAS_DE_RESERVA = 10;

/**
 * Reserva o próximo código gravando reserva.json com criação exclusiva.
 * Na colisão, tenta o seguinte ao que colidiu, mesmo que a listagem ainda não mostre o código novo.
 */
export async function reservarCodigo(armazem: ArmazemJson, contexto: { agora: Date; por: string }): Promise<string> {
  let minimo = 1;
  for (let tentativa = 0; tentativa < TENTATIVAS_DE_RESERVA; tentativa += 1) {
    const codigo = proximoCodigo(await codigosUsados(armazem), minimo);
    const reserva = ReservaSchema.parse({ codigo, reservado_em: contexto.agora.toISOString(), por: contexto.por });
    try {
      await armazem.gravar(caminhos.reserva(codigo), reserva, { criarSomente: true });
      return codigo;
    } catch (erro) {
      if (!(erro instanceof ErroJaExiste)) throw erro;
      minimo = numeroDoCodigo(codigo) + 1;
    }
  }
  throw new Error(`Não foi possível reservar um código em ${TENTATIVAS_DE_RESERVA} tentativas`);
}
```

- [ ] **Step 7: Implementar `repositorio/flags.ts`**

```ts
import { z } from "zod";
import { caminhos } from "@/lib/armazem/caminhos";
import type { ArmazemJson } from "@/lib/armazem/tipos";
import { FLAGS_PADRAO, FlagsSchema, type Flags } from "@/lib/contratos/flags";
import { ErroDadosInvalidos } from "./imoveis";

export async function lerFlags(armazem: ArmazemJson): Promise<{ flags: Flags; etag: string | null }> {
  const objeto = await armazem.ler(caminhos.flags);
  if (!objeto) return { flags: FLAGS_PADRAO, etag: null };
  const resultado = FlagsSchema.safeParse(objeto.dados);
  if (!resultado.success) throw new ErroDadosInvalidos(caminhos.flags, z.prettifyError(resultado.error));
  return { flags: resultado.data, etag: objeto.etag };
}

/** etagAtual null = o arquivo ainda não existe; a gravação só cria. */
export async function gravarFlags(armazem: ArmazemJson, flags: Flags, etagAtual: string | null) {
  const validas = FlagsSchema.parse(flags);
  return armazem.gravar(caminhos.flags, validas, etagAtual ? { ifMatch: etagAtual } : { criarSomente: true });
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm test -- src/lib/dominio src/lib/repositorio && npm run typecheck`
Expected: PASS em todos.

- [ ] **Step 9: Commit**

```bash
git add apps/site/src/lib/dominio/codigo.ts apps/site/src/lib/dominio/codigo.test.ts apps/site/src/lib/repositorio
git commit -m "feat(repositorio): leitura validada, reserva de código sem colisão e flags com ETag"
```

---

### Task 0.8: Configuração, serviços e ajudante de testes

**Files:**
- Create: `apps/site/src/lib/config.ts`, `apps/site/src/lib/servicos.ts`, `apps/site/src/testes/servicos-de-teste.ts`
- Test: `apps/site/src/lib/config.test.ts`

**Interfaces:**
- Consumes: adaptadores (`arquivo.ts`, `vercel.ts`, `indisponivel.ts`), `listarImoveis`, `lerFlags`.
- Produces (`config.ts`):
  ```ts
  type DriverArmazem = "vercel" | "arquivo" | "indisponivel"
  interface Config { driver; armazemDir; armazemFotosDir; blobPrivadoToken; blobPublicoToken; fotosOrigem;
    authJwtSecret; authJwtTtlHoras; googleClientId; authAllowlist; skillApiSecret; cronSecret }
  lerConfig(env: Record<string, string | undefined>): Config
  criarArmazens(config: Config): { armazem: ArmazemJson; fotos: ArmazemFotos }
  ```
- Produces (`servicos.ts`): `type TagCache = "imoveis" | "flags"`, `interface Servicos { armazem; fotos; config; agora(): Date; revalidar(tag: TagCache): Promise<void>; catalogo(): Promise<Imovel[]>; flags(): Promise<Flags> }`, `servicos(): Servicos` (memoizado; só no runtime do Next).
- Produces (`servicos-de-teste.ts`): `CONFIG_TESTE`, `criarServicosDeTeste(sobrescrever?)` que devolve `Servicos & { tagsRevalidadas: TagCache[]; raiz: string; definirAgora(data: Date): void }`.

- [ ] **Step 1: Teste da configuração**

`src/lib/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ArmazemJsonArquivo } from "./armazem/arquivo";
import { ArmazemJsonIndisponivel } from "./armazem/indisponivel";
import { criarArmazens, lerConfig } from "./config";

describe("lerConfig", () => {
  it("usa o driver vercel por padrão e TTL de 8 horas", () => {
    const config = lerConfig({});
    expect(config.driver).toBe("vercel");
    expect(config.authJwtTtlHoras).toBe(8);
  });

  it("ignora TTL não positivo", () => {
    expect(lerConfig({ AUTH_JWT_TTL_HORAS: "-5" }).authJwtTtlHoras).toBe(8);
    expect(lerConfig({ AUTH_JWT_TTL_HORAS: "2" }).authJwtTtlHoras).toBe(2);
  });

  it("recusa driver desconhecido", () => {
    expect(() => lerConfig({ ARMAZEM_DRIVER: "s3" })).toThrow("ARMAZEM_DRIVER inválido");
  });

  it("tira a barra final da origem das fotos", () => {
    expect(lerConfig({ FOTOS_ORIGEM: "https://x.public.blob.vercel-storage.com/" }).fotosOrigem).toBe(
      "https://x.public.blob.vercel-storage.com",
    );
  });

  it("fotos do driver arquivo ficam em $ARMAZEM_DIR/publico por padrão", () => {
    expect(lerConfig({ ARMAZEM_DRIVER: "arquivo", ARMAZEM_DIR: "/tmp/x" }).armazemFotosDir).toBe("/tmp/x/publico");
  });
});

describe("criarArmazens", () => {
  it("monta o adaptador de cada driver", () => {
    expect(criarArmazens(lerConfig({ ARMAZEM_DRIVER: "arquivo", ARMAZEM_DIR: "/tmp/x" })).armazem).toBeInstanceOf(ArmazemJsonArquivo);
    expect(criarArmazens(lerConfig({ ARMAZEM_DRIVER: "indisponivel" })).armazem).toBeInstanceOf(ArmazemJsonIndisponivel);
  });

  it("driver vercel sem token falha com mensagem clara", () => {
    expect(() => criarArmazens(lerConfig({ ARMAZEM_DRIVER: "vercel" }))).toThrow("BLOB_PRIVADO_READ_WRITE_TOKEN ausente");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/config.test.ts`
Expected: FAIL com `Failed to resolve import "./config"`.

- [ ] **Step 3: Implementar `config.ts`**

```ts
import path from "node:path";
import { ArmazemFotosArquivo, ArmazemJsonArquivo } from "./armazem/arquivo";
import { ArmazemFotosIndisponivel, ArmazemJsonIndisponivel } from "./armazem/indisponivel";
import type { ArmazemFotos, ArmazemJson } from "./armazem/tipos";
import { ArmazemFotosVercel, ArmazemJsonVercel } from "./armazem/vercel";

export type DriverArmazem = "vercel" | "arquivo" | "indisponivel";
const DRIVERS: readonly DriverArmazem[] = ["vercel", "arquivo", "indisponivel"];
const TTL_PADRAO_HORAS = 8;

export interface Config {
  driver: DriverArmazem;
  armazemDir: string;
  armazemFotosDir: string;
  blobPrivadoToken: string;
  blobPublicoToken: string;
  fotosOrigem: string;
  authJwtSecret: string;
  authJwtTtlHoras: number;
  googleClientId: string;
  authAllowlist: string;
  skillApiSecret: string;
  cronSecret: string;
}

/** Lê o ambiente sem lançar por segredo ausente: cada consumidor nega acesso (fail-closed) se o seu estiver vazio. */
export function lerConfig(env: Record<string, string | undefined>): Config {
  const driver = (env.ARMAZEM_DRIVER || "vercel") as DriverArmazem;
  if (!DRIVERS.includes(driver)) throw new Error(`ARMAZEM_DRIVER inválido: ${env.ARMAZEM_DRIVER}`);
  const armazemDir = path.resolve(env.ARMAZEM_DIR || ".dados-local");
  const ttl = Number(env.AUTH_JWT_TTL_HORAS);
  return {
    driver,
    armazemDir,
    armazemFotosDir: env.ARMAZEM_FOTOS_DIR ? path.resolve(env.ARMAZEM_FOTOS_DIR) : path.join(armazemDir, "publico"),
    blobPrivadoToken: env.BLOB_PRIVADO_READ_WRITE_TOKEN ?? "",
    blobPublicoToken: env.BLOB_PUBLICO_READ_WRITE_TOKEN ?? "",
    fotosOrigem: (env.FOTOS_ORIGEM ?? "").replace(/\/$/, ""),
    authJwtSecret: env.AUTH_JWT_SECRET ?? "",
    authJwtTtlHoras: ttl > 0 ? ttl : TTL_PADRAO_HORAS,
    googleClientId: env.GOOGLE_CLIENT_ID ?? "",
    authAllowlist: env.AUTH_ALLOWLIST ?? "",
    skillApiSecret: env.SKILL_API_SECRET ?? "",
    cronSecret: env.CRON_SECRET ?? "",
  };
}

export function criarArmazens(config: Config): { armazem: ArmazemJson; fotos: ArmazemFotos } {
  switch (config.driver) {
    case "arquivo":
      return {
        armazem: new ArmazemJsonArquivo(path.join(config.armazemDir, "privado")),
        fotos: new ArmazemFotosArquivo(config.armazemFotosDir, config.fotosOrigem),
      };
    case "indisponivel":
      return { armazem: new ArmazemJsonIndisponivel(), fotos: new ArmazemFotosIndisponivel(config.fotosOrigem) };
    case "vercel":
      return {
        armazem: new ArmazemJsonVercel(config.blobPrivadoToken),
        fotos: new ArmazemFotosVercel(config.blobPublicoToken, config.fotosOrigem),
      };
  }
}
```

- [ ] **Step 4: Implementar `servicos.ts`**

```ts
import { revalidateTag, unstable_cache } from "next/cache";
import type { ArmazemFotos, ArmazemJson } from "./armazem/tipos";
import { criarArmazens, lerConfig, type Config } from "./config";
import type { Flags } from "./contratos/flags";
import type { Imovel } from "./contratos/imovel";
import { lerFlags } from "./repositorio/flags";
import { listarImoveis } from "./repositorio/imoveis";

export type TagCache = "imoveis" | "flags";

/** Tudo de que os handlers e as páginas precisam. Os testes montam um Servicos próprio (src/testes/servicos-de-teste.ts). */
export interface Servicos {
  armazem: ArmazemJson;
  fotos: ArmazemFotos;
  config: Config;
  agora(): Date;
  revalidar(tag: TagCache): Promise<void>;
  /** Todos os imóveis (inclusive rascunhos), com cache por tag "imoveis". Só para uso no servidor. */
  catalogo(): Promise<Imovel[]>;
  /** Flags com cache por tag "flags". */
  flags(): Promise<Flags>;
}

let instancia: Servicos | null = null;

/** Só no runtime do Next: depende de next/cache. */
export function servicos(): Servicos {
  if (instancia) return instancia;
  const config = lerConfig(process.env);
  const { armazem, fotos } = criarArmazens(config);
  instancia = {
    armazem,
    fotos,
    config,
    agora: () => new Date(),
    // Rotas de API não podem usar updateTag; { expire: 0 } expira na hora (docs do Next 16, revalidateTag).
    revalidar: async (tag) => {
      revalidateTag(tag, { expire: 0 });
    },
    catalogo: unstable_cache(() => listarImoveis(armazem), ["catalogo-imoveis"], { tags: ["imoveis"] }),
    flags: unstable_cache(async () => (await lerFlags(armazem)).flags, ["flags"], { tags: ["flags"] }),
  };
  return instancia;
}
```

- [ ] **Step 5: Implementar o ajudante de testes**

`src/testes/servicos-de-teste.ts`:

```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ArmazemFotosArquivo, ArmazemJsonArquivo } from "@/lib/armazem/arquivo";
import type { Config } from "@/lib/config";
import { lerFlags } from "@/lib/repositorio/flags";
import { listarImoveis } from "@/lib/repositorio/imoveis";
import type { Servicos, TagCache } from "@/lib/servicos";
import { ORIGEM_FOTOS_TESTE } from "./fixtures";

export const CONFIG_TESTE: Config = {
  driver: "arquivo",
  armazemDir: "",
  armazemFotosDir: "",
  blobPrivadoToken: "",
  blobPublicoToken: "",
  fotosOrigem: ORIGEM_FOTOS_TESTE,
  authJwtSecret: "segredo-de-teste-com-mais-de-32-caracteres",
  authJwtTtlHoras: 8,
  googleClientId: "cliente-google-teste",
  authAllowlist: "gabriela@exemplo.com, Moises@Exemplo.com",
  skillApiSecret: "segredo-da-skill-de-teste",
  cronSecret: "segredo-do-cron-de-teste",
};

export type ServicosDeTeste = Servicos & {
  tagsRevalidadas: TagCache[];
  raiz: string;
  definirAgora(data: Date): void;
};

/** Servicos com armazém de arquivo num diretório temporário, relógio fixo e revalidação registrada. Sem cache. */
export async function criarServicosDeTeste(sobrescrever: Partial<Servicos> = {}): Promise<ServicosDeTeste> {
  const raiz = await mkdtemp(path.join(tmpdir(), "mcv-servicos-"));
  const armazem = new ArmazemJsonArquivo(path.join(raiz, "privado"));
  const fotos = new ArmazemFotosArquivo(path.join(raiz, "publico"), ORIGEM_FOTOS_TESTE);
  const tagsRevalidadas: TagCache[] = [];
  let agora = new Date("2026-10-15T12:00:00.000Z");
  return {
    armazem,
    fotos,
    config: { ...CONFIG_TESTE, armazemDir: raiz, armazemFotosDir: path.join(raiz, "publico") },
    agora: () => agora,
    definirAgora: (data) => {
      agora = data;
    },
    revalidar: async (tag) => {
      tagsRevalidadas.push(tag);
    },
    catalogo: () => listarImoveis(armazem),
    flags: async () => (await lerFlags(armazem)).flags,
    tagsRevalidadas,
    raiz,
    ...sobrescrever,
  };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS em toda a suíte, sem erro de tipo nem de lint.

- [ ] **Step 7: Commit**

```bash
git add apps/site/src/lib/config.ts apps/site/src/lib/config.test.ts apps/site/src/lib/servicos.ts apps/site/src/testes/servicos-de-teste.ts
git commit -m "feat(site): configuração por ambiente, serviços com cache por tag e ajudante de testes"
```

---

### Task 0.9: Stores do Blob, verificações reais e documentação do projeto

Esta task responde aos pontos em aberto da frente 0 (spec seção 14) com evidência, não com suposição. Os Steps 1 e 2 são **ação humana** no painel da Vercel (criam recursos no time e afetam custo). O agente prepara o script e o roteiro, pede ao humano para executar e registra o resultado.

**Files:**
- Create: `apps/site/scripts/verificar-blob.ts`
- Create: `docs/verificacoes/2026-10-frente-0-blob.md`
- Create: `tasks/todo.md`
- Modify: `CLAUDE.md` (seção "Projeto" e nova seção "Como transferir")

**Interfaces:**
- Consumes: `ArmazemJsonVercel`, `ArmazemFotosVercel`, `ErroConflito`, `ErroJaExiste`.

- [ ] **Step 1: (humano) Criar o projeto e os três stores no time `luiz-martucci's projects`**

No painel da Vercel, plano Pro, time `luiz-martucci's projects`:
1. Criar o projeto `mc-vieira-site` importando o repositório, com **Root Directory = `apps/site`** e Framework = Next.js. Não precisa fazer o primeiro deploy funcionar ainda.
2. Storage → Create → Blob → nome `mcv-privado`, acesso **Private**. Conectar ao projeto com prefixo de variável `BLOB_PRIVADO` (gera `BLOB_PRIVADO_READ_WRITE_TOKEN`), ambientes Production e Preview.
3. Storage → Create → Blob → nome `mcv-publico`, acesso **Public**. Conectar com prefixo `BLOB_PUBLICO`.
4. Storage → Create → Blob → nome `mcv-teste`, acesso **Private**, **sem** conectar a ambiente de produção. Este store só serve para os testes de contrato e o script de verificação.
5. Copiar os tokens para `apps/site/.env.local` (nunca para arquivo versionado): `BLOB_PRIVADO_READ_WRITE_TOKEN`, `BLOB_PUBLICO_READ_WRITE_TOKEN` e `BLOB_TESTE_READ_WRITE_TOKEN` (do `mcv-teste`). Anotar a origem pública do `mcv-publico` (formato `https://<id>.public.blob.vercel-storage.com`) em `FOTOS_ORIGEM`.

- [ ] **Step 2: Escrever o script de verificação**

`apps/site/scripts/verificar-blob.ts`:

```ts
/**
 * Verificações reais do Vercel Blob (frente 0, spec seção 14). Roda contra o store de TESTE e o público.
 * Uso: npm run verificar:blob  (lê .env.local)
 */
import { randomUUID } from "node:crypto";
import { ErroConflito, ErroJaExiste } from "../src/lib/armazem/tipos";
import { ArmazemFotosVercel, ArmazemJsonVercel } from "../src/lib/armazem/vercel";

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} em .env.local`);
  return valor;
}

async function principal() {
  const privado = new ArmazemJsonVercel(exigir("BLOB_TESTE_READ_WRITE_TOKEN"));
  const publico = new ArmazemFotosVercel(exigir("BLOB_PUBLICO_READ_WRITE_TOKEN"), exigir("FOTOS_ORIGEM"));
  const prefixo = `verificacao/${randomUUID()}/`;
  const caminho = `${prefixo}a.json`;
  const relatorio: string[] = [];

  // 1. Criação exclusiva e a mensagem real do erro.
  await privado.gravar(caminho, { versao: 1 }, { criarSomente: true });
  try {
    await privado.gravar(caminho, { versao: 2 }, { criarSomente: true });
    relatorio.push("FALHA: segunda gravação com criarSomente não foi recusada");
  } catch (erro) {
    relatorio.push(
      erro instanceof ErroJaExiste
        ? "OK: allowOverwrite:false recusa e é traduzido para ErroJaExiste"
        : `ATENÇÃO: erro não traduzido. Ajuste MENSAGEM_JA_EXISTE em vercel.ts. Mensagem: ${(erro as Error).message}`,
    );
  }

  // 2. ifMatch.
  const lido = await privado.ler(caminho);
  const nova = await privado.gravar(caminho, { versao: 2 }, { ifMatch: lido!.etag });
  try {
    await privado.gravar(caminho, { versao: 3 }, { ifMatch: lido!.etag });
    relatorio.push("FALHA: ifMatch com ETag velho não foi recusado");
  } catch (erro) {
    relatorio.push(erro instanceof ErroConflito ? "OK: ifMatch velho vira ErroConflito" : `FALHA: ${(erro as Error).message}`);
  }
  relatorio.push(`OK: ETag muda a cada gravação (${lido!.etag} → ${nova.etag})`);

  // 3. Visibilidade imediata no list() (ponto em aberto do spec).
  const novo = `${prefixo}recem-gravado.json`;
  const inicio = Date.now();
  await privado.gravar(novo, { x: 1 });
  let visivelEm: number | null = null;
  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    const itens = await privado.listar(prefixo);
    if (itens.some((item) => item.caminho === novo)) {
      visivelEm = Date.now() - inicio;
      break;
    }
    await new Promise((resolver) => setTimeout(resolver, 500));
  }
  relatorio.push(visivelEm === null ? "ATENÇÃO: blob novo não apareceu no list() em 10 s" : `OK: blob novo visível no list() após ${visivelEm} ms`);
  const pastas = await privado.listarPastas("verificacao/");
  relatorio.push(pastas.includes(prefixo) ? "OK: listarPastas (mode folded) mostra a pasta" : "FALHA: listarPastas não mostrou a pasta");

  // 4. Store privado não responde sem token.
  const urlPrivada = `https://blob.vercel-storage.com/${caminho}`;
  const semToken = await fetch(urlPrivada);
  relatorio.push(semToken.ok ? `FALHA: blob privado respondeu ${semToken.status} sem token` : `OK: blob privado sem token responde ${semToken.status}`);

  // 5. Store público aceita só .webp (barreira do app) e serve a foto.
  try {
    await publico.enviar("imoveis/MC999/imovel.json", Buffer.from("{}"), "application/json");
    relatorio.push("FALHA: store público aceitou JSON");
  } catch {
    relatorio.push("OK: store público recusa JSON antes de enviar");
  }
  const webp = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
  const caminhoFoto = `imoveis/MC999/fotos/verificacao-${Date.now()}-800.webp`;
  const { url } = await publico.enviar(caminhoFoto, webp, "image/webp");
  const resposta = await fetch(url);
  relatorio.push(resposta.ok ? `OK: foto pública servida (${resposta.headers.get("content-type")})` : `FALHA: foto pública ${resposta.status}`);

  // Limpeza.
  await privado.apagar((await privado.listar(prefixo)).map((item) => item.caminho));
  await publico.apagar([caminhoFoto]);

  console.log(relatorio.join("\n"));
  if (relatorio.some((linha) => linha.startsWith("FALHA"))) process.exitCode = 1;
}

principal().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
```

Observação sobre o item 4: se o store privado usar outro host para URLs, troque `urlPrivada` pela URL que `get()` devolve em `resultado.blob.url` (leia com `get(caminho, { access: "private", token })` e use essa URL no `fetch` sem token). O objetivo é provar que sem token não há leitura.

- [ ] **Step 3: (humano roda, agente registra) Rodar a verificação e a bateria de contrato contra o Blob real**

Run: `cd apps/site && npm run verificar:blob`
Expected: todas as linhas começam com `OK`. Se alguma começar com `ATENÇÃO` ou `FALHA`, corrija o adaptador (`vercel.ts`) e rode de novo antes de seguir.

Run: `cd apps/site && node --env-file=.env.local ./node_modules/.bin/vitest run src/lib/armazem/vercel.test.ts`
Expected: PASS na bateria "contrato ArmazemJson: vercel (store de teste)" (8 testes).

- [ ] **Step 4: Verificar a transferência de projeto com os stores**

Leia a documentação oficial atual da Vercel sobre transferência de projeto entre times (página "Transferring a project", em vercel.com/docs) e responda, com citação do trecho: os stores do Blob conectados vão junto? E as variáveis e os Cron Jobs? Se a documentação não for conclusiva, registre "não confirmado" e o caminho alternativo do spec (backup + script de cópia).

- [ ] **Step 5: Registrar o resultado**

`docs/verificacoes/2026-10-frente-0-blob.md`:

```markdown
# Verificações da frente 0: Vercel Blob

Data: (preencher). Versão do SDK: @vercel/blob 2.8.2. Stores: mcv-privado (Private), mcv-publico (Public), mcv-teste (Private).

## Saída de `npm run verificar:blob`

(colar a saída completa)

## Respostas aos pontos em aberto (spec seção 14)

- **Blob recém-gravado aparece de imediato no `list()`?** (sim/não, com o tempo medido). Consequência no código: a reserva de código já não depende disso (`reservarCodigo` avança o mínimo na colisão). O catálogo público só lê imóveis que já existiam antes de publicar, então não é afetado.
- **A transferência de projeto entre times leva os stores?** (resposta com citação e link). Se não: o caminho é backup diário + script de cópia, descrito no CLAUDE.md, seção "Como transferir".
- **Mensagem real do erro de `allowOverwrite: false`:** (texto). `MENSAGEM_JA_EXISTE` em `apps/site/src/lib/armazem/vercel.ts` confere com ela.
```

- [ ] **Step 6: Criar `tasks/todo.md` com os riscos e ajustes**

```markdown
# Riscos e ajustes (site novo)

Registrado pelo plano `docs/superpowers/plans/2026-10-15-site-novo/`. Cada item tem dono e saída.

## Ajustes ao spec decididos no plano (revisar com o Luiz no PR)

- [ ] A. Reserva de código antes das fotos (`POST /api/imoveis/reservas`).
- [ ] B. Lápide `excluido.json` para não reaproveitar o maior código.
- [ ] C. Nome de foto com hash do conteúdo (`<ordem>-<hash10>-<largura>.webp`).
- [ ] D. `origem: contato` e código opcional no clique do flutuante e do contato.
- [ ] E. Voltar a rascunho limpa o destaque; destacar rascunho é recusado.
- [ ] F. Recusa de cookies lembrada em localStorage, sem identificador (entra no documento do Moisés).
- [ ] G. "Esteve no ar até dd/mm" calculado pelo histórico.

## Riscos conhecidos

- [ ] Limitador de `/api/eventos` vive na memória de cada instância. Um ataque distribuído entre muitas instâncias passa do limite por instância. Saída se acontecer: regra de rate limit no Firewall da Vercel para `/api/eventos`.
- [ ] Dois editores marcando destaque ao mesmo tempo podem chegar a 6 destaques (a contagem lê os outros imóveis sem trava). Baixa chance com 2 editores; o painel mostra a contagem.
- [ ] Planilha do lote depende das páginas públicas da Tokko; imóvel sem foto original não migra (spec seção 14).
```

- [ ] **Step 7: Atualizar o `CLAUDE.md` (stack, comandos, estrutura, como transferir)**

Na seção "🧱 Projeto" do `CLAUDE.md` da raiz, troque os quatro marcadores de preencher por:

```markdown
- **O que é:** site de imóveis da M.C. Vieira (venda e aluguel) que leva o visitante ao WhatsApp do Moisés; painel `/admin` para a Gabriela e o Moisés; API única de gravação usada pela skill "publicar imóvel".
- **Stack:** Next.js 16 (App Router) + TypeScript, zod, Vercel Blob (store privado para JSON, público para fotos), Vercel (plano Pro, time `luiz-martucci's projects`), Vitest e Playwright.
- **Comandos (em `apps/site/`):** `npm install` · `npm run dev` · `npm test` · `npm run test:e2e` · `npm run lint` · `npm run typecheck` · `npm run build`.
- **Estrutura:** `apps/site/src/lib/` regras e contratos (testados sem servidor); `apps/site/src/app/` páginas e rotas finas; `apps/site/scripts/` CLI da skill e verificações; `docs/` spec, plano, ADRs e verificações.
```

E acrescente, antes de "📚 Referências", a seção:

```markdown
## 🔁 Como transferir (para o Moisés ou outra pessoa)

| Recurso | Onde vive | Como transferir |
|---|---|---|
| Projeto `mc-vieira-site` | Vercel, time `luiz-martucci's projects` | Settings → Transfer Project para o time do novo dono |
| Stores `mcv-privado` e `mcv-publico` | Vercel Blob, mesmo time | Ver `docs/verificacoes/2026-10-frente-0-blob.md`. Se não acompanharem a transferência: criar stores no time novo e copiar com backup + script de cópia |
| Variáveis (`AUTH_*`, `GOOGLE_CLIENT_ID`, `SKILL_API_SECRET`, `CRON_SECRET`, `FOTOS_ORIGEM`, tokens do Blob) | Vercel, ambiente do projeto | Recriar no time novo se não vierem; gerar segredos novos (`openssl rand -base64 32`) |
| Cron diário `/api/cron/diario` | `apps/site/vercel.json` | Vai com o código |
| OAuth Client ID | Projeto GCP `mc-vieira-site`, conta Google pessoal do Luiz | IAM → adicionar o novo dono como Owner |
| Domínio `mcvieiraimoveis.com.br` | Registro.br, titular Moisés | Já é do Moisés; só apontar o DNS para o projeto |
```

- [ ] **Step 8: Rodar a suíte completa**

Run: `cd apps/site && npm test && npm run typecheck && npm run lint && npm run build`
Expected: tudo verde.

- [ ] **Step 9: Commit e fechamento da frente 0**

```bash
cd /Users/felipemartucci/PycharmProjects/real-state-platform
git status --short
git add apps/site/scripts/verificar-blob.ts docs/verificacoes/2026-10-frente-0-blob.md tasks/todo.md CLAUDE.md
git commit -m "chore(site): verifica o Vercel Blob real e documenta stack, comandos e transferência"
git pull --rebase origin main
npm --prefix apps/site test
```

Entregue ao humano, como texto (não execute):

```bash
git push -u origin feat/site-novo-fundacao
```
