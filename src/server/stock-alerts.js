const admin = require("firebase-admin");

const COLECAO_ESTOQUE = "insumos";
const COLECAO_HISTORICO = "historico";
const COLECAO_ALERTAS = "alertas";
const COLECAO_REPOSICAO = "reposicao";
const COLECAO_CONFIG = "configuracoes";
const COLECAO_AUTOMACAO_LOGS = "automacaoLogs";

function getAdminDb() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (clientEmail && privateKey && projectId) {
      admin.initializeApp({
        credential: admin.credential.cert({ clientEmail, privateKey, projectId }),
      });
    } else {
      admin.initializeApp({ projectId });
    }
  }

  return admin.firestore();
}

function calcularDiasCobertura(estoqueAtual, consumoDiario) {
  if (!consumoDiario || consumoDiario <= 0) return 999;
  return Math.floor((estoqueAtual || 0) / consumoDiario);
}

function buscarMelhorFornecedor(insumo) {
  const fornecedores = insumo.fornecedores || [];
  if (!fornecedores.length) return null;

  const principal = fornecedores.find((fornecedor) => fornecedor.principal);
  if (principal) return principal;

  return [...fornecedores].sort((a, b) => (a.custoUnitario || a.custo || 0) - (b.custoUnitario || b.custo || 0))[0] || null;
}

function calcularQtdSugerida(insumo, consumoDiario) {
  const estoqueMinimo = insumo.estoqueMinimo || 0;
  const estoqueMaximo = insumo.estoqueMaximo || Math.max(estoqueMinimo * 2, consumoDiario * 7);
  const estoqueAtual = insumo.quantidadeAtual || 0;
  const quantidade = Math.max(estoqueMaximo - estoqueAtual, estoqueMinimo);
  const quantidadePadrao = insumo.quantidadePadraoPedido || 1;

  return Math.ceil(quantidade / quantidadePadrao) * quantidadePadrao;
}

function montarLinkWhatsApp(telefone, insumo, quantidade) {
  const numero = String(telefone || "").replace(/\D/g, "");
  const mensagem = encodeURIComponent(
    `Ola! Gostaria de fazer um pedido de:\n\n${insumo.nome}\nQuantidade: ${quantidade} ${insumo.unidadeCompra || "un"}\n\nPedido automatico - Carioca's.`,
  );

  return `https://wa.me/55${numero}?text=${mensagem}`;
}

async function calcularConsumoDiario(insumoId) {
  const db = getAdminDb();
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  const snapshot = await db
    .collection(COLECAO_HISTORICO)
    .where("insumoId", "==", insumoId)
    .where("tipo", "in", ["saida", "producao", "saida_producao"])
    .where("criadoEm", ">=", trintaDiasAtras)
    .get();

  if (snapshot.empty) return 0;

  let totalSaida = 0;
  snapshot.forEach((item) => {
    totalSaida += Math.abs(Number(item.data().quantidade || 0));
  });

  return totalSaida / 30;
}

async function calcularAlertaReposicao(insumo) {
  const consumoDiario = await calcularConsumoDiario(insumo.id);
  const estoqueAtual = insumo.quantidadeAtual || 0;
  const estoqueMinimo = insumo.estoqueMinimo || 0;
  const diasCobertura = calcularDiasCobertura(estoqueAtual, consumoDiario);
  const melhorFornecedor = buscarMelhorFornecedor(insumo);
  const prazoEntrega = melhorFornecedor?.diasEntrega || insumo.diasEntrega || 0;
  const diasPedido = insumo.diasPedido || 0;
  const limiteCritico = prazoEntrega + diasPedido + 1;

  let nivel = null;
  let mensagem = "";

  if (estoqueAtual <= 0) {
    nivel = "critical";
    mensagem = `${insumo.nome} esta com estoque zerado`;
  } else if (diasCobertura <= 1) {
    nivel = "critical";
    mensagem = `${insumo.nome} esta com cobertura critica (${diasCobertura}d)`;
  } else if (diasCobertura <= limiteCritico || estoqueAtual <= estoqueMinimo) {
    nivel = "warning";
    mensagem = `${insumo.nome} precisa de reposicao (${diasCobertura}d de cobertura)`;
  }

  if (!nivel) return null;

  const qtdSugerida = calcularQtdSugerida(insumo, consumoDiario);
  const custoFornecedor = melhorFornecedor?.custoUnitario || melhorFornecedor?.custo || insumo.custoCompra || 0;
  const telefone = melhorFornecedor?.telefoneFornecedor;

  return {
    acaoSugerida: `Comprar ${Math.round(qtdSugerida)} ${insumo.unidadeCompra || "un"}`,
    consumoDiario: Math.round(consumoDiario * 100) / 100,
    custoEstimado: Math.round(qtdSugerida * custoFornecedor * 100) / 100,
    diasAtePedido: Math.max(0, diasCobertura - prazoEntrega - diasPedido),
    diasCobertura,
    diasPedido,
    economiaEstimada: Math.max(0, Math.round(((insumo.custoCompra || 0) - custoFornecedor) * qtdSugerida * 100) / 100),
    estoqueAtual,
    estoqueMaximo: insumo.estoqueMaximo || 0,
    estoqueMinimo,
    insumoId: insumo.id,
    insumoNome: insumo.nome,
    lido: false,
    limiteCritico,
    linkWhatsApp: telefone ? montarLinkWhatsApp(telefone, insumo, qtdSugerida) : null,
    melhorFornecedor: melhorFornecedor
      ? {
          custo: custoFornecedor,
          diasEntrega: melhorFornecedor.diasEntrega || 0,
          fornecedorId: melhorFornecedor.fornecedorId || null,
          fornecedorNome: melhorFornecedor.fornecedorNome,
        }
      : null,
    mensagem,
    nivel,
    prazoEntrega,
    qtdSugerida: Math.round(qtdSugerida),
    resolvido: false,
    tipo: "reposicao",
  };
}

async function persistirAlerta(alerta) {
  const db = getAdminDb();
  const batch = db.batch();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const alertaRef = db.collection(COLECAO_ALERTAS).doc();
  const reposicaoRef = db.collection(COLECAO_REPOSICAO).doc(alertaRef.id);

  batch.set(alertaRef, { ...alerta, criadoEm: timestamp });
  batch.set(reposicaoRef, { ...alerta, criadoEm: timestamp });
  await batch.commit();

  return alertaRef.id;
}

async function avaliarReposicaoInsumo(insumoId) {
  const db = getAdminDb();
  const snapshot = await db.collection(COLECAO_ESTOQUE).doc(insumoId).get();
  if (!snapshot.exists) return null;

  const insumo = { id: snapshot.id, ...snapshot.data() };
  if (insumo.statusProduto && insumo.statusProduto !== "ativo") return null;

  const alerta = await calcularAlertaReposicao(insumo);
  if (alerta) await persistirAlerta(alerta);

  return alerta;
}

async function avaliarReposicaoGeral() {
  const db = getAdminDb();
  const snapshot = await db.collection(COLECAO_ESTOQUE).where("statusProduto", "==", "ativo").get();
  const resultados = [];

  for (const item of snapshot.docs) {
    const insumo = { id: item.id, ...item.data() };

    try {
      const alerta = await calcularAlertaReposicao(insumo);
      if (!alerta) continue;
      await persistirAlerta(alerta);
      resultados.push(alerta);
    } catch (error) {
      console.error(`Erro avaliando ${insumo.nome}:`, error);
    }
  }

  const criticos = resultados.filter((alerta) => alerta.nivel === "critical");
  if (criticos.length) await notificarAdminReposicao(criticos);

  return { criticos: criticos.length, total: resultados.length };
}

async function enviarWhatsApp(numero, texto) {
  const apiUrl = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "http://localhost:8080";
  const apiKey = process.env.EVOLUTION_API_KEY || "cariocas-pro-evolution-key-2026";
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "cariocas-pro";

  await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({
      number: String(numero || "").replace(/\D/g, ""),
      options: { delay: 1200, linkPreview: false },
      text: texto,
    }),
  });
}

async function notificarAdminReposicao(alertasCriticos) {
  try {
    const db = getAdminDb();
    const configDoc = await db.collection(COLECAO_CONFIG).doc("whatsappAutomation").get();
    const config = configDoc.data();

    if (!config?.whatsappAdminNumber) return;

    const mensagem = [
      "ALERTAS CRITICOS DE REPOSICAO",
      "",
      ...alertasCriticos.slice(0, 5).map((alerta) => `- ${alerta.insumoNome}: ${alerta.mensagem}`),
      alertasCriticos.length > 5 ? `+${alertasCriticos.length - 5} alertas` : "",
      "",
      "Acesse o painel para mais detalhes.",
    ].filter(Boolean).join("\n");

    await enviarWhatsApp(config.whatsappAdminNumber, mensagem);
  } catch (error) {
    console.error("Erro ao notificar admin:", error);
  }
}

async function registrarLogFornecedor(insumo, fornecedor, qtdSugerida) {
  const db = getAdminDb();
  await db.collection(COLECAO_AUTOMACAO_LOGS).add({
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    enviado: false,
    fornecedorId: fornecedor.fornecedorId || null,
    fornecedorNome: fornecedor.fornecedorNome,
    insumoId: insumo.id,
    insumoNome: insumo.nome,
    linkWhatsApp: montarLinkWhatsApp(fornecedor.telefoneFornecedor, insumo, qtdSugerida),
    qtdSugerida,
    tipo: "fornecedor_alerta",
  });
}

async function resolverAlerta(alertaId, resolvidoPor, observacao) {
  const db = getAdminDb();
  const dados = {
    lido: true,
    observacaoResolucao: observacao || "",
    resolvido: true,
    resolvidoEm: admin.firestore.FieldValue.serverTimestamp(),
    resolvidoPor,
  };

  await Promise.all([
    db.collection(COLECAO_ALERTAS).doc(alertaId).update(dados),
    db.collection(COLECAO_REPOSICAO).doc(alertaId).set(dados, { merge: true }),
  ]);
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  try {
    const resultado = req.body?.insumoId
      ? await avaliarReposicaoInsumo(req.body.insumoId)
      : await avaliarReposicaoGeral();

    return res.status(200).json({ resultado, success: true });
  } catch (error) {
    console.error("Erro stock-alerts:", error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  avaliarReposicaoGeral,
  avaliarReposicaoInsumo,
  calcularAlertaReposicao,
  handler,
  registrarLogFornecedor,
  resolverAlerta,
};
