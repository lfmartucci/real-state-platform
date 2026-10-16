import { tratarLogin } from "@/lib/api/login";
import { servicos } from "@/lib/servicos";

export const POST = (req: Request) => tratarLogin(req, servicos());
