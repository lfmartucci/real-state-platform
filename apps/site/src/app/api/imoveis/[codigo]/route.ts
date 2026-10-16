import { tratarAtualizarImovel, tratarLerImovel } from "@/lib/api/imoveis";
import { servicos } from "@/lib/servicos";

interface Contexto {
  params: Promise<{ codigo: string }>;
}

export async function GET(req: Request, { params }: Contexto) {
  return tratarLerImovel(req, servicos(), (await params).codigo);
}

export async function PUT(req: Request, { params }: Contexto) {
  return tratarAtualizarImovel(req, servicos(), (await params).codigo);
}
