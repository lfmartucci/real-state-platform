import { tratarReservarCodigo } from "@/lib/api/imoveis";
import { servicos } from "@/lib/servicos";

export const POST = (req: Request) => tratarReservarCodigo(req, servicos());
