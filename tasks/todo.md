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
