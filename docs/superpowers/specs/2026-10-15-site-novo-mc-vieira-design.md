# Site novo M.C. Vieira: design

Data: 15/10/2026. Origem: `Site MC Vieira/13-site-novo/CONTINUAR-AQUI.md` e brainstorming de 15/10/2026.
Mock aprovado: `Site MC Vieira/13-site-novo/exportado/site-mc-vieira-mock-C4.html` (direção C, Cinematográfico).

## 1. Objetivo e sucesso

Um site de anúncios de imóveis (venda e aluguel), em português, hospedado na Vercel, que leva o visitante ao WhatsApp do Moisés, (11) 99676-7680. A Tokko sai do site. O site novo é a fonte única dos anúncios.

**Medida de sucesso (combinada antes de construir):** cliques em "Falar com o Moisés", por imóvel. Segundo critério: visitantes únicos e recorrentes, por aparelho.

**Escala:** até cerca de 50 imóveis ativos, cerca de 24 fotos por imóvel (medido em 13 pastas de originais).

**Quem opera:**
- Gabriela publica anúncios pelo Claude Code (skill "publicar anúncio").
- Gabriela também edita anúncios existentes pela mesma skill (preço, texto, fotos, status).
- Gabriela e Moisés usam o painel `/admin` para configurar os campos visíveis e para editar anúncios: marcar como reservado, vendido ou alugado, ocultar e reexibir, corrigir preço e texto.
- Moisés passa a publicar anúncios novos por API na fase 2, sem mudar o formato dos dados.

## 2. Decisões

| # | Decisão | Origem |
|---|---|---|
| 1 | Visual C4: fundo marinho `#0E1726`, hero com slideshow Ken Burns, faixas grandes alternadas, botão flutuante de WhatsApp | CONTINUAR-AQUI |
| 2 | Fotos no estilo Elliman (`grade.py`), que só corrige a luz e nunca troca o céu nem inventa ambiente | CONTINUAR-AQUI |
| 3 | Sem foto do Moisés no site | CONTINUAR-AQUI |
| 4 | Chave Comprar/Alugar, e o aluguel aparece como "R$ x/mês" | CONTINUAR-AQUI |
| 5 | O site mostra só bairro e cidade. O endereço exato vai pelo WhatsApp | 15/10 |
| 6 | O site fica em `*.vercel.app`. Domínio próprio fora do escopo (titular do domínio no Registro.br provavelmente é uma empresa, a descobrir) | 15/10 |
| 7 | Um app Next.js só, no plano **Pro** da Vercel | 15/10 |
| 8 | **Fotos e dados dos anúncios no Vercel Blob.** Isso substitui a decisão "anúncios como arquivos no repositório" do CONTINUAR-AQUI. O repositório guarda só código e documentação | 15/10 |
| 9 | Painel `/admin` com login Google, no modelo do pep19, com flags dos campos visíveis **e edição de anúncios desde a primeira entrega** (status, ocultar, preço, texto) | 15/10 |
| 10 | Primeira dobra do imóvel: preço, área útil e quartos (com suítes). Vagas e custos mensais existem no anúncio e ficam desligados | 15/10 |
| 11 | Visitantes únicos e recorrentes por ID aleatório em cookie próprio, com consentimento | 15/10 |
| 12 | Spec único, com plano dividido em frentes paralelas | 15/10 |
| 13 | O `endereco_completo` **não fica no `anuncio.json` público**. Vai para um blob de acesso privado separado, lido só pelo painel e pela skill | 15/10 |
| 14 | A skill publica e também edita anúncios. Depois de gravar, chama `/api/revalidar` | 15/10 |

**Por que fotos e dados fora do git:** cerca de 1.200 fotos tratadas a ~650 KB cada somam ~780 MB só na maior resolução (estimativa). Isso torna clone e push lentos.

**Por que Pro e não Hobby:** o Hobby bloqueia o acesso ao Blob por 30 dias ao estourar a franquia (1 GB de armazenamento), e a estimativa deste projeto fica perto de 1 GB. O Hobby também é voltado a uso pessoal e não comercial (a confirmar nos termos da Vercel).

## 3. Arquitetura

Um app Next.js (App Router) com quatro áreas:

| Área | Função | Usuário |
|---|---|---|
| Site público: `/`, `/imoveis`, `/imoveis/[codigo]` | Lê anúncios e flags do Blob, renderiza com cache e revalida quando algo muda | Visitante |
| Painel: `/admin` | Login Google, tela de flags, lista e edição de anúncios | Gabriela, Moisés |
| API: `/api/auth/login`, `/api/flags`, `/api/anuncios`, `/api/revalidar`, `/api/eventos` | Autenticação, flags, gravação de anúncios, revalidação do cache, registro de eventos | Painel, skill, visitante |
| Skill "publicar anúncio" (fora do app) | Publica e edita anúncios: trata fotos, gera larguras, aplica o logo, grava no Blob e chama `/api/revalidar` | Gabriela |
| Jobs (Vercel Cron) | Backup diário e consolidação diária dos eventos | Sistema |

**Layout do Blob:**

```
anuncios/<codigo>/anuncio.json           público, sem endereço
privado/<codigo>/endereco.json           acesso privado: só painel e skill
anuncios/<codigo>/fotos/<n>-800.webp, <n>-1600.webp, <n>-2560.webp
config/flags.json
eventos/AAAA-MM-DD/<id>.json   um blob pequeno por evento (o Blob não anexa a um arquivo)
backup/AAAA-MM-DD/...        cópia diária dos JSON de anuncios/, privado/ e config/ (acesso privado)
```

**Regras:**
- O código do imóvel é o identificador e entra na URL e nos eventos.
- Um JSON por imóvel evita que dois editores sobrescrevam um ao outro. Cada JSON tem `atualizado_em`.
- O site lê com cache e revalida quando a skill, a API ou o painel gravam. Publicar não exige deploy.
- O endereço completo **nunca** é gravado em blob público. Filtrar na API não bastaria, porque o JSON público é lido direto do CDN. Na frente 0, confirmar se o Blob oferece `access: 'private'`. Se não oferecer, usar um segundo store privado.
- Não existe `indice.json`. O índice é montado no servidor com `list()` do prefixo `anuncios/`, com cache, e some o risco de duas publicações simultâneas se sobrescreverem.
- Ordem de gravação da skill: fotos, depois o JSON do imóvel, depois `/api/revalidar`. Uma falha no meio nunca publica um anúncio sem foto.
- O JSON é gravado com checagem de `atualizado_em`: se mudou desde a leitura, a gravação é recusada e quem editava relê e tenta de novo.
- Toda gravação valida o esquema, e JSON inválido é recusado.

## 4. Contratos

Estes três contratos são escritos primeiro, como tipos e esquemas validados, e todas as frentes dependem deles.

### 4.1 Anúncio (`anuncio.json`)

| Grupo | Campos |
|---|---|
| Identidade | `codigo`, `negocio` (`venda` \| `aluguel`), `tipo`, `status` (`disponivel` \| `reservado` \| `vendido` \| `alugado`), `visivel` (`true` \| `false`; `false` oculta o anúncio do site sem apagar) |
| Texto | `titulo` (tese do imóvel em uma frase afirmativa), `descricao`. Sem emoji |
| Local | `bairro`, `cidade` |
| Preço | `preco` (inteiro em reais), `condominio` e `iptu` (mensais, opcionais), `preco_inclui_condominio` |
| Medidas | `area_util_m2`, `area_total_m2`, `quartos`, `suites`, `banheiros`, `vagas` |
| Comodidades | lista de textos curtos |
| Fotos | lista de `{ ordem, legenda, larguras: { 800, 1600, 2560 }, placeholder }`, com a primeira como capa |
| Controle | `criado_em`, `atualizado_em`, `destaque` |

- O endereço completo fica em `privado/<codigo>/endereco.json` (`{ codigo, endereco_completo, atualizado_em }`) e não faz parte do contrato público.
- Anúncio com `visivel: false` não aparece na lista, na home nem por URL direta (a página responde 404).
- Aluguel exibe "R$ x/mês", e o formato diz se inclui condomínio.
- Área útil e área total são campos separados.
- Campo opcional ausente é omitido na tela, nunca exibido como zero.

### 4.2 Flags (`config/flags.json`)

- As chaves aceitas são um **enum fechado de campos públicos** (`area_util_m2`, `area_total_m2`, `quartos`, `suites`, `banheiros`, `vagas`, `condominio`, `iptu`, `tipo`). Qualquer outra chave, inclusive de endereço, é recusada pelo esquema.
- `primeira_dobra`: lista de chaves de campo, **máximo 4** (o preço fica sempre à parte). Padrão: `area_util_m2`, `quartos`.
- `detalhes`: lista de chaves de campo mostradas nas seções de detalhe. Padrão: vazia.
- `atualizado_em` e `atualizado_por` (e-mail do editor).
- O painel recusa o quinto campo na primeira dobra.

### 4.3 Sessão do painel

- JWT HMAC-SHA256: `sub` (e-mail), `papel`, `iss`, `iat`, `exp`. Validade de 8 horas (`AUTH_JWT_TTL_HORAS`).
- No login, o servidor exige `email_verified` e compara o e-mail em minúsculas com `AUTH_ALLOWLIST`.
- As rotas `POST`, `PUT` e `DELETE` do painel também conferem o cabeçalho `Origin`.
- Um só papel agora, `admin`. O papel `editor` entra se Gabriela e Moisés precisarem de permissões diferentes.

### 4.4 Eventos

| Evento | Campos | Quando |
|---|---|---|
| `clique_whatsapp` | `visitante_id`, `codigo`, `origem` (`lista` \| `imovel` \| `flutuante`), `data` (ISO 8601, UTC) | Clique em qualquer botão de WhatsApp |
| `visualizacao_imovel` | `visitante_id`, `codigo`, `data` | Abertura da página de um imóvel |

Eventos só são enviados se o visitante aceitou o cookie (seção 7).

**Defesa do endpoint `/api/eventos`** (é público, e cada gravação custa):
- Valida o esquema, exige `visitante_id` em formato UUID e `codigo` de um imóvel existente.
- Limita a frequência por origem de rede, sem guardar o IP, e descarta user agents de bot.
- Recusa requisição sem `visitante_id`, porque sem cookie não há evento.

## 5. Site público

| Rota | Tarefa do visitante | Conteúdo, nesta ordem |
|---|---|---|
| `/` | explorar | Hero com os imóveis em `destaque` → chave Comprar/Alugar → faixas grandes alternadas → "Prazer, eu sou" (só texto e foto de imóvel) → contato |
| `/imoveis` | comparar | Filtros (negócio, tipo, bairro, preço, quartos) → grade → estado vazio explicado |
| `/imoveis/[codigo]` | decidir | Veja abaixo |

**Página do imóvel:**
1. Eyebrow (tipo e bairro) e título (a tese do imóvel).
2. Galeria, com a capa grande.
3. Primeira dobra: preço, mais os campos de `primeira_dobra`, e o botão "Falar com o Moisés".
4. Descrição e comodidades, com no máximo 4 itens por bloco.
5. Seção de detalhes, conforme as flags.
6. Procedência: "Atualizado em dd/mm/aaaa" e o código do imóvel.
7. Bairro e cidade, sem mapa.

**Botão do WhatsApp:** é a única cor de ação do site (verde do WhatsApp) e não aparece em mais nada. A mensagem vai pronta, com o código e o título do imóvel.

**Filtros na URL**, por exemplo `/imoveis?negocio=aluguel&quartos=3`, para o link ser compartilhável.

**Estados:**

| Estado | Tela |
|---|---|
| Carregando | Esqueleto com a forma da grade e das fotos, com placeholder borrado em cada foto |
| Vazio | Frase que explica o que foi consultado e o que remover. Ex.: "Nenhum imóvel de aluguel com 4 quartos no Morumbi. Remova o filtro de quartos para ver 6." |
| Reservado, vendido ou alugado | O imóvel continua na página, com selo e sem o botão principal de contato. Sai da lista e da home 30 dias depois de marcado, e a URL direta continua funcionando |
| Oculto (`visivel: false`) | Não aparece em lugar nenhum, e a URL direta responde 404 |
| Erro (Blob indisponível) | Mensagem clara e o botão do WhatsApp |

**Fotos:** `srcset` com 800, 1600 e 2560 px em WebP. `loading="lazy"` abaixo da primeira dobra. As fotos do hero e a capa carregam com prioridade. Servidas direto do CDN do Blob, sem otimizador de imagens da Vercel. Toda foto tem texto alternativo (a legenda, ou título e número da foto). O Ken Burns respeita `prefers-reduced-motion`. Meta de LCP: abaixo de 2,5 s em celular.

**Princípios de página adotados** (do guia de páginas e data-viz): uma mensagem por tela em três registros (eyebrow, título, leitura), todo número com base e unidade, no máximo 5 blocos heterogêneos por dobra, cor semântica reservada, teste do tom de cinza, estados vazio e de erro explicados, sem emoji.

## 6. Painel `/admin`

- **Login:** botão Google (GIS). O servidor verifica o ID token com `google-auth-library`. O e-mail é conferido na variável `AUTH_ALLOWLIST` (nega por padrão se estiver vazia). O JWT vai em cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Desenho reaproveitado de `pep19/api/auth/login.ts`, sem o BigQuery.
- **Tela de flags:** duas listas de caixas, "Primeira dobra" (máximo 4) e "Detalhes", com pré-visualização da página do imóvel. Ao salvar, grava `flags.json` e revalida o cache.
- **Proteção:** toda rota `/api` do painel confere o JWT no servidor.
- **Anúncios (primeira entrega):**
  - Lista com filtros por status e visibilidade.
  - Edição de preço, condomínio, IPTU, título, descrição, medidas e comodidades.
  - Troca de status (reservado, vendido, alugado, disponível) e botão para ocultar ou reexibir.
  - Edição do endereço completo, só nesta tela.
  - Cada gravação valida o esquema e confere `atualizado_em`. Se outra pessoa mudou o anúncio antes, o painel mostra o aviso e recarrega.
  - Ao salvar, grava o JSON e revalida o cache.
- **Fora do painel:** subir e tratar fotos fica com a skill. O painel não faz upload de foto.

## 7. Visitantes únicos e recorrentes (LGPD)

- O site grava, no navegador, um **UUID aleatório** em cookie próprio, com validade de 6 meses, **só após o visitante aceitar** o banner de cookies.
- Os eventos guardam o `visitante_id`, o código do imóvel, a origem e a data. **Nenhum nome, e-mail, telefone ou IP.**
- Se o visitante recusar, o site funciona normalmente e nenhum evento é enviado.
- Há uma página de política de privacidade em linguagem simples, com a finalidade e o prazo de retenção (6 meses, o mesmo do cookie). Eventos mais antigos são apagados pelo job diário.
- Limite conhecido: quem recusa, troca de navegador ou limpa os dados conta como novo. O número de recorrentes é um piso.
- O texto do banner e da política deve ser revisado por quem responde pela LGPD na M.C. Vieira antes da publicação com domínio próprio.

## 8. Contrato com a skill "publicar anúncio"

A skill tem ciclo de design próprio, em spec separado. Aqui fica só o contrato. Ela **publica anúncios novos e edita os existentes** (texto, preço, status, fotos a acrescentar ou remover):

1. Recebe fotos e descrição, ou, numa edição, lê o anúncio atual.
2. Avisa quando uma foto é ruim demais (escura, tremida ou pequena) e pede decisão. Não corrige o que não dá para corrigir.
3. Roda o `grade.py`, aplica o logo, gera as 3 larguras em WebP e o placeholder.
4. Monta o `anuncio.json` e mostra um resumo para conferência.
5. Só depois da confirmação grava no Blob, na ordem da seção 3. O endereço vai para o blob privado, e nunca para o `anuncio.json`.
6. Chama `/api/revalidar`, autenticado por um segredo, para o site refletir a mudança.

Só entra no Blob a versão com marca d'água. O original sem marca nunca vai para o Blob.

## 9. Erros e segurança

- Blob indisponível: estado de erro do site, sem quebrar a página.
- Endereço completo nunca é gravado em blob público, com teste dedicado que lê o JSON direto do CDN.
- `/api/revalidar` e todas as rotas de escrita exigem JWT do painel ou o segredo da skill.
- Segredos (`AUTH_JWT_SECRET`, `GOOGLE_CLIENT_ID`, `AUTH_ALLOWLIST`, token do Blob) só em variáveis da Vercel.
- Gravações validam o esquema nas duas pontas.
- Operações do painel exigem JWT válido, conferido no servidor.

## 10. Testes

- **Unidade:** validação dos esquemas, limite de 4 flags, enum fechado das flags (recusa chave de endereço), URL do WhatsApp com acento e `&` codificados, formatação de preço e área, assinatura e expiração do JWT.
- **Integração:** login com token inválido, de e-mail fora da lista e válido; gravação de flags sem login falha; o JSON público de cada imóvel sem `endereco_completo`; eventos descartados sem consentimento e sob abuso (1.000 envios seguidos não geram 1.000 blobs); gravação concorrente do mesmo anúncio recusada pela checagem de `atualizado_em`; imóvel oculto responde 404; vendido aparece sem botão de contato; jobs de backup e consolidação são idempotentes.
- **End-to-end (Playwright):** navegação como visitante em celular e desktop, filtros na URL, botão do WhatsApp com a mensagem certa, estados vazio e de erro, banner de cookies, flag alterada no painel refletida no site, imóvel marcado como vendido ou ocultado no painel refletido no site, acessibilidade por teclado e contraste (axe).
- **Visual:** screenshots da home e da página do imóvel contra o mock C4.

## 11. Frentes do plano (paralelas, depois dos contratos)

0. Estrutura do repositório (o app fica em `apps/site/`, e o `CLAUDE.md` ganha stack e comandos), contratos como tipos e esquemas (anúncio, endereço privado, flags, sessão, eventos), e a verificação do acesso privado do Blob. Bloqueia as demais.
1. Site público: páginas, galeria, filtros, estados, acessibilidade.
2. Painel: login, flags, lista e edição de anúncios, `/api/anuncios` e `/api/revalidar`.
3. Contrato com a skill (publicar e editar) e código compartilhado de imagens que o repositório mantém (esquemas, larguras, placeholder). O tratamento de foto com `grade.py` pertence à skill, no spec dela.
4. Eventos e defesa do endpoint, banner de cookies, política de privacidade, jobs de backup e consolidação (Vercel Cron), testes e deploy.

## 12. Fora do escopo

Domínio próprio, mapa, favoritos, cadastro de visitantes, a skill em si (spec próprio), upload de foto pelo painel, a API do Moisés para criar anúncios (fase 2).

## 13. Pontos em aberto

- Confirmar que a conta Vercel é Pro e que o uso comercial é permitido.
- Conferir no painel os valores incluídos do Blob no Pro (a documentação e os resumos divergem) e o custo da transferência na região usada.
- Descobrir quem é o titular do domínio no Registro.br.
- Revisão da política de privacidade e do banner por quem responde pela LGPD.
- Papel `editor`: decidir se Gabriela e Moisés precisam de permissões diferentes.
- Quem consulta o relatório de cliques, e onde ele aparece.
- Medida de sucesso e consentimento: quem recusa o banner não gera evento, então os cliques por imóvel são um piso. Avaliar com quem responde pela LGPD um contador agregado de cliques, sem ID nem cookie, para a medida principal.
- Eventos como um blob por evento custam uma gravação cada (US$ 5 por milhão). A conta é baixa para o volume esperado, mas um job diário deve consolidar os eventos do dia num resumo e apagar os blobs avulsos (apagar é grátis). Se o volume crescer muito, avaliar um banco de eventos.
