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

function isXml(text: string) {
  return text.trim().startsWith("<");
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }

  if (isXml(text)) {
    return { xml: text };
  }

  return { raw: text };
}

function extrairXml(data: Record<string, unknown>) {
  return String(data.xml || data.xmlNfe || data.nfeXml || data.conteudoXml || data.XML || data.data || "");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const chave = normalizarChave(String(body?.chave || ""));

  if (chave.length !== 44) {
    return NextResponse.json({ error: "Informe a chave de acesso da NF-e com 44 digitos." }, { status: 400 });
  }

  const meuDanfeApiKey = process.env.MEUDANFE_API_KEY?.trim();
  const lookupUrl = process.env.NFE_LOOKUP_URL?.trim() || "https://api.meudanfe.com.br/v2/fd/add/{chave}";
  const lookupToken = process.env.NFE_LOOKUP_TOKEN?.trim();
  const xmlUrl = process.env.NFE_XML_URL?.trim() || "https://api.meudanfe.com.br/v2/fd/get/xml/{chave}";
  const tokenHeader = process.env.NFE_LOOKUP_TOKEN_HEADER?.trim() || (meuDanfeApiKey ? "Api-Key" : "authorization");
  const tokenValue = meuDanfeApiKey || lookupToken;

  if (!tokenValue) {
    return NextResponse.json(
      {
        error:
          "Consulta por chave ainda precisa da Api-Key fiscal configurada no servidor. Configure MEUDANFE_API_KEY no VPS.",
      },
      { status: 501 },
    );
  }

  try {
    const response = await fetch(montarUrl(lookupUrl, chave), {
      headers: {
        accept: "application/json, application/xml, text/xml, text/plain",
        [tokenHeader]: tokenHeader.toLowerCase() === "authorization" ? `Bearer ${tokenValue}` : tokenValue,
      },
      cache: "no-store",
      method: process.env.NFE_LOOKUP_METHOD?.trim() || "GET",
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Nao foi possivel consultar a NF-e. Codigo ${response.status}.` }, { status: response.status });
    }

    const data = await parseResponse(response);
    const status = String(data.status || "").toUpperCase();
    const statusMessage = String(data.statusMessage || data.message || "");
    const xml = extrairXml(data);

    if (xml) {
      return NextResponse.json({ chave, xml });
    }

    if (status === "WAITING" || status === "SEARCHING") {
      return NextResponse.json(
        {
          chave,
          status,
          statusMessage:
            statusMessage ||
            "A nota esta na fila de consulta do Meu Danfe. Aguarde alguns segundos e clique em Ler nota novamente para consultar o status.",
        },
        { status: 202 },
      );
    }

    if (status === "NOT_FOUND") {
      return NextResponse.json({ error: statusMessage || "NF-e nao encontrada pelo Meu Danfe." }, { status: 404 });
    }

    if (status === "ERROR") {
      return NextResponse.json({ error: statusMessage || "Falha ao consultar a NF-e no Meu Danfe." }, { status: 502 });
    }

    if (status === "OK" && xmlUrl) {
      const xmlResponse = await fetch(montarUrl(xmlUrl, chave), {
        headers: {
          accept: "application/xml, text/xml, application/json, text/plain",
          [tokenHeader]: tokenHeader.toLowerCase() === "authorization" ? `Bearer ${tokenValue}` : tokenValue,
        },
        cache: "no-store",
      });
      const xmlData = await parseResponse(xmlResponse);
      const xmlContent = extrairXml(xmlData);

      if (xmlResponse.ok && xmlContent) {
        return NextResponse.json({ chave, xml: xmlContent });
      }
    }

    return NextResponse.json(
      {
        chave,
        status: status || "OK",
        statusMessage:
          statusMessage ||
          "O Meu Danfe retornou a solicitacao, mas este endpoint nao trouxe o XML. Configure NFE_XML_URL com a rota de download do XML.",
      },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao consultar a NF-e pela chave." },
      { status: 502 },
    );
  }
}
