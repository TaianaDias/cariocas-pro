import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../lib/firebase";

export interface AlertaReposicao {
  id?: string;
  insumoId?: string;
  insumoNome?: string;
  estoqueAtual?: number;
  estoqueMinimo?: number;
  estoqueMaximo?: number;
  consumoDiario?: number;
  diasCobertura?: number;
  prazoEntrega?: number;
  diasPedido?: number;
  diasAtePedido?: number;
  limiteCritico?: number;
  nivel?: "critical" | "warning" | "info";
  mensagem: string;
  acaoSugerida?: string | null;
  qtdSugerida?: number;
  custoEstimado?: number;
  melhorFornecedor?: {
    fornecedorId?: string;
    fornecedorNome: string;
    custo?: number;
    diasEntrega?: number;
  } | null;
  economiaEstimada?: number;
  linkWhatsApp?: string | null;
  lido: boolean;
  resolvido: boolean;
  resolvidoPor?: string;
  observacaoResolucao?: string;
  criadoEm: unknown;
}

const COLECAO = "alertas";

function mapAlertas(snapshot: { docs: Array<{ id: string; data: () => unknown }> }) {
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as object) }) as AlertaReposicao);
}

export function ouvirAlertasAtivos(callback: (alertas: AlertaReposicao[]) => void): () => void {
  const consulta = query(collection(db, COLECAO), where("resolvido", "==", false), orderBy("criadoEm", "desc"));
  return onSnapshot(consulta, (snap) => callback(mapAlertas(snap)));
}

export function ouvirAlertasTodos(callback: (alertas: AlertaReposicao[]) => void): () => void {
  const consulta = query(collection(db, COLECAO), orderBy("criadoEm", "desc"));
  return onSnapshot(consulta, (snap) => callback(mapAlertas(snap)));
}

export async function listarAlertas(): Promise<AlertaReposicao[]> {
  const consulta = query(collection(db, COLECAO), orderBy("criadoEm", "desc"));
  const snap = await getDocs(consulta);
  return mapAlertas(snap);
}

export async function listarAlertasAtivos(): Promise<AlertaReposicao[]> {
  const consulta = query(collection(db, COLECAO), where("resolvido", "==", false), orderBy("criadoEm", "desc"));
  const snap = await getDocs(consulta);
  return mapAlertas(snap);
}

export const listarAlertasAbertos = listarAlertasAtivos;

export async function criarAlerta(dados: Omit<AlertaReposicao, "id" | "criadoEm">): Promise<string> {
  const ref = await addDoc(collection(db, COLECAO), {
    ...dados,
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function marcarAlertaComoLido(alertaId: string): Promise<void> {
  await updateDoc(doc(db, COLECAO, alertaId), { lido: true });
}

export async function marcarAlertaComoNaoLido(alertaId: string): Promise<void> {
  await updateDoc(doc(db, COLECAO, alertaId), { lido: false });
}

export async function resolverAlerta(alertaId: string, responsavel: string, observacao?: string): Promise<void> {
  await updateDoc(doc(db, COLECAO, alertaId), {
    lido: true,
    observacaoResolucao: observacao || "",
    resolvido: true,
    resolvidoEm: serverTimestamp(),
    resolvidoPor: responsavel,
  });
}

export async function getAlertasNaoResolvidos(): Promise<AlertaReposicao[]> {
  return listarAlertasAtivos();
}

export async function getAlertasCriticos(): Promise<AlertaReposicao[]> {
  const consulta = query(collection(db, COLECAO), where("resolvido", "==", false), where("nivel", "==", "critical"), orderBy("criadoEm", "desc"));
  const snap = await getDocs(consulta);
  return mapAlertas(snap);
}

export async function getContagemNaoLidos(): Promise<number> {
  const alertas = await getAlertasNaoResolvidos();
  return alertas.filter((alerta) => !alerta.lido).length;
}

export const getAlertasNaoLidos = getContagemNaoLidos;
export const marcarComoLido = marcarAlertaComoLido;
export function marcarComoResolvido(id: string): Promise<void> {
  return resolverAlerta(id, "sistema", "Resolvido automaticamente");
}
