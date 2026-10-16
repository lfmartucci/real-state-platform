# Toda gravação de imóvel passa pela API do app

A skill "publicar imóvel", o painel e a futura API do Moisés gravam o `imovel.json` só por `/api/imoveis`; ninguém grava JSON direto no Vercel Blob, embora a skill tenha o token e pudesse fazê-lo. Decidimos assim porque cada gravação precisa aplicar as mesmas regras — validar o esquema, gerar o próximo código `MC` sem colisão, checar concorrência por ETag (`ifMatch`), registrar `status_desde` e o histórico, e revalidar o cache — e, com a skill gravando direto, essas regras existiriam em dois lugares e divergiriam. A skill continua subindo as fotos direto no store público, porque são arquivos grandes e sem regra de negócio.

## Consequences

- Os JSON ficam num store **privado**, lido só pelo servidor do app; o store público guarda apenas fotos. Isso também elimina o cache de até 1 mês do CDN sobre um JSON público sobrescrito.
- O endereço completo continua num arquivo separado (`endereco.json`) dentro do store privado, como segunda barreira contra vazamento por serialização.
- A skill depende do app no ar para gravar; uma falha da API bloqueia publicações, mas nunca publica um imóvel sem foto.
