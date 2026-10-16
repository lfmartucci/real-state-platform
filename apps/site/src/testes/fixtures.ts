import type { Foto, Imovel, ImovelEntrada } from "@/lib/contratos/imovel";

export const ORIGEM_FOTOS_TESTE = "https://teste.public.blob.vercel-storage.com";
/** WebP 1x1 válido, usado como placeholder nos testes. */
export const PLACEHOLDER_TESTE = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

export function fotosDeExemplo(codigo: string, quantidade = 3, origem = ORIGEM_FOTOS_TESTE): Foto[] {
  return Array.from({ length: quantidade }, (_, indice) => {
    const ordem = indice + 1;
    const url = (largura: number) => `${origem}/imoveis/${codigo}/fotos/${ordem}-abcdef0123-${largura}.webp`;
    return { ordem, larguras: { "800": url(800), "1600": url(1600), "2560": url(2560) }, placeholder: PLACEHOLDER_TESTE };
  });
}

export function entradaDeExemplo(sobrescrever: Partial<ImovelEntrada> = {}): ImovelEntrada {
  return {
    tipo: "casa_condominio",
    status: "disponivel",
    publicacao: "publicado",
    ofertas: [{ negocio: "venda", preco: 1_900_000 }],
    titulo: "Casa em condomínio com piscina e vista para a mata",
    descricao: "Casa térrea com quatro quartos, piscina aquecida e jardim.",
    bairro: "Fazenda da Ilha",
    cidade: "Embu-Guaçu",
    condominio: 900,
    iptu: 350,
    area_util_m2: 440,
    area_total_m2: 1000,
    quartos: 4,
    suites: 2,
    banheiros: 4,
    vagas: 3,
    comodidades: ["Piscina", "Churrasqueira", "Jardim", "Portaria 24h"],
    fotos: fotosDeExemplo("MC001"),
    destaque: false,
    ...sobrescrever,
  };
}

export function imovelDeExemplo(sobrescrever: Partial<Imovel> = {}): Imovel {
  const codigo = sobrescrever.codigo ?? "MC001";
  return {
    codigo,
    ...entradaDeExemplo({ fotos: fotosDeExemplo(codigo) }),
    status_desde: "2026-10-01T12:00:00.000Z",
    publicado_em: "2026-10-01T12:00:00.000Z",
    criado_em: "2026-10-01T12:00:00.000Z",
    atualizado_em: "2026-10-10T12:00:00.000Z",
    atualizado_por: "gabriela@exemplo.com",
    historico: [],
    ...sobrescrever,
  };
}
