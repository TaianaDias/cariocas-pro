import { sendPasswordResetEmail } from "firebase/auth";

import { auth } from "../lib/firebase";
import type { Funcionario } from "../types";

type FuncionarioApi = Omit<Funcionario, "criadoEm" | "dataContratacao"> & {
  criadoEm?: string | null;
  dataContratacao?: string | null;
};

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("Sessão expirada. Entre novamente para continuar.");
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Não foi possível concluir a operação.");
  }
  return payload;
}

function hydrateFuncionario(item: FuncionarioApi): Funcionario {
  return {
    ...item,
    criadoEm: item.criadoEm ? new Date(item.criadoEm) : new Date(),
    dataContratacao: item.dataContratacao ? new Date(item.dataContratacao) : new Date(),
  } as Funcionario;
}

export async function listarFuncionarios(): Promise<Funcionario[]> {
  const payload = await apiRequest<{ funcionarios: FuncionarioApi[] }>("/api/funcionarios");
  return (payload.funcionarios || []).map(hydrateFuncionario);
}

export async function getFuncionario(id: string): Promise<Funcionario | null> {
  try {
    const payload = await apiRequest<{ funcionario: FuncionarioApi }>(`/api/funcionarios?id=${encodeURIComponent(id)}`);
    return hydrateFuncionario(payload.funcionario);
  } catch (error) {
    if (error instanceof Error && error.message === "Funcionário não encontrado.") return null;
    throw error;
  }
}

export const buscarFuncionario = getFuncionario;

export async function criarFuncionario(dados: Omit<Funcionario, "id" | "criadoEm">): Promise<string> {
  const payload = await apiRequest<{ id: string; novoAcesso: boolean }>("/api/funcionarios", {
    body: JSON.stringify(dados),
    method: "POST",
  });

  if (payload.novoAcesso && dados.email) {
    // O servidor cria a conta sem senha. O Firebase envia ao colaborador o fluxo
    // oficial para definir a própria senha, sem expor credenciais ao administrador.
    await sendPasswordResetEmail(auth, dados.email.trim().toLowerCase()).catch((error) => {
      console.warn("Funcionário criado, mas o e-mail para definir a senha não pôde ser enviado.", error);
    });
  }

  return payload.id;
}

export async function atualizarFuncionario(id: string, dados: Partial<Funcionario>): Promise<void> {
  await apiRequest<{ ok: boolean }>("/api/funcionarios", {
    body: JSON.stringify({ ...dados, id }),
    method: "PATCH",
  });
}

export async function deletarFuncionario(id: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/funcionarios?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export const removerFuncionario = deletarFuncionario;

export async function getFuncionariosAtivos(): Promise<Funcionario[]> {
  const todos = await listarFuncionarios();
  return todos.filter((item) => item.ativo);
}
