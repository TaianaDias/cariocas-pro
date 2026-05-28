import { NextResponse } from "next/server";

function normalizarChave(value: string) {
  return value.replace(/\D/g, "");
}

function montarUrl(baseUrl: string, chave: string) {
  if (baseUrl.includes("{chave}")) {
    return baseUrl.replace("{chave}", chave);
  }

  return `${baseUrl.replace(/\/$/, "")}/${chave}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const chave = normalizarChave(String(body?.chave || ""));

  if (chave.length !== 44) {
    return NextResponse.json({ error: "Informe a chave de acesso da NF-e com 44 digitos." }, { status: 400 });
  }

  const lookupUrl = process.env.NFE_LOOKUP_URL?.trim();
  const lookupToken = process.env.NFE_LOOKUP_TOKEN?.trim();

  if (!lookupUrl) {
    return NextResponse.json(
      {
        error:
          "Consulta por chave ainda precisa de uma API fiscal configurada no servidor. Configure NFE_LOOKUP_URL para baixar o XML pela chave da NF-e.",
      },
      { status: 501 },
    );
  }

  try {
    const response = await fetch(montarUrl(lookupUrl, chave), {
      headers: {
        accept: "application/xml, text/xml, application/json, text/plain",
        ...(lookupToken ? { authorization: `Bearer ${lookupToken}` } : {}),
      },
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json({ error: `Nao foi possivel consultar a NF-e. Codigo ${response.status}.` }, { status: response.status });
    }

    if (contentType.includes("application/json")) {
      const data = JSON.parse(text);
      const xml = data.xml || data.xmlNfe || data.nfeXml || data.conteudoXml || "";
      if (!xml) {
        return NextResponse.json({ error: "A API fiscal respondeu, mas nao retornou o XML da NF-e." }, { status: 502 });
      }
      return NextResponse.json({ chave, xml });
    }

    return NextResponse.json({ chave, xml: text });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao consultar a NF-e pela chave." },
      { status: 502 },
    );
  }
}
