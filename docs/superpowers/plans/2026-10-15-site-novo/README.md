# Site novo M.C. Vieira: plano de implementação (visão geral)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o site de imóveis da M.C. Vieira (site público, painel `/admin`, API única de gravação, contrato com a skill, medição e jobs) num app Next.js na Vercel, com dados no Vercel Blob.

**Architecture:** Um app Next.js 16 (App Router) em `apps/site/`. Toda regra de negócio vive em módulos puros em `src/lib/` (contratos zod, domínio, handlers `Request → Response`), testados com Vitest sem servidor. O armazenamento fica atrás de uma porta (`ArmazemJson` e `ArmazemFotos`) com três adaptadores: Vercel Blob (produção), arquivo local (testes, e2e e dev) e indisponível (simula Blob fora do ar). Os arquivos `route.ts` e `page.tsx` só ligam os módulos ao Next.

**Tech Stack:** Next.js 16.4.1, React 19.3, TypeScript 5.9.3, zod 4.6.7, @vercel/blob 2.8.2, google-auth-library 11.3.0, Vitest 4.1.12, Playwright 1.64.1, @axe-core/playwright 4.14.0, sharp 0.35.5, papaparse 5.7.0, tsx 4.23.15. CSS puro com tokens (sem Tailwind).

**Spec:** `docs/superpowers/specs/2026-10-15-site-novo-mc-vieira-design.md` · Vocabulário: `CONTEXT.md` · Decisão: `docs/adr/0001-gravacao-unica-pela-api.md`

---

## Arquivos do plano

O spec decidiu "spec único, com plano dividido em frentes paralelas" (decisão 12). Cada frente é um arquivo próprio e entrega software testável sozinha.

| Arquivo | Frente | Depende de | Branch |
|---|---|---|---|
| `frente-0-fundacao.md` | Estrutura, contratos, armazém, repositório, stores do Blob | — | `feat/site-novo-fundacao` |
| `frente-1-site-publico.md` | Páginas públicas, galeria, filtros, estados, privacidade, e2e do visitante | 0 | `feat/site-novo-site-publico` |
| `frente-2-api-e-painel.md` | Login, `/api/imoveis`, `/api/flags`, painel, e2e do painel | 0 | `feat/site-novo-api-painel` |
| `frente-3-contrato-skill.md` | Fotos (larguras, placeholder), cliente da API, CLI, planilha do lote | 0, 2 (tasks 2.1 a 2.5) | `feat/site-novo-contrato-skill` |
| `frente-4-medicao-jobs-deploy.md` | Eventos, banner, jobs, relatório, documento do Moisés, deploy | 0, 1, 2 | `feat/site-novo-medicao` |

**Ordem:** 0 → (1 ‖ 2) → (3 ‖ 4). As frentes 1 e 2 podem rodar ao mesmo tempo, em worktrees separados. A 3 só precisa dos handlers da frente 2 (tasks 2.1 a 2.5), não do painel.

Cada frente termina com a sequência de fechamento do `CLAUDE.md` (branch → add → commit → `git pull --rebase origin main` → comando de push **só como texto**). Nunca rode `git push` nem `gh pr create`.

## Ajustes ao spec (decididos no plano, registrados em `tasks/todo.md`)

O spec é a fonte, mas tem sete pontos que não fecham na implementação. Cada um tem a menor resolução possível:

| # | Problema no spec | Resolução no plano | Frente |
|---|---|---|---|
| A | §3 manda subir as fotos **antes** de gravar o imóvel, mas o caminho da foto leva o código, e o código só nasce na API | `POST /api/imoveis/reservas` reserva o próximo código (grava `imoveis/<codigo>/reserva.json` com `allowOverwrite: false`). A skill reserva, sobe as fotos nesse código e cria o imóvel com `POST /api/imoveis { codigo, ... }`. A geração de código sem colisão vive na reserva | 0, 2, 3 |
| B | "Código nunca reaproveitado" + "próximo = maior existente + 1": excluir o maior código faria ele voltar | A exclusão grava uma lápide `imoveis/<codigo>/excluido.json`. O próximo código conta todas as pastas de `imoveis/`, com lápide ou reserva | 0, 2 |
| C | Foto reeditada no mesmo caminho `<n>-800.webp` fica velha no CDN (cache de até 1 ano no store público) | Nome com hash do conteúdo: `imoveis/<codigo>/fotos/<ordem>-<hash10>-<largura>.webp`. A limpeza de órfãs continua por prefixo, que é determinístico | 3 |
| D | `codigo` é obrigatório no evento, mas o botão flutuante da home e o "Conversar no WhatsApp" da seção "Prazer" não têm imóvel. O clique seria perdido na medida principal | `origem` ganha o valor `contato`, e `codigo` é opcional quando `origem` é `flutuante` ou `contato` | 4 |
| E | O limite de 5 destaques pode travar com destaques em imóveis fora do ar | Voltar a rascunho limpa o `destaque`. Marcar destaque num rascunho é recusado (422) | 2 |
| F | O visitante que recusa o banner o veria de novo a cada visita | A recusa fica em `localStorage` (`mcv_consentimento=recusado`), sem identificador. Entra como item 3 do documento do Moisés | 4 |
| G | "Esteve no ar até dd/mm" pede a data de retirada, que não existe no contrato | A data sai da última entrada do histórico com `campo: "publicacao"` e `para: "rascunho"`. Sem ela, o selo diz só "Esteve no ar" | 2 |

## Global Constraints

Toda task inclui, implicitamente, estas regras. Valores copiados do spec.

- App em `apps/site/`. Node ≥ 22. npm (não há pnpm na máquina). Versões exatas como na seção Tech Stack, fixadas sem `^`.
- `next.config.ts` **sem** `cacheComponents` e sem `partialPrefetching` (o scaffold do 16.4 liga os dois; o plano usa o modelo `unstable_cache` + `revalidateTag`).
- Português do Brasil em toda a interface. **Sem emoji** em texto do site, título ou descrição.
- Cores: `--noite #0E1726`, `--noite2 #131F33`, `--vinho #8B1E2D`, `--vinho-claro #B8475A`, `--marinho #1F3A68`, `--off #FAF8F4`, `--linha rgba(250,248,244,.14)`. Verde do WhatsApp `#25D366` é a **única cor de ação** e só aparece em botão de WhatsApp.
- Fontes: Montserrat 300/400/500/600 e Playfair Display 400 (normal e itálico).
- WhatsApp do Moisés: `5511996767680`, (11) 99676-7680. CRECI 67.944-F.
- **Sem foto do Moisés no site.** O site mostra só **bairro e cidade**; o endereço vai pelo WhatsApp.
- Código: `MC` + 3 dígitos, gerado pela API, imutável, nunca reaproveitado.
- `tipo`: `apartamento`, `casa`, `casa_condominio`, `terreno`, `cobertura`, `sala_comercial`, `galpao`, `chacara`. `status`: `disponivel` | `reservado` | `vendido` | `alugado`. `publicacao`: `rascunho` | `publicado`.
- Limites: primeira dobra no máximo **4** campos; no máximo **5** destaques; histórico com as últimas **20** alterações.
- Fotos WebP em **800, 1600 e 2560** px, servidas direto do CDN do store público, sem otimizador de imagem da Vercel. Meta de LCP abaixo de **2,5 s** em celular.
- Sessão: JWT HMAC-SHA256, validade **8 horas** (`AUTH_JWT_TTL_HORAS`), cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Retenção: cookie do visitante **6 meses** (15.552.000 s), eventos e resumos **180 dias**, backup **30 dias**.
- **Toda gravação de `imovel.json`, `endereco.json`, `reserva.json`, `excluido.json` e `flags.json` passa pelos handlers de `/api/imoveis` e `/api/flags`** (ADR 0001). Os únicos outros escritores do store privado são o servidor do app para `eventos/` e os jobs para `resumos/` e `backup/`.
- O store público contém **só `.webp`**. O endereço nunca aparece em log, histórico, evento ou resposta de rota pública.
- Segredos só em variáveis da Vercel (e `.env.local`, ignorado pelo git, para dev).
- Toda query SQL eventual segue a convenção de nomes completos do `CLAUDE.md` (não há SQL previsto).
- Nunca `git push`, `gh pr create`, `--no-verify`.

## Review Focus

As cinco entradas que o spec implica, sem teste próprio nele, com mais chance de morder quem usa o site. Cada uma tem teste na task dona.

1. **Excluir o imóvel de maior código e cadastrar outro** → o novo recebe o código seguinte, nunca o excluído. Teste: frente 2, Task 2.5 (`reserva depois de excluir o maior código não reaproveita`).
2. **Reeditar as fotos de um imóvel publicado** → o visitante vê as fotos novas assim que o JSON é gravado, sem esperar o CDN. Teste: frente 3, Task 3.1 (`hash muda quando o conteúdo muda, e o caminho muda junto`).
3. **Abrir o HTML de um imóvel publicado** → nenhum e-mail da equipe (`atualizado_por`, histórico) nem endereço aparece no código-fonte. Testes: frente 0, Task 0.4 (`paraPublico` descarta histórico e e-mails) e frente 1, Task 1.10 (e2e procura `@exemplo.com`, `historico` e o endereço no HTML).
4. **Retirar do ar um imóvel em destaque e tentar destacar outro com 5 já marcados** → a vaga foi liberada e o novo destaque entra. Teste: frente 2, Task 2.3 (`voltar a rascunho limpa o destaque e libera a vaga`).
5. **Tocar no WhatsApp flutuante da home ou no da seção "Prazer"** → o clique entra no total de cliques de contato, mesmo sem imóvel. Teste: frente 4, Task 4.1 (`clique de contato sem código é aceito para origem flutuante e contato`).

## Mapa de arquivos (todas as frentes)

```
apps/site/
  package.json, next.config.ts, tsconfig.json, vitest.config.ts, playwright.config.ts, vercel.json, eslint.config.mjs
  .env.exemplo                         variáveis com valores fictícios (frente 0)
  public/marca/                        logo-horizontal-branco.svg, simbolo-branco.svg (frente 0)
  src/lib/contratos/                   comum.ts, imovel.ts, flags.ts, eventos.ts, sessao.ts, publico.ts (frente 0)
  src/lib/armazem/                     tipos.ts, caminhos.ts, arquivo.ts, vercel.ts, indisponivel.ts (frente 0)
  src/lib/repositorio/                 imoveis.ts, flags.ts (frente 0)
  src/lib/dominio/                     codigo.ts (0), regras.ts, historico.ts (2)
  src/lib/config.ts, src/lib/servicos.ts                                   (frente 0)
  src/lib/apresentacao/                formatar.ts, campos.ts, whatsapp.ts, filtros.ts, vitrine.ts (frente 1)
  src/lib/catalogo.ts                  leituras públicas com cache (frente 1)
  src/lib/auth/                        sessao-jwt.ts, allowlist.ts, google.ts, autenticar.ts, guarda.ts, sessao-servidor.ts (frente 2)
  src/lib/api/                         respostas.ts, login.ts, imoveis.ts, flags.ts (2), eventos.ts, cron.ts (4)
  src/lib/painel/                      lista.ts, entrada.ts, confirmacoes.ts, cliente-api.ts (frente 2)
  src/lib/fotos/                       preparar.ts, subir.ts (frente 3)
  src/lib/skill/                       cliente.ts, planilha.ts (frente 3)
  src/lib/eventos/                     dias.ts, limitador.ts, consolidar.ts, relatorio.ts (frente 4)
  src/lib/jobs/                        backup.ts, limpeza.ts (frente 4)
  src/testes/                          servicos-de-teste.ts, fixtures.ts (frente 0)
  src/app/                             páginas e rotas (frentes 1, 2, 4)
  src/components/site/, src/components/admin/                              (frentes 1, 2, 4)
  scripts/verificar-blob.ts (0), scripts/skill/*.ts (3), scripts/verificar-publico.ts (4)
  e2e/                                 preparar.ts, fixtures-e2e.ts, *.spec.ts (frentes 1, 2, 4)
docs/verificacoes/2026-10-frente-0-blob.md   resultado das verificações da frente 0
docs/contrato-skill-publicar-imovel.md       contrato da skill (frente 3)
docs/privacidade-medicao-moises.md           documento de uma página (frente 4)
tasks/todo.md                                riscos e ajustes ao spec
```

## Interfaces compartilhadas (resumo)

Cada frente repete as assinaturas de que precisa no bloco **Interfaces** de cada task. Este resumo serve de índice.

- `ArmazemJson`: `ler(caminho)`, `gravar(caminho, dados, { ifMatch?, criarSomente? })`, `listar(prefixo)`, `listarPastas(prefixo)`, `apagar(caminhos, { ifMatch? })`, `copiar(de, para)`. Erros: `ErroConflito`, `ErroJaExiste`.
- `ArmazemFotos`: `origem`, `enviar(caminho, conteudo, contentType)`, `listar(prefixo)`, `apagar(caminhos)`.
- `Servicos`: `{ armazem, fotos, config, agora(), revalidar(tag), catalogo(), flags() }`.
- Handlers: `(req: Request, s: Servicos, ...) => Promise<Response>`, um por rota.
- Contratos: `ImovelSchema`, `ImovelEntradaSchema`, `EnderecoSchema`, `ReservaSchema`, `LapideSchema`, `FlagsSchema`, `FlagsEntradaSchema`, `EventoEntradaSchema`, `EventoGravadoSchema`, `ResumoDiaSchema`, `paraPublico()`.
