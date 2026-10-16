## 🧭 Filosofia central

**Planejamento profundo na frente, execução autônoma atrás.**
- Dúvidas técnicas durante o build resolvem-se via **ping-pong entre subagentes** antes de interromper o humano.


## 🧱 Projeto

- **O que é:** site de imóveis da M.C. Vieira (venda e aluguel) que leva o visitante ao WhatsApp do Moisés; painel `/admin` para a Gabriela e o Moisés; API única de gravação usada pela skill "publicar imóvel".
- **Stack:** Next.js 16 (App Router) + TypeScript, zod, Vercel Blob (store privado para JSON, público para fotos), Vercel (plano Pro, time `luiz-martucci's projects`), Vitest e Playwright.
- **Comandos (em `apps/site/`):** `npm install` · `npm run dev` · `npm test` · `npm run test:e2e` · `npm run lint` · `npm run typecheck` · `npm run build`.
- **Estrutura:** `apps/site/src/lib/` regras e contratos (testados sem servidor); `apps/site/src/app/` páginas e rotas finas; `apps/site/scripts/` CLI da skill e verificações; `docs/` spec, plano, ADRs e verificações.


## 🎯 Regras de ouro

1. **Discovery primeiro, build depois.** Spec aprovada antes de código não-trivial.
2. **Resolva dúvidas internamente.** Subagentes como camada de consultoria antes do humano.
3. **Interromper humano é exceção** — critérios em [Quando escalar](#-quando-escalar-ao-usuário-raro).
4. **Simplicity First** — toda mudança é a mais simples possível.
5. **No Laziness** — encontre causa-raiz. Sem `try/except: pass`, sem TODO esquecido.
6. **Minimal Impact** — toque só no necessário; refactor de oportunidade só se no plano.
7. **Não infira** — antes de propor solução, valide com evidência (ver [Aprendizados](#-aprendizados-evergreen)).
8. **Sinalize riscos por escrito sem necessariamente parar** — registre em `tasks/todo.md`.


## 🚨 Quando escalar ao usuário (raro)

Escale quando:
- Trade-off de **produto** que muda comportamento percebido pelo usuário-final.
- Decisão **irreversível** (deletar dados, breaking change em API pública, schema em produção).
- Risco **financeiro/operacional** alto (gastos de API, toque em produção, deletar branch protegido).
- Ambiguidade fundamental no problema (não na solução).

**Não escale** por:
- Escolha entre opções técnicas equivalentes.
- Naming, formatação, organização interna.
- Detalhes de estilo dentro de design system definido.
- Refactor de escopo limitado dentro do plano.
- Decisões reversíveis com baixo custo.

Mensagem estruturada quando escalar: **contexto + opções + recomendação + impacto de cada caminho**.

---

## ✅ Verificação antes de "Done"

- Nunca marque tarefa completa sem provar que funciona.
- Compare comportamento antes/depois quando relevante (diff de output, testes, screenshots).
- **Pra mudanças de UI/UX: rode o app, navegue como usuário e faça screenshot. Use Playwright se houver dúvida.**
- Pergunte-se: "Um staff engineer aprovaria isso em code review?"
- Antes de declarar `done`, rode `superpowers:verification-before-completion`.

> Build verde ≠ feature funciona. Status de CI prova que **compila**, não que **funciona**.

---

## 📦 Fechamento de implementação (branch → commit → push → PR)

Ao terminar de implementar uma spec — **depois** de passar pela checklist de [Verificação antes de "Done"](#-verificação-antes-de-done) — feche sempre pela sequência abaixo. Nunca pule etapa, mesmo em specs pequenas.

> ⚙️ **Branch, `git add`, `git commit` e `git pull --rebase` são AÇÃO DO AGENTE — execute de
> fato, não apenas gere o texto.** Confira o que vai entrar no `add` com leitura (`git status`,
> `git diff`) antes de adicionar, e nunca `git add .` às cegas — liste os arquivos da spec.
> **Push e abertura de PR continuam ação do humano**: nunca rode `git push` nem `gh pr create`
> por conta própria (ver "⛔ Comandos proibidos") — gere o comando de push, e sob demanda a
> descrição do PR, como texto pra ele copiar e rodar.

**1. Nome da branch**
Padrão `tipo/escopo-curto` (ex: `feat/busca-por-bairro`, `fix/filtro-preco-nulo`). Crie de fato:
```bash
git checkout -b tipo/escopo-curto
```

**2. `git add`**
Adicione de fato, listando explicitamente os arquivos alterados/criados relevantes à spec:
```bash
git add caminho/arquivo1 caminho/arquivo2
```

**3. `git commit`**
Crie o commit de fato. Mensagem no padrão Conventional Commits (`feat`, `fix`, `refactor`, `chore`, `docs`, `test`), curta, no imperativo, referenciando a spec quando fizer sentido.
```bash
git commit -m "feat(escopo): descrição curta da mudança"
```

**4. `git pull --rebase`**
Rode de fato, sempre com rebase, pra manter histórico limpo antes do push. Se der conflito, resolva antes de seguir.
```bash
git pull --rebase origin main
```

**5. Comando de push — entregável de texto, NÃO execute**
Gere pronto pra copiar; quem roda é o humano.
```bash
git push -u origin tipo/escopo-curto
```

**6. Descrição do PR — entregável de texto, NÃO execute nem abra o PR**
Estrutura fixa:
- **Contexto:** por que essa mudança existe (link da spec/issue).
- **O que mudou:** bullets objetivos.
- **Como testar:** passos manuais ou comando de teste.
- **Riscos/impacto:** o que pode quebrar, se algo precisa de atenção em produção.

> **A descrição do PR é SOB DEMANDA, e vai no chat.** Não a gere no fechamento por default —
> só quando o humano pedir, que é quando ele está de fato abrindo o PR. Aí emita **dentro de um
> bloco de código markdown** (cerca ```` ```markdown ````), pronto para copiar/colar no GitHub sem
> reformatar. Nunca como texto solto. Não escreva a descrição em arquivo.

> Os itens 1–5 são a saída padrão de fechamento — não espere o usuário pedir cada um separadamente;
> os itens 1–4 você executa de fato, o item 5 (push) você só gera como texto. O item 6 é a única
> exceção de geração: só quando pedido, porque descrição gerada cedo envelhece a cada commit novo
> na branch.

---

## 🤝 Ping-pong entre subagentes

Quando uma dúvida aparece durante o build, **antes** de cogitar interromper o humano, rode ciclo de consulta interna:

1. Agente principal formula a dúvida com clareza (problema + opções + viés inicial).
2. Consulta subagente especialista relevante.
3. Se resolve, segue.
4. Se não resolve, consulta segundo especialista com viés oposto (ex: revisão adversarial).
5. Se ainda não resolve, escala (ver Quando escalar).

---

## 🧮 Seleção de modelo ao disparar subagentes

Regra deste projeto — **sobrepõe** a diretriz genérica de "Model Selection" de skills externas (ex: `superpowers:subagent-driven-development`), que recomenda subir até "o modelo mais capaz disponível" em tarefas de arquitetura/design:

1. **Modelo não especificado → o mais barato que dê conta da tarefa.** Tarefa mecânica (1-2 arquivos, spec clara, sem ambiguidade) vai pro modelo mais barato disponível (ex: Haiku) por padrão — nunca herda o modelo da sessão por omissão.
2. **Teto = modelo da sessão atual.** Nenhum subagente disparado nesta sessão pode rodar em modelo **superior** ao que o usuário escolheu para a sessão, com duas exceções:
   - **Revisão** (code review, adversarial review, security audit).
   - **Planejamento/arquitetura** (specs, PRDs, decisões de design).
3. Nessas duas exceções, pode-se escalar acima do modelo da sessão até o mais capaz disponível — é o único caso em que vale pagar o prêmio.

**Por quê:** o usuário já fez a escolha de custo/capacidade pra sessão; deixar um subagente escalar sem necessidade por padrão descontrola gasto sem ganho correspondente. Review e planejamento são exceção porque erro ali é caro de destravar depois.

---

## ⛔ Comandos proibidos

| Comando | Por quê |
|---|---|
| `git push`, `gh pr create` (por conta própria) | Push e PR são ação do humano |
| `git push --force` em `main` | Branch protegida |
| `rm -rf` em diretórios fora do projeto | Sanidade |
| `--no-verify`, `--no-gpg-sign` em commits | Hooks existem por motivo; investigar antes de pular |

> Acrescente aqui comandos de deploy específicos da infra escolhida (ex: CLI de deploy quando o deploy é via integração Git).


## 🗄️ Convenção de SQL — nomes completos, sempre

Em **toda** query (migrations, views, scripts, resposta em chat), use nomes **descritivos e completos** para CTEs, aliases de tabela e colunas derivadas. Alias de 1–3 letras (`r`, `p`, `t1`) é proibido: encarece a leitura, atrapalha buscar o nome no arquivo e some do contexto quando a query passa de 20 linhas.

| ❌ | ✅ |
|---|---|
| `WITH i AS (...)` | `WITH imoveis_ativos AS (...)` |
| `propriedades p` | `propriedades AS propriedade` |

Regras de apoio:
- Nome no **domínio do negócio**, coerente com o nome da coluna/tabela real.
- `AS` explícito em alias de tabela e de coluna — nunca alias implícito por justaposição.
- Qualifique **toda** coluna com o alias da sua tabela em query com JOIN, mesmo quando não há ambiguidade hoje.
- Vale igualmente para SQL descartável de investigação: a query de hoje vira a view de amanhã.

---

## 🔐 Segurança e LGPD

- Nunca exponha credenciais, tokens ou secrets em código, logs ou mensagens.
- Dados pessoais (clientes, proprietários, documentos, contatos) não vão para logs nem para fora de zona controlada sem justificativa.
- Nunca execute destrutivos em produção sem confirmação explícita (caso legítimo de escalar).


## 🔄 Loop de auto-melhoria + Auditoria periódica

**Auto-melhoria:**
- Após qualquer correção do humano (técnica ou de processo): registre o padrão em `tasks/lessons.md`.
- Itere nas lições até taxa de repetição cair a zero.
- **No início de cada sessão: releia `tasks/lessons.md`** (se existir) antes de começar trabalho não-trivial.
- Atualize [Aprendizados](#-aprendizados-evergreen) quando um padrão se cristalizar como regra universal.

**Auditoria (a cada milestone, antes de deploy importante, ou sob demanda):**

Categorias: Segurança (secrets, CVEs, validação de input, PII em logs), Performance (queries N+1, bundle size, paths críticos), Qualidade (code smells, duplicação, complexidade), Cobertura de testes, Conformidade com este CLAUDE.md, LGPD.


## 🪞 Aprendizados (evergreen)

Padrões cristalizados como regras. **Casos datados (histórico narrativo) ficam em `tasks/lessons.md`.**

- **Não inferir nunca.** Antes de propor solução, valide com evidência observável (grep, `git diff`, `curl`, `Read`). Conclusão sem dado é palpite — em código de produção, palpite vira incidente.
- **Checklist antes de planejar pipeline de dados.** Pra qualquer plano envolvendo movimentação de dados, perguntar: (a) "PII saindo de zona controlada?" — se sim, justificar caso a caso; (b) "Estou usando a plataforma certa pra escala?"; (c) "Pré-requisitos contradizem o próprio plano?". Se qualquer resposta for "ops", parar e replanejar antes de escrever a primeira linha.
- **Diagnóstico estruturado quando a 1ª solução falha.** Ao falhar 1 vez na correção do mesmo problema, pare e invoque `superpowers:systematic-debugging`. Não tente segunda solução sem diagnóstico empírico.
- **Build verde ≠ feature funciona.** Pra qualquer mudança UI/UX, valide navegando como usuário (Playwright/preview) antes de declarar pronto.
- **Branches longos exigem merge real.** Pra branches >1 semana com 5+ arquivos comuns: `git merge --no-commit --no-ff` num branch tmp e resolver conflitos. Nunca copiar blobs cegamente.
- **Auto-merge pode duplicar.** Rode build/testes depois de `git merge` automático antes de declarar resolvido.
- **`git filter-repo` destrói refs locais.** Sempre criar backup remoto antes de rewrite de histórico.

---

## 🔁 Como transferir (para o Moisés ou outra pessoa)

| Recurso | Onde vive | Como transferir |
|---|---|---|
| Projeto `mc-vieira-site` | Vercel, time `luiz-martucci's projects` | Settings → Transfer Project para o time do novo dono |
| Stores `mcv-privado` e `mcv-publico` | Vercel Blob, mesmo time | Ver `docs/verificacoes/2026-10-frente-0-blob.md`. Se não acompanharem a transferência: criar stores no time novo e copiar com backup + script de cópia |
| Variáveis (`AUTH_*`, `GOOGLE_CLIENT_ID`, `SKILL_API_SECRET`, `CRON_SECRET`, `FOTOS_ORIGEM`, tokens do Blob) | Vercel, ambiente do projeto | Recriar no time novo se não vierem; gerar segredos novos (`openssl rand -base64 32`) |
| Cron diário `/api/cron/diario` | `apps/site/vercel.json` | Vai com o código |
| OAuth Client ID | Projeto GCP `mc-vieira-site`, conta Google pessoal do Luiz | IAM → adicionar o novo dono como Owner |
| Domínio `mcvieiraimoveis.com.br` | Registro.br, titular Moisés | Já é do Moisés; só apontar o DNS para o projeto |

## 📚 Referências

> Criar sob demanda; remover da lista o que não fizer sentido.

- **Estado atual do projeto** (features ativas, roadmap): `docs/project-state.md`
- **Design system** (tokens, layout, componentes): `docs/design.md`
- **Acervo de soluções documentadas** (bugs, padrões): `docs/solutions/`
- **Vocabulário de domínio compartilhado**: `CONCEPTS.md` — entidades (imóvel, anúncio, proprietário, lead, contrato…), processos e status.
