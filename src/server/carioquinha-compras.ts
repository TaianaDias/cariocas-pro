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

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

function querCriarReposicao(texto: string) {
  const t = normalizar(texto);
  const acao = t.includes("criar") || t.includes("gerar") || t.includes("abrir") || t.includes("fazer");
  const fluxo = t.includes("solicitacao") || t.includes("pedido");
  const reposicao = t.includes("reposicao") || t.includes("itens abaixo do minimo") || t.includes("estoque minimo");
  return acao && fluxo && reposicao;
}

function querStatusCompras(texto: string) {
  const t = normalizar(texto);
  return (
    t.includes("status das compras") ||
    t.includes("status dos pedidos") ||
    t.includes("pedidos pendentes") ||
    t.includes("solicitacoes pendentes") ||
    t.includes("solicitacoes de compra")
  );
}

function querAprovar(texto: string) {
  const t = normalizar(texto);
  return (t.includes("aprovar") || t.includes("aprova")) && Boolean(extrairNumeroPedido(texto));
}

export async function processarComandoComprasCarioquinha(
  pergunta: string,
  contexto: ContextoCarioquinha,
): Promise<ResultadoComandoCompras> {
  const db = getComprasDb();
  if (!db) {
    if (querCriarReposicao(pergunta) || querStatusCompras(pergunta) || querAprovar(pergunta)) {
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
    const numero = extrairNumeroPedido(pergunta);
    if (!podeAprovarCompras(actor)) {
      return {
        handled: true,
        resposta: "Seu acesso permite solicitar compras, mas a aprovação precisa ser feita por uma pessoa responsável por compras.",
      };
    }

    const pedido = await buscarSolicitacaoPorNumero(db, tenant, numero);
    if (!pedido) {
      return { handled: true, resposta: `Não encontrei a solicitação ${numero} nesta loja.` };
    }

    const resultado = await aprovarSolicitacaoCompra(db, tenant, actor, pedido.id);
    const complemento = resultado.autodisparo
      ? "Os itens aprovados foram separados por destino e o envio automático foi processado."
      : "Os itens aprovados foram separados por destino e estão prontos para a conferência final na Central de Compras antes do envio real.";

    return {
      handled: true,
      resposta: `Solicitação ${numero} analisada: ${resultado.resultadoAprovacao}.\n\n${complemento}`,
      dados: resultado,
    };
  }

  return { handled: false };
}
