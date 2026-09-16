import { FieldValue, getFirestore, type DocumentData, type DocumentReference, type Firestore } from "firebase-admin/firestore";

import { isAdministrativeRole } from "../lib/access-control";
import { getAdminApp } from "../lib/server-auth";
import { enviarWhatsAppDetalhado } from "../services/whatsapp.service";
import type { PermissaoFuncionario } from "../types";

export type CompraActor = {
  uid: string;
  nome: string;
  role?: string | null;
  permissoes?: readonly string[] | null;
};

export type CompraTenant = {
  empresaId: string;
  lojaId: string;
};

export type CompraItemInput = {
  insumoId: string;
  quantidade: number;
};

export type CompraDecisionInput = {
  aprovar: boolean;
  insumoId: string;
  motivo?: string;
  quantidade?: number;
};

export type CompraRecebimentoInput = {
  insumoId: string;
  quantidade: number;
};

type StockRecord = {
  id: string;
  data: DocumentData;
  ref: DocumentReference<DocumentData>;
};

type DestinoEnvio = {
  nome: string;
  telefone: string;
};

type GrupoEnvio = {
  id: string;
  tipo: "fornecedor" | "interno";
  destinoNome: string;
  destinos: DestinoEnvio[];
  itens: Array<{
    insumoId: string;
    insumoNome: string;
    quantidade: number;
    unidade: string;
  }>;
  mensagem: string;
  status: "aguardando" | "enviado" | "erro" | "sem_contato" | "parcial";
  erro?: string;
  enviadoEm?: Date | null;
};

const STATUS_ATIVOS = new Set([
  "solicitado",
  "em_analise",
  "aguardando_envio",
  "envio_parcial",
  "enviado",
  "recebimento_parcial",
]);

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : String(value ?? "").trim().slice(0, max);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function onlyDigits(value: unknown) {
  return text(value, 80).replace(/\D/g, "");
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function pedidosCollection(db: Firestore, empresaId: string) {
  return db.collection("empresas").doc(empresaId).collection("pedidosCompra");
}

function insumosCollection(db: Firestore, empresaId: string) {
  return db.collection("empresas").doc(empresaId).collection("insumos");
}

function historicoCollection(db: Firestore, empresaId: string) {
  return db.collection("empresas").doc(empresaId).collection("historicoEstoque");
}

export function getComprasDb(): Firestore | null {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

export function podeAprovarCompras(actor: CompraActor) {
  if (isAdministrativeRole(actor.role)) return true;
  const permissoes = actor.permissoes || [];
  return permissoes.includes("*") || permissoes.includes("compras.aprovar");
}

export function autodisparoComprasAtivo() {
  return process.env.COMPRAS_WHATSAPP_AUTOSEND_ENABLED === "true";
}

function nomeActor(actor: CompraActor) {
  return actor.nome || actor.uid || "Equipe";
}

async function carregarInsumos(db: Firestore, tenant: CompraTenant): Promise<StockRecord[]> {
  const nested = await insumosCollection(db, tenant.empresaId).get();
  const nestedRecords = nested.docs
    .filter((doc) => {
      const data = doc.data();
      return !data.lojaId || data.lojaId === tenant.lojaId;
    })
    .map((doc) => ({ id: doc.id, data: doc.data(), ref: doc.ref }));

  if (nestedRecords.length) return nestedRecords;

  const legacy = await db.collection("insumos").where("empresaId", "==", tenant.empresaId).get();
  return legacy.docs
    .filter((doc) => {
      const data = doc.data();
      return !data.lojaId || data.lojaId === tenant.lojaId;
    })
    .map((doc) => ({ id: doc.id, data: doc.data(), ref: doc.ref }));
}

function unidadeInsumo(data: DocumentData) {
  return text(data.unidadeCompra || data.unidadeMedida || data.unidadeUso || "un", 60) || "un";
}

function principalDoInsumo(data: DocumentData) {
  const fornecedores = Array.isArray(data.fornecedores) ? data.fornecedores as DocumentData[] : [];
  const principal = fornecedores.find((item) => item?.principal) || fornecedores[0];
  const nomeFallback = text(data.fornecedorPrincipal, 220);

  if (!principal && !nomeFallback) return null;

  return {
    fornecedorId: text(principal?.fornecedorId, 180),
    fornecedorNome: text(principal?.fornecedorNome || nomeFallback, 220) || "Fornecedor",
    telefone: onlyDigits(
      principal?.vendedorTelefone ||
      principal?.telefoneVendedor ||
      principal?.telefoneFornecedor ||
      principal?.telefone ||
      "",
    ),
    vendedorNome: text(principal?.vendedorNome || principal?.contatoNome || "", 220),
  };
}

function estoqueSeguro(record: StockRecord) {
  const data = record.data;
  return {
    id: record.id,
    nome: text(data.nome, 220),
    quantidadeAtual: number(data.quantidadeAtual ?? data.estoqueAtual),
    estoqueMinimo: number(data.estoqueMinimo),
    estoqueMaximo: number(data.estoqueMaximo),
    unidade: unidadeInsumo(data),
    abaixoMinimo: number(data.estoqueMinimo) > 0 && number(data.quantidadeAtual ?? data.estoqueAtual) <= number(data.estoqueMinimo),
    quantidadeSugerida: quantidadeSugerida(data),
  };
}

function quantidadeSugerida(data: DocumentData) {
  const atual = number(data.quantidadeAtual ?? data.estoqueAtual);
  const maximo = number(data.estoqueMaximo);
  const minimo = number(data.estoqueMinimo);
  const padrao = number(data.quantidadePadraoPedido);
  if (maximo > atual) return Math.max(1, Math.ceil(maximo - atual));
  if (minimo > atual) return Math.max(1, Math.ceil(minimo - atual));
  if (padrao > 0) return padrao;
  return 1;
}

async function resolverResponsaveisCompra(db: Firestore, tenant: CompraTenant): Promise<DestinoEnvio[]> {
  const snapshot = await db.collection("funcionarios").where("empresaId", "==", tenant.empresaId).get();
  const destinos = snapshot.docs
    .map((doc) => doc.data())
    .filter((data) => data.lojaId === tenant.lojaId && data.ativo !== false)
    .filter((data) => {
      const permissoes = Array.isArray(data.permissoes) ? data.permissoes : [];
      return permissoes.includes("*") || permissoes.includes("compras.aprovar");
    })
    .map((data) => ({
      nome: text(data.nome || data.email || "Responsável por compras", 220),
      telefone: onlyDigits(data.telefone || data.whatsapp || data.celular || data.numeroWhatsApp),
    }))
    .filter((destino) => destino.telefone);

  return Array.from(new Map(destinos.map((item) => [item.telefone, item])).values());
}

async function nomeEmpresa(db: Firestore, empresaId: string) {
  const snap = await db.collection("empresas").doc(empresaId).get();
  const data = snap.data() || {};
  return text(data.nomeFantasia || data.nome || data.razaoSocial || "Empresa", 220) || "Empresa";
}

function mensagemFornecedor(empresa: string, numero: string, destino: string, itens: GrupoEnvio["itens"]) {
  const abertura = destino ? `Olá, ${destino}!` : "Olá!";
  const linhas = itens.map((item) => `- ${item.insumoNome}: ${item.quantidade} ${item.unidade}`).join("\n");
  return `${abertura}\n\nSegue pedido da ${empresa}:\n\n${linhas}\n\nPedido ${numero}. Por favor, confirme disponibilidade e previsão de entrega.`;
}

function mensagemInterna(empresa: string, numero: string, aprovador: string, itens: GrupoEnvio["itens"]) {
  const linhas = itens.map((item) => `- ${item.insumoNome}: ${item.quantidade} ${item.unidade}`).join("\n");
  return `Compra interna aprovada - ${empresa}\n\n${linhas}\n\nPedido ${numero}\nAprovado por: ${aprovador}`;
}

function historicoEvento(status: string, actor: CompraActor, detalhe?: string) {
  return {
    data: new Date(),
    detalhe: detalhe || "",
    status,
    usuarioId: actor.uid,
    usuarioNome: nomeActor(actor),
  };
}

function serializePedido(id: string, data: DocumentData, approver: boolean) {
  const itens = Array.isArray(data.itens)
    ? data.itens.map((item: DocumentData) => ({
        aprovacao: text(item.aprovacao || "pendente", 30),
        insumoId: text(item.insumoId, 180),
        insumoNome: text(item.insumoNome, 220),
        motivoRecusa: text(item.motivoRecusa, 500),
        quantidadeAprovada: number(item.quantidadeAprovada),
        quantidadeRecebida: number(item.quantidadeRecebida),
        quantidadeSolicitada: number(item.quantidadeSolicitada ?? item.quantidade),
        unidade: text(item.unidade, 60) || "un",
        ...(approver ? {
          destinoCompra: text(item.destinoCompra, 30),
          fornecedorNome: text(item.fornecedorSnapshot?.fornecedorNome, 220),
          fornecedorTelefone: onlyDigits(item.fornecedorSnapshot?.telefone),
          vendedorNome: text(item.fornecedorSnapshot?.vendedorNome, 220),
        } : {}),
      }))
    : [];

  return {
    id,
    numero: text(data.numero, 80),
    status: text(data.status || "solicitado", 40),
    prioridade: text(data.prioridade || "normal", 30),
    setor: text(data.setor, 120),
    observacoes: text(data.observacoes, 2000),
    origemSolicitacao: text(data.origemSolicitacao || "sistema", 40),
    solicitadoPor: text(data.solicitadoPor, 180),
    solicitadoPorNome: text(data.solicitadoPorNome || "Equipe", 220),
    criadoEm: toIso(data.criadoEm || data.dataPedido),
    atualizadoEm: toIso(data.atualizadoEm),
    resultadoAprovacao: text(data.resultadoAprovacao, 40),
    aprovadoPorNome: text(data.aprovadoPorNome, 220),
    itens,
    ...(approver ? {
      modoEnvio: text(data.modoEnvio, 30),
      gruposEnvio: Array.isArray(data.gruposEnvio)
        ? data.gruposEnvio.map((grupo: DocumentData) => ({
            id: text(grupo.id, 180),
            tipo: text(grupo.tipo, 30),
            destinoNome: text(grupo.destinoNome, 220),
            destinos: Array.isArray(grupo.destinos)
              ? grupo.destinos.map((destino: DocumentData) => ({ nome: text(destino.nome, 220), telefone: onlyDigits(destino.telefone) }))
              : [],
            itens: Array.isArray(grupo.itens)
              ? grupo.itens.map((item: DocumentData) => ({
                  insumoId: text(item.insumoId, 180),
                  insumoNome: text(item.insumoNome, 220),
                  quantidade: number(item.quantidade),
                  unidade: text(item.unidade, 60),
                }))
              : [],
            mensagem: text(grupo.mensagem, 4000),
            status: text(grupo.status, 30),
            erro: text(grupo.erro, 1000),
            enviadoEm: toIso(grupo.enviadoEm),
          }))
        : [],
    } : {}),
  };
}

export async function listarCentralCompras(db: Firestore, tenant: CompraTenant, actor: CompraActor) {
  const approver = podeAprovarCompras(actor);
  const [stockRecords, pedidosSnap] = await Promise.all([
    carregarInsumos(db, tenant),
    pedidosCollection(db, tenant.empresaId).get(),
  ]);

  const estoque = stockRecords.map(estoqueSeguro).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const pedidos = pedidosSnap.docs
    .filter((doc) => {
      const data = doc.data();
      return data.lojaId === tenant.lojaId && (data.tipoFluxo === "solicitacao_compra" || data.tipoFluxo === "solicitacao_interna");
    })
    .map((doc) => serializePedido(doc.id, doc.data(), approver))
    .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));

  return {
    estoque,
    pedidos,
    podeAprovar: approver,
    autodisparoAtivo: autodisparoComprasAtivo(),
  };
}

async function criarSolicitacaoComRegistros(
  db: Firestore,
  tenant: CompraTenant,
  actor: CompraActor,
  registros: StockRecord[],
  input: {
    itens: CompraItemInput[];
    observacoes?: string;
    origemSolicitacao?: string;
    prioridade?: string;
    setor?: string;
  },
) {
  const map = new Map(registros.map((record) => [record.id, record]));
  const itens = [] as DocumentData[];
  const ids = new Set<string>();

  for (const item of input.itens.slice(0, 100)) {
    const insumoId = text(item.insumoId, 180);
    const quantidade = number(item.quantidade);
    if (!insumoId || quantidade <= 0 || ids.has(insumoId)) continue;
    const record = map.get(insumoId);
    if (!record) continue;
    ids.add(insumoId);
    const fornecedor = principalDoInsumo(record.data);
    itens.push({
      aprovacao: "pendente",
      destinoCompra: fornecedor ? "fornecedor" : "interno",
      fornecedorSnapshot: fornecedor,
      insumoId,
      insumoNome: text(record.data.nome, 220) || "Insumo",
      quantidadeAprovada: 0,
      quantidadeRecebida: 0,
      quantidadeSolicitada: quantidade,
      unidade: unidadeInsumo(record.data),
    });
  }

  if (!itens.length) throw new Error("Adicione pelo menos um item válido à solicitação.");

  const agora = new Date();
  const numero = `CP-${agora.toISOString().slice(2, 10).replace(/-/g, "")}-${String(agora.getTime()).slice(-5)}`;
  const ref = pedidosCollection(db, tenant.empresaId).doc();
  await ref.set({
    atualizadoEm: FieldValue.serverTimestamp(),
    criadoEm: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    dataPedido: FieldValue.serverTimestamp(),
    empresaId: tenant.empresaId,
    historicoStatus: [historicoEvento("solicitado", actor)],
    itens,
    lojaId: tenant.lojaId,
    numero,
    observacoes: text(input.observacoes, 2000),
    origemSolicitacao: text(input.origemSolicitacao || "sistema", 40),
    prioridade: ["normal", "alta", "urgente"].includes(text(input.prioridade, 30).toLowerCase()) ? text(input.prioridade, 30).toLowerCase() : "normal",
    setor: text(input.setor || "Operação", 120),
    solicitadoPor: actor.uid,
    solicitadoPorNome: nomeActor(actor),
    status: "solicitado",
    tipoFluxo: "solicitacao_compra",
    valorTotal: 0,
  });

  return { id: ref.id, numero, itens: itens.length };
}

export async function criarSolicitacaoCompra(
  db: Firestore,
  tenant: CompraTenant,
  actor: CompraActor,
  input: {
    itens: CompraItemInput[];
    observacoes?: string;
    origemSolicitacao?: string;
    prioridade?: string;
    setor?: string;
  },
) {
  const registros = await carregarInsumos(db, tenant);
  return criarSolicitacaoComRegistros(db, tenant, actor, registros, input);
}

export async function criarSolicitacaoReposicaoCarioquinha(db: Firestore, tenant: CompraTenant, actor: CompraActor) {
  const registros = await carregarInsumos(db, tenant);
  const itens = registros
    .filter((record) => {
      const atual = number(record.data.quantidadeAtual ?? record.data.estoqueAtual);
      const minimo = number(record.data.estoqueMinimo);
      return minimo > 0 && atual <= minimo;
    })
    .map((record) => ({
      insumoId: record.id,
      quantidade: quantidadeSugerida(record.data),
    }));

  if (!itens.length) {
    return { id: "", numero: "", itens: 0, vazio: true };
  }

  const criado = await criarSolicitacaoComRegistros(db, tenant, actor, registros, {
    itens,
    observacoes: "Solicitação criada automaticamente pela Carioquinha a partir dos itens abaixo do estoque mínimo.",
    origemSolicitacao: "carioquinha",
    prioridade: "normal",
    setor: "Reposição",
  });
  return { ...criado, vazio: false };
}

function montarGrupos(
  empresa: string,
  numero: string,
  aprovador: string,
  itensAprovados: Array<DocumentData & { fornecedorAtual?: ReturnType<typeof principalDoInsumo> }>,
  responsaveisInternos: DestinoEnvio[],
): GrupoEnvio[] {
  const grupos = new Map<string, GrupoEnvio>();

  for (const item of itensAprovados) {
    const fornecedor = item.fornecedorAtual;
    if (fornecedor?.fornecedorNome) {
      const key = `fornecedor:${fornecedor.fornecedorId || fornecedor.fornecedorNome.toLowerCase()}`;
      if (!grupos.has(key)) {
        grupos.set(key, {
          id: key,
          tipo: "fornecedor",
          destinoNome: fornecedor.fornecedorNome,
          destinos: fornecedor.telefone
            ? [{ nome: fornecedor.vendedorNome || fornecedor.fornecedorNome, telefone: fornecedor.telefone }]
            : [],
          itens: [],
          mensagem: "",
          status: fornecedor.telefone ? "aguardando" : "sem_contato",
        });
      }
      grupos.get(key)!.itens.push({
        insumoId: item.insumoId,
        insumoNome: item.insumoNome,
        quantidade: item.quantidadeAprovada,
        unidade: item.unidade,
      });
      continue;
    }

    const key = "interno";
    if (!grupos.has(key)) {
      grupos.set(key, {
        id: key,
        tipo: "interno",
        destinoNome: "Responsáveis por compras internas",
        destinos: responsaveisInternos,
        itens: [],
        mensagem: "",
        status: responsaveisInternos.length ? "aguardando" : "sem_contato",
      });
    }
    grupos.get(key)!.itens.push({
      insumoId: item.insumoId,
      insumoNome: item.insumoNome,
      quantidade: item.quantidadeAprovada,
      unidade: item.unidade,
    });
  }

  for (const grupo of grupos.values()) {
    grupo.mensagem = grupo.tipo === "fornecedor"
      ? mensagemFornecedor(empresa, numero, grupo.destinos[0]?.nome || "", grupo.itens)
      : mensagemInterna(empresa, numero, aprovador, grupo.itens);
  }

  return Array.from(grupos.values());
}

async function dispararGrupos(grupos: GrupoEnvio[]) {
  const saida: GrupoEnvio[] = [];

  for (const grupo of grupos) {
    if (!grupo.destinos.length) {
      saida.push({ ...grupo, status: "sem_contato", erro: "Nenhum WhatsApp válido foi encontrado para este destino." });
      continue;
    }

    let enviados = 0;
    let ultimoErro = "";
    for (const destino of grupo.destinos) {
      const envio = await enviarWhatsAppDetalhado(destino.telefone, grupo.mensagem);
      if (envio.success) enviados += 1;
      else ultimoErro = envio.error || "Falha no envio pelo WhatsApp.";
    }

    const status: GrupoEnvio["status"] = enviados === grupo.destinos.length ? "enviado" : enviados > 0 ? "parcial" : "erro";
    saida.push({
      ...grupo,
      status,
      erro: status === "enviado" ? "" : ultimoErro,
      enviadoEm: enviados > 0 ? new Date() : null,
    });
  }

  return saida;
}

function statusDepoisDoEnvio(grupos: GrupoEnvio[]) {
  if (!grupos.length) return "cancelado";
  if (grupos.every((grupo) => grupo.status === "enviado")) return "enviado";
  if (grupos.some((grupo) => grupo.status === "enviado" || grupo.status === "parcial")) return "envio_parcial";
  return "aguardando_envio";
}

export async function aprovarSolicitacaoCompra(
  db: Firestore,
  tenant: CompraTenant,
  actor: CompraActor,
  id: string,
  decisoes?: CompraDecisionInput[],
  options: { forcarEnvio?: boolean } = {},
) {
  if (!podeAprovarCompras(actor)) throw new Error("Somente um responsável por compras pode aprovar solicitações.");

  const ref = pedidosCollection(db, tenant.empresaId).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Solicitação não encontrada.");
  const atual = snap.data() || {};
  if (atual.lojaId !== tenant.lojaId || (atual.tipoFluxo !== "solicitacao_compra" && atual.tipoFluxo !== "solicitacao_interna")) {
    throw new Error("Solicitação não pertence a esta loja.");
  }
  if (!["solicitado", "em_analise"].includes(text(atual.status, 40))) {
    throw new Error("Esta solicitação já foi analisada.");
  }

  const registros = await carregarInsumos(db, tenant);
  const stockMap = new Map(registros.map((record) => [record.id, record]));
  const decisionMap = new Map((decisoes || []).map((item) => [item.insumoId, item]));
  const itensAtuais = Array.isArray(atual.itens) ? atual.itens as DocumentData[] : [];
  const itens = itensAtuais.map((item) => {
    const decisao = decisionMap.get(text(item.insumoId, 180));
    const aprovar = decisao ? decisao.aprovar : true;
    const solicitada = number(item.quantidadeSolicitada ?? item.quantidade);
    const quantidadeAprovada = aprovar ? Math.max(0, Math.min(number(decisao?.quantidade) || solicitada, solicitada)) : 0;
    const record = stockMap.get(text(item.insumoId, 180));
    const fornecedorAtual = record ? principalDoInsumo(record.data) : null;
    return {
      ...item,
      aprovacao: aprovar && quantidadeAprovada > 0 ? "aprovado" : "recusado",
      destinoCompra: fornecedorAtual ? "fornecedor" : "interno",
      fornecedorSnapshot: fornecedorAtual,
      motivoRecusa: aprovar ? "" : text(decisao?.motivo || "Não aprovado pelo responsável por compras.", 500),
      quantidadeAprovada,
      quantidadeRecebida: number(item.quantidadeRecebida),
      fornecedorAtual,
    };
  });

  const aprovados = itens.filter((item) => item.aprovacao === "aprovado" && item.quantidadeAprovada > 0);
  const recusados = itens.length - aprovados.length;
  const resultadoAprovacao = aprovados.length === 0 ? "recusado" : recusados > 0 ? "parcial" : "aprovado";
  const responsaveis = await resolverResponsaveisCompra(db, tenant);
  const empresa = await nomeEmpresa(db, tenant.empresaId);
  let grupos = montarGrupos(empresa, text(atual.numero, 80), nomeActor(actor), aprovados, responsaveis);
  const auto = autodisparoComprasAtivo() || options.forcarEnvio === true;

  if (auto && grupos.length) {
    grupos = await dispararGrupos(grupos);
  }

  const status = aprovados.length === 0 ? "cancelado" : auto ? statusDepoisDoEnvio(grupos) : "aguardando_envio";
  const historico = Array.isArray(atual.historicoStatus) ? atual.historicoStatus.slice(0, 100) : [];
  historico.push(historicoEvento(status, actor, resultadoAprovacao === "parcial" ? "Aprovação parcial por item." : "Solicitação analisada."));

  const itensPersistidos = itens.map(({ fornecedorAtual: _fornecedorAtual, ...item }) => item);
  await ref.update({
    aprovadoEm: FieldValue.serverTimestamp(),
    aprovadoPor: actor.uid,
    aprovadoPorNome: nomeActor(actor),
    atualizadoEm: FieldValue.serverTimestamp(),
    gruposEnvio: grupos,
    historicoStatus: historico,
    itens: itensPersistidos,
    modoEnvio: auto ? "automatico" : "simulacao",
    resultadoAprovacao,
    status,
  });

  return { status, resultadoAprovacao, grupos, autodisparo: auto };
}

export async function enviarSolicitacaoCompraAgora(db: Firestore, tenant: CompraTenant, actor: CompraActor, id: string) {
  if (!podeAprovarCompras(actor)) throw new Error("Somente um responsável por compras pode enviar pedidos.");
  const ref = pedidosCollection(db, tenant.empresaId).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Solicitação não encontrada.");
  const atual = snap.data() || {};
  if (atual.lojaId !== tenant.lojaId) throw new Error("Solicitação não pertence a esta loja.");
  if (!["aguardando_envio", "envio_parcial"].includes(text(atual.status, 40))) {
    throw new Error("Esta solicitação não está aguardando envio.");
  }

  const gruposAtuais = Array.isArray(atual.gruposEnvio) ? atual.gruposEnvio as GrupoEnvio[] : [];
  const pendentes = gruposAtuais.map((grupo) => grupo.status === "enviado" ? grupo : { ...grupo, status: grupo.destinos?.length ? "aguardando" as const : "sem_contato" as const });
  const grupos = await dispararGrupos(pendentes);
  const status = statusDepoisDoEnvio(grupos);
  const historico = Array.isArray(atual.historicoStatus) ? atual.historicoStatus.slice(0, 100) : [];
  historico.push(historicoEvento(status, actor, "Envio confirmado manualmente pelo responsável por compras."));
  await ref.update({
    atualizadoEm: FieldValue.serverTimestamp(),
    gruposEnvio: grupos,
    historicoStatus: historico,
    modoEnvio: "manual_confirmado",
    status,
  });
  return { grupos, status };
}

export async function cancelarSolicitacaoCompra(db: Firestore, tenant: CompraTenant, actor: CompraActor, id: string) {
  const ref = pedidosCollection(db, tenant.empresaId).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Solicitação não encontrada.");
  const atual = snap.data() || {};
  if (atual.lojaId !== tenant.lojaId) throw new Error("Solicitação não pertence a esta loja.");
  const statusAtual = text(atual.status, 40);
  const proprio = atual.solicitadoPor === actor.uid;
  if (!podeAprovarCompras(actor) && !(proprio && statusAtual === "solicitado")) {
    throw new Error("Você não pode cancelar esta solicitação.");
  }
  if (!STATUS_ATIVOS.has(statusAtual) || ["enviado", "recebimento_parcial"].includes(statusAtual)) {
    throw new Error("Esta solicitação não pode mais ser cancelada por aqui.");
  }
  const historico = Array.isArray(atual.historicoStatus) ? atual.historicoStatus.slice(0, 100) : [];
  historico.push(historicoEvento("cancelado", actor));
  await ref.update({
    atualizadoEm: FieldValue.serverTimestamp(),
    canceladoEm: FieldValue.serverTimestamp(),
    historicoStatus: historico,
    status: "cancelado",
  });
  return { status: "cancelado" };
}

export async function registrarRecebimentoSolicitacao(
  db: Firestore,
  tenant: CompraTenant,
  actor: CompraActor,
  id: string,
  recebimentos?: CompraRecebimentoInput[],
) {
  if (!podeAprovarCompras(actor)) throw new Error("Somente um responsável por compras pode registrar o recebimento.");
  const ref = pedidosCollection(db, tenant.empresaId).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Solicitação não encontrada.");
  const atual = snap.data() || {};
  if (atual.lojaId !== tenant.lojaId) throw new Error("Solicitação não pertence a esta loja.");
  if (!["enviado", "envio_parcial", "recebimento_parcial", "aguardando_envio"].includes(text(atual.status, 40))) {
    throw new Error("Esta solicitação ainda não está pronta para recebimento.");
  }

  const registros = await carregarInsumos(db, tenant);
  const stockMap = new Map(registros.map((record) => [record.id, record]));
  const recebimentoMap = new Map((recebimentos || []).map((item) => [item.insumoId, number(item.quantidade)]));
  const itensAtuais = Array.isArray(atual.itens) ? atual.itens as DocumentData[] : [];
  const itens = [] as DocumentData[];

  for (const item of itensAtuais) {
    const aprovado = text(item.aprovacao, 30) === "aprovado";
    if (!aprovado) {
      itens.push(item);
      continue;
    }

    const aprovada = number(item.quantidadeAprovada);
    const recebidaAntes = number(item.quantidadeRecebida);
    const restante = Math.max(aprovada - recebidaAntes, 0);
    const solicitadaAgora = recebimentoMap.has(text(item.insumoId, 180)) ? recebimentoMap.get(text(item.insumoId, 180))! : restante;
    const quantidadeRecebida = Math.max(0, Math.min(solicitadaAgora, restante));

    if (quantidadeRecebida > 0) {
      const record = stockMap.get(text(item.insumoId, 180));
      if (!record) throw new Error(`O insumo ${text(item.insumoNome, 220)} não foi encontrado no estoque.`);
      const atualEstoque = number(record.data.quantidadeAtual ?? record.data.estoqueAtual);
      await record.ref.set({
        quantidadeAtual: atualEstoque + quantidadeRecebida,
        estoqueAtual: atualEstoque + quantidadeRecebida,
        atualizadoEm: FieldValue.serverTimestamp(),
      }, { merge: true });
      await historicoCollection(db, tenant.empresaId).add({
        criadoEm: FieldValue.serverTimestamp(),
        data: FieldValue.serverTimestamp(),
        empresaId: tenant.empresaId,
        insumoId: text(item.insumoId, 180),
        insumoNome: text(item.insumoNome, 220),
        lojaId: tenant.lojaId,
        observacao: `Recebimento da solicitação ${text(atual.numero, 80)}`,
        pedidoCompraId: id,
        quantidade: quantidadeRecebida,
        responsavel: actor.uid,
        tipo: "entrada",
        tipoMovimentacao: "compra",
        unidade: text(item.unidade, 60) || "un",
        usuarioId: actor.uid,
      });
    }

    itens.push({ ...item, quantidadeRecebida: recebidaAntes + quantidadeRecebida });
  }

  const aprovados = itens.filter((item) => text(item.aprovacao, 30) === "aprovado");
  const completo = aprovados.length > 0 && aprovados.every((item) => number(item.quantidadeRecebida) >= number(item.quantidadeAprovada));
  const status = completo ? "recebido" : "recebimento_parcial";
  const historico = Array.isArray(atual.historicoStatus) ? atual.historicoStatus.slice(0, 100) : [];
  historico.push(historicoEvento(status, actor, completo ? "Recebimento concluído." : "Recebimento parcial registrado."));
  await ref.update({
    atualizadoEm: FieldValue.serverTimestamp(),
    ...(completo ? { dataRecebimento: FieldValue.serverTimestamp() } : {}),
    historicoStatus: historico,
    itens,
    status,
  });
  return { status };
}

export async function resolverAtorCompras(db: Firestore, tenant: CompraTenant, identificador: string): Promise<CompraActor> {
  const id = text(identificador, 320);
  const usuarioDireto = await db.collection("usuarios").doc(id).get().catch(() => null);
  if (usuarioDireto?.exists) {
    const data = usuarioDireto.data() || {};
    if ((data.empresaId || id) === tenant.empresaId && (!data.lojaId || data.lojaId === tenant.lojaId)) {
      return {
        uid: text(data.uid || usuarioDireto.id, 180),
        nome: text(data.nome || data.email || "Equipe", 220),
        role: text(data.role, 40),
        permissoes: Array.isArray(data.permissoes) ? data.permissoes : [],
      };
    }
  }

  const funcionarioDireto = await db.collection("funcionarios").doc(id).get().catch(() => null);
  if (funcionarioDireto?.exists) {
    const data = funcionarioDireto.data() || {};
    if (data.empresaId === tenant.empresaId && data.lojaId === tenant.lojaId && data.ativo !== false) {
      return {
        uid: text(data.uid || funcionarioDireto.id, 180),
        nome: text(data.nome || data.email || "Equipe", 220),
        role: text(data.role, 40),
        permissoes: Array.isArray(data.permissoes) ? data.permissoes : [],
      };
    }
  }

  if (id.includes("@")) {
    const porEmail = await db.collection("funcionarios").where("email", "==", id.toLowerCase()).limit(1).get().catch(() => null);
    const doc = porEmail?.docs[0];
    const data = doc?.data();
    if (doc && data?.empresaId === tenant.empresaId && data?.lojaId === tenant.lojaId && data?.ativo !== false) {
      return {
        uid: text(data.uid || doc.id, 180),
        nome: text(data.nome || data.email || "Equipe", 220),
        role: text(data.role, 40),
        permissoes: Array.isArray(data.permissoes) ? data.permissoes : [],
      };
    }
  }

  return { uid: id, nome: "Equipe", role: "funcionario", permissoes: [] };
}

export async function buscarSolicitacaoPorNumero(db: Firestore, tenant: CompraTenant, numero: string) {
  const snapshot = await pedidosCollection(db, tenant.empresaId).where("numero", "==", text(numero, 80)).limit(1).get();
  const doc = snapshot.docs[0];
  if (!doc || doc.data().lojaId !== tenant.lojaId) return null;
  return { id: doc.id, data: doc.data() };
}

export async function listarSolicitacoesResumo(db: Firestore, tenant: CompraTenant, limit = 5) {
  const snapshot = await pedidosCollection(db, tenant.empresaId).get();
  return snapshot.docs
    .filter((doc) => doc.data().lojaId === tenant.lojaId && (doc.data().tipoFluxo === "solicitacao_compra" || doc.data().tipoFluxo === "solicitacao_interna"))
    .map((doc) => ({
      id: doc.id,
      numero: text(doc.data().numero, 80),
      status: text(doc.data().status, 40),
      criadoEm: toIso(doc.data().criadoEm || doc.data().dataPedido),
      itens: Array.isArray(doc.data().itens) ? doc.data().itens.length : 0,
    }))
    .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")))
    .slice(0, Math.max(1, limit));
}
