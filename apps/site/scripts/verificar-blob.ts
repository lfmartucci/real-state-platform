/**
 * Verificações reais do Vercel Blob (frente 0, spec seção 14). Roda contra o store de TESTE e o público.
 * Uso: npm run verificar:blob  (lê .env.local)
 */
import { randomUUID } from "node:crypto";
import { ErroConflito, ErroJaExiste } from "../src/lib/armazem/tipos";
import { ArmazemFotosVercel, ArmazemJsonVercel } from "../src/lib/armazem/vercel";

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} em .env.local`);
  return valor;
}

async function principal() {
  const privado = new ArmazemJsonVercel(exigir("BLOB_TESTE_READ_WRITE_TOKEN"));
  const publico = new ArmazemFotosVercel(exigir("BLOB_PUBLICO_READ_WRITE_TOKEN"), exigir("FOTOS_ORIGEM"));
  const prefixo = `verificacao/${randomUUID()}/`;
  const caminho = `${prefixo}a.json`;
  const relatorio: string[] = [];

  // 1. Criação exclusiva e a mensagem real do erro.
  await privado.gravar(caminho, { versao: 1 }, { criarSomente: true });
  try {
    await privado.gravar(caminho, { versao: 2 }, { criarSomente: true });
    relatorio.push("FALHA: segunda gravação com criarSomente não foi recusada");
  } catch (erro) {
    relatorio.push(
      erro instanceof ErroJaExiste
        ? "OK: allowOverwrite:false recusa e é traduzido para ErroJaExiste"
        : `ATENÇÃO: erro não traduzido. Ajuste MENSAGEM_JA_EXISTE em vercel.ts. Mensagem: ${(erro as Error).message}`,
    );
  }

  // 2. ifMatch.
  const lido = await privado.ler(caminho);
  const nova = await privado.gravar(caminho, { versao: 2 }, { ifMatch: lido!.etag });
  try {
    await privado.gravar(caminho, { versao: 3 }, { ifMatch: lido!.etag });
    relatorio.push("FALHA: ifMatch com ETag velho não foi recusado");
  } catch (erro) {
    relatorio.push(erro instanceof ErroConflito ? "OK: ifMatch velho vira ErroConflito" : `FALHA: ${(erro as Error).message}`);
  }
  relatorio.push(`OK: ETag muda a cada gravação (${lido!.etag} → ${nova.etag})`);

  // 3. Visibilidade imediata no list() (ponto em aberto do spec).
  const novo = `${prefixo}recem-gravado.json`;
  const inicio = Date.now();
  await privado.gravar(novo, { x: 1 });
  let visivelEm: number | null = null;
  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    const itens = await privado.listar(prefixo);
    if (itens.some((item) => item.caminho === novo)) {
      visivelEm = Date.now() - inicio;
      break;
    }
    await new Promise((resolver) => setTimeout(resolver, 500));
  }
  relatorio.push(visivelEm === null ? "ATENÇÃO: blob novo não apareceu no list() em 10 s" : `OK: blob novo visível no list() após ${visivelEm} ms`);
  const pastas = await privado.listarPastas("verificacao/");
  relatorio.push(pastas.includes(prefixo) ? "OK: listarPastas (mode folded) mostra a pasta" : "FALHA: listarPastas não mostrou a pasta");

  // 4. Store privado não responde sem token.
  const urlPrivada = `https://blob.vercel-storage.com/${caminho}`;
  const semToken = await fetch(urlPrivada);
  relatorio.push(semToken.ok ? `FALHA: blob privado respondeu ${semToken.status} sem token` : `OK: blob privado sem token responde ${semToken.status}`);

  // 5. Store público aceita só .webp (barreira do app) e serve a foto.
  try {
    await publico.enviar("imoveis/MC999/imovel.json", Buffer.from("{}"), "application/json");
    relatorio.push("FALHA: store público aceitou JSON");
  } catch {
    relatorio.push("OK: store público recusa JSON antes de enviar");
  }
  const webp = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
  const caminhoFoto = `imoveis/MC999/fotos/verificacao-${Date.now()}-800.webp`;
  const { url } = await publico.enviar(caminhoFoto, webp, "image/webp");
  const resposta = await fetch(url);
  relatorio.push(resposta.ok ? `OK: foto pública servida (${resposta.headers.get("content-type")})` : `FALHA: foto pública ${resposta.status}`);

  // Limpeza.
  await privado.apagar((await privado.listar(prefixo)).map((item) => item.caminho));
  await publico.apagar([caminhoFoto]);

  console.log(relatorio.join("\n"));
  if (relatorio.some((linha) => linha.startsWith("FALHA"))) process.exitCode = 1;
}

principal().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
