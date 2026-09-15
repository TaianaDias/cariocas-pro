"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { isAdministrativeRole } from "../../lib/access-control";

type StatusPedido = "solicitado" | "aprovado" | "comprado" | "cancelado";
type PrioridadePedido = "normal" | "alta" | "urgente";

type InsumoPedido = {
  id: string;
  nome: string;
  unidade: string;
  quantidadeAtual: number;
  estoqueMinimo: number;
  estoqueMaximo: number;
  categoriaId: string;
};

type ItemPedido = {
  insumoId: string;
  insumoNome: string;
  quantidade: number;
  unidade: string;
};

type Pedido = {
  id: string;
  numero: string;
  status: StatusPedido;
  prioridade: PrioridadePedido;
  setor: string;
  observacoes: string;
  itens: ItemPedido[];
  solicitadoPor: string;
  solicitadoPorNome: string;
  criadoEm: string | null;
  atualizadoEm: string | null;
};

type FormItem = {
  insumoId: string;
  quantidade: number;
};

const statusOptions: { label: string; value: "todos" | StatusPedido }[] = [
  { label: "Todos", value: "todos" },
  { label: "Solicitados", value: "solicitado" },
  { label: "Aprovados", value: "aprovado" },
  { label: "Comprados", value: "comprado" },
  { label: "Cancelados", value: "cancelado" },
];

const prioridadeLabels: Record<PrioridadePedido, string> = {
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

const statusLabels: Record<StatusPedido, string> = {
  solicitado: "Solicitado",
  aprovado: "Aprovado",
  comprado: "Comprado",
  cancelado: "Cancelado",
};

function formatDate(value: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function PedidosInsumosPage() {
  const { user, userProfile } = useAuth();
  const administrative = Boolean(userProfile && isAdministrativeRole(userProfile.role));
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [insumos, setInsumos] = useState<InsumoPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | StatusPedido>("todos");
  const [form, setForm] = useState({
    setor: "",
    prioridade: "normal" as PrioridadePedido,
    observacoes: "",
    itens: [] as FormItem[],
  });

  const carregar = useCallback(async () => {
    if (!user || !userProfile?.empresaId || !userProfile?.lojaId) return;
    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/pedidos-insumos", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        pedidos?: Pedido[];
        insumos?: InsumoPedido[];
      };
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar os pedidos de insumos.");
      setPedidos(Array.isArray(data.pedidos) ? data.pedidos : []);
      setInsumos(Array.isArray(data.insumos) ? data.insumos : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os pedidos de insumos.");
    } finally {
      setLoading(false);
    }
  }, [user, userProfile?.empresaId, userProfile?.lojaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const pedidosFiltrados = useMemo(
    () => pedidos.filter((pedido) => statusFilter === "todos" || pedido.status === statusFilter),
    [pedidos, statusFilter],
  );

  const insumosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const selecionados = new Set(form.itens.map((item) => item.insumoId));
    const base = termo
      ? insumos.filter((item) => `${item.nome} ${item.categoriaId}`.toLocaleLowerCase("pt-BR").includes(termo))
      : insumos;
    return base.filter((item) => !selecionados.has(item.id)).slice(0, 30);
  }, [busca, form.itens, insumos]);

  const solicitados = pedidos.filter((pedido) => pedido.status === "solicitado").length;
  const aprovados = pedidos.filter((pedido) => pedido.status === "aprovado").length;
  const comprados = pedidos.filter((pedido) => pedido.status === "comprado").length;

  function adicionarItem(insumo: InsumoPedido) {
    const sugerida = insumo.estoqueMaximo > insumo.quantidadeAtual
      ? Math.max(1, Math.ceil(insumo.estoqueMaximo - insumo.quantidadeAtual))
      : 1;
    setForm((current) => ({
      ...current,
      itens: [...current.itens, { insumoId: insumo.id, quantidade: sugerida }],
    }));
    setBusca("");
  }

  function alterarQuantidade(insumoId: string, quantidade: number) {
    setForm((current) => ({
      ...current,
      itens: current.itens.map((item) => item.insumoId === insumoId ? { ...item, quantidade } : item),
    }));
  }

  function removerItem(insumoId: string) {
    setForm((current) => ({
      ...current,
      itens: current.itens.filter((item) => item.insumoId !== insumoId),
    }));
  }

  async function criarPedido() {
    if (!user || saving) return;
    if (!form.setor.trim()) {
      setError("Informe o setor solicitante.");
      return;
    }
    if (!form.itens.length) {
      setError("Adicione pelo menos um item ao pedido.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/pedidos-insumos", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; numero?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível criar a ordem de pedido.");

      setForm({ setor: "", prioridade: "normal", observacoes: "", itens: [] });
      setFormOpen(false);
      setSuccess(`Ordem ${data.numero || "criada"} enviada para análise.`);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a ordem de pedido.");
    } finally {
      setSaving(false);
    }
  }

  async function alterarStatus(id: string, acao: "aprovar" | "comprado" | "cancelar") {
    if (!user || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/pedidos-insumos", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, acao }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar a ordem de pedido.");
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a ordem de pedido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="orders-page">
      <header className="orders-hero">
        <div>
          <span>Pedidos de Insumos</span>
          <h1>Ordem de Pedido</h1>
          <p>Centralize o que a equipe precisa comprar, acompanhe a aprovação e mantenha o histórico por loja.</p>
        </div>
        <button className="orders-primary" type="button" onClick={() => setFormOpen((value) => !value)}>
          {formOpen ? "Fechar pedido" : "+ Nova ordem"}
        </button>
      </header>

      <section className="orders-kpis" aria-label="Resumo das ordens">
        <article><span>Solicitados</span><strong>{solicitados}</strong></article>
        <article><span>Aprovados</span><strong>{aprovados}</strong></article>
        <article><span>Comprados</span><strong>{comprados}</strong></article>
      </section>

      {formOpen ? (
        <section className="orders-form-panel">
          <header>
            <div>
              <strong>Nova ordem de pedido</strong>
              <span>Selecione os itens e informe somente o necessário para a operação.</span>
            </div>
          </header>

          <div className="orders-form-grid">
            <label>
              <span>Setor solicitante</span>
              <input value={form.setor} onChange={(event) => setForm((current) => ({ ...current, setor: event.target.value }))} placeholder="Ex.: Cozinha de Produção" />
            </label>
            <label>
              <span>Prioridade</span>
              <select value={form.prioridade} onChange={(event) => setForm((current) => ({ ...current, prioridade: event.target.value as PrioridadePedido }))}>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </label>
            <label className="orders-wide">
              <span>Observação</span>
              <textarea rows={2} value={form.observacoes} onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))} placeholder="Ex.: necessário para o turno de sexta-feira" />
            </label>
          </div>

          <div className="orders-picker">
            <label>
              <span>Buscar insumo</span>
              <input type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Digite o nome do insumo" />
            </label>
            {busca.trim() ? (
              <div className="orders-picker-results">
                {insumosFiltrados.length ? insumosFiltrados.map((insumo) => (
                  <button key={insumo.id} type="button" onClick={() => adicionarItem(insumo)}>
                    <span><strong>{insumo.nome}</strong><small>{insumo.quantidadeAtual} {insumo.unidade} em estoque</small></span>
                    <b>Adicionar</b>
                  </button>
                )) : <small>Nenhum insumo encontrado.</small>}
              </div>
            ) : null}
          </div>

          <div className="orders-selected-items">
            {form.itens.length === 0 ? <p>Nenhum item adicionado.</p> : null}
            {form.itens.map((item) => {
              const insumo = insumos.find((candidate) => candidate.id === item.insumoId);
              if (!insumo) return null;
              return (
                <div key={item.insumoId}>
                  <span><strong>{insumo.nome}</strong><small>Estoque atual: {insumo.quantidadeAtual} {insumo.unidade}</small></span>
                  <label>
                    <span>Quantidade</span>
                    <input type="number" min="0.01" step="0.01" value={item.quantidade} onChange={(event) => alterarQuantidade(item.insumoId, Number(event.target.value))} />
                  </label>
                  <button type="button" onClick={() => removerItem(item.insumoId)}>Remover</button>
                </div>
              );
            })}
          </div>

          <footer className="orders-form-footer">
            <span>Custos e dados de fornecedores não são exibidos para a equipe nesta etapa.</span>
            <button className="orders-primary" type="button" disabled={saving || !form.setor.trim() || form.itens.length === 0} onClick={() => void criarPedido()}>
              {saving ? "Enviando..." : "Enviar ordem"}
            </button>
          </footer>
        </section>
      ) : null}

      {error ? <div className="orders-message orders-message--error" role="alert">{error}</div> : null}
      {success ? <div className="orders-message orders-message--success">{success}</div> : null}

      <section className="orders-toolbar">
        <label>
          <span>Filtrar por status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "todos" | StatusPedido)}>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </section>

      {loading ? <div className="orders-empty">Carregando ordens...</div> : null}
      {!loading && pedidosFiltrados.length === 0 ? (
        <div className="orders-empty">
          <strong>Nenhuma ordem encontrada.</strong>
          <span>As solicitações enviadas pela operação aparecerão aqui.</span>
        </div>
      ) : null}

      {!loading && pedidosFiltrados.length ? (
        <section className="orders-list">
          {pedidosFiltrados.map((pedido) => {
            const canCancelOwn = pedido.status === "solicitado" && pedido.solicitadoPor === user?.uid;
            return (
              <article className={`orders-card orders-card--${pedido.status}`} key={pedido.id}>
                <header>
                  <div>
                    <div className="orders-card-badges">
                      <span>{statusLabels[pedido.status]}</span>
                      <span>{prioridadeLabels[pedido.prioridade]}</span>
                    </div>
                    <h2>{pedido.numero}</h2>
                    <p>{pedido.setor} · solicitado por {pedido.solicitadoPorNome}</p>
                  </div>
                  <small>{formatDate(pedido.criadoEm)}</small>
                </header>

                <div className="orders-card-items">
                  {pedido.itens.map((item) => (
                    <div key={`${pedido.id}-${item.insumoId}`}>
                      <span>{item.insumoNome}</span>
                      <strong>{item.quantidade} {item.unidade}</strong>
                    </div>
                  ))}
                </div>

                {pedido.observacoes ? <p className="orders-card-note">{pedido.observacoes}</p> : null}

                <footer>
                  {administrative && pedido.status === "solicitado" ? <button type="button" disabled={saving} onClick={() => void alterarStatus(pedido.id, "aprovar")}>Aprovar</button> : null}
                  {administrative && pedido.status === "aprovado" ? <button className="orders-primary" type="button" disabled={saving} onClick={() => void alterarStatus(pedido.id, "comprado")}>Marcar como comprado</button> : null}
                  {administrative && (pedido.status === "solicitado" || pedido.status === "aprovado") ? <button className="orders-danger" type="button" disabled={saving} onClick={() => void alterarStatus(pedido.id, "cancelar")}>Cancelar</button> : null}
                  {!administrative && canCancelOwn ? <button className="orders-danger" type="button" disabled={saving} onClick={() => void alterarStatus(pedido.id, "cancelar")}>Cancelar solicitação</button> : null}
                </footer>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
