import { NextResponse } from "next/server";

function normalizarCodigo(value: string) {
  return value.replace(/\D/g, "");
}

function buildProduto(data: Record<string, unknown>) {
  const brand = data.brand as { name?: string } | undefined;

  return {
    imagemUrl: String(data.thumbnail || data.image || data.image_url || data.picture || data.image_front_url || ""),
    marca: String(brand?.name || data.manufacturer || data.brands || ""),
    nome: String(data.description || data.product_name || data.generic_name || ""),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codigo = normalizarCodigo(searchParams.get("codigo") || "");

  if (!codigo) {
    return NextResponse.json({ error: "Informe um codigo de barras valido." }, { status: 400 });
  }

  const cosmosApiKey = process.env.COSMOS_API_KEY || process.env.NEXT_PUBLIC_COSMOS_API_KEY;

  if (cosmosApiKey) {
    try {
      const response = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${codigo}.json`, {
        headers: { "X-Cosmos-Token": cosmosApiKey },
        next: { revalidate: 60 * 60 * 24 * 7 },
      });

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        const produto = buildProduto(data);

        if (produto.nome) {
          return NextResponse.json(produto);
        }
      }
    } catch {
      // Continua para a base aberta abaixo.
    }
  }

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=product_name,brands,generic_name,image_url,image_front_url`,
      { next: { revalidate: 60 * 60 * 24 * 7 } },
    );

    if (!response.ok) {
      return NextResponse.json({ error: "Produto nao encontrado em base externa." }, { status: 404 });
    }

    const data = await response.json();
    if (data?.status !== 1 || !data?.product) {
      return NextResponse.json({ error: "Produto nao encontrado em base externa." }, { status: 404 });
    }

    return NextResponse.json(buildProduto(data.product));
  } catch {
    return NextResponse.json({ error: "Nao foi possivel consultar o codigo de barras." }, { status: 502 });
  }
}
