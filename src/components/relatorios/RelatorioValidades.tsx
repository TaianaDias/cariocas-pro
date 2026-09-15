"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../hooks/useAuth";

type StatusValidade = "ativo" | "consumido" | "descartado";
type FiltroValidade = "ativos" | "vencidos" | "3dias" | "7dias" | "30dias" | "regulares" | "encerrados" | "todos";

type InsumoValidade = {
  id: string;
  nome: string;
  unidade: string;
  loteInterno: string;
  quantidadeAtual: number;
  validadeOriginal: number;
  validadeAposAberto: number;
  validadeAposProducao: number;
};

type RegistroValidade = {
  id: string;
  insumoId: string;
  insumoNome: string;
  lote: string;
  dataValidade: string | null;
  quantidade: number;
  unidade: string;
  observacao: string;
  status: StatusValidade;
  criadoPorNome: string;
  criadoEm: string | null;
  atualizadoEm: string | null;
};

function diasAteValidade(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const validade = new Date(value);
  if (Number.isNaN(validade.getTime())) return Number.POSITIVE_INFINITY;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.ceil((validade.getTime() - hoje.getTime()) / 86_400_000);
}

function formatDate(value: string | null) {
  if (!value) return "Não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informada";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(date);
}

function faixaValidade(registro: RegistroValidade) {
  if (registro.status !== "ativo") return { label: registro.status === "consumido" ? "Consumido" : "Descartado", tone: "closed" };
  const dias = diasAteValidade(registro.dataValidade);
  if (dias < 0) return { label: `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`, tone: "expired" };
  if (dias === 0) return { label: "Vence hoje", tone: "critical" };
  if (dias <= 3) return { label: `Vence em ${dias} dia${dias === 1 ? "" : "s"}`, tone: "critical" };
  if (dias <= 7) return { label: `Vence em ${dias} dias`, tone: "warning" };
  if (dias <= 30) return { label: `Vence em ${dias} dias`, tone: "attention" };
  return { label: `${dias} dias restantes`, tone: "ok" };
}

export function RelatorioValidades() {
  const { user, userProfile } = useAuth();
  const [registros, setRegistros] = useState<RegistroValidade[]>([]);
  const [insumos, setInsumos] = useState<InsumoValidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filtro, setFiltro] = useState<FiltroValidade>("ativos");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState({
    insumoId: "",
    lote: "",
    dataValidade: "",
    quantidade: 0,
    observacao: "",
  });

  const carregar = useCallback(async () => {
    if (!user || !userProfile?.empresaId || !userProfile?.lojaId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/relatorios/validades", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        validades?: RegistroValidade[];
        insumos?: InsumoValidade[];
      };
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as validades.");
      setRegistros(Array.isArray(data.validades) ? data.validades : []);
      setInsumos(Array.isArray(data.insumos) ? data.insumos : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as validades.");
    } finally {
      setLoading(false);
    }
  }, [user, userProfile?.empresaId, userProfile?.lojaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ativos = registros.filter((item) => item.status === "ativo");
  const vencidos = ativos.filter((item) => diasAteValidade(item.dataValidade) < 0).length;
  const vence3 = ativos.filter((item) => {
    const dias = diasAteValidade(item.dataValidade);
    return dias >= 0 && dias <= 3;
  }).length;
  const vence7 = ativos.filter((item) => {
    const dias = diasAteValidade(item.dataValidade);
    return dias > 3 && dias <= 7;
  }).length;

  const registrosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return registros.filter((registro) => {
      const dias = diasAteValidade(registro.dataValidade);
      let incluiFaixa = true;
      if (filtro === "ativos") incluiFaixa = registro.status === "ativo";
      if (filtro === "vencidos") incluiFaixa = registro.status === "ativo" && dias < 0;
      if (filtro === "3dias") incluiFaixa = registro.status === "ativo" && dias >= 0 && dias <= 3;
      if (filtro === "7dias") incluiFaixa = registro.status === "ativo" && dias >= 0 && dias <= 7;
      if (filtro === "30dias") incluiFaixa = registro.status === "ativo" && dias >= 0 && dias <= 30;
      if (filtro === "regulares") incluiFaixa = registro.status === "ativo" && dias > 30;
      if (filtro === "encerrados") incluiFaixa = registro.status !== "ativo";
      if (!incluiFaixa) return false;
      if (!termo) return true;
      return `${registro.insumoNome} ${registro.lote} ${registro.observacao}`.toLocaleLowerCase("pt-BR").includes(termo);
    });
  }, [busca, filtro, registros]);

  function selecionarInsumo(insumoId: string) {
    const insumo = insumos.find((item) => item.id === insumoId);
    setForm((current) => ({
      ...current,
      insumoId,
      lote: insumo?.loteInterno || current.lote,
      quantidade: insumo ? Math.max(0, insumo.quantidadeAtual) : current.quantidade,
    }));
  }

  async function registrar() {
    if (!user || saving) return;
    if (!form.insumoId) {
      setError("Selecione um insumo.");
      return;
    }
    if (!form.dataValidade) {
      setError("Informe a data de validade.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/relatorios/validades", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar a validade.");
      setForm({ insumoId: "", lote: "", dataValidade: "", quantidade: 0, observacao: "" });
      setFormOpen(false);
      setSuccess("Validade registrada com sucesso.");
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a validade.");
    } finally {
      setSaving(false);
    }
  }

  async function encerrar(id: string, status: "consumido" | "descartado") {
    if (!user || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/relatorios/validades", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível encerrar a validade.");
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível encerrar a validade.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="validity-page">
      <header className="validity-hero">
        <div>
          <span>Relatórios</span>
          <h1>Validades</h1>
          <p>Acompanhe lotes vencidos e próximos do vencimento e registre a validade real dos itens da loja.</p>
        </div>
        <button className="validity-primary" type="button" onClick={() => setFormOpen((value) => !value)}>
          {formOpen ? "Fechar cadastro" : "+ Registrar validade"}
        </button>
      </header>

      <section className="validity-kpis" aria-label="Resumo de validades">
        <article className="validity-kpi--danger"><span>Vencidos</span><strong>{vencidos}</strong></article>
        <article className="validity-kpi--critical"><span>Até 3 dias</span><strong>{vence3}</strong></article>
        <article className="validity-kpi--warning"><span>De 4 a 7 dias</span><strong>{vence7}</strong></article>
        <article><span>Registros ativos</span><strong>{ativos.length}</strong></article>
      </section>

      {formOpen ? (
        <section className="validity-form-panel">
          <header>
            <strong>Registrar validade do lote</strong>
            <span>Use a data real da embalagem ou da produção. As regras em dias do cadastro do insumo continuam como referência.</span>
          </header>
          <div className="validity-form-grid">
            <label className="validity-wide">
              <span>Insumo</span>
              <select value={form.insumoId} onChange={(event) => selecionarInsumo(event.target.value)}>
                <option value="">Selecione um insumo</option>
                {insumos.map((insumo) => <option key={insumo.id} value={insumo.id}>{insumo.nome}</option>)}
              </select>
            </label>
            <label>
              <span>Lote</span>
              <input value={form.lote} onChange={(event) => setForm((current) => ({ ...current, lote: event.target.value }))} placeholder="Ex.: L240915" />
            </label>
            <label>
              <span>Data de validade</span>
              <input type="date" value={form.dataValidade} onChange={(event) => setForm((current) => ({ ...current, dataValidade: event.target.value }))} />
            </label>
            <label>
              <span>Quantidade vinculada</span>
              <input type="number" min="0" step="0.01" value={form.quantidade} onChange={(event) => setForm((current) => ({ ...current, quantidade: Number(event.target.value) }))} />
            </label>
            <label className="validity-wide">
              <span>Observação</span>
              <textarea rows={2} value={form.observacao} onChange={(event) => setForm((current) => ({ ...current, observacao: event.target.value }))} placeholder="Ex.: caixa aberta, prateleira superior" />
            </label>
          </div>

          {form.insumoId ? (() => {
            const insumo = insumos.find((item) => item.id === form.insumoId);
            if (!insumo) return null;
            return (
              <div className="validity-reference">
                <strong>Referência cadastrada</strong>
                <span>Original: {insumo.validadeOriginal || 0} dias</span>
                <span>Após aberto: {insumo.validadeAposAberto || 0} dias</span>
                <span>Após produção: {insumo.validadeAposProducao || 0} dias</span>
              </div>
            );
          })() : null}

          <footer>
            <span>O registro fica vinculado à empresa, loja, insumo e usuário responsável.</span>
            <button className="validity-primary" type="button" disabled={saving || !form.insumoId || !form.dataValidade} onClick={() => void registrar()}>
              {saving ? "Salvando..." : "Salvar validade"}
            </button>
          </footer>
        </section>
      ) : null}

      {error ? <div className="validity-message validity-message--error" role="alert">{error}</div> : null}
      {success ? <div className="validity-message validity-message--success">{success}</div> : null}

      <section className="validity-toolbar">
        <label className="validity-search">
          <span>Buscar</span>
          <input type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Insumo, lote ou observação" />
        </label>
        <label>
          <span>Faixa</span>
          <select value={filtro} onChange={(event) => setFiltro(event.target.value as FiltroValidade)}>
            <option value="ativos">Todos os ativos</option>
            <option value="vencidos">Vencidos</option>
            <option value="3dias">Vence em até 3 dias</option>
            <option value="7dias">Vence em até 7 dias</option>
            <option value="30dias">Vence em até 30 dias</option>
            <option value="regulares">Acima de 30 dias</option>
            <option value="encerrados">Consumidos / descartados</option>
            <option value="todos">Todos os registros</option>
          </select>
        </label>
      </section>

      {loading ? <div className="validity-empty">Carregando validades...</div> : null}
      {!loading && registrosFiltrados.length === 0 ? (
        <div className="validity-empty">
          <strong>Nenhuma validade encontrada nesta faixa.</strong>
          <span>Registre o primeiro lote para iniciar o acompanhamento.</span>
        </div>
      ) : null}

      {!loading && registrosFiltrados.length ? (
        <section className="validity-list">
          {registrosFiltrados.map((registro) => {
            const faixa = faixaValidade(registro);
            return (
              <article className={`validity-card validity-card--${faixa.tone}`} key={registro.id}>
                <header>
                  <div>
                    <span className={`validity-badge validity-badge--${faixa.tone}`}>{faixa.label}</span>
                    <h2>{registro.insumoNome}</h2>
                    <p>{registro.lote ? `Lote ${registro.lote}` : "Lote não informado"}</p>
                  </div>
                  <div className="validity-date">
                    <small>Validade</small>
                    <strong>{formatDate(registro.dataValidade)}</strong>
                  </div>
                </header>

                <div className="validity-card-meta">
                  <span><small>Quantidade</small><strong>{registro.quantidade || 0} {registro.unidade}</strong></span>
                  <span><small>Registrado por</small><strong>{registro.criadoPorNome}</strong></span>
                  <span><small>Registro</small><strong>{formatDate(registro.criadoEm)}</strong></span>
                </div>

                {registro.observacao ? <p className="validity-note">{registro.observacao}</p> : null}

                {registro.status === "ativo" ? (
                  <footer>
                    <button type="button" disabled={saving} onClick={() => void encerrar(registro.id, "consumido")}>Marcar como consumido</button>
                    <button className="validity-danger" type="button" disabled={saving} onClick={() => void encerrar(registro.id, "descartado")}>Marcar como descartado</button>
                  </footer>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
