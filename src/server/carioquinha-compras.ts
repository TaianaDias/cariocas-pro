import type { Firestore } from "firebase-admin/firestore";

import {
  aprovarSolicitacaoCompra,
  buscarSolicitacaoPorNumero,
  criarSolicitacaoReposicaoCarioquinha,
  getComprasDb,
  listarSolicitacoesResumo,
  podeAprovarCompras,
  resolverAtorCompras,
} from "./compras-flow";

type ContextoCarioquinha = {
  empresaId: string;
  lojaId: string;
  uid: string;
};

type ResultadoComandoCompras = {
  handled: boolean;
  resposta?: string;
  dados?: unknown;
};

type ReposicaoSegura = {
  id: string;
  nome: string;
  atual: number;
  minimo: number;
  sugerida: number;
  unidade: string;
};

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function numero(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function texto(value: unknown, max = 220) {
  return String(value ?? "").trim().slice(0, max);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    solicitado: "aguardando aprovação",
    em_analise: "em análise",
    aguardando_envio: "aguardando envio",
    envio_parcial: "envio parcial",
    enviado: "enviado",
    recebimento_parcial: "recebimento parcial",
    recebido: "recebido",
    cancelado: "cancelado",
  };
  return labels[status] || status.replaceAll("_", " ");
}

function extrairNumeroPedido(pergunta: string) {
  return pergunta.match(/\bCP-[A-Za-z0-9-]+\b/i)?.[0]?.toUpperCase() || "";
}

function querCriarReposicao(textoPergunta: string) {
  const t = normalizar(textoPergunta);
  const acao = t.includes("criar") || t.includes("gerar") || t.includes("abrir") || t.includes("fazer");
  const fluxo = t.includes("solicitacao") || t.includes("pedido");
  const reposicao = t.includes("reposicao") || t.includes("itens abaixo do minimo") || t.includes("estoque minimo");
  return acao && fluxo && reposicao;
}

function querRecomendacaoReposicao(textoPergunta: string) {
  const t = normalizar(textoPergunta);
  return (
    t.includes("o que devo repor") ||
    t.includes("o que preciso repor") ||
    t.includes("o que devo comprar hoje") ||
    t.includes("o que precisa comprar") ||
    t === "reposicao de estoque"
  );
}

function querItensCriticos(textoPergunta: string) {
  const t = normalizar(textoPergunta);
  return t.includes("itens criticos") || t.includes("itens abaixo do minimo") || t.includes("estoque critico");
}

function querStatusCompras(textoPergunta: string) {
  const t = normalizar(textoPergunta);
  return (
    t.includes("status das compras") ||
    t.includes("status dos pedidos") ||
    t.includes("pedidos pendentes") ||
    t.includes("solicitacoes pendentes") ||
    t.includes("solicitacoes de compra")
  );
}

function querAprovar(textoPergunta: string) {
  const t = normalizar(textoPergunta);
  return (t.includes("aprovar") || t.includes("aprova")) && Boolean(extrairNumeroPedido(textoPergunta));
}

async function listarReposicaoSegura(db: Firestore, contexto: ContextoCarioquinha): Promise<ReposicaoSegura[]> {
  const nested = await db.collection("empresas").doc(contexto.empresaId).collection("insumos").get();
  let docs = nested.docs.filter((doc) => !doc.data().lojaId || doc.data().lojaId === contexto.lojaId);

  if (!docs.length) {
    const legacy = await db.collection("insumos").where("empresaId", "==", contexto.empresaId).get();
    docs = legacy.docs.filter((doc) => !doc.data().lojaId || doc.data().lojaId === contexto.lojaId);
  }

  return docs
    .map((doc) => {
      const data = doc.data();
      const atual = numero(data.quantidadeAtual ?? data.estoqueAtual);
      const minimo = numero(data.estoqueMinimo);
      const maximo = numero(data.estoqueMaximo);
      const sugerida = maximo > atual ? Math.max(1, Math.ceil(maximo - atual)) : Math.max(1, Math.ceil(minimo - atual));
      return {
        id: doc.id,
        nome: texto(data.nome) || "Insumo",
        atual,
        minimo,
        sugerida,
        unidade: texto(data.unidadeCompra || data.unidadeMedida || data.unidadeUso || "un", 60) || "un",
      };
    })
    .filter((item) => item.minimo > 0 && item.atual <= item.minimo)
    .sort((a, b) => (a.atual / Math.max(a.minimo, 1)) - (b.atual / Math.max(b.minimo, 1)));
}

export async function processarComandoComprasCarioquinha(
  pergunta: string,
  contexto: ContextoCarioquinha,
): Promise<ResultadoComandoCompras> {
  const db = getComprasDb();
  const comandoCompras =
    querCriarReposicao(pergunta) ||
    querRecomendacaoReposicao(pergunta) ||
    querItensCriticos(pergunta) ||
    querStatusCompras(pergunta) ||
    querAprovar(pergunta);

  if (!db) {
    if (comandoCompras) {
      return { handled: true, resposta: "Não consegui acessar a Central de Compras agora. Tente novamente em instantes." };
    }
    return { handled: false };
  }

  const tenant = { empresaId: contexto.empresaId, lojaId: contexto.lojaId };
  const actor = await resolverAtorCompras(db, tenant, contexto.uid);

  if (querCriarReposicao(pergunta)) {
    const criado = await criarSolicitacaoReposicaoCarioquinha(db, tenant, actor);
    if (criado.vazio) {
      return {
        handled: true,
        resposta: "Conferi o estoque e não encontrei itens abaixo do mínimo para gerar uma solicitação agora.",
      };
    }

    return {
      handled: true,
      resposta:
        `Solicitação ${criado.numero} criada com ${criado.itens} item(ns) e enviada para aprovação.\n\n` +
        "O responsável por compras pode revisar item por item antes de liberar o envio aos fornecedores.",
      dados: criado,
    };
  }

  if (querRecomendacaoReposicao(pergunta) || querItensCriticos(pergunta)) {
    const itens = await listarReposicaoSegura(db, contexto);
    if (!itens.length) {
      return { handled: true, resposta: "Conferi o estoque desta loja e não encontrei itens abaixo do mínimo agora." };
    }

    const linhas = itens
      .slice(0, 15)
      .map((item) => `- ${item.nome}: atual ${item.atual} ${item.unidade} · sugerido ${item.sugerida} ${item.unidade}`)
      .join("\n");
    return {
      handled: true,
      resposta:
        `Itens para reposição (${itens.length}):\n\n${linhas}\n\n` +
        "Para transformar essa lista em solicitação, diga: “Criar solicitação de reposição”.",
      dados: itens,
    };
  }

  if (querStatusCompras(pergunta)) {
    const pedidos = await listarSolicitacoesResumo(db, tenant, 6);
    if (!pedidos.length) {
      return { handled: true, resposta: "Não há solicitações de compra registradas no momento." };
    }

    const linhas = pedidos
      .map((pedido) => `- ${pedido.numero}: ${statusLabel(pedido.status)} · ${pedido.itens} item(ns)`)
      .join("\n");
    return {
      handled: true,
      resposta: `Últimas solicitações de compra:\n\n${linhas}`,
      dados: pedidos,
    };
  }

  if (querAprovar(pergunta)) {
    const numeroPedido = extrairNumeroPedido(pergunta);
    if (!podeAprovarCompras(actor)) {
      return {
        handled: true,
        resposta: "Seu acesso permite solicitar compras, mas a aprovação precisa ser feita por uma pessoa responsável por compras.",
      };
    }

    const pedido = await buscarSolicitacaoPorNumero(db, tenant, numeroPedido);
    if (!pedido) {
      return { handled: true, resposta: `Não encontrei a solicitação ${numeroPedido} nesta loja.` };
    }

    const resultado = await aprovarSolicitacaoCompra(db, tenant, actor, pedido.id);
    const complemento = resultado.autodisparo
      ? "Os itens aprovados foram separados por destino e o envio automático foi processado."
      : "Os itens aprovados foram separados por destino e estão prontos para a conferência final na Central de Compras antes do envio real.";

    return {
      handled: true,
      resposta: `Solicitação ${numeroPedido} analisada: ${resultado.resultadoAprovacao}.\n\n${complemento}`,
      dados: resultado,
    };
  }

  return { handled: false };
}
