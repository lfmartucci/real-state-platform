# Site novo M.C. Vieira: design

Data: 15/10/2026. Origem: `Site MC Vieira/13-site-novo/CONTINUAR-AQUI.md`, brainstorming de 15/10/2026 e sessão de refinamento (grilling) de 15/10/2026.
Mock aprovado: `Site MC Vieira/13-site-novo/exportado/site-mc-vieira-mock-C4.html` (direção C, Cinematográfico).
Vocabulário: `CONTEXT.md` (Imóvel, Oferta, Código, Status, Rascunho, Publicado, Destaque, Preço sob consulta, Clique de contato). Decisão de arquitetura: `docs/adr/0001-gravacao-unica-pela-api.md`.

## 1. Objetivo e sucesso

Um site de imóveis (venda e aluguel), em português, hospedado na Vercel, que leva o visitante ao WhatsApp do Moisés, (11) 99676-7680. O site novo substitui a Tokko e vira a fonte única dos imóveis **na virada do domínio** (seção 12). Até lá, a Tokko fica congelada.

**Medidas de sucesso (combinadas antes de construir):**
- **Principal, não depende de consentimento:** total de cliques de contato ("Falar com o Moisés"), por imóvel, por negócio e por dia. Conta todos os visitantes, inclusive quem recusou o banner. O evento anônimo não leva ID, cookie nem IP. É menos preciso: não separa quem clicou duas vezes de duas pessoas.
- **Secundária, depende de consentimento:** visitantes únicos e recorrentes, por aparelho. Cobre só quem aceitou o banner, então é um piso.
- As duas medidas aparecem na aba Relatório do painel (seção 6) e só começam a contar quando a medição é ligada (seção 7).

**Escala:** até cerca de 50 imóveis publicados, cerca de 24 fotos por imóvel (medido em 13 pastas de originais).

**Quem opera:**
- Gabriela cadastra e edita imóveis pelo Claude Code (skill "publicar imóvel"), um a um ou em lote.
- Gabriela e Moisés usam o painel `/admin` para publicar e retirar do ar, trocar status, editar preço e texto, escolher destaques, configurar os campos visíveis e ler o relatório.
- Moisés passa a cadastrar imóveis por API na fase 2, pela mesma API que a skill usa, sem mudar o formato dos dados.

## 2. Decisões

| # | Decisão | Origem |
|---|---|---|
| 1 | Visual C4: fundo marinho `#0E1726`, hero com slideshow Ken Burns, faixas grandes alternadas, botão flutuante de WhatsApp | CONTINUAR-AQUI |
| 2 | Fotos no estilo Elliman (`grade.py`), que só corrige a luz e nunca troca o céu nem inventa ambiente | CONTINUAR-AQUI |
| 3 | Sem foto do Moisés no site | CONTINUAR-AQUI |
| 4 | Chave Comprar/Alugar, e o aluguel aparece como "R$ x/mês" | CONTINUAR-AQUI |
| 5 | O site mostra só bairro e cidade. O endereço exato vai pelo WhatsApp | 15/10 |
| 6 | Estreia em `*.vercel.app`, com a Tokko congelada. O domínio `mcvieiraimoveis.com.br` (titular: Moisés, pessoa física, no Registro.br) vira depois | 15/10 |
| 7 | Um app Next.js só, no plano **Pro** da Vercel, no time `luiz-martucci's projects` | 15/10 |
| 8 | Fotos e dados dos imóveis no Vercel Blob, em dois stores: **público** (só fotos) e **privado** (JSON, endereço, config, eventos, backup). O repositório guarda só código e documentação | 15/10 |
| 9 | Painel `/admin` com login Google, no modelo do pep19, com edição de imóveis, flags, destaques e relatório desde a primeira entrega | 15/10 |
| 10 | Primeira dobra do imóvel: bloco de preço (uma linha por oferta), área útil e quartos (com suítes). Vagas e custos mensais existem no imóvel e ficam desligados | 15/10 |
| 11 | Visitantes únicos e recorrentes por ID aleatório em cookie próprio, com consentimento | 15/10 |
| 12 | Spec único, com plano dividido em frentes paralelas | 15/10 |
| 13 | **Imóvel com várias ofertas:** um imóvel tem uma oferta de venda, uma de aluguel ou as duas. O status é do imóvel | grilling |
| 14 | **Código `MC` + 3 dígitos**, gerado pela API, imutável e nunca reaproveitado, inclusive para os imóveis migrados | grilling |
| 15 | **Publicação em dois estados:** `rascunho` e `publicado`. Retirar do ar devolve a rascunho. Marcar vendido ou alugado devolve a rascunho na hora | grilling |
| 16 | **Gravação única pela API:** skill, painel e a API do Moisés gravam JSON só por `/api/imoveis`. A skill sobe fotos direto no store público | grilling (ADR 0001) |
| 17 | Preço opcional por oferta ("Preço sob consulta") | grilling |
| 18 | Um papel só, `admin`, com confirmação forte nas ações destrutivas e histórico de alterações por imóvel | grilling |
| 19 | Migração pela skill em modo lote, entrando como rascunho para revisão no painel. Só migra imóvel com fotos originais | grilling |
| 20 | Medição (eventos, banner, cookie) desligada por `eventos_ativos` até o "de acordo" do Moisés sobre privacidade | grilling |

**Por que fotos e dados fora do git:** cerca de 1.200 fotos tratadas a ~650 KB cada somam ~780 MB só na maior resolução (estimativa). Isso torna clone e push lentos.

**Por que Pro e não Hobby:** o Hobby é para uso pessoal e não comercial, e bloqueia o Blob ao estourar a franquia (1 GB). No Pro o Blob não tem franquia própria: o uso sai do crédito mensal do plano. Preços de referência (docs da Vercel, 23/09/2026): armazenamento US$ 0,023/GB-mês, operações avançadas (put, copy, list) US$ 5/milhão, transferência US$ 0,05/GB. Para este volume, centavos por mês.

## 3. Arquitetura

Um app Next.js (App Router) com estas áreas:

| Área | Função | Usuário |
|---|---|---|
| Site público: `/`, `/imoveis`, `/imoveis/[codigo]`, `/privacidade` | Lê imóveis e flags do store privado no servidor, renderiza com cache e revalida quando algo muda | Visitante |
| Painel: `/admin` | Login Google; lista, edição e publicação de imóveis; flags; destaques; relatório | Gabriela, Moisés |
| API: `/api/auth/login`, `/api/imoveis`, `/api/flags`, `/api/eventos`, `/api/relatorio` | Autenticação, **única porta de gravação de JSON**, flags, registro de eventos, leitura do relatório | Painel, skill, visitante |
| Skill "publicar imóvel" (fora do app) | Trata fotos, sobe no store público, propõe descrição e grava o imóvel por `/api/imoveis`. Modo unitário e modo lote | Gabriela |
| Jobs (Vercel Cron) | Diário: backup, consolidação dos eventos, limpeza de eventos e backups vencidos | Sistema |

**Layout do Blob:**

```
store público
  imoveis/<codigo>/fotos/<n>-800.webp, <n>-1600.webp, <n>-2560.webp

store privado (lido só pelo servidor do app)
  imoveis/<codigo>/imovel.json        dados do imóvel, sem endereço
  imoveis/<codigo>/endereco.json      endereço completo (arquivo separado, de propósito)
  config/flags.json
  eventos/AAAA-MM-DD/<id>.json        um blob pequeno por evento (o Blob não anexa a um arquivo)
  resumos/AAAA-MM-DD.json             consolidação diária dos eventos
  backup/AAAA-MM-DD/...               cópia diária dos JSON de imoveis/ e config/, guardada por 30 dias
```

**Regras:**
- O código do imóvel é o identificador e entra na URL, nos eventos e na mensagem do WhatsApp.
- **Toda gravação de JSON passa por `/api/imoveis` ou `/api/flags`.** Lá vivem, num lugar só: validação do esquema, geração do código, checagem de concorrência, `status_desde`, histórico e revalidação do cache. Ninguém grava JSON direto no Blob (ADR 0001).
- **Geração do código:** a API calcula o próximo `MC` a partir do maior existente e grava com `allowOverwrite: false`. Se o arquivo já existe (dois lotes ao mesmo tempo), tenta o seguinte.
- **Concorrência:** cada leitura devolve o ETag do `imovel.json`, e a gravação usa `ifMatch`. Se outra pessoa gravou antes, o Blob recusa (`BlobPreconditionFailedError`), a API responde 409 e quem editava relê e tenta de novo.
- Um JSON por imóvel evita que dois editores sobrescrevam imóveis diferentes um do outro.
- O site lê no servidor, com cache por tag, e a API revalida a tag ao gravar. Publicar não exige deploy. A leitura logo depois de gravar usa `useCache: false` para não pegar o CDN velho (até 60 s).
- Não existe `indice.json`. O índice é montado no servidor com `list()` do prefixo `imoveis/` do store privado, com cache. Na frente 0, confirmar se um blob recém-gravado aparece de imediato no `list()`; se não, a API revalida o índice com a tag depois de gravar e o painel mostra o imóvel pela resposta da própria gravação.
- O store público contém **só fotos `.webp`**. Nenhum JSON, nenhum endereço.
- O endereço fica num arquivo separado mesmo dentro do store privado: um bug que serialize o imóvel inteiro para o navegador não vaza o endereço.
- Ordem de gravação da skill: fotos no store público, depois o imóvel pela API. Uma falha no meio deixa fotos órfãs, nunca um imóvel sem foto. As fotos órfãs são apagadas na próxima tentativa (o caminho é determinístico).

## 4. Contratos

Estes contratos são escritos primeiro, como tipos e esquemas validados, e todas as frentes dependem deles.

### 4.1 Imóvel (`imovel.json`)

| Grupo | Campos |
|---|---|
| Identidade | `codigo` (`MC` + 3 dígitos), `tipo`, `status`, `status_desde`, `publicacao` (`rascunho` \| `publicado`), `publicado_em` (primeira publicação; vazio se nunca foi ao ar) |
| Ofertas | lista de 1 ou 2 `{ negocio: venda \| aluguel, preco?, inclui_condominio? }`, no máximo uma de cada negócio |
| Texto | `titulo` (tese do imóvel em uma frase afirmativa), `descricao`. Sem emoji |
| Local | `bairro`, `cidade` |
| Custos mensais | `condominio`, `iptu` (opcionais, inteiros em reais) |
| Medidas | `area_util_m2`, `area_total_m2`, `quartos`, `suites`, `banheiros`, `vagas` |
| Comodidades | lista de textos curtos |
| Fotos | lista de `{ ordem, legenda, larguras: { 800, 1600, 2560 }, placeholder }`, com a primeira como capa |
| Controle | `criado_em`, `atualizado_em`, `atualizado_por`, `destaque`, `historico` |

**`tipo`:** enum fechado: `apartamento`, `casa`, `casa_condominio`, `terreno`, `cobertura`, `sala_comercial`, `galpao`, `chacara`.

**`status`:** `disponivel` \| `reservado` \| `vendido` \| `alugado`.
- O status é do imóvel inteiro. Quando uma oferta fecha, o imóvel sai do mercado.
- `vendido` só é aceito se o imóvel tem oferta de venda; `alugado`, se tem oferta de aluguel.
- Qualquer transição vale. Toda troca grava `status_desde`.
- Marcar `vendido` ou `alugado` muda `publicacao` para `rascunho` na mesma gravação.
- Quando um aluguel acaba, o imóvel volta a `disponivel` com as ofertas que tinha.

**`preco`:** inteiro em reais, opcional. Ausente significa "Preço sob consulta".

**`inclui_condominio`:** só existe na oferta de aluguel.

**`destaque`:** no máximo 5 imóveis com `destaque: true` ao mesmo tempo. A API recusa o sexto.

**`historico`:** as últimas 20 alterações, `{ em, por, campo, de, para }`. O endereço nunca entra no histórico.

**Endereço:** `imoveis/<codigo>/endereco.json` (`{ codigo, endereco_completo, atualizado_em }`), no store privado, fora do contrato do imóvel. Só a API grava e só o painel e a skill leem.

**Exibição:**
- Imóvel em `rascunho` não aparece na lista nem na home. A URL direta responde **404** com a página "Este imóvel não está mais disponível" e um link para `/imoveis`, sem nenhum dado do imóvel.
- Aluguel exibe "R$ x/mês", e o formato diz se inclui condomínio.
- Área útil e área total são campos separados.
- Campo opcional ausente é omitido na tela, nunca exibido como zero.

### 4.2 Flags (`config/flags.json`)

- As chaves aceitas são um **enum fechado de campos públicos** (`area_util_m2`, `area_total_m2`, `quartos`, `suites`, `banheiros`, `vagas`, `condominio`, `iptu`, `tipo`). Qualquer outra chave, inclusive de endereço, é recusada pelo esquema.
- `primeira_dobra`: lista de chaves de campo, **máximo 4**. O bloco de preço fica sempre à parte e conta como um só, mesmo com duas ofertas. Padrão: `area_util_m2`, `quartos`.
- `detalhes`: lista de chaves de campo mostradas nas seções de detalhe. Padrão: vazia.
- `eventos_ativos`: liga a medição (banner, cookie, `/api/eventos`). Padrão: `false` (seção 7).
- `atualizado_em` e `atualizado_por` (e-mail do editor).
- O painel recusa o quinto campo na primeira dobra.

### 4.3 Sessão do painel

- JWT HMAC-SHA256: `sub` (e-mail), `papel`, `iss`, `iat`, `exp`. Validade de 8 horas (`AUTH_JWT_TTL_HORAS`).
- No login, o servidor exige `email_verified` e compara o e-mail em minúsculas com `AUTH_ALLOWLIST`.
- As rotas `POST`, `PUT` e `DELETE` do painel também conferem o cabeçalho `Origin`.
- Um só papel, `admin`. As ações destrutivas têm confirmação forte (seção 6), e toda alteração fica no histórico do imóvel.

### 4.4 Gravação pela skill

- A skill chama `/api/imoveis` com o segredo `SKILL_API_SECRET` no cabeçalho, em vez do JWT. A mesma credencial serve à API do Moisés na fase 2 (ou um segredo próprio dele).
- `atualizado_por` recebe `skill` (ou `api`), para o histórico.

### 4.5 Eventos

| Evento | Campos | Quando |
|---|---|---|
| `clique_whatsapp` | `visitante_id` (opcional), `codigo`, `negocio` (`venda` \| `aluguel`, opcional), `origem` (`lista` \| `imovel` \| `flutuante`), `data` (ISO 8601, UTC) | Clique em qualquer botão de WhatsApp |
| `visualizacao_imovel` | `visitante_id` (opcional), `codigo`, `negocio` (opcional), `data` | Abertura da página de um imóvel |

- `negocio` vem do contexto da visita (`?negocio=` herdado da lista). Sem contexto, fica ausente.
- O `visitante_id` é **opcional** e só vai no evento se o visitante aceitou o cookie (seção 7). Sem consentimento, o site envia o mesmo evento **sem `visitante_id`** (evento anônimo). O total de cliques e de visualizações conta todos os eventos, com ou sem ID. Únicos e recorrentes contam só os eventos com ID.
- Com `eventos_ativos: false`, o site não envia evento nenhum e o endpoint recusa tudo.

**Defesa do endpoint `/api/eventos`** (é público, e cada gravação custa):
- Valida o esquema, exige `codigo` de um imóvel publicado e, quando houver `visitante_id`, que seja um UUID.
- Limita a frequência por origem de rede, sem guardar o IP, e descarta user agents de bot.
- Não grava IP, user agent nem qualquer outro dado do visitante no evento.

## 5. Site público

| Rota | Tarefa do visitante | Conteúdo, nesta ordem |
|---|---|---|
| `/` | explorar | Hero com os destaques → chave Comprar/Alugar → faixas grandes alternadas → "Prazer, eu sou" (só texto e foto de imóvel) → contato |
| `/imoveis` | comparar | Filtros (negócio, tipo, bairro, preço, quartos) → grade → estado vazio explicado |
| `/imoveis/[codigo]` | decidir | Veja abaixo |
| `/privacidade` | entender | Política de privacidade em linguagem simples (seção 7) |

**Hero:** os imóveis com `destaque`, publicados e com status `disponivel` (no máximo 5). Sem nenhum, os 3 publicados e disponíveis mais recentes. Reservado não entra no hero.

**Abas Comprar e Alugar:** um imóvel aparece em cada aba onde tem oferta. Com venda e aluguel, aparece nas duas.

**Página do imóvel:**
1. Eyebrow (tipo e bairro) e título (a tese do imóvel).
2. Galeria, com a capa grande.
3. Primeira dobra: bloco de preço, os campos de `primeira_dobra` e o botão "Falar com o Moisés".
   - Bloco de preço: uma linha por oferta ("Venda R$ 1.200.000", "Aluguel R$ 6.000/mês"), ou "Preço sob consulta".
   - A ordem segue o contexto: `?negocio=aluguel` (vindo da lista) põe o aluguel em cima. Sem contexto, venda primeiro.
4. Descrição e comodidades, com no máximo 4 itens por bloco.
5. Seção de detalhes, conforme as flags.
6. Procedência: "Atualizado em dd/mm/aaaa" e o código do imóvel.
7. Bairro e cidade, sem mapa.

**Botão do WhatsApp:** é a única cor de ação do site (verde do WhatsApp) e não aparece em mais nada. A mensagem vai pronta com o código e o título. Com contexto, cita o negócio ("Tenho interesse em alugar o MC007 – Casa no Morumbi"). Sem contexto, é neutra.

**Filtros na URL**, por exemplo `/imoveis?negocio=aluguel&quartos=3`, para o link ser compartilhável.
- O filtro de tipo mostra só os tipos que têm imóvel publicado.
- O filtro de faixa de preço exclui imóveis sob consulta e avisa quantos ficaram de fora ("3 imóveis com preço sob consulta não entram neste filtro"). Na ordenação por preço, os sob consulta vão para o fim.

**Estados:**

| Estado | Tela |
|---|---|
| Carregando | Esqueleto com a forma da grade e das fotos, com placeholder borrado em cada foto |
| Vazio | Frase que explica o que foi consultado e o que remover. Ex.: "Nenhum imóvel de aluguel com 4 quartos no Morumbi. Remova o filtro de quartos para ver 6." |
| Reservado | O imóvel continua na lista e na página, com selo e sem o botão principal de contato. O botão flutuante continua |
| Rascunho (inclui vendido e alugado) | Não aparece em lugar nenhum. A URL direta responde 404 com "Este imóvel não está mais disponível" e link para `/imoveis` |
| Erro (Blob indisponível) | Mensagem clara e o botão do WhatsApp |

**Fotos:** `srcset` com 800, 1600 e 2560 px em WebP. `loading="lazy"` abaixo da primeira dobra. As fotos do hero e a capa carregam com prioridade. Servidas direto do CDN do store público, sem otimizador de imagens da Vercel. Toda foto tem texto alternativo (a legenda, ou título e número da foto). O Ken Burns respeita `prefers-reduced-motion`. Meta de LCP: abaixo de 2,5 s em celular.

**Princípios de página adotados** (do guia de páginas e data-viz): uma mensagem por tela em três registros (eyebrow, título, leitura), todo número com base e unidade, no máximo 5 blocos heterogêneos por dobra, cor semântica reservada, teste do tom de cinza, estados vazio e de erro explicados, sem emoji.

## 6. Painel `/admin`

- **Login:** botão Google (GIS). O servidor verifica o ID token com `google-auth-library`. O OAuth Client ID fica no projeto GCP `mc-vieira-site`, na conta Google pessoal do Luiz (tela de consentimento externa, em produção, só escopo de e-mail). O e-mail é conferido na variável `AUTH_ALLOWLIST` (nega por padrão se estiver vazia). O JWT vai em cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Desenho reaproveitado de `pep19/api/auth/login.ts`, sem o BigQuery.
- **Proteção:** toda rota `/api` do painel confere o JWT no servidor.
- **Imóveis:**
  - Lista com filtros por publicação (rascunho, publicado), status e "esteve no ar". Rascunho com `publicado_em` mostra o selo "Esteve no ar até dd/mm", para não ser confundido com um imóvel novo do lote.
  - Pré-visualização de qualquer imóvel, inclusive rascunho, como a página pública ficaria.
  - Edição de ofertas e preços, condomínio, IPTU, título, descrição, medidas e comodidades.
  - Publicar (rascunho → publicado) e retirar do ar (publicado → rascunho).
  - Troca de status. Marcar vendido ou alugado pede que se digite o código, porque tira o imóvel do ar na hora. Sair de vendido ou alugado pede confirmação ("Este imóvel volta a aparecer na lista. Confirmar?").
  - Marcar e desmarcar destaque (máximo 5).
  - Edição do endereço completo, só nesta tela.
  - Histórico do imóvel (últimas 20 alterações).
  - **Excluir definitivamente:** só para rascunhos, com confirmação digitando o código. Apaga o `imovel.json`, o `endereco.json` e as fotos. O código não é reaproveitado. Os backups guardam os JSON por 30 dias, mas não as fotos: depois de excluídas, as fotos não voltam.
  - Cada gravação valida o esquema e usa o ETag. Se outra pessoa mudou o imóvel antes, o painel mostra o aviso e recarrega.
- **Flags:** duas listas de caixas, "Primeira dobra" (máximo 4) e "Detalhes", com pré-visualização da página do imóvel. Ao salvar, grava `flags.json` e revalida o cache.
- **Relatório (só leitura):**
  - Por imóvel e por negócio, nos últimos 7 e 30 dias: cliques de contato, visualizações e taxa de clique (cliques ÷ visualizações).
  - Bloco separado: visitantes únicos e recorrentes, marcado como "piso: só quem aceitou cookies".
  - Lê os resumos diários (`resumos/`).
  - Com `eventos_ativos: false`, mostra "Medição desligada até a revisão de privacidade".
- **Fora do painel:** subir e tratar fotos fica com a skill. O painel não faz upload de foto.

## 7. Visitantes e privacidade (LGPD)

- **A medição começa desligada** (`eventos_ativos: false`): sem banner, sem cookie, sem eventos. O site estreia assim.
- **Quem decide ligar:** o Moisés, como controlador dos dados, depois de ler um documento de uma página (entregável da frente 4) com três perguntas:
  1. O evento anônimo (sem ID, cookie nem IP) pode ser coletado sem consentimento?
  2. O cookie com UUID aleatório, válido por 6 meses e gravado só após o aceite, com eventos retidos por 6 meses, está adequado?
  3. O texto do banner e da política está correto?
  Ele pode consultar o advogado ou o contador, se quiser. A flag só é ligada com o "de acordo" dele registrado por escrito (e-mail ou WhatsApp).
- Com a medição ligada:
  - O site grava, no navegador, um **UUID aleatório** em cookie próprio, com validade de 6 meses, **só após o visitante aceitar** o banner.
  - Os eventos guardam o `visitante_id`, o código do imóvel, o negócio, a origem e a data. **Nenhum nome, e-mail, telefone ou IP.**
  - Se o visitante recusar, o site funciona normalmente e **não grava cookie nem `visitante_id`**. O clique e a visualização ainda geram eventos anônimos, que não identificam ninguém e alimentam só os totais.
- A página `/privacidade` descreve, em linguagem simples, a finalidade, a contagem anônima e o prazo de retenção (6 meses, o mesmo do cookie). Eventos mais antigos são apagados pelo job diário.
- Limite conhecido: quem recusa, troca de navegador ou limpa os dados não entra em únicos e recorrentes, ou conta como novo. Esses números são um piso. O total de cliques não tem esse limite.

## 8. Contrato com a skill "publicar imóvel"

A skill tem ciclo de design próprio, em spec separado. Aqui fica só o contrato.

**Modo unitário (cadastro novo ou edição):**
1. Recebe fotos e dados, ou, numa edição, lê o imóvel atual pela API.
2. Avisa quando uma foto é ruim demais (escura, tremida ou pequena) e pede decisão. Não corrige o que não dá para corrigir.
3. Roda o `grade.py`, aplica o logo, gera as 3 larguras em WebP e o placeholder.
4. Propõe título e descrição, e monta o imóvel com um resumo para conferência.
5. Só depois da confirmação sobe as fotos no store público e grava o imóvel por `/api/imoveis` (seção 3). O endereço vai na mesma chamada, em campo separado, e a API grava no `endereco.json`.

**Modo lote (migração e cadastros em série):**
1. A skill pré-preenche uma planilha a partir das páginas públicas atuais da Tokko (título, ofertas, preços, medidas, texto) e da pasta de fotos originais de cada imóvel.
2. A Gabriela revisa a planilha e completa o que a página pública não tem (endereço exato).
3. Um script roda a skill para cada linha: trata as fotos, propõe a descrição e grava pela API **como rascunho**.
4. A conferência acontece no painel: a Gabriela abre cada rascunho na pré-visualização e publica.
5. A planilha valida `tipo` e `negocio` contra os enums antes de rodar.

**Regras comuns:**
- Só migra imóvel com fotos originais. Fotos baixadas da Tokko não são usadas (resolução baixa, marca d'água de terceiros). Imóvel sem original fica na Tokko congelada até os originais chegarem.
- Só entra no Blob a versão com marca d'água da M.C. Vieira. O original sem marca nunca vai para o Blob.
- A skill nunca grava JSON direto no Blob (ADR 0001).

## 9. Erros e segurança

- Blob indisponível: estado de erro do site, sem quebrar a página.
- O store público contém só fotos. Teste dedicado confirma que nenhum JSON e nenhum endereço é acessível por URL pública.
- Todas as rotas de escrita exigem JWT do painel ou o `SKILL_API_SECRET`.
- Segredos (`AUTH_JWT_SECRET`, `GOOGLE_CLIENT_ID`, `AUTH_ALLOWLIST`, `SKILL_API_SECRET`, tokens dos dois stores do Blob) só em variáveis da Vercel.
- Gravações validam o esquema na API, que é o único ponto de escrita.
- Operações do painel exigem JWT válido, conferido no servidor.
- O endereço nunca aparece em log, histórico, evento ou resposta de rota pública.

## 10. Testes

- **Unidade:** validação dos esquemas; regras de status por oferta (`vendido` sem oferta de venda é recusado); vendido ou alugado muda para rascunho; limite de 4 flags; limite de 5 destaques; enum fechado das flags (recusa chave de endereço); enum de `tipo`; histórico limitado a 20 e sem endereço; URL do WhatsApp com acento e `&` codificados e com o negócio do contexto; formatação de preço, "sob consulta" e área; assinatura e expiração do JWT.
- **Integração:**
  - login com token inválido, de e-mail fora da lista e válido; gravação sem login nem segredo falha;
  - geração de código sem colisão com dois cadastros simultâneos;
  - gravação concorrente do mesmo imóvel recusada pelo ETag (409);
  - nenhum JSON nem endereço acessível no store público;
  - rascunho responde 404 com a página "não está mais disponível"; reservado aparece sem botão de contato;
  - com `eventos_ativos: false`, nenhum cookie, nenhum banner e `/api/eventos` recusa;
  - com a medição ligada e sem consentimento, o evento é gravado sem `visitante_id` e nenhum cookie é criado;
  - eventos sob abuso (1.000 envios seguidos não geram 1.000 blobs);
  - exclusão definitiva só para rascunho, e apaga JSON, endereço e fotos;
  - jobs de backup, consolidação e limpeza são idempotentes; backup com mais de 30 dias é apagado.
- **End-to-end (Playwright):** navegação como visitante em celular e desktop; imóvel com duas ofertas nas duas abas e com a ordem de preço do contexto; filtros na URL, inclusive o aviso de "sob consulta"; botão do WhatsApp com a mensagem certa; estados vazio e de erro; banner de cookies; flag alterada no painel refletida no site; imóvel publicado, retirado do ar e marcado como vendido no painel refletido no site; relatório com dados; acessibilidade por teclado e contraste (axe).
- **Visual:** screenshots da home e da página do imóvel contra o mock C4.

## 11. Frentes do plano (paralelas, depois dos contratos)

0. Estrutura do repositório (o app fica em `apps/site/`, e o `CLAUDE.md` ganha stack, comandos e a seção "Como transferir"); contratos como tipos e esquemas (imóvel, endereço, flags, sessão, eventos); criação dos dois stores do Blob no time `luiz-martucci's projects`. Verificações: visibilidade imediata no `list()` e se a transferência de projeto entre times da Vercel leva os stores do Blob junto. Bloqueia as demais.
1. Site público: páginas, galeria, filtros, estados, página de privacidade, acessibilidade.
2. API e painel: login, `/api/imoveis` (código, ETag, histórico, status, exclusão), `/api/flags`, lista, edição, publicação, destaques e pré-visualização.
3. Contrato com a skill (unitário e lote), `SKILL_API_SECRET` e código compartilhado de imagens que o repositório mantém (esquemas, larguras, placeholder). O tratamento de foto com `grade.py`, a proposta de descrição e o pré-preenchimento da planilha pertencem à skill, no spec dela.
4. Eventos e defesa do endpoint, banner de cookies, flag `eventos_ativos`, documento de uma página para o Moisés, jobs (backup, consolidação, limpeza), aba Relatório, testes e deploy.

## 12. Transição e portabilidade

**Estreia e virada:**
- O site estreia em `*.vercel.app` com os imóveis migrados pelo lote e publicados pela Gabriela.
- A Tokko fica congelada: nada novo entra lá. Durante a transição, só os imóveis que fecharem negócio são marcados lá também.
- A virada do domínio (fora do escopo desta entrega) é: o Moisés aponta o DNS no Registro.br para a Vercel, as URLs antigas da Tokko redirecionam para `/imoveis` (os códigos novos não guardam o ID antigo), e a Tokko é desligada. A partir daí, o site é a fonte única.

**Portabilidade** (transferir para o Moisés ou outra pessoa depois; não é prioridade agora):
- Tudo vive no mesmo time da Vercel: projeto, os dois stores do Blob, variáveis de ambiente e Cron. Nada depende de outra conta.
- O projeto GCP `mc-vieira-site` é transferido adicionando o novo dono como Owner.
- O `CLAUDE.md` do app lista cada recurso, onde vive e como transferir. Se a frente 0 mostrar que os stores não acompanham a transferência de projeto, o caminho documentado é backup mais script de cópia.

## 13. Fora do escopo

Virada do domínio, mapa, favoritos, cadastro de visitantes, a skill em si (spec próprio), upload de foto pelo painel, a API do Moisés para cadastrar imóveis (fase 2), papéis com permissões diferentes, resumo do relatório por WhatsApp ou e-mail.

## 14. Pontos em aberto

- **Frente 0:** confirmar se a transferência de projeto entre times da Vercel leva os stores do Blob, e se um blob recém-gravado aparece de imediato no `list()`.
- **Operacional:** conseguir com o Moisés ou o fotógrafo os originais das fotos dos imóveis que só existem na Tokko. Até lá, esses imóveis não migram.
- **Privacidade:** "de acordo" do Moisés para ligar `eventos_ativos` (seção 7).
