# Verificações da frente 0: Vercel Blob

Data: 2026-10-16. Versão do SDK: @vercel/blob 2.8.2. Stores: mcv-privado (Private), mcv-publico (Public), mcv-teste (Private).

## Status

Parte documental feita (transferência de projeto). **Parte ao vivo NÃO EXECUTADA — aguarda Step 1 humano** (criar o projeto `mc-vieira-site` e os três stores na Vercel e preencher `apps/site/.env.local`; não há token neste ambiente).

## Saída de `npm run verificar:blob`

NÃO EXECUTADO — aguarda Step 1 humano. Pendente: rodar `cd apps/site && npm run verificar:blob` após o Step 1 e colar a saída completa aqui. Esperado: todas as linhas começam com `OK`; se houver `ATENÇÃO` ou `FALHA`, corrigir `apps/site/src/lib/armazem/vercel.ts` e rodar de novo.

Único resultado real até agora (sem `.env.local`, com `node --import tsx scripts/verificar-blob.ts`): a falha é clara e antecipada.

```
Error: Defina BLOB_TESTE_READ_WRITE_TOKEN em .env.local
```

Observação: `npm run verificar:blob` usa `node --env-file=.env.local`; sem o arquivo o Node aborta antes do script com `node: .env.local: not found`.

Também pendente: `cd apps/site && node --env-file=.env.local ./node_modules/.bin/vitest run src/lib/armazem/vercel.test.ts` (bateria "contrato ArmazemJson: vercel (store de teste)", 8 testes; PASS esperado).

### Roteiro para o humano (Step 1)

1. Vercel, plano Pro, time `luiz-martucci's projects`: criar o projeto `mc-vieira-site` importando o repositório, Root Directory = `apps/site`, Framework = Next.js.
2. Storage → Create → Blob → `mcv-privado`, **Private**, conectar ao projeto com prefixo `BLOB_PRIVADO` (Production e Preview).
3. Storage → Create → Blob → `mcv-publico`, **Public**, prefixo `BLOB_PUBLICO`.
4. Storage → Create → Blob → `mcv-teste`, **Private**, sem conectar a produção.
5. Em `apps/site/.env.local` (nunca versionado): `BLOB_PRIVADO_READ_WRITE_TOKEN`, `BLOB_PUBLICO_READ_WRITE_TOKEN`, `BLOB_TESTE_READ_WRITE_TOKEN` e `FOTOS_ORIGEM` (`https://<id>.public.blob.vercel-storage.com`).
6. Rodar os dois comandos acima e preencher este documento.

## Respostas aos pontos em aberto (spec seção 14)

- **Blob recém-gravado aparece de imediato no `list()`?** Pendente — rodar `npm run verificar:blob` após Step 1 (a linha "blob novo visível no list() após N ms" responde). Consequência no código: a reserva de código já não depende disso (`reservarCodigo` avança o mínimo na colisão). O catálogo público só lê imóveis que já existiam antes de publicar, então não é afetado.
- **A transferência de projeto entre times leva os stores?** **Não.** Documentação oficial "Transferring a project" (https://vercel.com/docs/projects/transferring-projects, atualizada em 2026-09-08), seção "What is not transferred?":
  - "[Vercel Blob](/docs/vercel-blob) has [a separate transfer mechanism](/docs/storage#transferring-your-store)"
  - "[Integrations](/docs/integrations): Those associated with your project must be added again after the transfer is complete."

  Seção "What is transferred?" inclui: "[Environment variables] are copied to the target team, except for those defined in the `env` and `build.env` configurations of `vercel.json`" e "[Cron Jobs](/docs/cron-jobs)".

  Mecanismo separado para o Blob (https://vercel.com/docs/storage, "Transferring your store"): "You can bring your Blob or Global Config stores along with your account as you upgrade from Hobby to Pro, or downgrade from Pro to Hobby." Passos: Storage → selecionar o store → Settings → Transfer Store → escolher conta/time de destino. A página descreve apenas Hobby↔Pro; **não confirmado** se "Transfer Store" aceita Pro→Pro entre times arbitrários. Ao transferir o store, reconectá-lo ao projeto no time novo (as variáveis de token podem precisar ser recriadas). Caminho alternativo, se não funcionar: backup diário + script de cópia, descrito no CLAUDE.md, seção "Como transferir".
- **Mensagem real do erro de `allowOverwrite: false`:** pendente — rodar `npm run verificar:blob` após Step 1 (se a linha vier `ATENÇÃO`, ela traz a mensagem). `MENSAGEM_JA_EXISTE` em `apps/site/src/lib/armazem/vercel.ts` deve conferir com ela.
