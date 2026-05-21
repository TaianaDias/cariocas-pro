import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  updateDoc,
  where,
  writeBatch,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type OrderByDirection,
  type QueryConstraint,
  type Unsubscribe,
  type WhereFilterOp,
} from "firebase/firestore";

import { db } from "../lib/firebase";

type FiltroConsulta = {
  campo: string;
  operador: WhereFilterOp;
  valor: unknown;
};

type OrdenacaoConsulta = {
  campo: string;
  direcao: OrderByDirection;
};

type BuscaRange = {
  campo: string;
  inicio: unknown;
  fim: unknown;
};

type BatchOperacao = {
  caminho: string;
  dados?: DocumentData;
  docId: string;
  tipo: "set" | "update" | "delete";
};

export function getCollectionRef(caminho: string): CollectionReference {
  return collection(db, caminho);
}

export function getDocRef(caminho: string, docId: string): DocumentReference {
  return doc(db, caminho, docId);
}

export function withId<T>(id: string, data: DocumentData) {
  return { id, ...data } as T;
}

export async function obterDocumento<T>(caminho: string, docId: string): Promise<T | null> {
  const docSnap = await getDoc(getDocRef(caminho, docId));

  if (!docSnap.exists()) {
    return null;
  }

  return withId<T>(docSnap.id, docSnap.data());
}

export async function obterTodos<T>(caminho: string): Promise<T[]> {
  const snap = await getDocs(getCollectionRef(caminho));
  return snap.docs.map((item) => withId<T>(item.id, item.data()));
}

export async function criarDocumento<T extends DocumentData>(
  caminho: string,
  dados: T,
  docId?: string,
): Promise<string> {
  const data = {
    ...dados,
    atualizadoEm: serverTimestamp(),
    criadoEm: serverTimestamp(),
  };

  if (docId) {
    await setDoc(getDocRef(caminho, docId), data);
    return docId;
  }

  const ref = await addDoc(getCollectionRef(caminho), data);
  return ref.id;
}

export async function atualizarDocumento<T extends DocumentData>(
  caminho: string,
  docId: string,
  dados: Partial<T>,
): Promise<void> {
  await updateDoc(getDocRef(caminho, docId), {
    ...dados,
    atualizadoEm: serverTimestamp(),
  });
}

export async function deletarDocumento(caminho: string, docId: string): Promise<void> {
  await deleteDoc(getDocRef(caminho, docId));
}

export async function consultar<T>(
  caminho: string,
  filtros: FiltroConsulta[] = [],
  ordenacao?: OrdenacaoConsulta,
  limite?: number,
  buscaRange?: BuscaRange,
): Promise<T[]> {
  const constraints: QueryConstraint[] = [];

  for (const filtro of filtros) {
    constraints.push(where(filtro.campo, filtro.operador, filtro.valor));
  }

  if (buscaRange) {
    constraints.push(orderBy(buscaRange.campo));
    constraints.push(startAt(buscaRange.inicio));
    constraints.push(endAt(buscaRange.fim));
  } else if (ordenacao) {
    constraints.push(orderBy(ordenacao.campo, ordenacao.direcao));
  }

  if (limite) {
    constraints.push(limit(limite));
  }

  const consulta = query(getCollectionRef(caminho), ...constraints);
  const snap = await getDocs(consulta);
  return snap.docs.map((item) => withId<T>(item.id, item.data()));
}

export function ouvirColecao<T>(
  caminho: string,
  callback: (dados: T[]) => void,
  filtros: FiltroConsulta[] = [],
  ordenacao?: OrdenacaoConsulta,
): Unsubscribe {
  const constraints: QueryConstraint[] = [];

  for (const filtro of filtros) {
    constraints.push(where(filtro.campo, filtro.operador, filtro.valor));
  }

  if (ordenacao) {
    constraints.push(orderBy(ordenacao.campo, ordenacao.direcao));
  }

  const consulta = query(getCollectionRef(caminho), ...constraints);

  return onSnapshot(consulta, (snap) => {
    callback(snap.docs.map((item) => withId<T>(item.id, item.data())));
  });
}

export function ouvirDocumento<T>(
  caminho: string,
  docId: string,
  callback: (dado: T | null) => void,
): Unsubscribe {
  return onSnapshot(getDocRef(caminho, docId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }

    callback(withId<T>(snap.id, snap.data()));
  });
}

export async function batchEscrita(operacoes: BatchOperacao[]): Promise<void> {
  const batch = writeBatch(db);

  for (const operacao of operacoes) {
    const ref = getDocRef(operacao.caminho, operacao.docId);

    if (operacao.tipo === "set") {
      batch.set(ref, {
        ...operacao.dados,
        atualizadoEm: serverTimestamp(),
      });
    }

    if (operacao.tipo === "update") {
      batch.update(ref, {
        ...operacao.dados,
        atualizadoEm: serverTimestamp(),
      });
    }

    if (operacao.tipo === "delete") {
      batch.delete(ref);
    }
  }

  await batch.commit();
}

export function incrementar(campo: string, valor: number) {
  return {
    [campo]: increment(valor),
  };
}

// Aliases em ingles mantidos para os services ja criados.
export const getDocumentRef = getDocRef;
export const getDocument = obterDocumento;
export const deleteDocument = deletarDocumento;

export async function listDocuments<T>(
  caminho: string,
  constraints: QueryConstraint[] = [],
): Promise<T[]> {
  const collectionRef = getCollectionRef(caminho);
  const consulta = constraints.length ? query(collectionRef, ...constraints) : collectionRef;
  const snap = await getDocs(consulta);
  return snap.docs.map((item) => withId<T>(item.id, item.data()));
}

export async function createDocument<T>(
  caminho: string,
  dados: Omit<T, "id">,
): Promise<string> {
  return criarDocumento(caminho, dados as DocumentData);
}

export async function setDocument<T>(
  caminho: string,
  docId: string,
  dados: Omit<T, "id">,
): Promise<string> {
  const data = {
    ...(dados as DocumentData),
    atualizadoEm: serverTimestamp(),
  };

  await setDoc(getDocRef(caminho, docId), data);
  return docId;
}

export async function updateDocument<T>(
  caminho: string,
  docId: string,
  dados: Partial<T>,
): Promise<void> {
  return atualizarDocumento(caminho, docId, dados as DocumentData);
}

export function byField(campo: string, operador: WhereFilterOp, valor: unknown) {
  return where(campo, operador, valor);
}

export function orderedBy(campo: string, direcao: OrderByDirection = "asc") {
  return orderBy(campo, direcao);
}

export function limitedTo(amount: number) {
  return limit(amount);
}

export { increment, serverTimestamp };
