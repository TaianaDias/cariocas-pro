"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../ui/PageHeader";

type StockItem = {
  id: string;
  nome: string;
  quantidadeAtual: number;
  estoqueMinimo: number;
  estoqueMaximo: number;
  unidade: string;
  abaixoMinimo: boolean;
  quantidadeSugerida: number;
};

type PedidoItem = {
  aprovacao: string;
  insumoId: string;
  insumoNome: string;
  motivoRecusa?: string;
  quantidadeAprovada: number;
  quantidadeRecebida: number;
  quantidadeSolicitada: number;
  unidade: string;
  destinoCompra?: string;
  fornecedorNome?: string;
  fornecedorTelefone?: string;
  vendedorNome?: string;
};

type GrupoEnvio = {
  id: string;
  tipo: string;
  destinoNome: string;
  destinos: Array<{ nome: string; telefone: string }>;
  itens: Array<{ insumoId: string; insumoNome: string; quantidade: number; unidade: string }>;
  mensagem: string;
  status: string;
  erro?: string;
  enviadoEm?: string | null;
};

type Pedido = {
  id: string;
  numero: string;
  status: string;
  prioridade: string;
  setor: string;
  observacoes: string;
  origemSolicitacao: string;
  solicitadoPor: string;
  solicitadoPorNome: string;
  criadoEm: string | null;
  atualizadoEm: string | null;
  resultadoAprovacao?: string;
  aprovadoPorNome?: string;
  modoEnvio?: string;
  gruposEnvio?: GrupoEnvio[];
  itens: PedidoItem[];
};

type CentralPayload = {
  estoque: StockItem[];
  pedidos: Pedido[];
  podeAprovar: boolean;
  autodisparoAtivo: boolean;
};

type Movement = {
  id: string;
  data: string | null;
  insumoId: string;
  insumoNome: string;
  observacao: string;
  quantidade: number;
  responsavel: string;
  tipo: string;
  unidade: string;
};

type Tab = "solicitar" | "andamento" | "recebimentos" | "movimentacoes";

type ApprovalDraft = Record<string, { aprovar: boolean; quantidade: number; motivo: string }>;
type ReceiveDraft = Record<string, number>;

const statusLabels: Record<string, string> = {
  solicitado: "Aguardando aprovação",
  em_analise: "Em análise",
  aguardando_envio: "Aguardando envio",
  envio_parcial: "Envio parcial",
  enviado: "Enviado",
  recebimento_parcial: "Recebimento parcial",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "recebido") return "success";
  if (status === "cancelado") return "danger";
  if (["solicitado", "em_analise", "aguardando_envio", "envio_parcial", "recebimento_parcial"].includes(status)) return "warning";
  return "neutral";
}

function dateLabel(value?: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function movementLabel(value: string) {
  if (value.includes("entrada")) return "Entrada";
  if (value.includes("saida")) return "Saída";
  if (value.includes("desperdicio")) return "Desperdício";
  if (value.includes("producao")) return "Produção";
  if (value.includes("compra")) return "Compra";
  return "Movimentação";
}

export function CentralComprasPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("solicitar");
  const [data, setData] = useState<CentralPayload>({ estoque: [], pedidos: [], podeAprovar: false, autodisparoAtivo: false });
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [setor, setSetor] = useState("Operação");
  const [prioridade, setPrioridade] = useState("normal");
  const [observacoes, setObservacoes] = useState("");
  const [approvalDrafts, setApprovalDrafts] = useState<Record<string, ApprovalDraft>>({});
  const [receiveDrafts, setReceiveDrafts] = useState<Record<string, ReceiveDraft>>({});
  const [movementForm, setMovementForm] = useState({ insumoId: "", observacao: "", quantidade: 1, tipo: "entrada" as "entrada" | "saida" });

  const authHeaders = useCallback(async (json = false) => {
    if (!user) throw new Error("Sessão expirada. Entre novamente para continuar.");
    const token = await user.getIdToken();
    return {
      authorization: `Bearer ${token}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
    };
  }, [user]);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const [centralResponse, movementResponse] = await Promise.all([
        fetch("/api/pedidos-insumos", { headers, cache: "no-store" }),
        fetch("/api/movimentacoes/operacional", { headers, cache: "no-store" }),
      ]);
      const central = (await centralResponse.json().catch(() => ({}))) as CentralPayload & { error?: string };
      const movementData = (await movementResponse.json().catch(() => ({}))) as { items?: Movement[]; error?: string };
      if (!centralResponse.ok) throw new Error(central.error || "Não foi possível carregar a Central de Compras.");
      if (!movementResponse.ok) throw new Error(movementData.error || "Não foi possível carregar as movimentações.");
      setData({
        estoque: central.estoque || [],
        pedidos: central.pedidos || [],
        podeAprovar: Boolean(central.podeAprovar),
        autodisparoAtivo: Boolean(central.autodisparoAtivo),
      });
      setMovements(movementData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a Central de Compras.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, user]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filteredStock = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const list = term ? data.estoque.filter((item) => item.nome.toLocaleLowerCase("pt-BR").includes(term)) : data.estoque;
    const selectedSet = new Set(selected);
    return [...list].sort((a, b) => {
      const selectedDiff = Number(selectedSet.has(b.id)) - Number(selectedSet.has(a.id));
      if (selectedDiff) return selectedDiff;
      const criticalDiff = Number(b.abaixoMinimo) - Number(a.abaixoMinimo);
      if (criticalDiff) return criticalDiff;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [data.estoque, search, selected]);

  const requested = data.pedidos.filter((pedido) => pedido.status === "solicitado" || pedido.status === "em_analise").length;
  const awaitingSend = data.pedidos.filter((pedido) => pedido.status === "aguardando_envio" || pedido.status === "envio_parcial").length;
  const awaitingReceive = data.pedidos.filter((pedido) => ["enviado", "envio_parcial", "recebimento_parcial", "aguardando_envio"].includes(pedido.status)).length;
  const lowStock = data.estoque.filter((item) => item.abaixoMinimo).length;

  function toggleItem(item: StockItem) {
    setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]);
    setQuantities((current) => ({ ...current, [item.id]: current[item.id] || item.quantidadeSugerida || 1 }));
  }

  function selecionarCriticos() {
    const criticos = data.estoque.filter((item) => item.abaixoMinimo);
    setSelected((current) => Array.from(new Set([...current, ...criticos.map((item) => item.id)])));
    setQuantities((current) => {
      const next = { ...current };
      for (const item of criticos) next[item.id] = next[item.id] || item.quantidadeSugerida || 1;
      return next;
    });
  }

  async function apiPatch(body: Record<string, unknown>) {
    const headers = await authHeaders(true);
    const response = await fetch("/api/pedidos-insumos", { method: "PATCH", headers, body: JSON.stringify(body) });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; status?: string; autodisparo?: boolean };
    if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar a solicitação.");
    return payload;
  }

  async function criarSolicitacao() {
    if (!selected.length || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const headers = await authHeaders(true);
      const response = await fetch("/api/pedidos-insumos", {
        method: "POST",
        headers,
        body: JSON.stringify({
          itens: selected.map((insumoId) => ({ insumoId, quantidade: Number(quantities[insumoId]) || 1 })),
          observacoes,
          prioridade,
          setor,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; numero?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível criar a solicitação.");
      setSelected([]);
      setQuantities({});
      setObservacoes("");
      setPrioridade("normal");
      setSuccess(`Solicitação ${payload.numero || ""} enviada para aprovação.`);
      setTab("andamento");
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a solicitação.");
    } finally {
      setSaving(false);
    }
  }

  function approvalValue(pedido: Pedido, item: PedidoItem) {
    const draft = approvalDrafts[pedido.id]?.[item.insumoId];
    return draft || { aprovar: true, quantidade: item.quantidadeSolicitada, motivo: "" };
  }

  function updateApproval(pedidoId: string, item: PedidoItem, patch: Partial<{ aprovar: boolean; quantidade: number; motivo: string }>) {
    setApprovalDrafts((current) => ({
      ...current,
      [pedidoId]: {
        ...(current[pedidoId] || {}),
        [item.insumoId]: {
          aprovar: current[pedidoId]?.[item.insumoId]?.aprovar ?? true,
          quantidade: current[pedidoId]?.[item.insumoId]?.quantidade ?? item.quantidadeSolicitada,
          motivo: current[pedidoId]?.[item.insumoId]?.motivo ?? "",
          ...patch,
        },
      },
    }));
  }

  async function aprovar(pedido: Pedido) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const decisoes = pedido.itens.map((item) => {
        const draft = approvalValue(pedido, item);
        return { insumoId: item.insumoId, aprovar: draft.aprovar, quantidade: draft.quantidade, motivo: draft.motivo };
      });
      const payload = await apiPatch({ acao: "aprovar", id: pedido.id, decisoes });
      setSuccess(payload.autodisparo
        ? `Solicitação ${pedido.numero} aprovada e encaminhada automaticamente.`
        : `Solicitação ${pedido.numero} aprovada. Os pedidos foram preparados para conferência antes do envio real.`);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aprovar a solicitação.");
    } finally {
      setSaving(false);
    }
  }

  async function enviarAgora(pedido: Pedido) {
    if (saving || !window.confirm(`Confirmar envio real do pedido ${pedido.numero} pelo WhatsApp?`)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiPatch({ acao: "enviar", id: pedido.id });
      setSuccess(`Envio do pedido ${pedido.numero} processado.`);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o pedido.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelar(pedido: Pedido) {
    if (saving || !window.confirm(`Cancelar a solicitação ${pedido.numero}?`)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiPatch({ acao: "cancelar", id: pedido.id });
      setSuccess(`Solicitação ${pedido.numero} cancelada.`);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cancelar a solicitação.");
    } finally {
      setSaving(false);
    }
  }

  function receiveValue(pedido: Pedido, item: PedidoItem) {
    const remaining = Math.max(item.quantidadeAprovada - item.quantidadeRecebida, 0);
    return receiveDrafts[pedido.id]?.[item.insumoId] ?? remaining;
  }

  function updateReceive(pedidoId: string, item: PedidoItem, value: number) {
    setReceiveDrafts((current) => ({
      ...current,
      [pedidoId]: { ...(current[pedidoId] || {}), [item.insumoId]: value },
    }));
  }

  async function receber(pedido: Pedido) {
    if (saving) return;
    const recebimentos = pedido.itens
      .filter((item) => item.aprovacao === "aprovado")
      .map((item) => ({ insumoId: item.insumoId, quantidade: Number(receiveValue(pedido, item)) || 0 }))
      .filter((item) => item.quantidade > 0);
    if (!recebimentos.length) {
      setError("Informe pelo menos uma quantidade recebida.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiPatch({ acao: "receber", id: pedido.id, recebimentos });
      setSuccess(`Recebimento do pedido ${pedido.numero} registrado e estoque atualizado.`);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar o recebimento.");
    } finally {
      setSaving(false);
    }
  }

  async function registrarMovimentacao() {
    if (!movementForm.insumoId || movementForm.quantidade <= 0 || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const headers = await authHeaders(true);
      const response = await fetch("/api/estoque/operacional", {
        method: "POST",
        headers,
        body: JSON.stringify(movementForm),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível registrar a movimentação.");
      setMovementForm({ insumoId: "", observacao: "", quantidade: 1, tipo: "entrada" });
      setSuccess("Movimentação registrada e estoque atualizado.");
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a movimentação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="central-purchases">
      <PageHeader
        eyebrow="Operação"
        title="Compras e Pedidos"
        description="Solicite insumos, aprove compras, encaminhe cada item ao destino correto e registre o recebimento sem duplicar processos."
      />

      <section className="central-purchases__kpis" aria-label="Resumo da Central de Compras">
        <Card><span>Abaixo do mínimo</span><strong>{lowStock}</strong></Card>
        <Card><span>Aguardando aprovação</span><strong>{requested}</strong></Card>
        <Card><span>Aguardando envio</span><strong>{awaitingSend}</strong></Card>
        <Card><span>Aguardando recebimento</span><strong>{awaitingReceive}</strong></Card>
      </section>

      <nav className="central-purchases__tabs" aria-label="Etapas de compras">
        <button className={tab === "solicitar" ? "is-active" : ""} onClick={() => setTab("solicitar")} type="button">Solicitar</button>
        <button className={tab === "andamento" ? "is-active" : ""} onClick={() => setTab("andamento")} type="button">Pedidos em andamento</button>
        <button className={tab === "recebimentos" ? "is-active" : ""} onClick={() => setTab("recebimentos")} type="button">Recebimentos</button>
        <button className={tab === "movimentacoes" ? "is-active" : ""} onClick={() => setTab("movimentacoes")} type="button">Movimentações</button>
      </nav>

      {error ? <p className="central-purchases__message central-purchases__message--error">{error}</p> : null}
      {success ? <p className="central-purchases__message central-purchases__message--success">{success}</p> : null}
      {loading ? <Card className="central-purchases__loading">Carregando Central de Compras...</Card> : null}

      {!loading && tab === "solicitar" ? (
        <section className="central-purchases__section">
          <Card className="central-purchases__request-config">
            <div className="central-purchases__grid">
              <label><span>Setor solicitante</span><input value={setor} onChange={(event) => setSetor(event.target.value)} placeholder="Ex.: Cozinha de Produção" /></label>
              <label><span>Prioridade</span><select value={prioridade} onChange={(event) => setPrioridade(event.target.value)}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
              <label className="central-purchases__wide"><span>Observação</span><textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} placeholder="Contexto da necessidade, se houver." /></label>
            </div>
          </Card>

          <Card className="central-purchases__stock-panel">
            <header>
              <div><strong>Itens do estoque</strong><span>Marque somente o que precisa ser comprado. A quantidade sugerida considera mínimo e máximo cadastrados.</span></div>
              <Button onClick={selecionarCriticos} disabled={!lowStock}>Selecionar abaixo do mínimo</Button>
            </header>
            <input className="central-purchases__search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar insumo" />
            <div className="central-purchases__stock-list">
              {filteredStock.map((item) => {
                const checked = selected.includes(item.id);
                return (
                  <label className={`central-purchases__stock-item ${checked ? "is-selected" : ""}`} key={item.id}>
                    <input type="checkbox" checked={checked} onChange={() => toggleItem(item)} />
                    <span className="central-purchases__stock-name"><b>{item.nome}</b><small>Atual: {item.quantidadeAtual} {item.unidade} · Mín.: {item.estoqueMinimo} · Máx.: {item.estoqueMaximo || "—"}</small></span>
                    {item.abaixoMinimo ? <Badge tone="warning">Repor</Badge> : <Badge tone="neutral">Estoque</Badge>}
                    <label className="central-purchases__qty" onClick={(event) => event.preventDefault()}>
                      <span>Qtd.</span>
                      <input
                        disabled={!checked}
                        min="0.01"
                        step="0.01"
                        type="number"
                        value={quantities[item.id] ?? item.quantidadeSugerida}
                        onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </label>
                  </label>
                );
              })}
            </div>
            <footer>
              <span>{selected.length} item(ns) selecionado(s)</span>
              <Button onClick={criarSolicitacao} disabled={saving || selected.length === 0}>{saving ? "Enviando..." : "Enviar para aprovação"}</Button>
            </footer>
          </Card>
        </section>
      ) : null}

      {!loading && tab === "andamento" ? (
        <section className="central-purchases__orders">
          {data.pedidos.filter((pedido) => pedido.status !== "recebido").map((pedido) => (
            <Card className="central-purchases__order" key={pedido.id}>
              <header>
                <div><span>{pedido.numero}</span><h2>{pedido.setor || "Operação"}</h2><small>Solicitado por {pedido.solicitadoPorNome} · {dateLabel(pedido.criadoEm)}</small></div>
                <div className="central-purchases__badges"><Badge tone={statusTone(pedido.status)}>{statusLabels[pedido.status] || pedido.status}</Badge><Badge tone="neutral">{pedido.prioridade || "normal"}</Badge></div>
              </header>

              <div className="central-purchases__order-items">
                {pedido.itens.map((item) => {
                  const draft = approvalValue(pedido, item);
                  const analyzable = data.podeAprovar && ["solicitado", "em_analise"].includes(pedido.status);
                  return (
                    <div key={item.insumoId}>
                      {analyzable ? <input type="checkbox" checked={draft.aprovar} onChange={(event) => updateApproval(pedido.id, item, { aprovar: event.target.checked })} /> : null}
                      <span><b>{item.insumoNome}</b><small>Solicitado: {item.quantidadeSolicitada} {item.unidade}{item.motivoRecusa ? ` · ${item.motivoRecusa}` : ""}</small></span>
                      {analyzable ? (
                        <input className="central-purchases__approve-qty" disabled={!draft.aprovar} min="0" max={item.quantidadeSolicitada} step="0.01" type="number" value={draft.quantidade} onChange={(event) => updateApproval(pedido.id, item, { quantidade: Number(event.target.value) })} />
                      ) : (
                        <small>{item.aprovacao === "aprovado" ? `Aprovado: ${item.quantidadeAprovada} ${item.unidade}` : item.aprovacao}</small>
                      )}
                    </div>
                  );
                })}
              </div>

              {data.podeAprovar && pedido.gruposEnvio?.length ? (
                <div className="central-purchases__dispatches">
                  <strong>Destinos gerados</strong>
                  {pedido.gruposEnvio.map((grupo) => (
                    <div key={grupo.id}><span><b>{grupo.destinoNome}</b><small>{grupo.itens.length} item(ns) · {grupo.destinos.map((destino) => destino.nome).join(", ") || "contato pendente"}</small></span><Badge tone={grupo.status === "enviado" ? "success" : grupo.status === "erro" || grupo.status === "sem_contato" ? "danger" : "warning"}>{grupo.status.replaceAll("_", " ")}</Badge></div>
                  ))}
                </div>
              ) : null}

              <footer>
                {data.podeAprovar && ["solicitado", "em_analise"].includes(pedido.status) ? <Button onClick={() => aprovar(pedido)} disabled={saving}>{saving ? "Processando..." : "Aprovar selecionados"}</Button> : null}
                {data.podeAprovar && ["aguardando_envio", "envio_parcial"].includes(pedido.status) ? <Button onClick={() => enviarAgora(pedido)} disabled={saving}>Enviar agora</Button> : null}
                {["solicitado", "em_analise", "aguardando_envio"].includes(pedido.status) ? <button className="central-purchases__danger-link" type="button" onClick={() => cancelar(pedido)}>Cancelar</button> : null}
              </footer>
            </Card>
          ))}
          {data.pedidos.filter((pedido) => pedido.status !== "recebido").length === 0 ? <EmptyState title="Nenhum pedido em andamento" description="As solicitações abertas aparecerão aqui." /> : null}
        </section>
      ) : null}

      {!loading && tab === "recebimentos" ? (
        <section className="central-purchases__orders">
          {data.pedidos.filter((pedido) => ["enviado", "envio_parcial", "recebimento_parcial", "aguardando_envio"].includes(pedido.status)).map((pedido) => (
            <Card className="central-purchases__order" key={pedido.id}>
              <header><div><span>{pedido.numero}</span><h2>Recebimento</h2><small>{statusLabels[pedido.status] || pedido.status}</small></div><Badge tone={statusTone(pedido.status)}>{statusLabels[pedido.status] || pedido.status}</Badge></header>
              <div className="central-purchases__receive-list">
                {pedido.itens.filter((item) => item.aprovacao === "aprovado").map((item) => {
                  const remaining = Math.max(item.quantidadeAprovada - item.quantidadeRecebida, 0);
                  return (
                    <label key={item.insumoId}><span><b>{item.insumoNome}</b><small>Aprovado: {item.quantidadeAprovada} · Já recebido: {item.quantidadeRecebida} · Falta: {remaining} {item.unidade}</small></span><input min="0" max={remaining} step="0.01" type="number" value={receiveValue(pedido, item)} onChange={(event) => updateReceive(pedido.id, item, Number(event.target.value))} /></label>
                  );
                })}
              </div>
              <footer>{data.podeAprovar ? <Button onClick={() => receber(pedido)} disabled={saving}>Registrar recebimento</Button> : <span>Somente o responsável por compras registra o recebimento.</span>}</footer>
            </Card>
          ))}
          {data.pedidos.filter((pedido) => ["enviado", "envio_parcial", "recebimento_parcial", "aguardando_envio"].includes(pedido.status)).length === 0 ? <EmptyState title="Nada aguardando recebimento" description="Pedidos enviados aparecerão aqui para conferência de chegada." /> : null}
        </section>
      ) : null}

      {!loading && tab === "movimentacoes" ? (
        <section className="central-purchases__section">
          <Card className="central-purchases__movement-form">
            <header><strong>Movimentação manual</strong><span>Use para entradas e saídas que não vieram de um pedido aprovado.</span></header>
            <div className="central-purchases__grid">
              <label><span>Insumo</span><select value={movementForm.insumoId} onChange={(event) => setMovementForm((current) => ({ ...current, insumoId: event.target.value }))}><option value="">Selecione</option>{data.estoque.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
              <label><span>Tipo</span><select value={movementForm.tipo} onChange={(event) => setMovementForm((current) => ({ ...current, tipo: event.target.value as "entrada" | "saida" }))}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
              <label><span>Quantidade</span><input min="0.01" step="0.01" type="number" value={movementForm.quantidade} onChange={(event) => setMovementForm((current) => ({ ...current, quantidade: Number(event.target.value) }))} /></label>
              <label><span>Observação</span><input value={movementForm.observacao} onChange={(event) => setMovementForm((current) => ({ ...current, observacao: event.target.value }))} placeholder="Ex.: ajuste de inventário" /></label>
            </div>
            <footer><Button onClick={registrarMovimentacao} disabled={saving || !movementForm.insumoId || movementForm.quantidade <= 0}>Registrar movimentação</Button></footer>
          </Card>
          <div className="central-purchases__movements">
            {movements.map((movement) => <Card key={movement.id}><span><b>{movement.insumoNome}</b><small>{movement.observacao || "Sem observação"}</small></span><span><b>{movementLabel(movement.tipo)}</b><small>{movement.quantidade} {movement.unidade} · {dateLabel(movement.data)}</small></span></Card>)}
            {!movements.length ? <EmptyState title="Nenhuma movimentação registrada" description="Entradas e saídas do estoque aparecerão aqui." /> : null}
          </div>
        </section>
      ) : null}

      {!data.autodisparoAtivo && data.podeAprovar ? (
        <Card className="central-purchases__test-notice">
          <strong>Proteção do ambiente de teste</strong>
          <span>Na V2, aprovar prepara e separa os pedidos por destino sem disparar mensagens reais automaticamente. Use “Enviar agora” somente quando quiser testar um envio real. Na entrada em produção, o autodisparo pode ser habilitado.</span>
        </Card>
      ) : null}
    </main>
  );
}
