import type { z } from "zod";

export function respostaErro(status: number, erro: string, mensagem: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ erro, mensagem, ...extra }, { status });
}

const LIMITE_PADRAO = 200_000;

export async function lerCorpoJson(
  req: Request,
  limiteBytes = LIMITE_PADRAO,
): Promise<{ ok: true; corpo: unknown } | { ok: false; resposta: Response }> {
  const texto = await req.text();
  if (Buffer.byteLength(texto) > limiteBytes) {
    return { ok: false, resposta: respostaErro(413, "corpo_grande_demais", `O corpo passa de ${limiteBytes} bytes.`) };
  }
  try {
    return { ok: true, corpo: JSON.parse(texto) };
  } catch {
    return { ok: false, resposta: respostaErro(400, "corpo_invalido", "O corpo precisa ser JSON válido.") };
  }
}

export function detalhesZod(erro: z.ZodError): { caminho: string; mensagem: string }[] {
  return erro.issues.map((issue) => ({ caminho: issue.path.join("."), mensagem: issue.message }));
}
