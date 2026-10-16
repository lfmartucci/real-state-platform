# Verificações da frente 0: Vercel Blob

Data: 2026-10-16. Versão do SDK: @vercel/blob 2.8.2. Stores: mcv-privado (Private), mcv-publico (Public), mcv-teste (Private).

## Status

Executado em 2026-10-16 contra os stores reais (`mcv-privado`, `mcv-publico`, `mcv-teste`), com `apps/site/.env.local` preenchido. Todas as verificações passaram.

## Saída de `npm run verificar:blob`

```
OK: allowOverwrite:false recusa e é traduzido para ErroJaExiste
OK: ifMatch velho vira ErroConflito
OK: ETag muda a cada gravação ("76470d098b34c4106f012a23a9900a63" → "094edf31b74a9638e7aa0c06744f4497")
OK: blob novo visível no list() após 1044 ms
OK: listarPastas (mode folded) mostra a pasta
OK: blob privado sem token responde 403
OK: store público recusa JSON antes de enviar
OK: foto pública servida (image/webp)
```

Bateria de contrato contra o store de teste: `node --env-file=.env.local ./node_modules/.bin/vitest run src/lib/armazem/vercel.test.ts` → 11 testes passando (3 de tradução de erros e 8 da bateria "contrato ArmazemJson: vercel (store de teste)"). A bateria remove os blobs que cria (`afterAll`).

## Respostas aos pontos em aberto (spec seção 14)

- **Blob recém-gravado aparece de imediato no `list()`?** Sim, na medição de 2026-10-16: visível após 1044 ms (uma amostra, não uma garantia de consistência). Consequência no código: a reserva de código já não depende disso (`reservarCodigo` avança o mínimo na colisão). O catálogo público só lê imóveis que já existiam antes de publicar, então não é afetado.
- **A transferência de projeto entre times leva os stores?** **Não.** Documentação oficial "Transferring a project" (https://vercel.com/docs/projects/transferring-projects, atualizada em 2026-09-08), seção "What is not transferred?":
  - "[Vercel Blob](/docs/vercel-blob) has [a separate transfer mechanism](/docs/storage#transferring-your-store)"
  - "[Integrations](/docs/integrations): Those associated with your project must be added again after the transfer is complete."

  Seção "What is transferred?" inclui: "[Environment variables] are copied to the target team, except for those defined in the `env` and `build.env` configurations of `vercel.json`" e "[Cron Jobs](/docs/cron-jobs)".

  Mecanismo separado para o Blob (https://vercel.com/docs/storage, "Transferring your store"): "You can bring your Blob or Global Config stores along with your account as you upgrade from Hobby to Pro, or downgrade from Pro to Hobby." Passos: Storage → selecionar o store → Settings → Transfer Store → escolher conta/time de destino. A página descreve apenas Hobby↔Pro; **não confirmado** se "Transfer Store" aceita Pro→Pro entre times arbitrários. Ao transferir o store, reconectá-lo ao projeto no time novo (as variáveis de token podem precisar ser recriadas). Caminho alternativo, se não funcionar: backup diário + script de cópia, descrito no CLAUDE.md, seção "Como transferir".
- **Mensagem real do erro de `allowOverwrite: false`:** confirmada. O adaptador a traduz para `ErroJaExiste` (linha 1 da saída acima), então `MENSAGEM_JA_EXISTE` em `apps/site/src/lib/armazem/vercel.ts` confere com o erro real.
