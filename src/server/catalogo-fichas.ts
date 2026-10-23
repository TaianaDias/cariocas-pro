import { createHash } from "node:crypto";
import { FieldValue, type Firestore, type Transaction, type DocumentData } from "firebase-admin/firestore";
import { atualizarIngredientesComEstoque, custosFixosPadrao, custosVariaveisPadrao, metasPadrao, recalcularReceita } from "../domain/precificacao";
import type { CriarInsumoFichaInput, AtualizarCustoFichaInput, SalvarFichaInput } from "../schemas/precificacao.schema";
import type { Insumo, ReceitaPrecificacao, CustosFixosPrecificacao, ReceitaIngrediente } from "../types";

export type FichaActor = { uid: string; empresaId: string; lojaId: string };
export class FichaError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function validarAtorFicha(profile: { uid: string; empresaId?: string; lojaId?: string; role?: string; plano?: string; plan?: string; ativo?: boolean; funcionarioAtivo?: boolean } | null, escrita = true): FichaActor {
  if (!profile) throw new FichaError("Entre novamente para continuar.", 401);
  if (!profile.empresaId || !profile.lojaId || !/^[A-Za-z0-9_-]+$/.test(profile.empresaId) || !/^[A-Za-z0-9_-]+$/.test(profile.lojaId)) throw new FichaError("Empresa e loja precisam estar definidas no seu perfil.", 403);
  if (profile.ativo === false || profile.funcionarioAtivo === false || !["admin", "dono", "proprietario", "user"].includes(profile.role || "")) throw new FichaError("Seu perfil não permite gerenciar fichas e custos.", 403);
  if (!(escrita ? ["plus", "full"] : ["pro", "plus", "full"]).includes(profile.plano || profile.plan || "free")) throw new FichaError("Seu plano não permite esta ação.", 403);
  return { uid: profile.uid, empresaId: profile.empresaId, lojaId: profile.lojaId };
}

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const pertence = (data: DocumentData, actor: FichaActor) => data.empresaId === actor.empresaId && data.lojaId === actor.lojaId;
const tenant = (db: Firestore, actor: FichaActor) => db.collection("empresas").doc(actor.empresaId);

async function operar(db: Firestore, actor: FichaActor, input: { operacaoId: string }, executar: (tx: Transaction, chave: string) => Promise<{ id: string; versao?: number }>) {
  const chave = hash([actor.lojaId, actor.uid, input.operacaoId]);
  const ref = tenant(db, actor).collection("operacoesPrecificacao").doc(chave);
  const assinatura = hash(input);
  return db.runTransaction(async (tx) => {
    const anterior = await tx.get(ref);
    if (anterior.exists) {
      if (anterior.data()?.assinatura !== assinatura) throw new FichaError("Esta operação já foi usada com outros dados. Recarregue e tente novamente.", 409);
      return anterior.data()!.resultado as { id: string; versao?: number };
    }
    const resultado = await executar(tx, chave);
    tx.create(ref, { assinatura, resultado, empresaId: actor.empresaId, lojaId: actor.lojaId, usuarioId: actor.uid, criadoEm: FieldValue.serverTimestamp() });
    return resultado;
  });
}

function auditar(db: Firestore, tx: Transaction, actor: FichaActor, chave: string, acao: string, recursoId: string) {
  tx.create(tenant(db, actor).collection("auditoria").doc(chave), { acao, recursoId, empresaId: actor.empresaId, lojaId: actor.lojaId, usuarioId: actor.uid, criadoEm: FieldValue.serverTimestamp() });
}

export async function criarInsumoParaFicha(db: Firestore, actor: FichaActor, input: CriarInsumoFichaInput) {
  const informadoEm = new Date().toISOString();
  return operar(db, actor, input, async (tx, chave) => {
    const ref = tenant(db, actor).collection("insumos").doc(input.operacaoId);
    if ((await tx.get(ref)).exists) throw new FichaError("Identificador de insumo já utilizado.", 409);
    tx.create(ref, {
      nome: input.nome, nomeNormalizado: input.nome.toLocaleLowerCase("pt-BR"),
      empresaId: actor.empresaId, lojaId: actor.lojaId, createdBy: actor.uid,
      unidadeCompra: input.unidadeCompra, unidadeUso: input.unidadeUso, unidadeMedida: input.unidadeUso,
      fatorConversao: input.fatorConversao, conversao: input.fatorConversao,
      // Cadastro não é recebimento. A referência nunca entra na valorização do saldo.
      estoqueAtual: 0, quantidadeAtual: 0, custoCompra: 0, custoUnitarioCompra: 0, custoUnitarioUso: 0, custoUnitario: 0,
      custoReferencia: { valorCompra: input.custoEstimado, origem: "estimado", informadoEm, versao: 1 },
      estadoCadastro: "pre_compra", origemCadastro: "manual", status: "ativo", statusProduto: "ativo",
      sku: "", marca: "", codigoBarras: "", categoriaId: "", estoqueMinimo: 0, estoqueMaximo: 0,
      criadoEm: FieldValue.serverTimestamp(), atualizadoEm: FieldValue.serverTimestamp(),
    });
    auditar(db, tx, actor, chave, "cadastrar_insumo_para_ficha", ref.id);
    return { id: ref.id, versao: 1 };
  });
}

async function lerInsumo(tx: Transaction, db: Firestore, actor: FichaActor, id: string) {
  const refs = [tenant(db, actor).collection("insumos").doc(id), db.collection("insumos").doc(id)];
  const snaps = await tx.getAll(...refs);
  const snap = snaps.find((item) => item.exists && pertence(item.data()!, actor));
  if (!snap) throw new FichaError("Insumo não encontrado nesta empresa e loja.", 404);
  return snap;
}

export async function atualizarCustoParaFicha(db: Firestore, actor: FichaActor, input: AtualizarCustoFichaInput) {
  const informadoEm = new Date().toISOString();
  return operar(db, actor, input, async (tx, chave) => {
    const snap = await lerInsumo(tx, db, actor, input.insumoId);
    const anterior = snap.data()!;
    if (Number(anterior.custoReferencia?.versao || 0) !== input.versaoCusto) throw new FichaError("O custo foi alterado em outra sessão. Recarregue antes de salvar.", 409);
    const versao = input.versaoCusto + 1;
    const custoReferencia = { valorCompra: input.custoEstimado, origem: "estimado", informadoEm, versao };
    tx.update(snap.ref, { custoReferencia, atualizadoEm: FieldValue.serverTimestamp() });
    tx.create(tenant(db, actor).collection("historicoCustosInsumos").doc(chave), {
      insumoId: snap.id, empresaId: actor.empresaId, lojaId: actor.lojaId, usuarioId: actor.uid,
      anterior: anterior.custoReferencia || null, atual: custoReferencia, motivo: "referencia_para_ficha", criadoEm: FieldValue.serverTimestamp(),
    });
    auditar(db, tx, actor, chave, "atualizar_referencia_ficha", snap.id);
    return { id: snap.id, versao };
  });
}

function custosDoDocumento(data: DocumentData | undefined, actor: FichaActor): CustosFixosPrecificacao {
  const base = { ...custosFixosPadrao, empresaId: actor.empresaId, lojaId: actor.lojaId };
  if (!data || !pertence(data, actor)) return base;
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(base)) if (typeof base[key as keyof typeof base] === "number") {
    const value = Number(data[key]);
    if (Number.isFinite(value) && value >= 0) result[key] = value;
  }
  return result as unknown as CustosFixosPrecificacao;
}

export async function salvarFichaConfiavel(db: Firestore, actor: FichaActor, input: SalvarFichaInput) {
  return operar(db, actor, input, async (tx, chave) => {
    const id = input.id || input.operacaoId;
    const ref = tenant(db, actor).collection("receitas").doc(id);
    const [existente, legado, configuracao] = await tx.getAll(ref, db.collection("receitas").doc(id), db.collection("custosFixos").doc(`${actor.empresaId}_${actor.lojaId}`));
    const origem = existente.exists ? existente : legado.exists ? legado : null;
    if (input.id && !origem) throw new FichaError("Ficha não encontrada nesta empresa e loja.", 404);
    if (origem && !pertence(origem.data()!, actor)) throw new FichaError("Ficha não encontrada nesta empresa e loja.", 404);
    const anterior = origem?.data() as ReceitaPrecificacao | undefined;
    if (Number(anterior?.versaoFicha || 0) !== input.versaoFicha) throw new FichaError("A ficha foi alterada em outra sessão. Recarregue antes de salvar.", 409);
    // Todas as leituras precedem escritas para permitir retry transacional seguro.
    const insumos = await Promise.all(input.ingredientes.map(async (item) => {
      const snap = await lerInsumo(tx, db, actor, item.insumoId);
      return { ...snap.data(), id: snap.id } as Insumo;
    }));
    const ingredientes = input.ingredientes.map((item, index) => ({ ...item, insumoNome: insumos[index].nome, receitaId: id, empresaId: actor.empresaId, lojaId: actor.lojaId, custoUnitarioConvertido: null, custoTotal: null } as ReceitaIngrediente));
    const ficha = recalcularReceita({
      ...anterior, ...input, id, ingredientes: atualizarIngredientesComEstoque(ingredientes, insumos),
      empresaId: actor.empresaId, lojaId: actor.lojaId, createdBy: actor.uid, globalEmpresa: false,
      versaoFicha: input.versaoFicha + 1,
    }, custosDoDocumento(configuracao.data(), actor));
    // JSON remove somente undefined opcionais; null de custo pendente é preservado.
    const dados = JSON.parse(JSON.stringify(ficha));
    tx.set(ref, { ...dados, criadoEm: anterior?.criadoEm || FieldValue.serverTimestamp(), atualizadoEm: FieldValue.serverTimestamp() });
    tx.create(tenant(db, actor).collection("historicoReceitas").doc(chave), {
      empresaId: actor.empresaId, lojaId: actor.lojaId, usuarioId: actor.uid, receitaId: id,
      anterior: anterior || null, atual: dados, criadoEm: FieldValue.serverTimestamp(),
    });
    auditar(db, tx, actor, chave, "salvar_ficha", id);
    return { id, versao: ficha.versaoFicha };
  });
}

async function lerColecao(db: Firestore, actor: FichaActor, nome: string) {
  const [novos, antigos] = await Promise.all([
    tenant(db, actor).collection(nome).where("lojaId", "==", actor.lojaId).get(),
    db.collection(nome).where("empresaId", "==", actor.empresaId).get(),
  ]);
  const merged = new Map<string, DocumentData>();
  for (const doc of [...antigos.docs, ...novos.docs]) if (pertence(doc.data(), actor)) merged.set(doc.id, { ...doc.data(), id: doc.id });
  return [...merged.values()];
}

export async function lerCatalogoFichas(db: Firestore, actor: FichaActor) {
  const [insumos, receitas, configuracao] = await Promise.all([
    lerColecao(db, actor, "insumos"), lerColecao(db, actor, "receitas"),
    db.collection("custosFixos").doc(`${actor.empresaId}_${actor.lojaId}`).get(),
  ]);
  const custosFixos = custosDoDocumento(configuracao.data(), actor);
  const fichas = receitas.map((item) => recalcularReceita({ ...item, ingredientes: atualizarIngredientesComEstoque(item.ingredientes || [], insumos as Insumo[]) }, custosFixos));
  return { insumos, receitas: fichas, custosFixos, custosVariaveis: custosVariaveisPadrao, metas: { ...metasPadrao, empresaId: actor.empresaId, lojaId: actor.lojaId } };
}
