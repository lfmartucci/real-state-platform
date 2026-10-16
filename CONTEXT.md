# M.C. Vieira — site de imóveis

Site onde a M.C. Vieira publica os imóveis que intermedeia, para venda e aluguel, e leva o visitante a falar com o Moisés pelo WhatsApp.

## Language

### Catálogo

**Imóvel**:
A coisa física publicada no site: fotos, medidas, bairro e cidade, identificada por um código. Tem um status único e uma ou mais ofertas.
_Avoid_: anúncio, listagem, propriedade

**Código**:
Identificador do imóvel no formato `MC` + 3 dígitos (ex.: `MC007`). Atribuído quando o imóvel é criado, nunca muda e nunca é reaproveitado. Os IDs da Tokko não são carregados.
_Avoid_: ID, referência, código Tokko

**Oferta**:
Um negócio proposto sobre um imóvel — venda ou aluguel — com o seu preço. Um imóvel pode ter uma oferta de venda e uma de aluguel ao mesmo tempo.
_Avoid_: negócio (como substantivo do objeto), anúncio

**Status**:
A situação comercial do imóvel inteiro: disponível, reservado, vendido ou alugado. Quando qualquer oferta fecha, o imóvel inteiro sai do mercado.
_Avoid_: situação, estado

**Rascunho**:
Imóvel que não está no ar: ou nunca foi publicado (ex.: acabou de entrar por lote), ou foi retirado do ar e voltou a rascunho. Não aparece no site e sua URL responde 404.
_Avoid_: oculto, invisível, despublicado

**Publicado**:
Imóvel no ar, visível no site conforme o seu status.
_Avoid_: visível, ativo, online

**Destaque**:
Imóvel escolhido pelo Moisés ou pela Gabriela para a vitrine da home. No máximo 5 ao mesmo tempo.
_Avoid_: vitrine, em evidência

**Preço sob consulta**:
Oferta publicada sem preço, por decisão do Moisés.
_Avoid_: preço zero, a combinar

### Medida

**Clique de contato**:
Um toque em qualquer botão de WhatsApp do site. É a medida principal de sucesso e conta todos os visitantes.
_Avoid_: lead, conversão

## Relationships

- Um **Imóvel** tem uma ou duas **Ofertas** (no máximo uma de venda e uma de aluguel).
- Um **Imóvel** está sempre em **Rascunho** ou **Publicado**. Marcar como vendido ou alugado devolve o imóvel a **Rascunho** na hora; só disponível e reservado ficam publicados.
- O **Status** pertence ao **Imóvel**, nunca à **Oferta**. "Vendido" só é válido se o imóvel tem oferta de venda; "alugado", se tem oferta de aluguel.
