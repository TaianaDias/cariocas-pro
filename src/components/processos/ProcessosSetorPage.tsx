"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { isAdministrativeRole } from "../../lib/access-control";

type TipoProcesso = "processo" | "pop" | "checklist";
type StatusProcesso = "rascunho" | "ativo" | "arquivado";
type TipoComprovacao = "nenhuma" | "confirmacao" | "texto" | "foto";

type EtapaProcesso = {
  id: string;
  titulo: string;
  descricao: string;
  obrigatoria: boolean;
  comprovacao: TipoComprovacao;
  ordem?: number;
};

type Processo = {
  id: string;
  setor: string;
  nome: string;
  descricao: string;
  tipo: TipoProcesso;
  frequencia: string;
  responsavel: string;
  status: StatusProcesso;
  etapas: EtapaProcesso[];
  ordem?: number;
};

type FormState = Omit<Processo, "id" | "ordem">;

type ProcessosSetorPageProps = {
  setor: string;
};

const SETORES: Record<string, { titulo: string; descricao: string }> = {
  "cozinha-producao": {
    titulo: "Cozinha de Produção",
    descricao: "Crie POPs, processos e checklists de produção conforme a rotina da sua operação.",
  },
  montagem: {
    titulo: "Área de Montagem",
    descricao: "Padronize montagem, organização e conferências sem engessar o jeito de trabalhar da equipe.",
  },
  "salao-delivery": {
    titulo: "Salão / Delivery",
    descricao: "Organize os processos do atendimento, expedição e delivery de acordo com a realidade da loja.",
  },
  "salao-reposicao": {
    titulo: "Salão / Reposição",
    descricao: "Monte rotinas de reposição, abastecimento e conferência totalmente ajustáveis.",
  },
};

const EMPTY_FORM = (setor: string): FormState => ({
  setor,
  nome: "",
  descricao: "",
  tipo: "processo",
  frequencia: "",
  responsavel: "",
  status: "rascunho",
  etapas: [],
});

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `etapa-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function tipoLabel(tipo: TipoProcesso) {
  if (tipo === "pop") return "POP";
  if (tipo === "checklist") return "Checklist";
  return "Processo";
}

function statusLabel(status: StatusProcesso) {
  if (status === "ativo") return "Ativo";
  if (status === "arquivado") return "Arquivado";
  return "Rascunho";
}

export function ProcessosSetorPage({ setor }: ProcessosSetorPageProps) {
  const { user, userProfile } = useAuth();
  const administrative = isAdministrativeRole(userProfile?.role);
  const setorInfo = SETORES[setor] || { titulo: "Rotinas e Padrões", descricao: "Configure os processos da operação." };

  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => EMPTY_FORM(setor));

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const token = await user.getIdToken();
    return fetch(input, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }, [user]);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/api/processos?setor=${encodeURIComponent(setor)}`);
      const data = (await response.json().catch(() => ({}))) as { processos?: Processo[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar os processos.");
      setProcessos(Array.isArray(data.processos) ? data.processos : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os processos.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, setor, user]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const processosVisiveis = useMemo(
    () => processos.filter((processo) => administrative || processo.status !== "arquivado"),
    [administrative, processos],
  );

  function abrirNovo() {
    setEditingId(null);
    setForm(EMPTY_FORM(setor));
    setEditorOpen(true);
  }

  function abrirEdicao(processo: Processo) {
    setEditingId(processo.id);
    setForm({
      setor: processo.setor,
      nome: processo.nome || "",
      descricao: processo.descricao || "",
      tipo: processo.tipo || "processo",
      frequencia: processo.frequencia || "",
      responsavel: processo.responsavel || "",
      status: processo.status || "rascunho",
      etapas: Array.isArray(processo.etapas) ? processo.etapas.map((etapa) => ({ ...etapa })) : [],
    });
    setEditorOpen(true);
  }

  function adicionarEtapa() {
    setForm((current) => ({
      ...current,
      etapas: [
        ...current.etapas,
        { id: uid(), titulo: "", descricao: "", obrigatoria: true, comprovacao: "confirmacao" },
      ],
    }));
  }

  function atualizarEtapa(index: number, patch: Partial<EtapaProcesso>) {
    setForm((current) => ({
      ...current,
      etapas: current.etapas.map((etapa, position) => position === index ? { ...etapa, ...patch } : etapa),
    }));
  }

  function removerEtapa(index: number) {
    setForm((current) => ({
      ...current,
      etapas: current.etapas.filter((_, position) => position !== index),
    }));
  }

  function moverEtapa(index: number, direction: -1 | 1) {
    setForm((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.etapas.length) return current;
      const etapas = [...current.etapas];
      [etapas[index], etapas[target]] = [etapas[target], etapas[index]];
      return { ...current, etapas };
    });
  }

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nome.trim()) {
      setError("Informe o nome do processo.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await authFetch("/api/processos", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o processo.");

      setEditorOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM(setor));
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o processo.");
    } finally {
      setSaving(false);
    }
  }

  async function alterarStatus(processo: Processo, status: StatusProcesso) {
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch("/api/processos", {
        method: "PATCH",
        body: JSON.stringify({ ...processo, status }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o processo.");
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o processo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="processos-page">
      <header className="processos-hero">
        <div>
          <span className="processos-eyebrow">Rotinas e Padrões</span>
          <h1>{setorInfo.titulo}</h1>
          <p>{setorInfo.descricao}</p>
        </div>
        {administrative ? (
          <button className="processos-primary-button" type="button" onClick={abrirNovo}>
            + Novo processo
          </button>
        ) : null}
      </header>

      <div className="processos-note">
        <strong>Conteúdo totalmente editável.</strong>
        <span> Nome, tipo, frequência, responsável, etapas, ordem, obrigatoriedade e forma de comprovação podem ser ajustados pela gestão.</span>
      </div>

      {error ? <div className="processos-error" role="alert">{error}</div> : null}

      {loading ? (
        <div className="processos-empty">Carregando processos...</div>
      ) : processosVisiveis.length === 0 ? (
        <div className="processos-empty">
          <strong>Nenhum processo cadastrado neste setor.</strong>
          <span>{administrative ? "Comece criando a primeira rotina conforme a necessidade da sua operação." : "A gestão ainda não publicou rotinas para este setor."}</span>
          {administrative ? <button type="button" onClick={abrirNovo}>Criar primeiro processo</button> : null}
        </div>
      ) : (
        <div className="processos-list">
          {processosVisiveis.map((processo) => {
            const expanded = expandedId === processo.id;
            return (
              <article className={`processo-card processo-card--${processo.status}`} key={processo.id}>
                <div className="processo-card__top">
                  <div>
                    <div className="processo-card__badges">
                      <span>{tipoLabel(processo.tipo)}</span>
                      <span>{statusLabel(processo.status)}</span>
                    </div>
                    <h2>{processo.nome}</h2>
                    {processo.descricao ? <p>{processo.descricao}</p> : null}
                  </div>
                </div>

                <div className="processo-card__meta">
                  <span><strong>Frequência:</strong> {processo.frequencia || "Não definida"}</span>
                  <span><strong>Responsável:</strong> {processo.responsavel || "Não definido"}</span>
                  <span><strong>Etapas:</strong> {processo.etapas?.length || 0}</span>
                </div>

                {expanded ? (
                  <div className="processo-card__steps">
                    {(processo.etapas || []).length === 0 ? <p>Nenhuma etapa adicionada.</p> : null}
                    {(processo.etapas || []).map((etapa, index) => (
                      <div className="processo-step-preview" key={etapa.id || index}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{etapa.titulo || "Etapa sem título"}</strong>
                          {etapa.descricao ? <p>{etapa.descricao}</p> : null}
                          <small>
                            {etapa.obrigatoria ? "Obrigatória" : "Opcional"} · Comprovação: {etapa.comprovacao === "nenhuma" ? "nenhuma" : etapa.comprovacao}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="processo-card__actions">
                  <button type="button" onClick={() => setExpandedId(expanded ? null : processo.id)}>
                    {expanded ? "Ocultar etapas" : "Ver etapas"}
                  </button>
                  {administrative ? <button type="button" onClick={() => abrirEdicao(processo)}>Editar</button> : null}
                  {administrative && processo.status !== "arquivado" ? (
                    <button className="processos-danger-link" type="button" disabled={saving} onClick={() => void alterarStatus(processo, "arquivado")}>Arquivar</button>
                  ) : null}
                  {administrative && processo.status === "arquivado" ? (
                    <button type="button" disabled={saving} onClick={() => void alterarStatus(processo, "rascunho")}>Restaurar</button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editorOpen ? (
        <div className="processos-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target && !saving) setEditorOpen(false);
        }}>
          <section className="processos-editor" role="dialog" aria-modal="true" aria-label={editingId ? "Editar processo" : "Criar processo"}>
            <header className="processos-editor__header">
              <div>
                <span>{editingId ? "Editar processo" : "Novo processo"}</span>
                <h2>{setorInfo.titulo}</h2>
              </div>
              <button type="button" aria-label="Fechar editor" disabled={saving} onClick={() => setEditorOpen(false)}>×</button>
            </header>

            <form onSubmit={salvar}>
              <div className="processos-form-grid">
                <label className="processos-field processos-field--wide">
                  <span>Nome do processo</span>
                  <input value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Ex.: Fechamento da cozinha" required />
                </label>

                <label className="processos-field">
                  <span>Tipo</span>
                  <select value={form.tipo} onChange={(event) => setForm((current) => ({ ...current, tipo: event.target.value as TipoProcesso }))}>
                    <option value="processo">Processo</option>
                    <option value="pop">POP</option>
                    <option value="checklist">Checklist</option>
                  </select>
                </label>

                <label className="processos-field">
                  <span>Status</span>
                  <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as StatusProcesso }))}>
                    <option value="rascunho">Rascunho</option>
                    <option value="ativo">Ativo</option>
                    <option value="arquivado">Arquivado</option>
                  </select>
                </label>

                <label className="processos-field">
                  <span>Frequência</span>
                  <input value={form.frequencia} onChange={(event) => setForm((current) => ({ ...current, frequencia: event.target.value }))} placeholder="Ex.: Diariamente no fechamento" />
                </label>

                <label className="processos-field">
                  <span>Responsável</span>
                  <input value={form.responsavel} onChange={(event) => setForm((current) => ({ ...current, responsavel: event.target.value }))} placeholder="Ex.: Auxiliar de cozinha" />
                </label>

                <label className="processos-field processos-field--wide">
                  <span>Descrição</span>
                  <textarea value={form.descricao} onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))} placeholder="Explique o objetivo do processo e qualquer orientação geral." rows={3} />
                </label>
              </div>

              <div className="processos-steps-editor">
                <div className="processos-steps-editor__title">
                  <div>
                    <h3>Etapas</h3>
                    <p>Adicione, remova e reorganize as etapas conforme a necessidade da sua operação.</p>
                  </div>
                  <button type="button" onClick={adicionarEtapa}>+ Adicionar etapa</button>
                </div>

                {form.etapas.length === 0 ? <div className="processos-step-empty">Nenhuma etapa adicionada.</div> : null}

                {form.etapas.map((etapa, index) => (
                  <div className="processos-step-editor" key={etapa.id}>
                    <div className="processos-step-editor__number">{index + 1}</div>
                    <div className="processos-step-editor__body">
                      <input value={etapa.titulo} onChange={(event) => atualizarEtapa(index, { titulo: event.target.value })} placeholder="Título da etapa" />
                      <textarea value={etapa.descricao} onChange={(event) => atualizarEtapa(index, { descricao: event.target.value })} placeholder="Instrução da etapa" rows={2} />
                      <div className="processos-step-editor__options">
                        <label>
                          <input type="checkbox" checked={etapa.obrigatoria} onChange={(event) => atualizarEtapa(index, { obrigatoria: event.target.checked })} />
                          Etapa obrigatória
                        </label>
                        <label>
                          <span>Comprovação</span>
                          <select value={etapa.comprovacao} onChange={(event) => atualizarEtapa(index, { comprovacao: event.target.value as TipoComprovacao })}>
                            <option value="nenhuma">Nenhuma</option>
                            <option value="confirmacao">Confirmação</option>
                            <option value="texto">Texto / observação</option>
                            <option value="foto">Foto</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="processos-step-editor__actions">
                      <button type="button" aria-label="Mover etapa para cima" disabled={index === 0} onClick={() => moverEtapa(index, -1)}>↑</button>
                      <button type="button" aria-label="Mover etapa para baixo" disabled={index === form.etapas.length - 1} onClick={() => moverEtapa(index, 1)}>↓</button>
                      <button type="button" aria-label="Remover etapa" onClick={() => removerEtapa(index)}>×</button>
                    </div>
                  </div>
                ))}
              </div>

              <footer className="processos-editor__footer">
                <small>O histórico de criação e alterações é registrado automaticamente e não pode ser editado.</small>
                <div>
                  <button type="button" disabled={saving} onClick={() => setEditorOpen(false)}>Cancelar</button>
                  <button className="processos-primary-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar processo"}</button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
