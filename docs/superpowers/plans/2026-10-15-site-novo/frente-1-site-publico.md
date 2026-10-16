# Frente 1: Site público

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as páginas públicas (`/`, `/imoveis`, `/imoveis/[codigo]`, `/privacidade`) no visual C4, com filtros na URL, estados de carregando, vazio, reservado, rascunho (404) e erro, e testes e2e de visitante em celular e desktop.

**Architecture:** Leia `README.md` desta pasta antes. Toda decisão de exibição (preço, campos, mensagem do WhatsApp, filtros, hero) é função pura em `src/lib/apresentacao/`, com teste unitário. Os componentes só montam HTML com essas funções e recebem `ImovelPublico`, nunca `Imovel`. As páginas leem pelo `src/lib/catalogo.ts`, que usa `servicos().catalogo()` (cache por tag). Os botões de WhatsApp levam atributos `data-evento`, `data-origem`, `data-codigo` e `data-negocio`; a frente 4 lê esses atributos para medir cliques, sem mexer nesta frente.

**Tech Stack:** Next.js 16.4.1 (App Router, `next/font/google`), CSS puro com tokens, Vitest, Playwright 1.64.1, @axe-core/playwright 4.14.0, sharp (só para gerar fotos de teste).

**Spec:** `docs/superpowers/specs/2026-10-15-site-novo-mc-vieira-design.md` (seções 4.1 Exibição, 5, 7, 10 e2e e visual). Mock: `Site MC Vieira/13-site-novo/exportado/site-mc-vieira-mock-C4.html`.

**Pré-requisito:** frente 0 concluída (merge em `main`). **Branch:** `git checkout -b feat/site-novo-site-publico`.

**Comandos (em `apps/site/`):** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`.

**Armadilha do Next 16 que esta frente evita:** `notFound()` chamado depois que a resposta começou a ser transmitida (dentro de um `loading.tsx`/Suspense) mantém status **200**. Por isso o `loading.tsx` da lista fica no route group `src/app/(site)/imoveis/(lista)/`, fora do alcance de `src/app/(site)/imoveis/[codigo]/`. Não crie `loading.tsx` em `(site)/` nem em `(site)/imoveis/`.

## Fidelidade ao mock C4 (regra desta frente)

O mock `Site MC Vieira/13-site-novo/exportado/site-mc-vieira-mock-C4.html` foi **aprovado pelo usuário** e é a fonte da verdade visual e de conteúdo das páginas públicas. O objetivo é reproduzi-lo, não reinterpretá-lo. O HTML e o CSS que este plano traz em cada task são ponto de partida: quando divergirem do mock, **vale o mock**.

- **Ler o mock:** o arquivo tem 3,5 MB por causa das fotos embutidas em base64. Gere uma cópia legível (cerca de 10 KB) fora do repositório e leia essa:
  ```bash
  python3 -c "import re,sys; s=open(sys.argv[1],encoding='utf-8').read(); open(sys.argv[2],'w').write(re.sub(r'data:[a-z/+\-]+;base64,[A-Za-z0-9+/=]+','data:…',s))" \
    "/Users/felipemartucci/PycharmProjects/real-state-platform/Site MC Vieira/13-site-novo/exportado/site-mc-vieira-mock-C4.html" /tmp/mock-c4-sem-base64.html
  ```
  Todo brief de subagente desta frente (implementador e revisor) leva o caminho do mock e esta seção.
- **Comparar de verdade:** em cada task que muda tela (1.5, 1.6, 1.7, 1.8), abra o mock e o app em 1440 px e 390 px, capture as duas telas e liste cada diferença (estrutura, textos, tipografia, cores, espaçamentos, estados e comportamentos como o slideshow com Ken Burns e as faixas alternadas).
- **Divergência exige aprovação explícita do usuário antes de implementar.** Isso inclui divergências forçadas pela técnica (framework, acessibilidade, dado real que não cabe no layout). Peça aprovação com: o que o mock mostra, o que não dá para reproduzir e por quê, opções e recomendação. Sem o "sim", siga o mock. O que o mock não mostra (filtros, estados vazio, carregando, erro, reservado, `/privacidade`) é lacuna, não divergência: desenhe com os tokens e componentes do mock e leve a lista ao usuário para aprovar.
- **Registro:** diferenças aprovadas vão para `tasks/todo.md` com a data e o que foi aprovado.
- **Revisão:** o revisor de cada task compara a tela com o mock, não só o código com o plano.


---

### Task 1.1: Formatação de preço, área, data e campos

**Files:**
- Create: `apps/site/src/lib/apresentacao/formatar.ts`, `apps/site/src/lib/apresentacao/campos.ts`
- Test: `apps/site/src/lib/apresentacao/formatar.test.ts`, `apps/site/src/lib/apresentacao/campos.test.ts`

**Interfaces:**
- Consumes: `Oferta`, `Negocio`, `Tipo`, `ImovelPublico`, `CampoPublico`.
- Produces (`formatar.ts`): `formatarReais(valor): string`, `ROTULO_NEGOCIO: Record<Negocio,string>`, `ROTULO_TIPO: Record<Tipo,string>`, `formatarPrecoOferta(oferta): string`, `ordenarOfertas(ofertas, negocio?): Oferta[]`, `linhasDePreco(ofertas, negocio?): LinhaDePreco[]` com `LinhaDePreco = { negocio: Negocio; rotulo: string; valor: string }`, `formatarArea(m2): string`, `formatarNumero(n): string`, `formatarData(iso): string` (dd/mm/aaaa, fuso de São Paulo), `formatarDiaMes(iso): string` (dd/mm), `plural(n, singular, plural): string`.
- Produces (`campos.ts`): `CampoExibido = { chave: CampoPublico; valor: string; rotulo: string }`, `exibirCampo(imovel, chave): CampoExibido | null`, `camposExibidos(imovel, chaves): CampoExibido[]`.

- [ ] **Step 1: Testes de formatação**

`src/lib/apresentacao/formatar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatarArea,
  formatarData,
  formatarDiaMes,
  formatarPrecoOferta,
  formatarReais,
  linhasDePreco,
  ordenarOfertas,
  plural,
} from "./formatar";

describe("preço", () => {
  it("formata reais sem centavos, com ponto de milhar", () => {
    expect(formatarReais(1_200_000)).toBe("R$ 1.200.000");
    expect(formatarReais(850)).toBe("R$ 850");
  });

  it("venda mostra só o valor", () => {
    expect(formatarPrecoOferta({ negocio: "venda", preco: 1_900_000 })).toBe("R$ 1.900.000");
  });

  it("aluguel mostra /mês e diz se inclui condomínio", () => {
    expect(formatarPrecoOferta({ negocio: "aluguel", preco: 6_000 })).toBe("R$ 6.000/mês");
    expect(formatarPrecoOferta({ negocio: "aluguel", preco: 6_000, inclui_condominio: true })).toBe(
      "R$ 6.000/mês, condomínio incluso",
    );
    expect(formatarPrecoOferta({ negocio: "aluguel", preco: 6_000, inclui_condominio: false })).toBe(
      "R$ 6.000/mês + condomínio",
    );
  });

  it("sem preço é 'Preço sob consulta', nunca zero", () => {
    expect(formatarPrecoOferta({ negocio: "venda" })).toBe("Preço sob consulta");
    expect(formatarPrecoOferta({ negocio: "aluguel" })).toBe("Preço sob consulta");
  });
});

describe("ordem das ofertas", () => {
  const ofertas = [
    { negocio: "aluguel" as const, preco: 6_000 },
    { negocio: "venda" as const, preco: 1_200_000 },
  ];

  it("sem contexto, venda primeiro", () => {
    expect(ordenarOfertas(ofertas).map((oferta) => oferta.negocio)).toEqual(["venda", "aluguel"]);
  });

  it("com contexto de aluguel, aluguel primeiro", () => {
    expect(ordenarOfertas(ofertas, "aluguel").map((oferta) => oferta.negocio)).toEqual(["aluguel", "venda"]);
  });

  it("monta uma linha por oferta", () => {
    expect(linhasDePreco(ofertas)).toEqual([
      { negocio: "venda", rotulo: "Venda", valor: "R$ 1.200.000" },
      { negocio: "aluguel", rotulo: "Aluguel", valor: "R$ 6.000/mês" },
    ]);
  });
});

describe("área, data e plural", () => {
  it("área inteira e decimal com vírgula", () => {
    expect(formatarArea(120)).toBe("120 m²");
    expect(formatarArea(85.5)).toBe("85,5 m²");
    expect(formatarArea(1200)).toBe("1.200 m²");
  });

  it("data no fuso de São Paulo", () => {
    expect(formatarData("2026-10-15T02:00:00.000Z")).toBe("14/10/2026");
    expect(formatarDiaMes("2026-10-15T15:00:00.000Z")).toBe("15/10");
  });

  it("plural simples", () => {
    expect(plural(1, "quarto", "quartos")).toBe("1 quarto");
    expect(plural(3, "quarto", "quartos")).toBe("3 quartos");
  });
});
```

- [ ] **Step 2: Testes de campos**

`src/lib/apresentacao/campos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { paraPublico } from "@/lib/contratos/publico";
import { imovelDeExemplo } from "@/testes/fixtures";
import { camposExibidos, exibirCampo } from "./campos";

const imovel = paraPublico(imovelDeExemplo());

describe("campos exibidos", () => {
  it("área útil com unidade", () => {
    expect(exibirCampo(imovel, "area_util_m2")).toEqual({ chave: "area_util_m2", valor: "440", rotulo: "m² úteis" });
  });

  it("quartos levam as suítes no rótulo", () => {
    expect(exibirCampo(imovel, "quartos")).toEqual({ chave: "quartos", valor: "4", rotulo: "quartos, 2 suítes" });
    expect(exibirCampo({ ...imovel, quartos: 1, suites: 1 }, "quartos")?.rotulo).toBe("quarto, 1 suíte");
    expect(exibirCampo({ ...imovel, suites: undefined }, "quartos")?.rotulo).toBe("quartos");
  });

  it("custos mensais em reais", () => {
    expect(exibirCampo(imovel, "condominio")).toEqual({ chave: "condominio", valor: "R$ 900", rotulo: "condomínio/mês" });
    expect(exibirCampo(imovel, "iptu")).toEqual({ chave: "iptu", valor: "R$ 350", rotulo: "IPTU/mês" });
  });

  it("tipo com nome legível", () => {
    expect(exibirCampo(imovel, "tipo")?.valor).toBe("Casa em condomínio");
  });

  it("campo ausente é omitido, nunca vira zero", () => {
    const semVagas = { ...imovel, vagas: undefined };
    expect(exibirCampo(semVagas, "vagas")).toBeNull();
    expect(camposExibidos(semVagas, ["vagas", "quartos"]).map((campo) => campo.chave)).toEqual(["quartos"]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- src/lib/apresentacao`
Expected: FAIL com `Failed to resolve import "./formatar"` e `"./campos"`.

- [ ] **Step 4: Implementar `formatar.ts`**

```ts
import type { Negocio, Tipo } from "@/lib/contratos/comum";
import type { Oferta } from "@/lib/contratos/imovel";

const numeroInteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const numeroDecimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
const diaMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

export const ROTULO_NEGOCIO: Record<Negocio, string> = { venda: "Venda", aluguel: "Aluguel" };

export const ROTULO_TIPO: Record<Tipo, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  casa_condominio: "Casa em condomínio",
  terreno: "Terreno",
  cobertura: "Cobertura",
  sala_comercial: "Sala comercial",
  galpao: "Galpão",
  chacara: "Chácara",
};

export function formatarNumero(valor: number): string {
  return numeroDecimal.format(valor);
}

export function formatarReais(valor: number): string {
  return `R$ ${numeroInteiro.format(valor)}`;
}

export function formatarPrecoOferta(oferta: Oferta): string {
  if (oferta.preco === undefined) return "Preço sob consulta";
  if (oferta.negocio === "venda") return formatarReais(oferta.preco);
  const mensal = `${formatarReais(oferta.preco)}/mês`;
  if (oferta.inclui_condominio === true) return `${mensal}, condomínio incluso`;
  if (oferta.inclui_condominio === false) return `${mensal} + condomínio`;
  return mensal;
}

/** Contexto da visita (?negocio=) primeiro; sem contexto, venda primeiro (spec seção 5). */
export function ordenarOfertas(ofertas: Oferta[], negocio?: Negocio): Oferta[] {
  const primeiro = negocio ?? "venda";
  return [...ofertas].sort((a, b) => Number(b.negocio === primeiro) - Number(a.negocio === primeiro));
}

export interface LinhaDePreco {
  negocio: Negocio;
  rotulo: string;
  valor: string;
}

export function linhasDePreco(ofertas: Oferta[], negocio?: Negocio): LinhaDePreco[] {
  return ordenarOfertas(ofertas, negocio).map((oferta) => ({
    negocio: oferta.negocio,
    rotulo: ROTULO_NEGOCIO[oferta.negocio],
    valor: formatarPrecoOferta(oferta),
  }));
}

export function formatarArea(m2: number): string {
  return `${numeroDecimal.format(m2)} m²`;
}

export function formatarData(iso: string): string {
  return data.format(new Date(iso));
}

export function formatarDiaMes(iso: string): string {
  return diaMes.format(new Date(iso));
}

export function plural(quantidade: number, singular: string, pluralDaPalavra: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : pluralDaPalavra}`;
}
```

- [ ] **Step 5: Implementar `campos.ts`**

```ts
import type { CampoPublico } from "@/lib/contratos/flags";
import type { ImovelPublico } from "@/lib/contratos/publico";
import { formatarNumero, formatarReais, ROTULO_TIPO } from "./formatar";

export interface CampoExibido {
  chave: CampoPublico;
  valor: string;
  rotulo: string;
}

const palavra = (quantidade: number, singular: string, plural: string) => (quantidade === 1 ? singular : plural);

export function exibirCampo(imovel: ImovelPublico, chave: CampoPublico): CampoExibido | null {
  switch (chave) {
    case "area_util_m2":
      return imovel.area_util_m2 === undefined ? null : { chave, valor: formatarNumero(imovel.area_util_m2), rotulo: "m² úteis" };
    case "area_total_m2":
      return imovel.area_total_m2 === undefined ? null : { chave, valor: formatarNumero(imovel.area_total_m2), rotulo: "m² totais" };
    case "quartos": {
      if (imovel.quartos === undefined) return null;
      const suites = imovel.suites ? `, ${imovel.suites} ${palavra(imovel.suites, "suíte", "suítes")}` : "";
      return { chave, valor: String(imovel.quartos), rotulo: `${palavra(imovel.quartos, "quarto", "quartos")}${suites}` };
    }
    case "suites":
      return imovel.suites === undefined ? null : { chave, valor: String(imovel.suites), rotulo: palavra(imovel.suites, "suíte", "suítes") };
    case "banheiros":
      return imovel.banheiros === undefined
        ? null
        : { chave, valor: String(imovel.banheiros), rotulo: palavra(imovel.banheiros, "banheiro", "banheiros") };
    case "vagas":
      return imovel.vagas === undefined ? null : { chave, valor: String(imovel.vagas), rotulo: palavra(imovel.vagas, "vaga", "vagas") };
    case "condominio":
      return imovel.condominio === undefined ? null : { chave, valor: formatarReais(imovel.condominio), rotulo: "condomínio/mês" };
    case "iptu":
      return imovel.iptu === undefined ? null : { chave, valor: formatarReais(imovel.iptu), rotulo: "IPTU/mês" };
    case "tipo":
      return { chave, valor: ROTULO_TIPO[imovel.tipo], rotulo: "tipo" };
  }
}

export function camposExibidos(imovel: ImovelPublico, chaves: readonly CampoPublico[]): CampoExibido[] {
  return chaves.map((chave) => exibirCampo(imovel, chave)).filter((campo): campo is CampoExibido => campo !== null);
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- src/lib/apresentacao`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/site/src/lib/apresentacao/formatar.ts apps/site/src/lib/apresentacao/formatar.test.ts apps/site/src/lib/apresentacao/campos.ts apps/site/src/lib/apresentacao/campos.test.ts
git commit -m "feat(site): formatação de preço, área, data e campos visíveis"
```

---

### Task 1.2: Link e mensagem do WhatsApp

**Files:**
- Create: `apps/site/src/lib/apresentacao/whatsapp.ts`
- Test: `apps/site/src/lib/apresentacao/whatsapp.test.ts`

**Interfaces:**
- Produces: `NUMERO_WHATSAPP = "5511996767680"`, `TELEFONE_EXIBIDO = "(11) 99676-7680"`, `ContextoWhatsApp = { codigo?: string; titulo?: string; negocio?: Negocio }`, `mensagemWhatsApp(ctx): string`, `urlWhatsApp(ctx): string`.

- [ ] **Step 1: Testes**

`src/lib/apresentacao/whatsapp.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mensagemWhatsApp, urlWhatsApp } from "./whatsapp";

describe("mensagem do WhatsApp", () => {
  it("com contexto de aluguel cita o negócio, o código e o título", () => {
    expect(mensagemWhatsApp({ codigo: "MC007", titulo: "Casa no Morumbi", negocio: "aluguel" })).toBe(
      "Olá, Moisés! Tenho interesse em alugar o MC007 – Casa no Morumbi.",
    );
  });

  it("com contexto de venda usa 'comprar'", () => {
    expect(mensagemWhatsApp({ codigo: "MC001", titulo: "Casa com piscina", negocio: "venda" })).toBe(
      "Olá, Moisés! Tenho interesse em comprar o MC001 – Casa com piscina.",
    );
  });

  it("sem contexto é neutra", () => {
    expect(mensagemWhatsApp({ codigo: "MC007", titulo: "Casa no Morumbi" })).toBe(
      "Olá, Moisés! Tenho interesse no imóvel MC007 – Casa no Morumbi.",
    );
  });

  it("sem imóvel é uma saudação geral", () => {
    expect(mensagemWhatsApp({})).toBe("Olá, Moisés! Vim pelo site da M.C. Vieira e gostaria de falar sobre imóveis.");
  });
});

describe("URL do WhatsApp", () => {
  it("aponta para o número do Moisés", () => {
    expect(urlWhatsApp({}).startsWith("https://wa.me/5511996767680?text=")).toBe(true);
  });

  it("codifica acento, travessão e &", () => {
    const url = urlWhatsApp({ codigo: "MC003", titulo: "Sala & escritório na Vila Olímpia" });
    const texto = url.split("?text=")[1];
    expect(texto).not.toContain("&");
    expect(texto).toContain("%26");
    expect(texto).toContain("Ol%C3%A1");
    expect(texto).toContain("%E2%80%93");
    expect(decodeURIComponent(texto)).toBe("Olá, Moisés! Tenho interesse no imóvel MC003 – Sala & escritório na Vila Olímpia.");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/apresentacao/whatsapp.test.ts`
Expected: FAIL com `Failed to resolve import "./whatsapp"`.

- [ ] **Step 3: Implementar**

`src/lib/apresentacao/whatsapp.ts`:

```ts
import type { Negocio } from "@/lib/contratos/comum";

export const NUMERO_WHATSAPP = "5511996767680";
export const TELEFONE_EXIBIDO = "(11) 99676-7680";

export interface ContextoWhatsApp {
  codigo?: string;
  titulo?: string;
  negocio?: Negocio;
}

const VERBO: Record<Negocio, string> = { venda: "comprar", aluguel: "alugar" };

export function mensagemWhatsApp({ codigo, titulo, negocio }: ContextoWhatsApp): string {
  if (!codigo) return "Olá, Moisés! Vim pelo site da M.C. Vieira e gostaria de falar sobre imóveis.";
  const imovel = titulo ? `${codigo} – ${titulo}` : codigo;
  if (negocio) return `Olá, Moisés! Tenho interesse em ${VERBO[negocio]} o ${imovel}.`;
  return `Olá, Moisés! Tenho interesse no imóvel ${imovel}.`;
}

export function urlWhatsApp(contexto: ContextoWhatsApp): string {
  return `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensagemWhatsApp(contexto))}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/lib/apresentacao/whatsapp.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/apresentacao/whatsapp.ts apps/site/src/lib/apresentacao/whatsapp.test.ts
git commit -m "feat(site): mensagem pronta do WhatsApp com código, título e negócio"
```

---

### Task 1.3: Filtros da lista, ordenação e estado vazio

**Files:**
- Create: `apps/site/src/lib/apresentacao/filtros.ts`
- Test: `apps/site/src/lib/apresentacao/filtros.test.ts`

**Interfaces:**
- Consumes: `ImovelPublico`, `NegocioSchema`, `TipoSchema`, `TIPOS`, `ROTULO_TIPO`, `formatarReais`.
- Produces:
  ```ts
  type Ordem = "recentes" | "menor_preco" | "maior_preco"
  interface FiltrosLista { negocio?: Negocio; tipo?: Tipo; bairro?: string; precoMin?: number; precoMax?: number; quartos?: number; ordem: Ordem }
  type ParametrosDeBusca = Record<string, string | string[] | undefined>
  lerFiltros(parametros: ParametrosDeBusca): FiltrosLista
  paraQuery(filtros: FiltrosLista): string            // "" ou "?negocio=...&..."
  filtrarImoveis(lista: ImovelPublico[], filtros: FiltrosLista): { imoveis: ImovelPublico[]; foraPorSobConsulta: number }
  tiposDisponiveis(lista): Tipo[]
  bairrosDisponiveis(lista): string[]
  descreverVazio(filtros, lista): string
  avisoSobConsulta(quantidade: number): string
  tituloDaLista(filtros): string
  ```

- [ ] **Step 1: Testes**

`src/lib/apresentacao/filtros.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { paraPublico } from "@/lib/contratos/publico";
import { imovelDeExemplo } from "@/testes/fixtures";
import {
  avisoSobConsulta,
  bairrosDisponiveis,
  descreverVazio,
  filtrarImoveis,
  lerFiltros,
  paraQuery,
  tiposDisponiveis,
  tituloDaLista,
} from "./filtros";

const imovel = (codigo: string, sobrescrever: Parameters<typeof imovelDeExemplo>[0]) =>
  paraPublico(imovelDeExemplo({ codigo, ...sobrescrever }));

// Lista em ordem de publicação mais recente primeiro (como o catálogo entrega).
const lista = [
  imovel("MC001", { tipo: "casa", bairro: "Morumbi", quartos: 3, ofertas: [{ negocio: "aluguel", preco: 8_000 }] }),
  imovel("MC002", { tipo: "apartamento", bairro: "Morumbi", quartos: 2, ofertas: [{ negocio: "aluguel", preco: 3_000 }] }),
  imovel("MC003", {
    tipo: "casa",
    bairro: "Centro",
    quartos: 4,
    ofertas: [
      { negocio: "venda", preco: 1_200_000 },
      { negocio: "aluguel", preco: 6_000 },
    ],
  }),
  imovel("MC004", { tipo: "terreno", bairro: "Centro", quartos: undefined, suites: undefined, ofertas: [{ negocio: "venda" }] }),
  imovel("MC005", { tipo: "casa", bairro: "Cipó", quartos: 3, ofertas: [{ negocio: "venda", preco: 700_000 }] }),
];
const codigos = (resultado: { imoveis: { codigo: string }[] }) => resultado.imoveis.map((item) => item.codigo);

describe("lerFiltros", () => {
  it("lê os parâmetros da URL", () => {
    expect(lerFiltros({ negocio: "aluguel", quartos: "3", tipo: "casa", bairro: " Morumbi ", preco_max: "10000", ordem: "menor_preco" })).toEqual({
      negocio: "aluguel",
      quartos: 3,
      tipo: "casa",
      bairro: "Morumbi",
      precoMax: 10_000,
      ordem: "menor_preco",
    });
  });

  it("descarta valores inválidos sem quebrar", () => {
    expect(lerFiltros({ negocio: "permuta", tipo: "sobrado", quartos: "-2", preco_min: "abc", ordem: "x" })).toEqual({ ordem: "recentes" });
  });

  it("aceita preço com pontos de milhar", () => {
    expect(lerFiltros({ preco_min: "1.000.000" }).precoMin).toBe(1_000_000);
  });

  it("volta para a URL de forma compartilhável", () => {
    expect(paraQuery({ negocio: "aluguel", quartos: 3, ordem: "recentes" })).toBe("?negocio=aluguel&quartos=3");
    expect(paraQuery({ ordem: "recentes" })).toBe("");
  });
});

describe("filtrarImoveis", () => {
  it("um imóvel com venda e aluguel aparece nas duas abas", () => {
    expect(codigos(filtrarImoveis(lista, { negocio: "venda", ordem: "recentes" }))).toEqual(["MC003", "MC004", "MC005"]);
    expect(codigos(filtrarImoveis(lista, { negocio: "aluguel", ordem: "recentes" }))).toEqual(["MC001", "MC002", "MC003"]);
  });

  it("quartos é 'no mínimo' e exclui imóvel sem quartos", () => {
    expect(codigos(filtrarImoveis(lista, { quartos: 3, ordem: "recentes" }))).toEqual(["MC001", "MC003", "MC005"]);
  });

  it("bairro ignora caixa e acento", () => {
    expect(codigos(filtrarImoveis(lista, { bairro: "cipo", ordem: "recentes" }))).toEqual(["MC005"]);
  });

  it("faixa de preço exclui sob consulta e conta quantos ficaram de fora", () => {
    const resultado = filtrarImoveis(lista, { negocio: "venda", precoMax: 2_000_000, ordem: "recentes" });
    expect(codigos(resultado)).toEqual(["MC003", "MC005"]);
    expect(resultado.foraPorSobConsulta).toBe(1);
  });

  it("faixa de preço usa a oferta do negócio escolhido", () => {
    expect(codigos(filtrarImoveis(lista, { negocio: "aluguel", precoMax: 7_000, ordem: "recentes" }))).toEqual(["MC002", "MC003"]);
  });

  it("ordenação por preço põe sob consulta no fim", () => {
    expect(codigos(filtrarImoveis(lista, { negocio: "venda", ordem: "menor_preco" }))).toEqual(["MC005", "MC003", "MC004"]);
    expect(codigos(filtrarImoveis(lista, { negocio: "venda", ordem: "maior_preco" }))).toEqual(["MC003", "MC005", "MC004"]);
  });
});

describe("opções dos filtros", () => {
  it("tipos só com imóvel publicado, na ordem do enum", () => {
    expect(tiposDisponiveis(lista)).toEqual(["apartamento", "casa", "terreno"]);
  });

  it("bairros em ordem alfabética, sem repetir", () => {
    expect(bairrosDisponiveis(lista)).toEqual(["Centro", "Cipó", "Morumbi"]);
  });
});

describe("textos", () => {
  it("estado vazio diz o que foi consultado e o que remover (exemplo do spec)", () => {
    const filtros = lerFiltros({ negocio: "aluguel", quartos: "5", bairro: "Morumbi" });
    expect(descreverVazio(filtros, lista)).toBe(
      "Nenhum imóvel de aluguel com 5 quartos ou mais no bairro Morumbi. Remova o filtro de quartos para ver 2.",
    );
  });

  it("estado vazio sem nenhum imóvel publicado", () => {
    expect(descreverVazio({ ordem: "recentes" }, [])).toBe(
      "Ainda não há imóveis publicados. Fale com o Moisés pelo WhatsApp para saber das novidades.",
    );
  });

  it("aviso de sob consulta no singular e no plural", () => {
    expect(avisoSobConsulta(1)).toBe("1 imóvel com preço sob consulta não entra neste filtro.");
    expect(avisoSobConsulta(3)).toBe("3 imóveis com preço sob consulta não entram neste filtro.");
  });

  it("título da lista segue o negócio", () => {
    expect(tituloDaLista({ negocio: "venda", ordem: "recentes" })).toBe("Imóveis à venda");
    expect(tituloDaLista({ negocio: "aluguel", ordem: "recentes" })).toBe("Imóveis para alugar");
    expect(tituloDaLista({ ordem: "recentes" })).toBe("Todos os imóveis");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/apresentacao/filtros.test.ts`
Expected: FAIL com `Failed to resolve import "./filtros"`.

- [ ] **Step 3: Implementar**

`src/lib/apresentacao/filtros.ts`:

```ts
import { NegocioSchema, TIPOS, TipoSchema, type Negocio, type Tipo } from "@/lib/contratos/comum";
import type { ImovelPublico } from "@/lib/contratos/publico";
import { formatarReais, ROTULO_TIPO } from "./formatar";

export type Ordem = "recentes" | "menor_preco" | "maior_preco";
const ORDENS: readonly Ordem[] = ["recentes", "menor_preco", "maior_preco"];

export interface FiltrosLista {
  negocio?: Negocio;
  tipo?: Tipo;
  bairro?: string;
  precoMin?: number;
  precoMax?: number;
  quartos?: number;
  ordem: Ordem;
}

export type ParametrosDeBusca = Record<string, string | string[] | undefined>;

const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);

function inteiroPositivo(valor: string | undefined, maximo = Number.MAX_SAFE_INTEGER): number | undefined {
  if (!valor || !/^[\d.]+$/.test(valor.trim())) return undefined;
  const numero = Number(valor.replace(/\./g, ""));
  return Number.isInteger(numero) && numero > 0 && numero <= maximo ? numero : undefined;
}

const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function lerFiltros(parametros: ParametrosDeBusca): FiltrosLista {
  const filtros: FiltrosLista = { ordem: "recentes" };
  const negocio = NegocioSchema.safeParse(primeiro(parametros.negocio));
  if (negocio.success) filtros.negocio = negocio.data;
  const tipo = TipoSchema.safeParse(primeiro(parametros.tipo));
  if (tipo.success) filtros.tipo = tipo.data;
  const bairro = primeiro(parametros.bairro)?.trim();
  if (bairro && bairro.length <= 80) filtros.bairro = bairro;
  const precoMin = inteiroPositivo(primeiro(parametros.preco_min));
  if (precoMin) filtros.precoMin = precoMin;
  const precoMax = inteiroPositivo(primeiro(parametros.preco_max));
  if (precoMax) filtros.precoMax = precoMax;
  const quartos = inteiroPositivo(primeiro(parametros.quartos), 10);
  if (quartos) filtros.quartos = quartos;
  const ordem = primeiro(parametros.ordem) as Ordem | undefined;
  if (ordem && ORDENS.includes(ordem)) filtros.ordem = ordem;
  return filtros;
}

export function paraQuery(filtros: FiltrosLista): string {
  const busca = new URLSearchParams();
  if (filtros.negocio) busca.set("negocio", filtros.negocio);
  if (filtros.tipo) busca.set("tipo", filtros.tipo);
  if (filtros.bairro) busca.set("bairro", filtros.bairro);
  if (filtros.precoMin) busca.set("preco_min", String(filtros.precoMin));
  if (filtros.precoMax) busca.set("preco_max", String(filtros.precoMax));
  if (filtros.quartos) busca.set("quartos", String(filtros.quartos));
  if (filtros.ordem !== "recentes") busca.set("ordem", filtros.ordem);
  const texto = busca.toString();
  return texto ? `?${texto}` : "";
}

function precosRelevantes(imovel: ImovelPublico, negocio?: Negocio): number[] {
  return imovel.ofertas
    .filter((oferta) => !negocio || oferta.negocio === negocio)
    .map((oferta) => oferta.preco)
    .filter((preco): preco is number => preco !== undefined);
}

export function filtrarImoveis(lista: ImovelPublico[], filtros: FiltrosLista) {
  const comFaixaDePreco = filtros.precoMin !== undefined || filtros.precoMax !== undefined;
  let foraPorSobConsulta = 0;
  const imoveis = lista.filter((imovel) => {
    if (filtros.negocio && !imovel.ofertas.some((oferta) => oferta.negocio === filtros.negocio)) return false;
    if (filtros.tipo && imovel.tipo !== filtros.tipo) return false;
    if (filtros.bairro && normalizar(imovel.bairro) !== normalizar(filtros.bairro)) return false;
    if (filtros.quartos && (imovel.quartos ?? 0) < filtros.quartos) return false;
    if (comFaixaDePreco) {
      const precos = precosRelevantes(imovel, filtros.negocio);
      if (precos.length === 0) {
        foraPorSobConsulta += 1;
        return false;
      }
      const dentro = (preco: number) =>
        (filtros.precoMin === undefined || preco >= filtros.precoMin) && (filtros.precoMax === undefined || preco <= filtros.precoMax);
      if (!precos.some(dentro)) return false;
    }
    return true;
  });
  return { imoveis: ordenar(imoveis, filtros), foraPorSobConsulta };
}

function ordenar(lista: ImovelPublico[], filtros: FiltrosLista): ImovelPublico[] {
  if (filtros.ordem === "recentes") return lista;
  const sentido = filtros.ordem === "menor_preco" ? 1 : -1;
  const chave = (imovel: ImovelPublico) => {
    const precos = precosRelevantes(imovel, filtros.negocio);
    return precos.length ? Math.min(...precos) : undefined;
  };
  return [...lista].sort((a, b) => {
    const precoA = chave(a);
    const precoB = chave(b);
    if (precoA === undefined) return precoB === undefined ? 0 : 1;
    if (precoB === undefined) return -1;
    return (precoA - precoB) * sentido;
  });
}

export function tiposDisponiveis(lista: ImovelPublico[]): Tipo[] {
  const presentes = new Set(lista.map((imovel) => imovel.tipo));
  return TIPOS.filter((tipo) => presentes.has(tipo));
}

export function bairrosDisponiveis(lista: ImovelPublico[]): string[] {
  return [...new Set(lista.map((imovel) => imovel.bairro))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function descreverFaixa(filtros: FiltrosLista): string {
  if (filtros.precoMin && filtros.precoMax) return `entre ${formatarReais(filtros.precoMin)} e ${formatarReais(filtros.precoMax)}`;
  if (filtros.precoMin) return `a partir de ${formatarReais(filtros.precoMin)}`;
  return `até ${formatarReais(filtros.precoMax ?? 0)}`;
}

type FiltroRemovivel = "quartos" | "preco" | "tipo" | "bairro" | "negocio";
const NOME_DO_FILTRO: Record<FiltroRemovivel, string> = {
  quartos: "quartos",
  preco: "preço",
  tipo: "tipo",
  bairro: "bairro",
  negocio: "negócio",
};

function sem(filtros: FiltrosLista, filtro: FiltroRemovivel): FiltrosLista {
  const copia = { ...filtros };
  if (filtro === "preco") {
    delete copia.precoMin;
    delete copia.precoMax;
  } else {
    delete copia[filtro];
  }
  return copia;
}

function ativo(filtros: FiltrosLista, filtro: FiltroRemovivel): boolean {
  return filtro === "preco" ? Boolean(filtros.precoMin || filtros.precoMax) : Boolean(filtros[filtro]);
}

export function descreverVazio(filtros: FiltrosLista, lista: ImovelPublico[]): string {
  if (lista.length === 0) return "Ainda não há imóveis publicados. Fale com o Moisés pelo WhatsApp para saber das novidades.";
  const partes = ["Nenhum imóvel"];
  if (filtros.negocio) partes.push(`de ${filtros.negocio}`);
  if (filtros.tipo) partes.push(`do tipo ${ROTULO_TIPO[filtros.tipo].toLowerCase()}`);
  if (filtros.quartos) partes.push(`com ${filtros.quartos} ${filtros.quartos === 1 ? "quarto" : "quartos"} ou mais`);
  if (ativo(filtros, "preco")) partes.push(descreverFaixa(filtros));
  if (filtros.bairro) partes.push(`no bairro ${filtros.bairro}`);
  const frase = `${partes.join(" ")}.`;
  for (const filtro of ["quartos", "preco", "tipo", "bairro", "negocio"] as const) {
    if (!ativo(filtros, filtro)) continue;
    const quantidade = filtrarImoveis(lista, sem(filtros, filtro)).imoveis.length;
    if (quantidade > 0) return `${frase} Remova o filtro de ${NOME_DO_FILTRO[filtro]} para ver ${quantidade}.`;
  }
  return `${frase} Remova os filtros para ver os ${lista.length} imóveis publicados.`;
}

export function avisoSobConsulta(quantidade: number): string {
  return quantidade === 1
    ? "1 imóvel com preço sob consulta não entra neste filtro."
    : `${quantidade} imóveis com preço sob consulta não entram neste filtro.`;
}

export function tituloDaLista(filtros: FiltrosLista): string {
  if (filtros.negocio === "venda") return "Imóveis à venda";
  if (filtros.negocio === "aluguel") return "Imóveis para alugar";
  return "Todos os imóveis";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/lib/apresentacao/filtros.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/apresentacao/filtros.ts apps/site/src/lib/apresentacao/filtros.test.ts
git commit -m "feat(site): filtros na URL, ordenação por preço e estado vazio explicado"
```

---

### Task 1.4: Vitrine (hero, abas) e leitura do catálogo

**Files:**
- Create: `apps/site/src/lib/apresentacao/vitrine.ts`, `apps/site/src/lib/catalogo.ts`
- Test: `apps/site/src/lib/apresentacao/vitrine.test.ts`

**Interfaces:**
- Consumes: `Imovel`, `ImovelPublico`, `paraPublico`, `paraFlagsPublicas`, `servicos()`, `REGEX_CODIGO`.
- Produces (`vitrine.ts`): `LIMITE_HERO = 5`, `HERO_SEM_DESTAQUE = 3`, `LIMITE_FAIXAS = 6`, `SEGUNDOS_POR_SLIDE = 6`, `publicadosDe(todos: Imovel[]): ImovelPublico[]` (só publicados, mais recentes primeiro), `selecionarHero(publicados)`, `imoveisDaAba(publicados, negocio?)`, `rotuloDosNegocios(imovel, aba?)`, `keyframesHero(quantidade)`.
- Produces (`catalogo.ts`, só servidor): `carregarPublicados(): Promise<ImovelPublico[]>`, `carregarImovelPublicado(codigo): Promise<ImovelPublico | null>`, `carregarFlagsPublicas(): Promise<FlagsPublicas>`, `registrarFalhaCatalogo(erro: unknown): void`.

- [ ] **Step 1: Testes**

`src/lib/apresentacao/vitrine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { imovelDeExemplo } from "@/testes/fixtures";
import { imoveisDaAba, keyframesHero, publicadosDe, rotuloDosNegocios, selecionarHero } from "./vitrine";

const dia = (n: number) => `2026-10-${String(n).padStart(2, "0")}T12:00:00.000Z`;

describe("publicadosDe", () => {
  it("só publicados, mais recentes primeiro, sem dados internos", () => {
    const todos = [
      imovelDeExemplo({ codigo: "MC001", publicado_em: dia(1) }),
      imovelDeExemplo({ codigo: "MC002", publicado_em: dia(5) }),
      imovelDeExemplo({ codigo: "MC003", publicacao: "rascunho", publicado_em: undefined }),
    ];
    const publicados = publicadosDe(todos);
    expect(publicados.map((imovel) => imovel.codigo)).toEqual(["MC002", "MC001"]);
    expect(publicados[0]).not.toHaveProperty("historico");
  });
});

describe("selecionarHero", () => {
  it("usa os destaques disponíveis, no máximo 5, e ignora reservado", () => {
    const publicados = publicadosDe([
      imovelDeExemplo({ codigo: "MC001", destaque: true, publicado_em: dia(1) }),
      imovelDeExemplo({ codigo: "MC002", destaque: true, status: "reservado", publicado_em: dia(2) }),
      imovelDeExemplo({ codigo: "MC003", destaque: false, publicado_em: dia(3) }),
    ]);
    expect(selecionarHero(publicados).map((imovel) => imovel.codigo)).toEqual(["MC001"]);
  });

  it("sem destaque, os 3 disponíveis mais recentes", () => {
    const publicados = publicadosDe(
      [1, 2, 3, 4].map((n) => imovelDeExemplo({ codigo: `MC00${n}`, publicado_em: dia(n) })),
    );
    expect(selecionarHero(publicados).map((imovel) => imovel.codigo)).toEqual(["MC004", "MC003", "MC002"]);
  });
});

describe("abas Comprar e Alugar", () => {
  const ambos = imovelDeExemplo({
    codigo: "MC001",
    ofertas: [
      { negocio: "venda", preco: 1 },
      { negocio: "aluguel", preco: 1 },
    ],
  });
  const soAluguel = imovelDeExemplo({ codigo: "MC002", ofertas: [{ negocio: "aluguel", preco: 1 }] });
  const publicados = publicadosDe([ambos, soAluguel]);

  it("imóvel com as duas ofertas aparece nas duas abas", () => {
    expect(imoveisDaAba(publicados, "venda").map((imovel) => imovel.codigo)).toEqual(["MC001"]);
    expect(imoveisDaAba(publicados, "aluguel").map((imovel) => imovel.codigo).sort()).toEqual(["MC001", "MC002"]);
  });

  it("rótulo do negócio segue a aba ou lista os dois", () => {
    expect(rotuloDosNegocios(publicados.find((imovel) => imovel.codigo === "MC001")!, "aluguel")).toBe("Aluguel");
    expect(rotuloDosNegocios(publicados.find((imovel) => imovel.codigo === "MC001")!)).toBe("Venda e aluguel");
  });
});

describe("keyframesHero", () => {
  it("cada slide fica 6 s visível; com 3 slides o ciclo é 18 s", () => {
    expect(keyframesHero(3)).toContain("33.33%{opacity:1}");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/apresentacao/vitrine.test.ts`
Expected: FAIL com `Failed to resolve import "./vitrine"`.

- [ ] **Step 3: Implementar `vitrine.ts`**

```ts
import type { Negocio } from "@/lib/contratos/comum";
import type { Imovel } from "@/lib/contratos/imovel";
import { paraPublico, type ImovelPublico } from "@/lib/contratos/publico";
import { ROTULO_NEGOCIO } from "./formatar";

export const LIMITE_HERO = 5;
export const HERO_SEM_DESTAQUE = 3;
export const LIMITE_FAIXAS = 6;
export const SEGUNDOS_POR_SLIDE = 6;

const dataDePublicacao = (imovel: ImovelPublico) => imovel.publicado_em ?? imovel.atualizado_em;

export function publicadosDe(todos: Imovel[]): ImovelPublico[] {
  return todos
    .filter((imovel) => imovel.publicacao === "publicado")
    .map(paraPublico)
    .sort((a, b) => dataDePublicacao(b).localeCompare(dataDePublicacao(a)));
}

/** Destaques disponíveis (máx. 5); sem nenhum, os 3 disponíveis mais recentes. Reservado não entra (spec seção 5). */
export function selecionarHero(publicados: ImovelPublico[]): ImovelPublico[] {
  const disponiveis = publicados.filter((imovel) => imovel.status === "disponivel");
  const destaques = disponiveis.filter((imovel) => imovel.destaque).slice(0, LIMITE_HERO);
  return destaques.length > 0 ? destaques : disponiveis.slice(0, HERO_SEM_DESTAQUE);
}

export function imoveisDaAba(publicados: ImovelPublico[], negocio?: Negocio): ImovelPublico[] {
  return negocio ? publicados.filter((imovel) => imovel.ofertas.some((oferta) => oferta.negocio === negocio)) : publicados;
}

export function rotuloDosNegocios(imovel: ImovelPublico, aba?: Negocio): string {
  if (aba) return ROTULO_NEGOCIO[aba];
  const negocios = imovel.ofertas.map((oferta) => oferta.negocio);
  return negocios.length === 2 ? "Venda e aluguel" : ROTULO_NEGOCIO[negocios[0]];
}

/** Keyframes do Ken Burns para N slides de 6 s, com 1 s de transição. */
export function keyframesHero(quantidade: number): string {
  const total = quantidade * SEGUNDOS_POR_SLIDE;
  const pct = (segundos: number) => `${((segundos / total) * 100).toFixed(2)}%`;
  return (
    "@keyframes hero-fade{" +
    "0%{opacity:0;transform:scale(1.12)}" +
    `${pct(1)}{opacity:1}` +
    `${pct(SEGUNDOS_POR_SLIDE)}{opacity:1}` +
    `${pct(SEGUNDOS_POR_SLIDE + 1)}{opacity:0;transform:scale(1)}` +
    "100%{opacity:0;transform:scale(1)}}"
  );
}
```

- [ ] **Step 4: Implementar `catalogo.ts`**

```ts
import { REGEX_CODIGO } from "./contratos/comum";
import { paraFlagsPublicas, type FlagsPublicas } from "./contratos/flags";
import type { ImovelPublico } from "./contratos/publico";
import { publicadosDe } from "./apresentacao/vitrine";
import { servicos } from "./servicos";

/** Leituras do site público. Rascunho nunca sai daqui. */
export async function carregarPublicados(): Promise<ImovelPublico[]> {
  return publicadosDe(await servicos().catalogo());
}

export async function carregarImovelPublicado(codigo: string): Promise<ImovelPublico | null> {
  if (!REGEX_CODIGO.test(codigo)) return null;
  return (await carregarPublicados()).find((imovel) => imovel.codigo === codigo) ?? null;
}

export async function carregarFlagsPublicas(): Promise<FlagsPublicas> {
  return paraFlagsPublicas(await servicos().flags());
}

/** Log sem dados do imóvel: só a mensagem do erro de infraestrutura. */
export function registrarFalhaCatalogo(erro: unknown): void {
  console.error("[catalogo] leitura falhou:", erro instanceof Error ? erro.message : String(erro));
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- src/lib/apresentacao/vitrine.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/lib/apresentacao/vitrine.ts apps/site/src/lib/apresentacao/vitrine.test.ts apps/site/src/lib/catalogo.ts
git commit -m "feat(site): seleção do hero, abas por negócio e leitura do catálogo público"
```

---

### Task 1.5: Base visual (tokens, fontes, cabeçalho, rodapé, WhatsApp, foto)

**Files:**
- Modify: `apps/site/src/app/layout.tsx`, `apps/site/src/app/globals.css`, `apps/site/eslint.config.mjs`
- Delete: `apps/site/src/app/page.tsx` (a home passa para `src/app/(site)/page.tsx` na Task 1.6)
- Create: `apps/site/src/app/(site)/layout.tsx`, `apps/site/src/components/site/Cabecalho.tsx`, `apps/site/src/components/site/Rodape.tsx`, `apps/site/src/components/site/LinkWhatsApp.tsx`, `apps/site/src/components/site/BotaoFlutuante.tsx`, `apps/site/src/components/site/IconeWhatsApp.tsx`, `apps/site/src/components/site/Foto.tsx`
- Test: `apps/site/src/components/site/componentes.test.tsx`

**Interfaces:**
- Consumes: `urlWhatsApp`, `TELEFONE_EXIBIDO`, `Foto` (contrato), `LARGURAS_FOTO`, `ORIGENS_CLIQUE`.
- Produces:
  - `LinkWhatsApp({ origem, codigo?, titulo?, negocio?, className?, rotuloAcessivel?, children })` → `<a>` com `href` do WhatsApp, `target="_blank"`, `data-evento="clique_whatsapp"`, `data-origem`, `data-codigo`, `data-negocio`.
  - `BotaoFlutuante({ codigo?, titulo?, negocio? })`.
  - `Foto({ foto, alt, sizes, prioridade?, className? })` e `textoAlternativo(foto, titulo): string`.
  - Classes CSS globais: `.pagina`, `.kicker`, `.btn`, `.btn-whatsapp`, `.selo`, `.whatsapp-flutuante`, `.pular`.

- [ ] **Step 1: Teste dos componentes (render no servidor)**

`src/components/site/componentes.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fotosDeExemplo } from "@/testes/fixtures";
import { Foto, textoAlternativo } from "./Foto";
import { LinkWhatsApp } from "./LinkWhatsApp";

describe("LinkWhatsApp", () => {
  it("leva a mensagem pronta e os atributos que a medição lê", () => {
    const html = renderToStaticMarkup(
      <LinkWhatsApp origem="imovel" codigo="MC003" titulo="Casa ampla" negocio="aluguel">
        Falar com o Moisés
      </LinkWhatsApp>,
    );
    expect(html).toContain('href="https://wa.me/5511996767680?text=');
    expect(html).toContain('data-evento="clique_whatsapp"');
    expect(html).toContain('data-origem="imovel"');
    expect(html).toContain('data-codigo="MC003"');
    expect(html).toContain('data-negocio="aluguel"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("sem imóvel não escreve data-codigo", () => {
    const html = renderToStaticMarkup(<LinkWhatsApp origem="contato">Oi</LinkWhatsApp>);
    expect(html).not.toContain("data-codigo");
  });
});

describe("Foto", () => {
  const [foto] = fotosDeExemplo("MC001", 1);

  it("tem srcset com as três larguras e placeholder de fundo", () => {
    const html = renderToStaticMarkup(<Foto foto={foto} alt="Sala" sizes="100vw" />);
    expect(html).toContain("1-abcdef0123-800.webp 800w");
    expect(html).toContain("1-abcdef0123-1600.webp 1600w");
    expect(html).toContain("1-abcdef0123-2560.webp 2560w");
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("data:image/webp;base64");
  });

  it("com prioridade carrega na hora", () => {
    // O React escreve o atributo em minúsculas (fetchpriority) no HTML.
    const html = renderToStaticMarkup(<Foto foto={foto} alt="Sala" sizes="100vw" prioridade />).toLowerCase();
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchpriority="high"');
  });

  it("texto alternativo usa a legenda, ou título e número da foto", () => {
    expect(textoAlternativo({ ...foto, legenda: "Varanda com vista" }, "Casa")).toBe("Varanda com vista");
    expect(textoAlternativo(foto, "Casa com piscina")).toBe("Casa com piscina, foto 1");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/components/site/componentes.test.tsx`
Expected: FAIL com `Failed to resolve import "./Foto"`.

- [ ] **Step 3: Componentes**

`src/components/site/IconeWhatsApp.tsx`:

```tsx
export function IconeWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.7-1.1-4.5-3.9-4.6-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.4Z" />
    </svg>
  );
}
```

`src/components/site/LinkWhatsApp.tsx`:

```tsx
import type { ReactNode } from "react";
import { urlWhatsApp } from "@/lib/apresentacao/whatsapp";
import type { Negocio } from "@/lib/contratos/comum";
import type { ORIGENS_CLIQUE } from "@/lib/contratos/eventos";

export type OrigemClique = (typeof ORIGENS_CLIQUE)[number];

interface Props {
  origem: OrigemClique;
  codigo?: string;
  titulo?: string;
  negocio?: Negocio;
  className?: string;
  rotuloAcessivel?: string;
  children: ReactNode;
}

/** Todo botão de WhatsApp do site passa por aqui. Os data-* são lidos pela medição (frente 4). */
export function LinkWhatsApp({ origem, codigo, titulo, negocio, className, rotuloAcessivel, children }: Props) {
  return (
    <a
      href={urlWhatsApp({ codigo, titulo, negocio })}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={rotuloAcessivel}
      data-evento="clique_whatsapp"
      data-origem={origem}
      data-codigo={codigo}
      data-negocio={negocio}
    >
      {children}
    </a>
  );
}
```

`src/components/site/BotaoFlutuante.tsx`:

```tsx
import type { Negocio } from "@/lib/contratos/comum";
import { IconeWhatsApp } from "./IconeWhatsApp";
import { LinkWhatsApp } from "./LinkWhatsApp";

export function BotaoFlutuante({ codigo, titulo, negocio }: { codigo?: string; titulo?: string; negocio?: Negocio }) {
  return (
    <LinkWhatsApp
      origem="flutuante"
      codigo={codigo}
      titulo={titulo}
      negocio={negocio}
      className="whatsapp-flutuante"
      rotuloAcessivel="Falar com o Moisés pelo WhatsApp"
    >
      <IconeWhatsApp />
    </LinkWhatsApp>
  );
}
```

`src/components/site/Foto.tsx`:

```tsx
import { LARGURAS_FOTO, type Foto as FotoDoImovel } from "@/lib/contratos/imovel";

interface Props {
  foto: FotoDoImovel;
  alt: string;
  sizes: string;
  prioridade?: boolean;
  className?: string;
}

export function textoAlternativo(foto: FotoDoImovel, titulo: string): string {
  return foto.legenda ?? `${titulo}, foto ${foto.ordem}`;
}

/** Servida direto do CDN do store público, sem otimizador da Vercel (spec seção 5). */
export function Foto({ foto, alt, sizes, prioridade = false, className }: Props) {
  const srcSet = LARGURAS_FOTO.map((largura) => `${foto.larguras[String(largura) as `${typeof largura}`]} ${largura}w`).join(", ");
  return (
    <img
      src={foto.larguras["1600"]}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={prioridade ? "eager" : "lazy"}
      fetchPriority={prioridade ? "high" : "auto"}
      decoding="async"
      className={className}
      style={{ backgroundImage: `url(${foto.placeholder})`, backgroundSize: "cover" }}
    />
  );
}
```

`src/components/site/Cabecalho.tsx`:

```tsx
import Link from "next/link";

const LINKS = [
  { href: "/imoveis?negocio=venda", rotulo: "Comprar" },
  { href: "/imoveis?negocio=aluguel", rotulo: "Alugar" },
  { href: "/imoveis", rotulo: "Todos os imóveis" },
  { href: "/#contato", rotulo: "Contato" },
];

export function Cabecalho() {
  const links = LINKS.map((link) => (
    <Link key={link.href} href={link.href}>
      {link.rotulo}
    </Link>
  ));
  return (
    <header className="cabecalho">
      <Link href="/" className="cabecalho-marca" aria-label="M.C. Vieira, página inicial">
        <img src="/marca/logo-horizontal-branco.svg" alt="M.C. Vieira" width={196} height={42} />
      </Link>
      <nav aria-label="Principal" className="cabecalho-nav">
        {links}
      </nav>
      <details className="cabecalho-menu">
        <summary>Menu</summary>
        <nav aria-label="Menu">{links}</nav>
      </details>
    </header>
  );
}
```

`src/components/site/Rodape.tsx`:

```tsx
import Link from "next/link";
import { TELEFONE_EXIBIDO } from "@/lib/apresentacao/whatsapp";
import { LinkWhatsApp } from "./LinkWhatsApp";

export function Rodape() {
  return (
    <footer className="rodape">
      <div>
        <img src="/marca/logo-horizontal-branco.svg" alt="M.C. Vieira" width={206} height={44} />
        <p>Embu-Guaçu · SP · CRECI 67.944-F</p>
      </div>
      <div>
        <p>
          <LinkWhatsApp origem="contato">WhatsApp {TELEFONE_EXIBIDO}</LinkWhatsApp>
        </p>
        <p>@mcvieiraimoveis</p>
        <p>
          <Link href="/privacidade">Privacidade</Link>
        </p>
      </div>
    </footer>
  );
}
```

`src/app/(site)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { Cabecalho } from "@/components/site/Cabecalho";
import { Rodape } from "@/components/site/Rodape";

export default function LayoutDoSite({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#conteudo" className="pular">
        Pular para o conteúdo
      </a>
      <Cabecalho />
      {children}
      <Rodape />
    </>
  );
}
```

`src/app/layout.tsx` (substitui o da frente 0):

```tsx
import type { Metadata } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const fonteTexto = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--fonte-texto", display: "swap" });
const fonteTitulo = Playfair_Display({ subsets: ["latin"], weight: ["400"], style: ["normal", "italic"], variable: "--fonte-titulo", display: "swap" });

export const metadata: Metadata = {
  title: { default: "M.C. Vieira Imóveis", template: "%s · M.C. Vieira Imóveis" },
  description: "Imóveis selecionados em Embu-Guaçu e região. Fale direto com o corretor Moisés pelo WhatsApp.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fonteTexto.variable} ${fonteTitulo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

Apague `src/app/page.tsx`: `rm apps/site/src/app/page.tsx`.

- [ ] **Step 4: CSS global**

`src/app/globals.css` (substitui o da frente 0). `--vinho-texto` é um tom derivado do vinho com contraste 7:1 sobre o marinho, para o texto `.kicker` passar no axe (o `--vinho-claro` do mock dá 3,2:1). O texto do botão de WhatsApp é marinho escuro: branco sobre `#25D366` dá 1,9:1.

```css
:root {
  --vinho: #8b1e2d;
  --vinho-claro: #b8475a;
  --vinho-texto: #e08a99;
  --rosa: #f2d6da;
  --marinho: #1f3a68;
  --noite: #0e1726;
  --noite2: #131f33;
  --off: #faf8f4;
  --linha: rgba(250, 248, 244, 0.14);
  --verde-whatsapp: #25d366;
  --cinza-texto: #555555;
  --margem: 56px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: var(--fonte-texto), Montserrat, sans-serif;
  background: var(--noite);
  color: var(--off);
  -webkit-font-smoothing: antialiased;
  line-height: 1.5;
}
a { color: inherit; text-decoration: none; }
img { display: block; max-width: 100%; }
:focus-visible { outline: 2px solid var(--rosa); outline-offset: 3px; }

.pular { position: absolute; left: -9999px; top: 8px; z-index: 50; background: var(--off); color: var(--noite); padding: 8px 12px; }
.pular:focus { left: 8px; }

.pagina { padding: 120px var(--margem) 80px; max-width: 1280px; margin: 0 auto; }
.kicker { font-size: 11px; letter-spacing: 0.36em; text-transform: uppercase; font-weight: 500; color: var(--vinho-texto); }
h1, h2, h3 { font-family: var(--fonte-titulo), "Playfair Display", serif; font-weight: 400; }

.btn {
  display: inline-block; border: 1px solid var(--off); padding: 16px 32px; font-size: 12px;
  letter-spacing: 0.24em; text-transform: uppercase; font-weight: 500; transition: background 0.3s, color 0.3s;
}
.btn:hover { background: var(--off); color: var(--noite); }

/* Única cor de ação do site: só em botão de WhatsApp. */
.btn-whatsapp {
  display: inline-flex; align-items: center; gap: 10px; background: var(--verde-whatsapp); color: var(--noite);
  padding: 16px 32px; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 600;
}
.btn-whatsapp:hover { filter: brightness(1.05); }

.selo {
  display: inline-block; background: var(--off); color: var(--noite); font-size: 11px; letter-spacing: 0.18em;
  text-transform: uppercase; padding: 6px 10px; font-weight: 600;
}

.whatsapp-flutuante {
  position: fixed; right: 24px; bottom: 24px; z-index: 20; width: 58px; height: 58px; border-radius: 50%;
  background: var(--verde-whatsapp); display: grid; place-items: center; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.whatsapp-flutuante svg { width: 30px; height: 30px; fill: var(--noite); }

.cabecalho {
  position: absolute; inset: 0 0 auto 0; z-index: 10; display: flex; align-items: center; justify-content: space-between;
  padding: 24px var(--margem); background: linear-gradient(rgba(14, 23, 38, 0.7), transparent);
}
.cabecalho-marca img { height: 42px; width: auto; }
.cabecalho-nav { display: flex; gap: 36px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; }
.cabecalho-menu { display: none; position: relative; }
.cabecalho-menu summary { cursor: pointer; list-style: none; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; padding: 8px; }
.cabecalho-menu nav { position: absolute; right: 0; top: 40px; background: var(--noite2); display: grid; gap: 16px; padding: 20px; min-width: 220px; }

.rodape {
  padding: 64px var(--margem) 96px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 24px;
  font-size: 13px; line-height: 1.9; border-top: 1px solid var(--linha);
}
.rodape img { height: 44px; width: auto; margin-bottom: 12px; }
.rodape a { text-decoration: underline; text-underline-offset: 3px; }

.aviso { margin: 16px 0; padding: 12px 16px; border-left: 3px solid var(--vinho-texto); background: var(--noite2); font-size: 14px; }
.estado-erro { display: flex; flex-direction: column; gap: 20px; align-items: flex-start; min-height: 60vh; }

@media (max-width: 900px) {
  :root { --margem: 20px; }
  .cabecalho { padding: 18px var(--margem); }
  .cabecalho-marca img { height: 32px; }
  .cabecalho-nav { display: none; }
  .cabecalho-menu { display: block; }
  .pagina { padding-top: 96px; }
  .rodape { padding: 48px var(--margem) 104px; }
}
```

- [ ] **Step 5: Lint: liberar `<img>` com justificativa**

Em `eslint.config.mjs`, dentro do array de `defineConfig([...])`, depois de `...nextTs,`, acrescente:

```js
  {
    // Fotos vêm do CDN do store público sem o otimizador da Vercel (spec seção 5); next/image não se aplica.
    rules: { "@next/next/no-img-element": "off" },
  },
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- src/components/site/componentes.test.tsx && npm run typecheck && npm run lint`
Expected: PASS e sem erros. (O build fica para a Task 1.6, que cria a home.)

- [ ] **Step 7: Conferência de fidelidade ao mock C4 (os tokens, fontes, cabeçalho, rodapé e botão do WhatsApp)**

Siga o procedimento de "Fidelidade ao mock C4" (início deste arquivo) para os tokens, fontes, cabeçalho, rodapé e botão do WhatsApp: abra o mock e o app lado a lado em 1440 px e 390 px, compare estrutura, textos, tipografia, cores, espaçamentos e estados, e escreva a lista de diferenças. Diferença sem aprovação do usuário não se commita: pare e peça aprovação com o formato descrito na seção. Registre as aprovadas em `tasks/todo.md`.

- [ ] **Step 8: Commit**

```bash
git add apps/site/src/app/layout.tsx apps/site/src/app/globals.css apps/site/eslint.config.mjs "apps/site/src/app/(site)/layout.tsx" apps/site/src/components/site
git rm apps/site/src/app/page.tsx
git commit -m "feat(site): base visual C4 com fontes, cabeçalho, rodapé, WhatsApp e foto responsiva"
```

---

### Task 1.6: Home

**Files:**
- Create: `apps/site/src/app/(site)/page.tsx`, `apps/site/src/app/(site)/home.css`
- Create: `apps/site/src/components/site/Hero.tsx`, `apps/site/src/components/site/ChaveNegocio.tsx`, `apps/site/src/components/site/FaixaImovel.tsx`, `apps/site/src/components/site/SecaoPrazer.tsx`, `apps/site/src/components/site/ErroCatalogo.tsx`, `apps/site/src/components/site/BlocoPreco.tsx`, `apps/site/src/components/site/ListaCampos.tsx`

**Interfaces:**
- Consumes: `carregarPublicados`, `carregarFlagsPublicas`, `registrarFalhaCatalogo`, `selecionarHero`, `imoveisDaAba`, `rotuloDosNegocios`, `keyframesHero`, `LIMITE_FAIXAS`, `SEGUNDOS_POR_SLIDE`, `linhasDePreco`, `camposExibidos`, `lerFiltros`, `Foto`, `textoAlternativo`, `LinkWhatsApp`, `BotaoFlutuante`.
- Produces: `BlocoPreco({ linhas })`, `ListaCampos({ campos, className? })`, `ErroCatalogo()` (reusados nas Tasks 1.7 e 1.8).

- [ ] **Step 1: Componentes compartilhados de preço, campos e erro**

`src/components/site/BlocoPreco.tsx`:

```tsx
import type { LinhaDePreco } from "@/lib/apresentacao/formatar";

/** Uma linha por oferta; conta como um bloco só na primeira dobra (spec 4.2). */
export function BlocoPreco({ linhas }: { linhas: LinhaDePreco[] }) {
  return (
    <div className="preco">
      {linhas.map((linha) => (
        <p key={linha.negocio} className="preco-linha">
          <span className="preco-rotulo">{linha.rotulo}</span> <span className="preco-valor">{linha.valor}</span>
        </p>
      ))}
    </div>
  );
}
```

`src/components/site/ListaCampos.tsx`:

```tsx
import type { CampoExibido } from "@/lib/apresentacao/campos";

export function ListaCampos({ campos, className = "campos" }: { campos: CampoExibido[]; className?: string }) {
  return (
    <dl className={className}>
      {campos.map((campo) => (
        <div key={campo.chave}>
          <dt>{campo.rotulo}</dt>
          <dd>{campo.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
```

`src/components/site/ErroCatalogo.tsx`:

```tsx
import { LinkWhatsApp } from "./LinkWhatsApp";

/** Estado de erro (Blob indisponível): mensagem clara e o botão do WhatsApp (spec seção 5). */
export function ErroCatalogo() {
  return (
    <main id="conteudo" className="pagina estado-erro">
      <p className="kicker">Imóveis</p>
      <h1>Não conseguimos carregar os imóveis agora</h1>
      <p>Tente de novo em alguns minutos. Se preferir, fale direto com o Moisés pelo WhatsApp.</p>
      <LinkWhatsApp origem="contato" className="btn-whatsapp">
        Falar com o Moisés
      </LinkWhatsApp>
    </main>
  );
}
```

- [ ] **Step 2: Hero, chave, faixa e seção "Prazer"**

`src/components/site/Hero.tsx`:

```tsx
import type { CSSProperties } from "react";
import Link from "next/link";
import { keyframesHero, SEGUNDOS_POR_SLIDE } from "@/lib/apresentacao/vitrine";
import type { ImovelPublico } from "@/lib/contratos/publico";
import { Foto, textoAlternativo } from "./Foto";

export function Hero({ imoveis }: { imoveis: ImovelPublico[] }) {
  const varios = imoveis.length > 1;
  const estilo = { "--hero-duracao": `${imoveis.length * SEGUNDOS_POR_SLIDE}s` } as CSSProperties;
  return (
    <section className={varios ? "hero" : "hero hero-unico"} style={estilo} aria-label="Apresentação">
      {varios && <style>{keyframesHero(imoveis.length)}</style>}
      {imoveis.map((imovel, indice) => (
        // O primeiro slide começa 1 s adiantado para estar visível no primeiro quadro (LCP).
        <div key={imovel.codigo} className="hero-slide" style={{ animationDelay: `${indice * SEGUNDOS_POR_SLIDE - 1}s` }}>
          <Foto foto={imovel.fotos[0]} alt={textoAlternativo(imovel.fotos[0], imovel.titulo)} sizes="100vw" prioridade={indice === 0} />
        </div>
      ))}
      <div className="hero-texto">
        <p className="kicker hero-kicker">M.C. Vieira · Corretor de imóveis</p>
        <h1>
          Viver bem
          <br />
          começa em <em>casa.</em>
        </h1>
        <p>Imóveis selecionados em Embu-Guaçu e região</p>
        <div className="hero-acoes">
          <Link className="btn" href="/imoveis?negocio=venda">
            Quero comprar
          </Link>
          <Link className="btn" href="/imoveis?negocio=aluguel">
            Quero alugar
          </Link>
        </div>
      </div>
      <p className="hero-rolar" aria-hidden="true">
        Role para descobrir
      </p>
    </section>
  );
}
```

`src/components/site/ChaveNegocio.tsx`:

```tsx
import Link from "next/link";
import type { Negocio } from "@/lib/contratos/comum";

const OPCOES: { negocio?: Negocio; rotulo: string }[] = [
  { negocio: "venda", rotulo: "Comprar" },
  { negocio: "aluguel", rotulo: "Alugar" },
  { rotulo: "Todos" },
];

export function ChaveNegocio({ atual }: { atual?: Negocio }) {
  return (
    <nav className="chave" aria-label="Comprar ou alugar">
      {OPCOES.map((opcao) => {
        const href = opcao.negocio ? `/?negocio=${opcao.negocio}#vitrine` : "/#vitrine";
        const ativo = opcao.negocio === atual;
        return (
          <Link key={opcao.rotulo} href={href} aria-current={ativo ? "page" : undefined} className={ativo ? "chave-ativa" : undefined}>
            {opcao.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
```

`src/components/site/FaixaImovel.tsx`:

```tsx
import Link from "next/link";
import { camposExibidos } from "@/lib/apresentacao/campos";
import { linhasDePreco } from "@/lib/apresentacao/formatar";
import { rotuloDosNegocios } from "@/lib/apresentacao/vitrine";
import type { Negocio } from "@/lib/contratos/comum";
import type { FlagsPublicas } from "@/lib/contratos/flags";
import type { ImovelPublico } from "@/lib/contratos/publico";
import { BlocoPreco } from "./BlocoPreco";
import { Foto, textoAlternativo } from "./Foto";
import { ListaCampos } from "./ListaCampos";

interface Props {
  imovel: ImovelPublico;
  indice: number;
  aba?: Negocio;
  flags: FlagsPublicas;
}

export function FaixaImovel({ imovel, indice, aba, flags }: Props) {
  const href = `/imoveis/${imovel.codigo}${aba ? `?negocio=${aba}` : ""}`;
  return (
    <Link href={href} className={indice % 2 === 1 ? "faixa faixa-invertida" : "faixa"}>
      <div className="faixa-foto">
        <Foto foto={imovel.fotos[0]} alt={textoAlternativo(imovel.fotos[0], imovel.titulo)} sizes="(max-width: 900px) 100vw, 60vw" />
      </div>
      <div className="faixa-info">
        <p className="faixa-numero">
          {String(indice + 1).padStart(2, "0")} · {rotuloDosNegocios(imovel, aba).toUpperCase()}
        </p>
        <h3>{imovel.titulo}</h3>
        <p className="faixa-local">
          {imovel.bairro} · {imovel.cidade}
        </p>
        {imovel.status === "reservado" && <p className="selo">Reservado</p>}
        <ListaCampos campos={camposExibidos(imovel, flags.primeira_dobra).slice(0, 3)} className="faixa-campos" />
        <BlocoPreco linhas={linhasDePreco(imovel.ofertas, aba)} />
        <span className="btn">Ver imóvel</span>
      </div>
    </Link>
  );
}
```

`src/components/site/SecaoPrazer.tsx`:

```tsx
import type { Foto as FotoDoImovel } from "@/lib/contratos/imovel";
import { Foto } from "./Foto";
import { LinkWhatsApp } from "./LinkWhatsApp";

/** "Prazer, eu sou": só texto e foto de imóvel, sem foto do Moisés (decisão 3). */
export function SecaoPrazer({ foto }: { foto?: FotoDoImovel }) {
  return (
    <section id="contato" className="prazer">
      <div className="prazer-texto">
        <p className="kicker prazer-kicker">Prazer, eu sou</p>
        <h2>Moisés Cezarino Vieira</h2>
        <p>
          Mais de 20 anos ajudando famílias a comprar, vender, alugar e trocar imóveis com segurança e transparência. Aqui você
          não fala com central: fala comigo.
        </p>
        <p className="prazer-creci">CRECI 67.944-F</p>
        <LinkWhatsApp origem="contato" className="btn-whatsapp">
          Conversar no WhatsApp
        </LinkWhatsApp>
      </div>
      <div className="prazer-foto">{foto && <Foto foto={foto} alt="Imóvel apresentado pela M.C. Vieira" sizes="(max-width: 900px) 100vw, 50vw" />}</div>
    </section>
  );
}
```

- [ ] **Step 3: Página e CSS da home**

`src/app/(site)/page.tsx`:

```tsx
import Link from "next/link";
import { BotaoFlutuante } from "@/components/site/BotaoFlutuante";
import { ChaveNegocio } from "@/components/site/ChaveNegocio";
import { ErroCatalogo } from "@/components/site/ErroCatalogo";
import { FaixaImovel } from "@/components/site/FaixaImovel";
import { Hero } from "@/components/site/Hero";
import { SecaoPrazer } from "@/components/site/SecaoPrazer";
import { lerFiltros, type ParametrosDeBusca } from "@/lib/apresentacao/filtros";
import { imoveisDaAba, LIMITE_FAIXAS, selecionarHero } from "@/lib/apresentacao/vitrine";
import { carregarFlagsPublicas, carregarPublicados, registrarFalhaCatalogo } from "@/lib/catalogo";
import "./home.css";

export const dynamic = "force-dynamic";

export default async function PaginaInicial({ searchParams }: { searchParams: Promise<ParametrosDeBusca> }) {
  const aba = lerFiltros(await searchParams).negocio;
  let dados;
  try {
    const [publicados, flags] = await Promise.all([carregarPublicados(), carregarFlagsPublicas()]);
    dados = { publicados, flags };
  } catch (erro) {
    registrarFalhaCatalogo(erro);
    return <ErroCatalogo />;
  }
  const hero = selecionarHero(dados.publicados);
  const daAba = imoveisDaAba(dados.publicados, aba);
  return (
    <main id="conteudo">
      <Hero imoveis={hero} />
      <section className="intro">
        <p className="kicker">Seleção do mês</p>
        <h2>
          Cada imóvel é visitado, fotografado e apresentado <em>pessoalmente</em> pelo Moisés.
        </h2>
      </section>
      <section id="vitrine" aria-label="Imóveis" className="vitrine">
        <ChaveNegocio atual={aba} />
        {daAba.slice(0, LIMITE_FAIXAS).map((imovel, indice) => (
          <FaixaImovel key={imovel.codigo} imovel={imovel} indice={indice} aba={aba} flags={dados.flags} />
        ))}
        {daAba.length === 0 && <p className="vitrine-vazia">Nenhum imóvel publicado nesta opção por enquanto.</p>}
        <div className="ver-todos">
          <Link className="btn" href={aba ? `/imoveis?negocio=${aba}` : "/imoveis"}>
            Ver todos os {daAba.length} imóveis
          </Link>
        </div>
      </section>
      <SecaoPrazer foto={hero[0]?.fotos[0]} />
      <BotaoFlutuante />
    </main>
  );
}
```

`src/app/(site)/home.css`:

```css
.hero { position: relative; height: 100vh; min-height: 620px; overflow: hidden; background: var(--noite2); }
.hero-slide { position: absolute; inset: 0; opacity: 0; animation: hero-fade var(--hero-duracao) infinite; }
.hero-unico .hero-slide { opacity: 1; animation: none; }
.hero-slide img { width: 100%; height: 100%; object-fit: cover; }
.hero::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(14, 23, 38, 0.35) 0%, rgba(14, 23, 38, 0) 22%, rgba(14, 23, 38, 0) 50%, rgba(14, 23, 38, 0.55) 82%, var(--noite) 100%);
}
.hero-texto {
  position: absolute; z-index: 2; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 0 20px; text-shadow: 0 2px 24px rgba(0, 0, 0, 0.35);
}
.hero-kicker { color: var(--rosa); }
.hero h1 { font-size: clamp(44px, 7vw, 104px); line-height: 1; margin: 22px 0; }
.hero h1 em { font-style: italic; color: var(--rosa); }
.hero-texto > p:not(.kicker) { font-weight: 300; letter-spacing: 0.06em; font-size: 16px; }
.hero-acoes { display: flex; gap: 16px; margin-top: 40px; flex-wrap: wrap; justify-content: center; }
.hero-rolar { position: absolute; z-index: 2; bottom: 34px; left: 50%; transform: translateX(-50%); font-size: 10px; letter-spacing: 0.4em; text-transform: uppercase; opacity: 0.75; }

@media (prefers-reduced-motion: reduce) {
  .hero-slide { animation: none; opacity: 0; }
  .hero-slide:first-of-type { opacity: 1; }
}

.intro { text-align: center; padding: 120px 20px 80px; max-width: 820px; margin: auto; }
.intro h2 { font-size: clamp(28px, 3.4vw, 44px); line-height: 1.3; margin-top: 22px; }
.intro h2 em { font-style: italic; color: var(--rosa); }

.chave { display: flex; justify-content: center; gap: 8px; padding: 0 20px 40px; }
.chave a { padding: 12px 24px; border: 1px solid var(--linha); font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; }
.chave a.chave-ativa { border-color: var(--off); background: var(--off); color: var(--noite); }

.faixa { display: grid; grid-template-columns: 7fr 5fr; min-height: 640px; border-top: 1px solid var(--linha); }
.faixa-invertida { grid-template-columns: 5fr 7fr; }
.faixa-invertida .faixa-foto { order: 2; }
.faixa-foto { position: relative; overflow: hidden; }
.faixa-foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 1.6s cubic-bezier(0.2, 0.7, 0.2, 1); }
.faixa:hover .faixa-foto img { transform: scale(1.04); }
.faixa-info { padding: 80px 72px; display: flex; flex-direction: column; justify-content: center; gap: 12px; background: var(--noite2); }
.faixa-numero { font-family: var(--fonte-titulo), serif; font-size: 14px; opacity: 0.75; letter-spacing: 0.2em; }
.faixa h3 { font-size: clamp(30px, 3vw, 46px); line-height: 1.1; }
.faixa-local { font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; opacity: 0.75; }
.faixa-campos { display: flex; gap: 30px; margin: 26px 0; padding: 22px 0; border-top: 1px solid var(--linha); border-bottom: 1px solid var(--linha); }
.faixa-campos div, .campos div { display: flex; flex-direction: column-reverse; }
.faixa-campos dd, .campos dd { font-family: var(--fonte-titulo), serif; font-size: 26px; }
.faixa-campos dt, .campos dt { font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase; opacity: 0.75; }
.faixa .btn { align-self: flex-start; margin-top: 18px; }
.preco-linha { font-size: 20px; font-weight: 300; letter-spacing: 0.04em; }
.preco-rotulo { font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; opacity: 0.75; margin-right: 8px; }
.vitrine-vazia { text-align: center; padding: 40px 20px; }
.ver-todos { text-align: center; padding: 80px 20px 120px; }

.prazer { display: grid; grid-template-columns: 1fr 1fr; background: var(--off); color: #2b2b2b; }
.prazer-texto { padding: 110px 80px; display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
.prazer-kicker { color: var(--vinho); }
.prazer h2 { font-size: clamp(36px, 4vw, 58px); color: var(--vinho); line-height: 1.05; }
.prazer-texto > p:not(.kicker) { line-height: 1.85; font-weight: 300; color: var(--cinza-texto); max-width: 460px; }
.prazer-creci { font-family: var(--fonte-titulo), serif; font-style: italic; font-size: 22px; color: var(--marinho) !important; }
.prazer-foto { min-height: 560px; position: relative; background: var(--noite2); }
.prazer-foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

@media (max-width: 900px) {
  .faixa, .faixa-invertida { grid-template-columns: 1fr; min-height: 0; }
  .faixa-invertida .faixa-foto { order: 0; }
  .faixa-foto { height: 320px; }
  .faixa-info { padding: 44px 20px 56px; }
  .prazer { grid-template-columns: 1fr; }
  .prazer-texto { padding: 64px 20px; }
  .prazer-foto { min-height: 300px; }
}
```

- [ ] **Step 4: Ver a home rodando com dados locais**

Crie `apps/site/.env.local` (se ainda não existir) com `ARMAZEM_DRIVER=arquivo`, `ARMAZEM_DIR=.dados-local`, `FOTOS_ORIGEM=http://localhost:3000/dev-fotos`. Rode `npm run dev` e abra `http://localhost:3000`.
Expected: home com hero sem fotos (catálogo vazio), texto "Viver bem começa em casa.", chave Comprar/Alugar/Todos, "Nenhum imóvel publicado nesta opção por enquanto.", seção "Prazer, eu sou" e botão flutuante verde. As fotos de verdade entram no e2e (Task 1.10).

Run: `npm run typecheck && npm run lint && npm run build`
Expected: sem erros. O build lista `ƒ /` (dinâmica).

- [ ] **Step 5: Conferência de fidelidade ao mock C4 (a home)**

Siga o procedimento de "Fidelidade ao mock C4" (início deste arquivo) para a home: abra o mock e o app lado a lado em 1440 px e 390 px, compare estrutura, textos, tipografia, cores, espaçamentos e estados, e escreva a lista de diferenças. Diferença sem aprovação do usuário não se commita: pare e peça aprovação com o formato descrito na seção. Registre as aprovadas em `tasks/todo.md`.

- [ ] **Step 6: Commit**

```bash
git add "apps/site/src/app/(site)/page.tsx" "apps/site/src/app/(site)/home.css" apps/site/src/components/site
git commit -m "feat(site): home com hero Ken Burns, chave Comprar/Alugar, faixas e seção Prazer"
```

---

### Task 1.7: Lista `/imoveis` com filtros e estados

**Files:**
- Create: `apps/site/src/app/(site)/imoveis/(lista)/page.tsx`, `apps/site/src/app/(site)/imoveis/(lista)/loading.tsx`, `apps/site/src/app/(site)/imoveis/(lista)/lista.css`
- Create: `apps/site/src/components/site/FiltrosImoveis.tsx`, `apps/site/src/components/site/CartaoImovel.tsx`

**Interfaces:**
- Consumes: `lerFiltros`, `filtrarImoveis`, `tiposDisponiveis`, `bairrosDisponiveis`, `descreverVazio`, `avisoSobConsulta`, `tituloDaLista`, `ParametrosDeBusca`, `FiltrosLista`, `ROTULO_TIPO`, `linhasDePreco`, `camposExibidos`, `plural`, `carregarPublicados`, `carregarFlagsPublicas`, `registrarFalhaCatalogo`, `ErroCatalogo`, `BlocoPreco`, `ListaCampos`, `Foto`, `LinkWhatsApp`, `BotaoFlutuante`.

- [ ] **Step 1: Formulário de filtros (funciona sem JavaScript)**

`src/components/site/FiltrosImoveis.tsx`:

```tsx
import Link from "next/link";
import type { FiltrosLista } from "@/lib/apresentacao/filtros";
import { ROTULO_TIPO } from "@/lib/apresentacao/formatar";
import type { Tipo } from "@/lib/contratos/comum";

interface Props {
  filtros: FiltrosLista;
  tipos: Tipo[];
  bairros: string[];
}

export function FiltrosImoveis({ filtros, tipos, bairros }: Props) {
  return (
    <form method="get" action="/imoveis" className="filtros" aria-label="Filtrar imóveis">
      <label>
        Negócio
        <select name="negocio" defaultValue={filtros.negocio ?? ""}>
          <option value="">Comprar ou alugar</option>
          <option value="venda">Comprar</option>
          <option value="aluguel">Alugar</option>
        </select>
      </label>
      <label>
        Tipo
        <select name="tipo" defaultValue={filtros.tipo ?? ""}>
          <option value="">Todos os tipos</option>
          {tipos.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ROTULO_TIPO[tipo]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Bairro
        <select name="bairro" defaultValue={filtros.bairro ?? ""}>
          <option value="">Todos os bairros</option>
          {bairros.map((bairro) => (
            <option key={bairro} value={bairro}>
              {bairro}
            </option>
          ))}
        </select>
      </label>
      <label>
        Preço mínimo (R$)
        <input name="preco_min" inputMode="numeric" pattern="[0-9.]*" defaultValue={filtros.precoMin ?? ""} />
      </label>
      <label>
        Preço máximo (R$)
        <input name="preco_max" inputMode="numeric" pattern="[0-9.]*" defaultValue={filtros.precoMax ?? ""} />
      </label>
      <label>
        Quartos
        <select name="quartos" defaultValue={filtros.quartos ? String(filtros.quartos) : ""}>
          <option value="">Qualquer</option>
          {[1, 2, 3, 4].map((quantidade) => (
            <option key={quantidade} value={quantidade}>
              {quantidade}+
            </option>
          ))}
        </select>
      </label>
      <label>
        Ordem
        <select name="ordem" defaultValue={filtros.ordem}>
          <option value="recentes">Mais recentes</option>
          <option value="menor_preco">Menor preço</option>
          <option value="maior_preco">Maior preço</option>
        </select>
      </label>
      <div className="filtros-acoes">
        <button type="submit" className="btn">
          Filtrar
        </button>
        <Link href="/imoveis">Limpar filtros</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Cartão do imóvel**

`src/components/site/CartaoImovel.tsx`:

```tsx
import Link from "next/link";
import { camposExibidos } from "@/lib/apresentacao/campos";
import { linhasDePreco, ROTULO_TIPO } from "@/lib/apresentacao/formatar";
import type { Negocio } from "@/lib/contratos/comum";
import type { FlagsPublicas } from "@/lib/contratos/flags";
import type { ImovelPublico } from "@/lib/contratos/publico";
import { BlocoPreco } from "./BlocoPreco";
import { Foto, textoAlternativo } from "./Foto";
import { LinkWhatsApp } from "./LinkWhatsApp";
import { ListaCampos } from "./ListaCampos";

interface Props {
  imovel: ImovelPublico;
  negocio?: Negocio;
  flags: FlagsPublicas;
  prioridade?: boolean;
}

export function CartaoImovel({ imovel, negocio, flags, prioridade = false }: Props) {
  const reservado = imovel.status === "reservado";
  return (
    <article className="cartao" data-codigo={imovel.codigo}>
      <Link href={`/imoveis/${imovel.codigo}${negocio ? `?negocio=${negocio}` : ""}`} className="cartao-link">
        <div className="cartao-foto">
          <Foto
            foto={imovel.fotos[0]}
            alt={textoAlternativo(imovel.fotos[0], imovel.titulo)}
            sizes="(max-width: 600px) 100vw, (max-width: 1100px) 50vw, 33vw"
            prioridade={prioridade}
          />
          {reservado && <span className="selo cartao-selo">Reservado</span>}
        </div>
        <p className="kicker">
          {ROTULO_TIPO[imovel.tipo]} · {imovel.bairro}
        </p>
        <h2>{imovel.titulo}</h2>
        <ListaCampos campos={camposExibidos(imovel, flags.primeira_dobra).slice(0, 3)} className="faixa-campos cartao-campos" />
        <BlocoPreco linhas={linhasDePreco(imovel.ofertas, negocio)} />
      </Link>
      {!reservado && (
        <LinkWhatsApp origem="lista" codigo={imovel.codigo} titulo={imovel.titulo} negocio={negocio} className="cartao-whatsapp">
          Falar com o Moisés sobre o {imovel.codigo}
        </LinkWhatsApp>
      )}
    </article>
  );
}
```

- [ ] **Step 3: Página, esqueleto e CSS da lista**

`src/app/(site)/imoveis/(lista)/page.tsx`:

```tsx
import type { Metadata } from "next";
import { BotaoFlutuante } from "@/components/site/BotaoFlutuante";
import { CartaoImovel } from "@/components/site/CartaoImovel";
import { ErroCatalogo } from "@/components/site/ErroCatalogo";
import { FiltrosImoveis } from "@/components/site/FiltrosImoveis";
import {
  avisoSobConsulta,
  bairrosDisponiveis,
  descreverVazio,
  filtrarImoveis,
  lerFiltros,
  tiposDisponiveis,
  tituloDaLista,
  type ParametrosDeBusca,
} from "@/lib/apresentacao/filtros";
import { plural } from "@/lib/apresentacao/formatar";
import { carregarFlagsPublicas, carregarPublicados, registrarFalhaCatalogo } from "@/lib/catalogo";
import "./lista.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Imóveis" };

export default async function PaginaLista({ searchParams }: { searchParams: Promise<ParametrosDeBusca> }) {
  const filtros = lerFiltros(await searchParams);
  let dados;
  try {
    const [publicados, flags] = await Promise.all([carregarPublicados(), carregarFlagsPublicas()]);
    dados = { publicados, flags };
  } catch (erro) {
    registrarFalhaCatalogo(erro);
    return <ErroCatalogo />;
  }
  const { imoveis, foraPorSobConsulta } = filtrarImoveis(dados.publicados, filtros);
  return (
    <main id="conteudo" className="pagina lista">
      <header className="lista-topo">
        <p className="kicker">Imóveis</p>
        <h1>{tituloDaLista(filtros)}</h1>
        <p>{plural(imoveis.length, "imóvel encontrado", "imóveis encontrados")}</p>
      </header>
      <FiltrosImoveis filtros={filtros} tipos={tiposDisponiveis(dados.publicados)} bairros={bairrosDisponiveis(dados.publicados)} />
      {foraPorSobConsulta > 0 && (
        <p className="aviso" role="status">
          {avisoSobConsulta(foraPorSobConsulta)}
        </p>
      )}
      {imoveis.length === 0 ? (
        <p className="lista-vazia" role="status">
          {descreverVazio(filtros, dados.publicados)}
        </p>
      ) : (
        <ul className="grade">
          {imoveis.map((imovel, indice) => (
            <li key={imovel.codigo}>
              <CartaoImovel imovel={imovel} negocio={filtros.negocio} flags={dados.flags} prioridade={indice < 2} />
            </li>
          ))}
        </ul>
      )}
      <BotaoFlutuante />
    </main>
  );
}
```

`src/app/(site)/imoveis/(lista)/loading.tsx` (fica neste route group de propósito; veja a armadilha no topo do arquivo):

```tsx
import "./lista.css";

export default function CarregandoLista() {
  return (
    <main id="conteudo" className="pagina lista" aria-busy="true" aria-label="Carregando imóveis">
      <header className="lista-topo">
        <p className="kicker">Imóveis</p>
        <div className="esqueleto esqueleto-titulo" />
      </header>
      <ul className="grade">
        {Array.from({ length: 6 }, (_, indice) => (
          <li key={indice}>
            <div className="esqueleto esqueleto-foto" />
            <div className="esqueleto esqueleto-linha" />
            <div className="esqueleto esqueleto-linha curta" />
          </li>
        ))}
      </ul>
    </main>
  );
}
```

`src/app/(site)/imoveis/(lista)/lista.css`:

```css
.lista-topo { display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
.lista-topo h1 { font-size: clamp(32px, 4vw, 52px); }

.filtros { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; padding: 24px; background: var(--noite2); margin-bottom: 28px; }
.filtros label { display: flex; flex-direction: column; gap: 6px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; }
.filtros select, .filtros input { font: inherit; font-size: 14px; letter-spacing: normal; text-transform: none; padding: 10px; background: var(--noite); color: var(--off); border: 1px solid var(--linha); }
.filtros-acoes { display: flex; align-items: center; gap: 16px; }
.filtros-acoes .btn { background: transparent; color: var(--off); cursor: pointer; padding: 12px 24px; }
.filtros-acoes a { text-decoration: underline; text-underline-offset: 3px; font-size: 13px; }

.grade { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 32px; }
.cartao { display: flex; flex-direction: column; gap: 12px; }
.cartao-link { display: flex; flex-direction: column; gap: 10px; }
.cartao-foto { position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: var(--noite2); }
.cartao-foto img { width: 100%; height: 100%; object-fit: cover; }
.cartao-selo { position: absolute; left: 12px; top: 12px; }
.cartao h2 { font-size: 24px; line-height: 1.2; }
.cartao-campos { margin: 6px 0; padding: 12px 0; gap: 22px; }
.cartao-campos dd { font-size: 20px; }
.cartao-whatsapp { align-self: flex-start; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; padding: 10px 14px; background: var(--verde-whatsapp); color: var(--noite); font-weight: 600; }
.lista-vazia { padding: 40px 24px; background: var(--noite2); font-size: 16px; }

.esqueleto { background: linear-gradient(90deg, var(--noite2), #1c2a42, var(--noite2)); background-size: 200% 100%; animation: brilho 1.4s infinite; }
.esqueleto-titulo { height: 48px; width: 60%; }
.esqueleto-foto { aspect-ratio: 4 / 3; margin-bottom: 12px; }
.esqueleto-linha { height: 16px; margin-bottom: 8px; }
.esqueleto-linha.curta { width: 50%; }
@keyframes brilho { from { background-position: 100% 0; } to { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) { .esqueleto { animation: none; } }
```

- [ ] **Step 4: Ver rodando**

Run: `npm run build && npm run lint && npm run typecheck`
Expected: sem erros. O build lista `ƒ /imoveis`.

Com `npm run dev`, abra `http://localhost:3000/imoveis?negocio=aluguel&quartos=3`.
Expected: título "Imóveis para alugar", filtros com "Alugar" e "3+" selecionados, e a frase do estado vazio "Ainda não há imóveis publicados..." (catálogo local vazio). A verificação com dados fica no e2e da Task 1.10.

- [ ] **Step 5: Conferência de fidelidade ao mock C4 (a lista `/imoveis`)**

Siga o procedimento de "Fidelidade ao mock C4" (início deste arquivo) para a lista `/imoveis`: abra o mock e o app lado a lado em 1440 px e 390 px, compare estrutura, textos, tipografia, cores, espaçamentos e estados, e escreva a lista de diferenças. O mock pode não ter uma tela de lista com filtros: o que o mock não mostra (filtros, estados vazio e de erro) não é divergência, é lacuna; reuse os tokens, a tipografia e os componentes do mock e liste essas telas para o usuário aprovar. Diferença sem aprovação do usuário não se commita: pare e peça aprovação com o formato descrito na seção. Registre as aprovadas em `tasks/todo.md`.

- [ ] **Step 6: Commit**

```bash
git add "apps/site/src/app/(site)/imoveis/(lista)" apps/site/src/components/site/FiltrosImoveis.tsx apps/site/src/components/site/CartaoImovel.tsx
git commit -m "feat(site): lista de imóveis com filtros na URL, aviso de sob consulta e esqueleto"
```

---

### Task 1.8: Página do imóvel e "não está mais disponível"

**Files:**
- Create: `apps/site/src/app/(site)/imoveis/[codigo]/page.tsx`, `apps/site/src/app/(site)/imoveis/[codigo]/not-found.tsx`
- Create: `apps/site/src/components/site/PaginaImovel.tsx`, `apps/site/src/components/site/Galeria.tsx`, `apps/site/src/components/site/imovel.css`

**Interfaces:**
- Consumes: `carregarImovelPublicado`, `carregarFlagsPublicas`, `registrarFalhaCatalogo`, `NegocioSchema`, `ROTULO_TIPO`, `formatarData`, `linhasDePreco`, `camposExibidos`, `BlocoPreco`, `ListaCampos`, `Foto`, `textoAlternativo`, `LinkWhatsApp`, `BotaoFlutuante`, `ErroCatalogo`.
- Produces: `PaginaImovel({ imovel: ImovelPublico; flags: FlagsPublicas; negocio?: Negocio; previa?: boolean })` (a frente 2 usa na pré-visualização do painel). Marcador de visualização na página pública: `<span hidden data-visualizacao data-codigo="MC001" data-negocio="aluguel">` (a frente 4 lê).

- [ ] **Step 1: Galeria e página do imóvel (componente)**

`src/components/site/Galeria.tsx`:

```tsx
import type { Foto as FotoDoImovel } from "@/lib/contratos/imovel";
import { Foto, textoAlternativo } from "./Foto";

export function Galeria({ fotos, titulo }: { fotos: FotoDoImovel[]; titulo: string }) {
  const [capa, ...resto] = [...fotos].sort((a, b) => a.ordem - b.ordem);
  return (
    <section className="galeria" aria-label="Fotos do imóvel">
      <figure className="galeria-capa">
        <Foto foto={capa} alt={textoAlternativo(capa, titulo)} sizes="100vw" prioridade />
      </figure>
      {resto.length > 0 && (
        <div className="galeria-grade">
          {resto.map((foto) => (
            <figure key={foto.ordem}>
              <Foto foto={foto} alt={textoAlternativo(foto, titulo)} sizes="(max-width: 900px) 100vw, 50vw" />
              {foto.legenda && <figcaption>{foto.legenda}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
```

`src/components/site/PaginaImovel.tsx`:

```tsx
import { camposExibidos } from "@/lib/apresentacao/campos";
import { formatarData, linhasDePreco, ROTULO_TIPO } from "@/lib/apresentacao/formatar";
import type { Negocio } from "@/lib/contratos/comum";
import type { FlagsPublicas } from "@/lib/contratos/flags";
import type { ImovelPublico } from "@/lib/contratos/publico";
import { BlocoPreco } from "./BlocoPreco";
import { Galeria } from "./Galeria";
import { LinkWhatsApp } from "./LinkWhatsApp";
import { ListaCampos } from "./ListaCampos";
import "./imovel.css";

const ITENS_POR_BLOCO = 4;

function emBlocos<T>(itens: T[], tamanho: number): T[][] {
  return Array.from({ length: Math.ceil(itens.length / tamanho) }, (_, indice) => itens.slice(indice * tamanho, (indice + 1) * tamanho));
}

interface Props {
  imovel: ImovelPublico;
  flags: FlagsPublicas;
  negocio?: Negocio;
  /** No painel: mostra a página como ficaria, sem contar visualização. */
  previa?: boolean;
}

/** Ordem do spec, seção 5: eyebrow e título, galeria, primeira dobra, descrição, detalhes, procedência, local. */
export function PaginaImovel({ imovel, flags, negocio, previa = false }: Props) {
  const reservado = imovel.status === "reservado";
  const detalhes = camposExibidos(imovel, flags.detalhes);
  return (
    <main id="conteudo" className="pagina imovel">
      <header className="imovel-topo">
        <p className="kicker">
          {ROTULO_TIPO[imovel.tipo]} · {imovel.bairro}
        </p>
        <h1>{imovel.titulo}</h1>
        {reservado && <p className="selo">Reservado</p>}
      </header>

      <Galeria fotos={imovel.fotos} titulo={imovel.titulo} />

      <section className="imovel-dobra" aria-label="Preço e principais medidas">
        <BlocoPreco linhas={linhasDePreco(imovel.ofertas, negocio)} />
        <ListaCampos campos={camposExibidos(imovel, flags.primeira_dobra)} />
        {reservado ? (
          <p className="imovel-reservado">Este imóvel está reservado.</p>
        ) : (
          <LinkWhatsApp origem="imovel" codigo={imovel.codigo} titulo={imovel.titulo} negocio={negocio} className="btn-whatsapp">
            Falar com o Moisés
          </LinkWhatsApp>
        )}
      </section>

      <section className="imovel-texto">
        <h2>Sobre o imóvel</h2>
        {imovel.descricao.split(/\n{2,}/).map((paragrafo, indice) => (
          <p key={indice}>{paragrafo}</p>
        ))}
      </section>

      {imovel.comodidades.length > 0 && (
        <section className="imovel-comodidades">
          <h2>Comodidades</h2>
          <div className="comodidades-blocos">
            {emBlocos(imovel.comodidades, ITENS_POR_BLOCO).map((bloco, indice) => (
              <ul key={indice}>
                {bloco.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ))}
          </div>
        </section>
      )}

      {detalhes.length > 0 && (
        <section className="imovel-detalhes">
          <h2>Detalhes</h2>
          <ListaCampos campos={detalhes} />
        </section>
      )}

      <footer className="imovel-rodape">
        <p className="imovel-procedencia">
          Atualizado em {formatarData(imovel.atualizado_em)} · Código {imovel.codigo}
        </p>
        <p className="imovel-local">
          {imovel.bairro}, {imovel.cidade}. O endereço exato é passado pelo WhatsApp.
        </p>
      </footer>
      {previa && <p className="imovel-aviso-previa">Pré-visualização: o visitante não vê esta faixa.</p>}
    </main>
  );
}
```

`src/components/site/imovel.css`:

```css
.imovel-topo { display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px; max-width: 900px; }
.imovel-topo h1 { font-size: clamp(32px, 4.4vw, 60px); line-height: 1.1; }
.galeria { display: flex; flex-direction: column; gap: 12px; margin-bottom: 40px; }
.galeria-capa { aspect-ratio: 16 / 9; overflow: hidden; background: var(--noite2); }
.galeria-capa img, .galeria-grade img { width: 100%; height: 100%; object-fit: cover; }
.galeria-grade { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.galeria-grade figure { aspect-ratio: 4 / 3; overflow: hidden; position: relative; background: var(--noite2); }
.galeria-grade figcaption { position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 12px; font-size: 13px; background: linear-gradient(transparent, rgba(14, 23, 38, 0.85)); }

.imovel-dobra { display: flex; flex-wrap: wrap; align-items: center; gap: 32px; padding: 28px 0; border-top: 1px solid var(--linha); border-bottom: 1px solid var(--linha); margin-bottom: 48px; }
.imovel-dobra .preco-linha { font-size: 24px; }
.campos { display: flex; gap: 30px; flex-wrap: wrap; }
.imovel-reservado { font-size: 14px; opacity: 0.85; }

.imovel-texto, .imovel-comodidades, .imovel-detalhes { max-width: 820px; margin-bottom: 48px; display: flex; flex-direction: column; gap: 16px; }
.imovel-texto h2, .imovel-comodidades h2, .imovel-detalhes h2 { font-size: 30px; }
.imovel-texto p { font-weight: 300; line-height: 1.85; }
.comodidades-blocos { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.comodidades-blocos ul { list-style: none; display: grid; gap: 8px; }
.comodidades-blocos li::before { content: "·"; margin-right: 8px; color: var(--vinho-texto); }

.imovel-rodape { border-top: 1px solid var(--linha); padding-top: 24px; display: grid; gap: 8px; font-size: 13px; }
.imovel-procedencia { letter-spacing: 0.08em; opacity: 0.85; }
.imovel-aviso-previa { position: fixed; left: 16px; bottom: 16px; z-index: 30; background: var(--off); color: var(--noite); font-size: 12px; padding: 8px 12px; }

@media (max-width: 900px) {
  .galeria-grade { grid-template-columns: 1fr; }
  .imovel-dobra { flex-direction: column; align-items: flex-start; }
}
```

- [ ] **Step 2: Rota pública e 404**

`src/app/(site)/imoveis/[codigo]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotaoFlutuante } from "@/components/site/BotaoFlutuante";
import { ErroCatalogo } from "@/components/site/ErroCatalogo";
import { PaginaImovel } from "@/components/site/PaginaImovel";
import type { ParametrosDeBusca } from "@/lib/apresentacao/filtros";
import { ROTULO_TIPO } from "@/lib/apresentacao/formatar";
import { carregarFlagsPublicas, carregarImovelPublicado, registrarFalhaCatalogo } from "@/lib/catalogo";
import { NegocioSchema } from "@/lib/contratos/comum";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<ParametrosDeBusca>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  try {
    const imovel = await carregarImovelPublicado(codigo);
    if (!imovel) return { title: "Imóvel não disponível" };
    return {
      title: imovel.titulo,
      description: `${ROTULO_TIPO[imovel.tipo]} em ${imovel.bairro}, ${imovel.cidade}. Código ${imovel.codigo}.`,
      openGraph: { images: [imovel.fotos[0].larguras["1600"]] },
    };
  } catch (erro) {
    registrarFalhaCatalogo(erro);
    return { title: "Imóveis" };
  }
}

export default async function PaginaDoImovel({ params, searchParams }: Props) {
  const { codigo } = await params;
  const pedido = NegocioSchema.safeParse((await searchParams).negocio);
  let dados;
  try {
    const [imovel, flags] = await Promise.all([carregarImovelPublicado(codigo), carregarFlagsPublicas()]);
    dados = { imovel, flags };
  } catch (erro) {
    registrarFalhaCatalogo(erro);
    return <ErroCatalogo />;
  }
  // Fora do try: notFound() lança de propósito. Rascunho (inclui vendido e alugado) e código inexistente caem aqui.
  if (!dados.imovel) notFound();
  const imovel = dados.imovel;
  const negocio = pedido.success && imovel.ofertas.some((oferta) => oferta.negocio === pedido.data) ? pedido.data : undefined;
  return (
    <>
      <PaginaImovel imovel={imovel} flags={dados.flags} negocio={negocio} />
      <span hidden data-visualizacao="" data-codigo={imovel.codigo} data-negocio={negocio} />
      <BotaoFlutuante codigo={imovel.codigo} titulo={imovel.titulo} negocio={negocio} />
    </>
  );
}
```

`src/app/(site)/imoveis/[codigo]/not-found.tsx`:

```tsx
import Link from "next/link";
import { BotaoFlutuante } from "@/components/site/BotaoFlutuante";

/** Sem nenhum dado do imóvel (spec 4.1 Exibição). */
export default function ImovelIndisponivel() {
  return (
    <main id="conteudo" className="pagina estado-erro">
      <p className="kicker">Imóvel</p>
      <h1>Este imóvel não está mais disponível</h1>
      <p>Ele pode ter sido vendido, alugado ou retirado do ar.</p>
      <Link className="btn" href="/imoveis">
        Ver os imóveis disponíveis
      </Link>
      <BotaoFlutuante />
    </main>
  );
}
```

- [ ] **Step 3: Ver rodando e conferir o 404**

Run: `npm run build && npm run start` (em outro terminal) e depois:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/imoveis/MC999
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/imoveis/nao-e-codigo
```

Expected: `404` nas duas. Pare o `npm run start`.

- [ ] **Step 4: Conferência de fidelidade ao mock C4 (a página do imóvel)**

Siga o procedimento de "Fidelidade ao mock C4" (início deste arquivo) para a página do imóvel: abra o mock e o app lado a lado em 1440 px e 390 px, compare estrutura, textos, tipografia, cores, espaçamentos e estados, e escreva a lista de diferenças. Diferença sem aprovação do usuário não se commita: pare e peça aprovação com o formato descrito na seção. Registre as aprovadas em `tasks/todo.md`.

- [ ] **Step 5: Commit**

```bash
git add "apps/site/src/app/(site)/imoveis/[codigo]" apps/site/src/components/site/PaginaImovel.tsx apps/site/src/components/site/Galeria.tsx apps/site/src/components/site/imovel.css
git commit -m "feat(site): página do imóvel com galeria, primeira dobra por flags e 404 para rascunho"
```

---

### Task 1.9: Página de privacidade

**Files:**
- Create: `apps/site/src/app/(site)/privacidade/page.tsx`, `apps/site/src/app/(site)/privacidade/privacidade.css`

**Interfaces:**
- Consumes: `carregarFlagsPublicas`, `registrarFalhaCatalogo`, `LinkWhatsApp`, `BotaoFlutuante`.
- Produces: elemento `<div id="preferencia-cookies">` onde a frente 4 (Task 4.2) monta o botão "Mudar minha escolha".

- [ ] **Step 1: Página**

`src/app/(site)/privacidade/page.tsx`:

```tsx
import type { Metadata } from "next";
import { BotaoFlutuante } from "@/components/site/BotaoFlutuante";
import { LinkWhatsApp } from "@/components/site/LinkWhatsApp";
import { carregarFlagsPublicas, registrarFalhaCatalogo } from "@/lib/catalogo";
import "./privacidade.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacidade" };

async function medicaoLigada(): Promise<boolean> {
  try {
    return (await carregarFlagsPublicas()).eventos_ativos;
  } catch (erro) {
    registrarFalhaCatalogo(erro);
    return false;
  }
}

export default async function PaginaPrivacidade() {
  const ligada = await medicaoLigada();
  return (
    <main id="conteudo" className="pagina privacidade">
      <p className="kicker">Privacidade</p>
      <h1>Como este site trata os seus dados</h1>
      <p className="privacidade-estado" role="status">
        {ligada
          ? "Hoje a medição está ligada: contamos cliques e visitas como explicado abaixo."
          : "Hoje a medição está desligada: o site não grava cookies nem conta visitas."}
      </p>

      <h2>Quem é o responsável</h2>
      <p>Moisés Cezarino Vieira, corretor de imóveis, CRECI 67.944-F, é quem decide como os dados deste site são usados.</p>

      <h2>O que o site conta, sem identificar ninguém</h2>
      <p>
        Quando a medição está ligada, o site conta quantas vezes cada imóvel é aberto e quantas vezes alguém toca em um botão de
        WhatsApp. Essa contagem não leva cookie, número de identificação nem endereço IP. Serve só para saber quais imóveis
        interessam mais.
      </p>

      <h2>O que o site guarda só se você aceitar</h2>
      <p>
        Se você aceitar o aviso de cookies, o site grava no seu navegador um número aleatório, válido por 6 meses. Ele permite
        saber se a mesma pessoa voltou ao site, sem saber quem ela é. Se você recusar, o site funciona do mesmo jeito e não grava
        esse número. Para não perguntar de novo, o navegador lembra só que você recusou.
      </p>

      <h2>O que o site nunca coleta</h2>
      <p>Nome, e-mail, telefone ou endereço IP. A conversa pelo WhatsApp acontece no próprio WhatsApp, fora deste site.</p>

      <h2>Por quanto tempo</h2>
      <p>As contagens e os números aleatórios são apagados depois de 6 meses.</p>

      <h2>Mudar a sua escolha</h2>
      <div id="preferencia-cookies" />
      <p>
        Você pode apagar os cookies do navegador quando quiser. Para qualquer dúvida sobre os seus dados, fale com o Moisés:{" "}
        <LinkWhatsApp origem="contato">WhatsApp (11) 99676-7680</LinkWhatsApp>.
      </p>
      <BotaoFlutuante />
    </main>
  );
}
```

`src/app/(site)/privacidade/privacidade.css`:

```css
.privacidade { max-width: 820px; display: flex; flex-direction: column; gap: 16px; }
.privacidade h1 { font-size: clamp(32px, 4vw, 52px); margin-bottom: 8px; }
.privacidade h2 { font-size: 26px; margin-top: 24px; }
.privacidade p { font-weight: 300; line-height: 1.85; }
.privacidade a { text-decoration: underline; text-underline-offset: 3px; }
.privacidade-estado { padding: 12px 16px; background: var(--noite2); border-left: 3px solid var(--vinho-texto); font-weight: 400 !important; }
```

- [ ] **Step 2: Ver rodando**

Run: `npm run build`
Expected: sem erros; `ƒ /privacidade` no relatório do build.

- [ ] **Step 3: Commit**

```bash
git add "apps/site/src/app/(site)/privacidade"
git commit -m "feat(site): página de privacidade em linguagem simples"
```

---

### Task 1.10: Testes e2e do visitante, acessibilidade e visual

**Files:**
- Create: `apps/site/playwright.config.ts`, `apps/site/e2e/fixtures-e2e.ts`, `apps/site/e2e/preparar.ts`, `apps/site/e2e/ambiente.ts`
- Create: `apps/site/e2e/visitante.spec.ts`, `apps/site/e2e/estados.spec.ts`, `apps/site/e2e/acessibilidade.spec.ts`, `apps/site/e2e/visual.spec.ts`
- Modify: `apps/site/package.json` (scripts `test:e2e` e `test:e2e:sem-build`)

**Interfaces:**
- Consumes: `imovelDeExemplo`, `fotosDeExemplo`, `gravarImovel`, `gravarEndereco`, `ArmazemJsonArquivo`.
- Produces (`fixtures-e2e.ts`): `ORIGEM_FOTOS_E2E = "http://localhost:3100/e2e-fotos"`, `ENDERECO_SECRETO = "Rua Secreta do Teste, 999"`, `IMOVEIS_E2E: Imovel[]` com os códigos abaixo. A frente 2 reutiliza `MC010` (publicado) e `MC011` (rascunho) nos testes do painel.
- Produces (`ambiente.ts`): `AMBIENTE_E2E: Record<string,string>` (variáveis dos servidores de teste) e `SEGREDO_JWT_E2E`.

| Código | Cenário |
|---|---|
| MC001 | Casa em condomínio, venda R$ 1.900.000, destaque, Fazenda da Ilha / Embu-Guaçu. Tem endereço gravado |
| MC002 | Apartamento, aluguel R$ 4.500 com condomínio incluso, 3 quartos, Centro / Embu-Guaçu |
| MC003 | Casa, venda R$ 1.200.000 **e** aluguel R$ 6.000, 4 quartos, destaque, Morumbi / São Paulo |
| MC004 | Chácara, venda R$ 850.000, **reservado**, Cipó / Embu-Guaçu |
| MC005 | Casa **rascunho**, nunca publicada |
| MC006 | Casa **vendida** (rascunho, esteve no ar) |
| MC007 | Terreno, venda **sob consulta**, Centro / Embu-Guaçu |
| MC008 | Apartamento, aluguel R$ 3.000, 2 quartos, Morumbi / São Paulo |
| MC010 | Apartamento publicado, venda R$ 500.000 (reservado para os testes do painel, frente 2) |
| MC011 | Casa rascunho (reservado para os testes do painel, frente 2) |

- [ ] **Step 1: Ambiente e fixtures do e2e**

`apps/site/e2e/ambiente.ts`:

```ts
export const SEGREDO_JWT_E2E = "segredo-jwt-e2e-com-mais-de-32-caracteres";

/** Variáveis dos servidores `next start` do e2e. Nada aqui vale fora dos testes. */
export const AMBIENTE_E2E: Record<string, string> = {
  ARMAZEM_DRIVER: "arquivo",
  ARMAZEM_DIR: ".dados-e2e",
  ARMAZEM_FOTOS_DIR: "public/e2e-fotos",
  FOTOS_ORIGEM: "http://localhost:3100/e2e-fotos",
  AUTH_JWT_SECRET: SEGREDO_JWT_E2E,
  AUTH_JWT_TTL_HORAS: "8",
  AUTH_ALLOWLIST: "gabriela@exemplo.com",
  GOOGLE_CLIENT_ID: "cliente-google-e2e",
  SKILL_API_SECRET: "segredo-skill-e2e",
  CRON_SECRET: "segredo-cron-e2e",
};
```

`apps/site/e2e/fixtures-e2e.ts`:

```ts
import type { Imovel } from "../src/lib/contratos/imovel";
import { fotosDeExemplo, imovelDeExemplo } from "../src/testes/fixtures";

export const ORIGEM_FOTOS_E2E = "http://localhost:3100/e2e-fotos";
export const ENDERECO_SECRETO = "Rua Secreta do Teste, 999";
const dia = (n: number) => `2026-10-${String(n).padStart(2, "0")}T12:00:00.000Z`;

function imovel(codigo: string, dados: Partial<Imovel>): Imovel {
  return imovelDeExemplo({ codigo, fotos: fotosDeExemplo(codigo, 3, ORIGEM_FOTOS_E2E), ...dados });
}

export const IMOVEIS_E2E: Imovel[] = [
  imovel("MC001", { destaque: true, publicado_em: dia(10), titulo: "Casa em condomínio com piscina e vista para a mata" }),
  imovel("MC002", {
    tipo: "apartamento",
    titulo: "Apartamento claro perto da estação",
    bairro: "Centro",
    quartos: 3,
    suites: 1,
    ofertas: [{ negocio: "aluguel", preco: 4_500, inclui_condominio: true }],
    publicado_em: dia(9),
  }),
  imovel("MC003", {
    tipo: "casa",
    titulo: "Casa ampla no Morumbi com quintal",
    bairro: "Morumbi",
    cidade: "São Paulo",
    quartos: 4,
    suites: 2,
    destaque: true,
    ofertas: [
      { negocio: "venda", preco: 1_200_000 },
      { negocio: "aluguel", preco: 6_000 },
    ],
    publicado_em: dia(8),
  }),
  imovel("MC004", { tipo: "chacara", titulo: "Chácara com varanda e vista", bairro: "Cipó", status: "reservado", ofertas: [{ negocio: "venda", preco: 850_000 }], publicado_em: dia(7) }),
  imovel("MC005", { tipo: "casa", titulo: "Casa nova do lote ainda em revisão", publicacao: "rascunho", publicado_em: undefined }),
  imovel("MC006", { tipo: "casa", titulo: "Casa térrea que já foi vendida", status: "vendido", publicacao: "rascunho", publicado_em: dia(1) }),
  imovel("MC007", {
    tipo: "terreno",
    titulo: "Terreno plano no Centro de Embu-Guaçu",
    bairro: "Centro",
    quartos: undefined,
    suites: undefined,
    banheiros: undefined,
    vagas: undefined,
    ofertas: [{ negocio: "venda" }],
    publicado_em: dia(6),
  }),
  imovel("MC008", {
    tipo: "apartamento",
    titulo: "Apartamento compacto no Morumbi",
    bairro: "Morumbi",
    cidade: "São Paulo",
    quartos: 2,
    suites: 0,
    ofertas: [{ negocio: "aluguel", preco: 3_000 }],
    publicado_em: dia(5),
  }),
  imovel("MC010", { tipo: "apartamento", titulo: "Apartamento usado nos testes do painel", ofertas: [{ negocio: "venda", preco: 500_000 }], publicado_em: dia(4) }),
  imovel("MC011", { tipo: "casa", titulo: "Casa em rascunho usada nos testes do painel", publicacao: "rascunho", publicado_em: undefined }),
];
```

- [ ] **Step 2: Preparação dos dados e das fotos de teste**

`apps/site/e2e/preparar.ts`:

```ts
/** Recria .dados-e2e/ e public/e2e-fotos/ do zero antes de cada rodada do e2e. */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ArmazemJsonArquivo } from "../src/lib/armazem/arquivo";
import { gravarEndereco, gravarImovel } from "../src/lib/repositorio/imoveis";
import { ENDERECO_SECRETO, IMOVEIS_E2E } from "./fixtures-e2e";

const CORES = ["#2f5d50", "#8b1e2d", "#1f3a68", "#b07d3a"];

async function gerarFoto(destino: string, largura: number, cor: string) {
  const altura = Math.round(largura * 0.66);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cor}"/><stop offset="1" stop-color="#0e1726"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, await sharp(Buffer.from(svg)).webp({ quality: 60 }).toBuffer());
}

async function principal() {
  await rm(".dados-e2e", { recursive: true, force: true });
  await rm("public/e2e-fotos", { recursive: true, force: true });
  const armazem = new ArmazemJsonArquivo(path.join(".dados-e2e", "privado"));
  for (const [indice, imovel] of IMOVEIS_E2E.entries()) {
    await gravarImovel(armazem, imovel);
    for (const foto of imovel.fotos) {
      for (const [largura, url] of Object.entries(foto.larguras)) {
        const caminho = new URL(url).pathname.replace(/^\/e2e-fotos\//, "");
        await gerarFoto(path.join("public/e2e-fotos", caminho), Number(largura), CORES[(indice + foto.ordem) % CORES.length]);
      }
    }
  }
  await gravarEndereco(armazem, { codigo: "MC001", endereco_completo: ENDERECO_SECRETO, atualizado_em: "2026-10-10T12:00:00.000Z" });
  console.log(`e2e: ${IMOVEIS_E2E.length} imóveis e fotos preparados`);
}

principal().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Configuração do Playwright**

`apps/site/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";
import { AMBIENTE_E2E } from "./e2e/ambiente";

// Herda o ambiente (PATH para o npx) e sobrepõe as variáveis do e2e, que vencem o .env.local.
const ambiente = { ...(process.env as Record<string, string>), ...AMBIENTE_E2E };

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" } },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    { command: "npx next start -p 3100", url: "http://localhost:3100", env: ambiente, reuseExistingServer: false, timeout: 60_000 },
    {
      // Segundo servidor com o Blob "fora do ar", para o estado de erro.
      command: "npx next start -p 3101",
      url: "http://localhost:3101/privacidade",
      env: { ...ambiente, ARMAZEM_DRIVER: "indisponivel" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
```

No `package.json`, acrescente aos scripts:

```json
    "test:e2e": "tsx e2e/preparar.ts && next build && playwright test",
    "test:e2e:sem-build": "tsx e2e/preparar.ts && playwright test"
```

Instale o navegador uma vez: `npx playwright install chromium`.

- [ ] **Step 4: Testes do visitante**

`apps/site/e2e/visitante.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { ENDERECO_SECRETO } from "./fixtures-e2e";

test.describe("visitante", () => {
  test("home tem hero, chave Comprar/Alugar e faixas", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Viver bem");
    await page.getByRole("navigation", { name: "Comprar ou alugar" }).getByRole("link", { name: "Alugar" }).click();
    await expect(page).toHaveURL(/negocio=aluguel/);
    const vitrine = page.locator("#vitrine");
    await expect(vitrine.getByText("Casa ampla no Morumbi com quintal")).toBeVisible();
    await expect(vitrine.getByText("Casa em condomínio com piscina e vista para a mata")).toHaveCount(0);
  });

  test("imóvel com venda e aluguel aparece nas duas abas da lista", async ({ page }) => {
    await page.goto("/imoveis?negocio=venda");
    await expect(page.locator('article[data-codigo="MC003"]')).toBeVisible();
    await page.goto("/imoveis?negocio=aluguel");
    await expect(page.locator('article[data-codigo="MC003"]')).toBeVisible();
    await expect(page.locator('article[data-codigo="MC001"]')).toHaveCount(0);
  });

  test("ordem do preço segue o contexto da lista", async ({ page }) => {
    await page.goto("/imoveis/MC003?negocio=aluguel");
    await expect(page.locator(".imovel-dobra .preco-linha").first()).toContainText("Aluguel");
    await page.goto("/imoveis/MC003");
    await expect(page.locator(".imovel-dobra .preco-linha").first()).toContainText("Venda");
    await expect(page.locator(".imovel-dobra .preco-linha").nth(1)).toContainText("R$ 6.000/mês");
  });

  test("filtros na URL são compartilháveis", async ({ page }) => {
    await page.goto("/imoveis?negocio=aluguel&quartos=3");
    await expect(page.locator('article[data-codigo="MC002"]')).toBeVisible();
    await expect(page.locator('article[data-codigo="MC003"]')).toBeVisible();
    await expect(page.locator('article[data-codigo="MC008"]')).toHaveCount(0);
    await expect(page.getByLabel("Quartos")).toHaveValue("3");
  });

  test("faixa de preço avisa quantos sob consulta ficaram de fora", async ({ page }) => {
    await page.goto("/imoveis?negocio=venda&preco_max=2000000");
    await expect(page.getByRole("status").filter({ hasText: "sob consulta" })).toHaveText(
      "1 imóvel com preço sob consulta não entra neste filtro.",
    );
    await expect(page.locator('article[data-codigo="MC007"]')).toHaveCount(0);
  });

  test("filtro sem resultado explica o que remover", async ({ page }) => {
    await page.goto("/imoveis?negocio=aluguel&quartos=5&bairro=Morumbi");
    await expect(page.locator(".lista-vazia")).toHaveText(
      "Nenhum imóvel de aluguel com 5 quartos ou mais no bairro Morumbi. Remova o filtro de quartos para ver 2.",
    );
  });

  test("botão do WhatsApp leva a mensagem com o negócio do contexto", async ({ page }) => {
    await page.goto("/imoveis/MC003?negocio=aluguel");
    const botao = page.locator(".imovel-dobra").getByRole("link", { name: "Falar com o Moisés" });
    const href = await botao.getAttribute("href");
    expect(href).toContain("https://wa.me/5511996767680?text=");
    expect(decodeURIComponent(href!.split("?text=")[1])).toBe(
      "Olá, Moisés! Tenho interesse em alugar o MC003 – Casa ampla no Morumbi com quintal.",
    );
  });

  test("reservado aparece com selo, sem o botão principal, e com o flutuante", async ({ page }) => {
    await page.goto("/imoveis/MC004");
    await expect(page.locator(".imovel-topo .selo")).toHaveText("Reservado");
    await expect(page.locator(".imovel-dobra").getByRole("link", { name: "Falar com o Moisés" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Falar com o Moisés pelo WhatsApp" })).toBeVisible();
  });

  test("rascunho e vendido respondem 404 sem nenhum dado do imóvel", async ({ page }) => {
    for (const [codigo, titulo] of [
      ["MC005", "Casa nova do lote ainda em revisão"],
      ["MC006", "Casa térrea que já foi vendida"],
    ]) {
      const resposta = await page.goto(`/imoveis/${codigo}`);
      expect(resposta?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Este imóvel não está mais disponível");
      await expect(page.getByRole("link", { name: "Ver os imóveis disponíveis" })).toHaveAttribute("href", "/imoveis");
      expect(await page.content()).not.toContain(titulo);
    }
  });

  test("HTML público não tem e-mail da equipe, histórico nem endereço (Review Focus 3)", async ({ request }) => {
    for (const caminho of ["/", "/imoveis", "/imoveis/MC001"]) {
      const html = await (await request.get(caminho)).text();
      expect(html).not.toContain("@exemplo.com");
      expect(html).not.toContain("historico");
      expect(html).not.toContain(ENDERECO_SECRETO);
    }
  });

  test("página do imóvel mostra procedência e só bairro e cidade", async ({ page }) => {
    await page.goto("/imoveis/MC001");
    await expect(page.locator(".imovel-procedencia")).toHaveText("Atualizado em 10/10/2026 · Código MC001");
    await expect(page.locator(".imovel-local")).toContainText("Fazenda da Ilha, Embu-Guaçu");
  });
});
```

- [ ] **Step 5: Testes de estados e acessibilidade**

`apps/site/e2e/estados.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("Blob indisponível: home, lista e imóvel mostram erro claro e o WhatsApp", async ({ page }) => {
  for (const caminho of ["/", "/imoveis", "/imoveis/MC001"]) {
    await page.goto(`http://localhost:3101${caminho}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Não conseguimos carregar os imóveis agora");
    await expect(page.locator(".estado-erro").getByRole("link", { name: "Falar com o Moisés" })).toHaveAttribute(
      "href",
      /wa\.me\/5511996767680/,
    );
  }
});

test("privacidade diz que a medição está desligada", async ({ page }) => {
  await page.goto("/privacidade");
  await expect(page.getByRole("status")).toHaveText("Hoje a medição está desligada: o site não grava cookies nem conta visitas.");
});
```

`apps/site/e2e/acessibilidade.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const caminho of ["/", "/imoveis", "/imoveis/MC003?negocio=aluguel", "/imoveis/MC004", "/imoveis/MC005", "/privacidade"]) {
  test(`axe sem violações em ${caminho}`, async ({ page }) => {
    await page.goto(caminho);
    const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(resultado.violations.map((violacao) => `${violacao.id}: ${violacao.help}`)).toEqual([]);
  });
}

test("teclado chega ao botão de contato do imóvel", async ({ page }) => {
  await page.goto("/imoveis/MC001");
  const botao = page.locator(".imovel-dobra").getByRole("link", { name: "Falar com o Moisés" });
  for (let tecla = 0; tecla < 30; tecla += 1) {
    await page.keyboard.press("Tab");
    if (await botao.evaluate((elemento) => elemento === document.activeElement)) break;
  }
  await expect(botao).toBeFocused();
});
```

- [ ] **Step 6: Screenshots contra o mock**

`apps/site/e2e/visual.spec.ts`:

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const MOCK = path.resolve(__dirname, "../../../Site MC Vieira/13-site-novo/exportado/site-mc-vieira-mock-C4.html");

test.describe("visual", () => {
  test("home", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveScreenshot("home.png", { fullPage: true });
  });

  test("página do imóvel", async ({ page }) => {
    await page.goto("/imoveis/MC003");
    await expect(page).toHaveScreenshot("imovel-mc003.png", { fullPage: true });
  });

  test("mock C4 para comparação lado a lado (só na máquina com a pasta de marca)", async ({ page }, info) => {
    test.skip(!existsSync(MOCK), "Mock fora do repositório; rode na máquina que tem 'Site MC Vieira/'.");
    await page.goto(`file://${MOCK}`);
    await info.attach("mock-c4", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });
});
```

- [ ] **Step 7: Rodar o e2e e fechar a fidelidade**

Run (primeira vez, cria as referências de screenshot): `npm run test:e2e -- --update-snapshots`
Expected: todos os testes passam; o Playwright grava `e2e/visual.spec.ts-snapshots/*.png`.

Abra `npx playwright show-report` e compare as telas `home` e `imovel-mc003` com o anexo `mock-c4`. Fundo marinho, Playfair nos títulos, faixas alternadas, botão flutuante verde. Registre divergências visuais relevantes antes de commitar as referências. Esta comparação é o fechamento, não a primeira conferência: cada tela já foi comparada com o mock nas Tasks 1.5, 1.6, 1.7 e 1.8. Qualquer diferença restante sem aprovação registrada em `tasks/todo.md` impede o commit das referências de screenshot.

Run (segunda vez, valida contra as referências): `npm run test:e2e`
Expected: PASS em `celular` e `desktop`.

- [ ] **Step 8: Commit e fechamento da frente 1**

```bash
cd /Users/felipemartucci/PycharmProjects/real-state-platform
git status --short
git add apps/site/playwright.config.ts apps/site/package.json apps/site/e2e
git commit -m "test(site): e2e do visitante, estados, acessibilidade e screenshots contra o mock"
git pull --rebase origin main
npm --prefix apps/site test
```

Entregue ao humano, como texto (não execute):

```bash
git push -u origin feat/site-novo-site-publico
```
