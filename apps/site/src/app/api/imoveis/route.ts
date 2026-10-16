import { tratarCriarImovel, tratarListarImoveis } from "@/lib/api/imoveis";
import { servicos } from "@/lib/servicos";

export const GET = (req: Request) => tratarListarImoveis(req, servicos());
export const POST = (req: Request) => tratarCriarImovel(req, servicos());
