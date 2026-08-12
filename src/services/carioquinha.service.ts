import { getComprasRecomendadas, getCmvForaIdeal, getKpis, getPrevisaoRuptura } from "./dashboard.service";
import { criarInsumo, getInsumosCriticos } from "./estoque.service";
import { obterDocumento } from "./db";
import { registrarHistorico } from "./historico.service";
import { listarPorcoesDisponiveis, registrarSaidaParaProducao } from "./producao-porcoes.service";
import type { Insumo } from "../types";

type TenantContext = {
  empresaId: string;
  lojaId: string;
};

type CadastroInsumoInput = {
  categoria?: string;
  codigoBarras?: string;
  fornecedor?: string;
  marca?: string;
  maximo?: number;
  minimo?: number;
  nome?: string;
  observacao?: string;
  pesoPorUnidade?: number;
  preco?: number;
  quantidade?: number;
  sku?: string;
  unidade?: string;
  unidadePorItem?: string;
  valorTotal?: number;
};

type SaidaProducaoInput = {
  area?: string;
  nome?: string;
  observacao?: string;
  porcoes?: number;
  quantidade?: number;
  unidade?: string;
};

function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function montarMenuInicial() {
  return (
    "Oi, eu sou a Carioquinha.\n\n" +
    "Me diga o que voce precisa:\n\n" +
    "1. Reposicao de estoque\n" +
    "2. Itens criticos\n" +
    "3. Resumo do dia\n" +
    "4. Cadastrar insumo\n" +
    "5. Saida para producao\n" +
    "6. Porcoes disponiveis\n" +
    "7. CMV\n\n" +
    "Pode responder com o numero ou escrever o pedido. Exemplo: \"1\" ou \"o que devo repor hoje?\""
  );
}

function querMenuInicial(textoNormalizado: string) {
  const limpo = textoNormalizado.replace(/[^\w\s]/g, "").trim();
  return [
    "",
    "0",
    "oi",
    "ola",
    "bom dia",
    "boa tarde",
    "boa noite",
    "menu",
    "inicio",
    "iniciar",
    "opcoes",
    "opcoes disponiveis",
    "ajuda",
    "comandos",
  ].includes(limpo);
}

async function obterContextoUsuario(uid: string): Promise<TenantContext | null> {
  const usuario = await obterDocumento<{ empresaId?: string; lojaId?: string }>("usuários", uid);
  if (!usuario?.empresaId || !usuario?.lojaId) return null;
  return { empresaId: usuario.empresaId, lojaId: usuario.lojaId };
}

function parseNumero(valor?: string) {
  if (!valor) return undefined;
  const limpo = valor.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : undefined;
}

function unidadeEmBase(quantidade: number, unidade?: string) {
  const u = normalizarTexto(unidade || "");

  if (u === "kg") return { quantidade: quantidade * 1000, unidade: "g" };
  if (u === "g" || u === "grama" || u === "gramas") return { quantidade, unidade: "g" };
  if (u === "l" || u === "lt" || u === "litro" || u === "litros") return { quantidade: quantidade * 1000, unidade: "ml" };
  if (u === "ml") return { quantidade, unidade: "ml" };

  return { quantidade, unidade: u || "un" };
}

function calcularUnidadesConvertidas(input: CadastroInsumoInput) {
  if (!input.quantidade || !input.unidade || !input.pesoPorUnidade || !input.unidadePorItem) return null;

  const total = unidadeEmBase(input.quantidade, input.unidade);
  const porItem = unidadeEmBase(input.pesoPorUnidade, input.unidadePorItem);

  if (total.unidade !== porItem.unidade || porItem.quantidade <= 0) return null;

  const unidades = Math.floor(total.quantidade / porItem.quantidade);
  if (unidades <= 0) return null;

  return {
    custoPorUnidade: input.valorTotal ? input.valorTotal / unidades : input.preco,
    unidades,
  };
}

function extrairCampo(texto: string, nomes: string[]) {
  const alternativos = nomes.map((nome) => nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(?:^|[\\n,;])\\s*(?:${alternativos})\\s*[:=]\\s*([^\\n,;]+)`, "i");
  return texto.match(regex)?.[1]?.trim();
}

function extrairSaidaProducao(pergunta: string): SaidaProducaoInput | null {
  const textoNormalizado = normalizarTexto(pergunta);
  const temIntencao =
    (textoNormalizado.includes("saiu") || textoNormalizado.includes("saida") || textoNormalizado.includes("baixar")) &&
    textoNormalizado.includes("producao") &&
    (textoNormalizado.includes("porcao") || textoNormalizado.includes("porções"));

  if (!temIntencao) return null;

  const nomeEstruturado = extrairCampo(pergunta, ["nome", "produto", "insumo", "item"]);
  const quantidadeEstruturada = parseNumero(extrairCampo(pergunta, ["quantidade", "qtd", "baixa", "saiu"]));
  const unidadeEstruturada = extrairCampo(pergunta, ["unidade", "un", "medida"]);
  const porcoesEstruturadas = parseNumero(extrairCampo(pergunta, ["porções", "porções", "porcao", "porcao", "rendimento"]));

  if (nomeEstruturado || quantidadeEstruturada || porcoesEstruturadas) {
    return {
      area: extrairCampo(pergunta, ["área", "área", "setor"]),
      nome: nomeEstruturado,
      observacao: extrairCampo(pergunta, ["obs", "observação"]),
      porcoes: porcoesEstruturadas,
      quantidade: quantidadeEstruturada,
      unidade: unidadeEstruturada || pergunta.match(/\b(kg|g|un|und|cx|lt|l|ml|pct|pacote|caixa)\b/i)?.[1],
    };
  }

  const livre = pergunta.match(/(?:saiu|saida|baixar)\s+(?:do estoque\s+)?(?:para\s+)?producao\s+de\s+(.+?)\s+(\d+(?:[,.]\d+)?)\s*(kg|g|un|und|cx|lt|l|ml|pct|pacote|caixa)?(?:.*?)(?:virou|converteu|rendeu|gerou)\s+(\d+(?:[,.]\d+)?)\s+por/i);

  if (!livre) return null;

  return {
    nome: livre[1]?.trim(),
    quantidade: parseNumero(livre[2]),
    unidade: livre[3] || "un",
    porcoes: parseNumero(livre[4]),
  };
}

function extrairCadastroInsumo(pergunta: string): CadastroInsumoInput | null {
  const textoNormalizado = normalizarTexto(pergunta);
  const temIntencao =
    textoNormalizado.includes("cadastrar") ||
    textoNormalizado.includes("cadastre") ||
    textoNormalizado.includes("novo insumo") ||
    textoNormalizado.includes("novo item");

  if (!temIntencao) return null;

  const pesoPorUnidade =
    parseNumero(extrairCampo(pergunta, ["peso por unidade", "peso unidade", "peso do pacote", "peso pacote", "por unidade", "pacote", "porcao", "porcao"])) ||
    parseNumero(pergunta.match(/(\d+(?:[,.]\d+)?)\s*(kg|g|ml|l|lt)\s*(?:cada|por unidade|por pacote|por porcao|por porcao)/i)?.[1]);
  const unidadePorItem =
    extrairCampo(pergunta, ["unidade por item", "unidade pacote", "unidade por unidade"]) ||
    pergunta.match(/(\d+(?:[,.]\d+)?)\s*(kg|g|ml|l|lt)\s*(?:cada|por unidade|por pacote|por porcao|por porcao)/i)?.[2];

  const nome =
    extrairCampo(pergunta, ["nome", "produto", "insumo", "item"]) ||
    pergunta
      .replace(/cadastrar|cadastre|novo insumo|novo item|insumo|item/gi, "")
      .split(/,|;/)[0]
      ?.replace(/[:=]/g, "")
      .trim();

  const unidade = extrairCampo(pergunta, ["unidade", "un", "medida"]) || pergunta.match(/\b(kg|g|un|und|cx|lt|l|ml|pct|pacote|caixa)\b/i)?.[1];

  return {
    categoria: extrairCampo(pergunta, ["categoria"]),
    codigoBarras: extrairCampo(pergunta, ["codigo", "código de barras", "cod", "ean"]),
    fornecedor: extrairCampo(pergunta, ["fornecedor"]),
    marca: extrairCampo(pergunta, ["marca"]),
    maximo: parseNumero(extrairCampo(pergunta, ["maximo", "estoque máximo"])),
    minimo: parseNumero(extrairCampo(pergunta, ["minimo", "estoque mínimo", "min"])),
    nome,
    observacao: extrairCampo(pergunta, ["obs", "observação"]),
    pesoPorUnidade,
    preco: parseNumero(extrairCampo(pergunta, ["preço", "preço", "custo", "valor"])),
    quantidade: parseNumero(extrairCampo(pergunta, ["quantidade", "qtd", "saldo", "estoque"])),
    sku: extrairCampo(pergunta, ["sku", "codigo interno"]),
    unidade,
    unidadePorItem,
    valorTotal: parseNumero(extrairCampo(pergunta, ["valor total", "total compra", "total", "valor da compra"])),
  };
}

function montarInsumoParaCadastro(input: CadastroInsumoInput, uid: string): Omit<Insumo, "id" | "criadoEm" | "atualizadoEm" | "createdBy"> {
  const conversao = calcularUnidadesConvertidas(input);
  const unidade = conversao ? "un" : input.unidade || "un";
  const quantidade = conversao?.unidades ?? input.quantidade ?? 0;
  const custoCompra = conversao?.custoPorUnidade ?? input.preco ?? 0;
  const observacaoConversao = conversao
    ? `Calculo automatico: ${input.quantidade} ${input.unidade} / ${input.pesoPorUnidade} ${input.unidadePorItem} = ${conversao.unidades} unidades. Valor total R$ ${(input.valorTotal ?? 0).toFixed(2)} / ${conversao.unidades} = R$ ${custoCompra.toFixed(2)} por unidade.`
    : "";

  return {
    nome: input.nome?.trim() || "",
    sku: input.sku || `INS-${Date.now()}`,
    marca: input.marca || "",
    categoriaId: input.categoria || "",
    codigoBarras: input.codigoBarras || "",
    status: "ativo",
    quantidadeAtual: quantidade,
    estoqueMinimo: input.minimo ?? 0,
    estoqueMaximo: input.maximo ?? Math.max(quantidade, input.minimo ?? 0),
    localArmazenamento: "",
    unidadeMedida: unidade,
    unidadeCompra: input.unidade || unidade,
    unidadeUso: unidade,
    conversao: conversao?.unidades ?? 1,
    custoCompra,
    promocaoAtiva: false,
    validadeOriginal: 0,
    validadeAposAberto: 0,
    validadeAposProducao: 0,
    loteInterno: "",
    fornecedorPrincipal: input.fornecedor,
    frequenciaPedido: "",
    diasPedido: 0,
    diasEntrega: 0,
    quantidadePadraoPedido: 0,
    responsavel: uid,
    observacao: input.observacao || observacaoConversao || "Cadastrado via WhatsApp pela IA Carioquinha",
    tipoEtiqueta: "",
    precosVenda: [],
    margemEstimada: 0,
    cmv: 0,
  };
}

async function cadastrarInsumoViaWhatsApp(pergunta: string, uid: string, context: TenantContext | null) {
  const dados = extrairCadastroInsumo(pergunta);

  if (!dados) return null;

  const somentePedidoDeFormulario = normalizarTexto(pergunta).replace(/[^\w\s]/g, "").trim();
  if (["cadastrar insumo", "cadastre insumo", "novo insumo", "cadastrar item", "novo item"].includes(somentePedidoDeFormulario)) {
    return {
      resposta:
        "Cadastro de insumo\n\n" +
        "Me envie em uma linha:\n\n" +
        "Nome:\n" +
        "Compra total:\n" +
        "Cada unidade:\n" +
        "Valor total:\n" +
        "Mínimo:\n\n" +
        "Exemplo pronto:\n" +
        "Cadastrar insumo: nome=Hamburguer 150g, quantidade=3, unidade=kg, peso por unidade=150, unidade por item=g, valor total=50,00, mínimo=5\n\n" +
        "Eu calculo: 3kg / 150g = 20 un | R$ 2,50 cada",
    };
  }

  const faltando = [];
  if (!dados.nome) faltando.push("nome");
  if (dados.quantidade === undefined) faltando.push("quantidade");
  if (dados.preco === undefined && dados.valorTotal === undefined) faltando.push("preço/custo ou valor total");

  const temConversaoParcial =
    dados.valorTotal !== undefined || dados.pesoPorUnidade !== undefined || dados.unidadePorItem !== undefined;
  if (temConversaoParcial && dados.pesoPorUnidade === undefined) faltando.push("peso por unidade");
  if (temConversaoParcial && !dados.unidadePorItem) faltando.push("unidade por item");

  if (faltando.length > 0) {
    return {
      resposta:
        `Consigo cadastrar no estoque, mas faltou: ${faltando.join(", ")}.\n\n` +
        "Envie assim:\n" +
        "Cadastrar insumo: nome=Hamburguer 150g, quantidade=3, unidade=kg, peso por unidade=150, unidade por item=g, valor total=50,00, mínimo=5",
    };
  }

  if (!context) {
    return { resposta: "Não consegui identificar empresa e loja para cadastrar esse insumo com segurança." };
  }

  const novoInsumo = {
    ...montarInsumoParaCadastro(dados, uid),
    empresaId: context.empresaId,
    lojaId: context.lojaId,
  };
  const id = await criarInsumo(novoInsumo, uid);

  await registrarHistorico({
    empresaId: context.empresaId,
    lojaId: context.lojaId,
    insumoId: id,
    insumoNome: novoInsumo.nome,
    quantidade: novoInsumo.quantidadeAtual,
    custoUnitario: novoInsumo.custoCompra,
    custoTotal: novoInsumo.quantidadeAtual * novoInsumo.custoCompra,
    observacao: "Cadastro inicial via WhatsApp",
    responsavel: uid,
  });

  return {
    resposta:
      `Insumo cadastrado com sucesso:\n\n` +
      `Nome: ${novoInsumo.nome}\n` +
      `Quantidade: ${novoInsumo.quantidadeAtual} ${novoInsumo.unidadeMedida}\n` +
      `Custo: R$ ${novoInsumo.custoCompra.toFixed(2)}\n` +
      `Minimo: ${novoInsumo.estoqueMinimo} ${novoInsumo.unidadeMedida}\n` +
      `Fornecedor: ${novoInsumo.fornecedorPrincipal || "não informado"}`,
    dados: { id, insumo: novoInsumo },
  };
}

async function registrarProducaoViaWhatsApp(pergunta: string, uid: string, context: TenantContext | null) {
  const dados = extrairSaidaProducao(pergunta);

  const somentePedidoDeFormulario = normalizarTexto(pergunta).replace(/[^\w\s]/g, "").trim();
  if (
    ["saida para produção", "saida produção", "saiu para produção", "registrar produção"].includes(
      somentePedidoDeFormulario,
    )
  ) {
    return {
      resposta:
        "Saída para produção\n\n" +
        "Me envie assim:\n\n" +
        "Produto:\n" +
        "Saiu do estoque:\n" +
        "Virou porções:\n" +
        "Área:\n\n" +
        "Exemplo pronto:\n" +
        "Saída para produção: nome=Carne moida, quantidade=2, unidade=kg, porções=10, área=cozinha",
    };
  }

  if (!dados) return null;

  const faltando = [];
  if (!dados.nome) faltando.push("nome do insumo");
  if (dados.quantidade === undefined) faltando.push("quantidade que saiu do estoque");
  if (!dados.unidade) faltando.push("unidade");
  if (dados.porcoes === undefined) faltando.push("porções geradas");

  if (faltando.length > 0) {
    return {
      resposta:
        `Consigo registrar essa producao, mas faltou: ${faltando.join(", ")}.\n\n` +
        "Envie assim:\n" +
        "Saiu do estoque para produção: nome=Carne moida, quantidade=2, unidade=kg, porções=10, área=cozinha",
    };
  }

  const nome = dados.nome;
  const quantidade = dados.quantidade;
  const unidade = dados.unidade;
  const porcoes = dados.porcoes;

  if (!nome || quantidade === undefined || !unidade || porcoes === undefined) {
    return { resposta: "Não consegui interpretar os dados da produção. Envie no formato estruturado." };
  }

  if (!context) {
    return { resposta: "Não consegui identificar empresa e loja para registrar essa produção com segurança." };
  }

  const producao = await registrarSaidaParaProducao({
    area: dados.area,
    empresaId: context.empresaId,
    insumoNome: nome,
    lojaId: context.lojaId,
    observacao: dados.observacao,
    porcoes,
    quantidade,
    responsavel: uid,
    unidade,
  });

  return {
    resposta:
      `Producao registrada com sucesso.\n\n` +
      `Saiu do estoque: ${producao.insumoNome}\n` +
      `Baixa: ${producao.quantidadeBaixada} ${producao.unidade}\n` +
      `Foi para: ${producao.area}\n` +
      `Virou: ${producao.porcoesGeradas} porcoes\n` +
      `Porcoes disponiveis na area: ${producao.porcoesDisponiveis}\n` +
      `Custo total: R$ ${producao.custoTotal.toFixed(2)}\n` +
      `Custo por porcao: R$ ${producao.custoPorPorcao.toFixed(2)}`,
    dados: producao,
  };
}

export async function processarPergunta(
  pergunta: string,
  uid: string,
  contextoForcado?: TenantContext | null,
): Promise<{ resposta: string; dados?: unknown }> {
  try {
    const p = pergunta.toLowerCase();
    const textoNormalizado = normalizarTexto(pergunta);
    const context = contextoForcado ?? (await obterContextoUsuario(uid));
    const opcao = textoNormalizado.replace(/[^\d]/g, "").trim();

    if (querMenuInicial(textoNormalizado)) {
      return { resposta: montarMenuInicial() };
    }

    if (opcao === "4") {
      return {
        resposta:
          "Cadastro de insumo\n\n" +
          "Me envie assim:\n" +
          "Cadastrar insumo: nome=Hamburguer 150g, quantidade=3, unidade=kg, peso por unidade=150, unidade por item=g, valor total=50,00, minimo=5",
      };
    }

    if (opcao === "5") {
      return {
        resposta:
          "Saida para producao\n\n" +
          "Me envie assim:\n" +
          "Saiu do estoque para producao: nome=Carne moida, quantidade=2, unidade=kg, porcoes=10, area=cozinha",
      };
    }

    const cadastro = await cadastrarInsumoViaWhatsApp(pergunta, uid, context);

    if (cadastro) {
      return cadastro;
    }

    const producao = await registrarProducaoViaWhatsApp(pergunta, uid, context);

    if (producao) {
      return producao;
    }

    if (opcao === "1") {
      const recomendadas = await getComprasRecomendadas(context || undefined);
      if (recomendadas.length === 0) return { resposta: "No momento, nenhum insumo precisa de reposicao urgente." };
      const lista = recomendadas.map((item) => `- ${item.insumo.nome}: comprar ${item.quantidadeRecomendada} ${item.insumo.unidadeCompra} (R$ ${item.custoEstimado.toFixed(2)})`).join("\n");
      return { resposta: `Compras recomendadas:\n\n${lista}`, dados: recomendadas };
    }

    if (opcao === "2") {
      const criticos = await getInsumosCriticos(context || undefined);
      if (criticos.length === 0) return { resposta: "Nenhum item critico no momento." };
      const lista = criticos.slice(0, 10).map((item) => `- ${item.nome}: ${item.quantidadeAtual} ${item.unidadeMedida} (min: ${item.estoqueMinimo})`).join("\n");
      return { resposta: `Itens criticos (${criticos.length} total):\n\n${lista}`, dados: criticos };
    }

    if (opcao === "3") {
      const kpis = await getKpis(context || undefined);
      const criticos = await getInsumosCriticos(context || undefined);
      const ruptura = await getPrevisaoRuptura(context || undefined);
      return {
        resposta:
          `Resumo do dia:\n\n` +
          `Custo do dia: R$ ${kpis.custoDoDia.toFixed(2)} (${kpis.variacaoCusto > 0 ? "subiu" : "caiu"} ${Math.abs(kpis.variacaoCusto)}%)\n` +
          `Itens criticos: ${kpis.itensCriticos}\n` +
          `Risco de ruptura: ${ruptura.length} itens\n` +
          `Reposicao pendente: ${kpis.reposicaoPendente}`,
        dados: { kpis, criticos, ruptura, uid },
      };
    }

    if (opcao === "6") {
      const porcoes = await listarPorcoesDisponiveis(context || undefined);
      if (porcoes.length === 0) return { resposta: "Nao ha porcoes disponiveis registradas na producao." };
      const lista = porcoes
        .slice(0, 10)
        .map((item) => `- ${item.insumoNome}: ${item.porcoesDisponiveis} porcoes em ${item.area} (R$ ${item.custoPorPorcao.toFixed(2)}/porcao)`)
        .join("\n");
      return { resposta: `Porcoes disponiveis:\n\n${lista}`, dados: porcoes };
    }

    if (opcao === "7") {
      const cmv = await getCmvForaIdeal(context || undefined);
      if (cmv.length === 0) return { resposta: "Todos os itens estao dentro da margem ideal de CMV." };
      const lista = cmv.slice(0, 5).map((item) => `- ${item.insumo.nome}: atual ${item.cmvAtual.toFixed(1)}%, ideal ${item.cmvIdeal.toFixed(1)}% (${item.variacao.toFixed(1)}%)`).join("\n");
      return { resposta: `Itens com CMV fora do ideal:\n\n${lista}`, dados: cmv };
    }

    if (textoNormalizado.includes("porções disponíveis") || textoNormalizado.includes("porções na área")) {
      const porcoes = await listarPorcoesDisponiveis(context || undefined);
      if (porcoes.length === 0) return { resposta: "Nao há porções disponíveis registradas na produção." };

      const lista = porcoes
        .slice(0, 10)
        .map((item) => `- ${item.insumoNome}: ${item.porcoesDisponiveis} porcoes em ${item.area} (R$ ${item.custoPorPorcao.toFixed(2)}/porcao)`)
        .join("\n");

      return { resposta: `Porcoes disponiveis:\n\n${lista}`, dados: porcoes };
    }

    if (
      textoNormalizado.includes("como cadastrar") ||
      textoNormalizado.includes("ajuda") ||
      textoNormalizado.includes("comandos")
    ) {
      return {
        resposta:
          "Comandos:\n\n" +
          "1. Cadastrar insumo\n" +
          "2. Saída para produção\n" +
          "3. Porções disponíveis\n" +
          "4. Resumo do dia\n\n" +
          "Digite uma opcao pelo nome que eu abro os campos.",
      };
    }

    if (p.includes("repor") || p.includes("comprar") || p.includes("reposicao")) {
      const recomendadas = await getComprasRecomendadas(context || undefined);
      if (recomendadas.length === 0) return { resposta: "No momento, nenhum insumo precisa de reposicao urgente." };
      const lista = recomendadas.map((item) => `- ${item.insumo.nome}: comprar ${item.quantidadeRecomendada} ${item.insumo.unidadeCompra} (R$ ${item.custoEstimado.toFixed(2)})`).join("\n");
      return { resposta: `Compras recomendadas:\n\n${lista}`, dados: recomendadas };
    }

    if (p.includes("resumo") || p.includes("dia")) {
      const kpis = await getKpis(context || undefined);
      const criticos = await getInsumosCriticos(context || undefined);
      const ruptura = await getPrevisaoRuptura(context || undefined);
      return {
        resposta:
          `Resumo do dia:\n\n` +
          `Custo do dia: R$ ${kpis.custoDoDia.toFixed(2)} (${kpis.variacaoCusto > 0 ? "subiu" : "caiu"} ${Math.abs(kpis.variacaoCusto)}%)\n` +
          `Itens criticos: ${kpis.itensCriticos}\n` +
          `Risco de ruptura: ${ruptura.length} itens\n` +
          `Reposicao pendente: ${kpis.reposicaoPendente}`,
        dados: { kpis, criticos, ruptura, uid },
      };
    }

    if (p.includes("critico") || p.includes("critico")) {
      const criticos = await getInsumosCriticos(context || undefined);
      if (criticos.length === 0) return { resposta: "Nenhum item critico no momento." };
      const lista = criticos.slice(0, 10).map((item) => `- ${item.nome}: ${item.quantidadeAtual} ${item.unidadeMedida} (min: ${item.estoqueMinimo})`).join("\n");
      return { resposta: `Itens criticos (${criticos.length} total):\n\n${lista}`, dados: criticos };
    }

    if (p.includes("cmv")) {
      const cmv = await getCmvForaIdeal(context || undefined);
      if (cmv.length === 0) return { resposta: "Todos os itens estao dentro da margem ideal de CMV." };
      const lista = cmv.slice(0, 5).map((item) => `- ${item.insumo.nome}: atual ${item.cmvAtual.toFixed(1)}%, ideal ${item.cmvIdeal.toFixed(1)}% (${item.variacao.toFixed(1)}%)`).join("\n");
      return { resposta: `Itens com CMV fora do ideal:\n\n${lista}`, dados: cmv };
    }

    return {
      resposta:
        "Nao entendi totalmente o pedido, mas posso te ajudar por aqui:\n\n" +
        montarMenuInicial(),
    };

    return {
      resposta:
        "Oi, sou a Carioquinha.\n\n" +
        "O que voce quer fazer?\n\n" +
        "1. Cadastrar insumo\n" +
        "2. Saída para produção\n" +
        "3. Porções disponíveis\n" +
        "4. Resumo do dia\n\n" +
        "Digite o nome da opcao.",
    };
  } catch (error) {
    console.error("Erro ao processar pergunta da Carioquinha", error);
    return { resposta: "Não consegui processar sua pergunta agora. Tente novamente em instantes." };
  }
}

export function getSugestoesRapidas(): string[] {
  return [
    "O que devo repor hoje?",
    "Resumo do dia",
    "Quais itens criticos?",
    "Como esta o CMV?",
    "Como cadastrar",
    "Cadastrar insumo",
    "Saída para produção: nome=Carne moida, quantidade=2, unidade=kg, porções=10, área=cozinha",
    "Porções disponíveis",
  ];
}
