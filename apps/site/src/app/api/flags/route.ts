import { tratarGravarFlags, tratarLerFlags } from "@/lib/api/flags";
import { servicos } from "@/lib/servicos";

export const GET = (req: Request) => tratarLerFlags(req, servicos());
export const PUT = (req: Request) => tratarGravarFlags(req, servicos());
