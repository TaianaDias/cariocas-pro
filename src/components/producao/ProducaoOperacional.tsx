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
  codigoBarras: string;
  marca: string;
  nome: string;
  quantidadeAtual: number;
  status: string;
  unidadeCompra: string;
  unidadeMedida: string;
};

type Portion = {
  id: string;
  area: string;
  criadoEm: string | null;
  formatoPorcao: string;
  insumoId: string;
  insumoNome: string;
  insumoPorcionadoId: string;
  insumoPorcionadoNome: string;
  observacao: string;
  porcoesDisponiveis: number;
  porcoesGeradas: number;
  quantidadeBaixada: number;
  quantidadePorPorcao: number;
  responsavel: string;
  status: string;
  unidade: string;
  unidadePorcao: string;
};

type Recipe = {
  id: string;
  codigo: string;
  ingredientes: Array<{ insumoId: string; insumoNome: string; quantidade: number; unidade: string }>;
  modoPreparo: string;
  nome: string;
  rendimento: number;
  unidade: string;
};

type ProductionOrder = {
  id: string;
  dataFim: string | null;
  dataInicio: string | null;
  dataProgramada: string | null;
  fichaTecnicaId: string;
  fichaTecnicaNome: string;
  observacao: string;
  quantidadeProduzir: number;
  quantidadeProduzida: number;
  responsavel: string;
};

type ProductionPayload = {
  error?: string;
  estoque?: StockItem[];
  fichas?: Recipe[];
  ordens?: ProductionOrder[];
  porcoes?: Portion[];
};

function dateLabel(value: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function ProducaoOperacional() {
  const { user } = useAuth();
  const [estoque, setEstoque] = useState<StockItem[]>([]);
  const [fichas, setFichas] = useState<Recipe[]>([]);
  const [ordens, setOrdens] = useState<ProductionOrder[]>([]);
  const [porcoes, setPorcoes] = useState<Portion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    area: "producao",
    formatoPorcao: "pacote",
    insumoId: "",
    insumoPorcionadoId: "",
    observacao: "",
    porcoes: 1,
    quantidade: 1,
    quantidadePorPorcao: 1,
  });

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/producao/operacional", {
        cache: "no-store",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => ({}))) as ProductionPayload;
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar a produção.");

      setEstoque(data.estoque || []);
      setFichas(data.fichas || []);
      setOrdens(data.ordens || []);
      setPorcoes(data.porcoes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a produção.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const totalPorcoes = useMemo(
    () => porcoes.reduce((total, item) => total + (Number(item.porcoesDisponiveis) || 0), 0),
    [porcoes],
  );
  const selected = estoque.find((item) => item.id === form.insumoId);

  async function salvarPorcao() {
    if (!user || !form.insumoId) {
      setFormError("Selecione o item que será porcionado.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/producao/operacional", {
        body: JSON.stringify(form),
        headers: {
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar o porcionamento.");

      setForm({
        area: "producao",
        formatoPorcao: "pacote",
        insumoId: "",
        insumoPorcionadoId: "",
        observacao: "",
        porcoes: 1,
        quantidade: 1,
        quantidadePorPorcao: 1,
      });
      setFormOpen(false);
      await carregar();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível registrar o porcionamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="operational-page">
      <PageHeader
        eyebrow="Produção"
        title="Produção operacional"
        description="Porcione itens, acompanhe saldos e consulte fichas sem visualizar custos, margens ou preços."
        actions={<Button onClick={() => setFormOpen((current) => !current)}>{formOpen ? "Fechar" : "Porcionar estoque"}</Button>}
      />

      <section className="operational-kpis" aria-label="Resumo da produção">
        <Card className="operational-kpi"><span>Itens disponíveis</span><strong>{estoque.length}</strong></Card>
        <Card className="operational-kpi"><span>Porções prontas</span><strong>{totalPorcoes}</strong></Card>
        <Card className="operational-kpi"><span>Fichas liberadas</span><strong>{fichas.length}</strong></Card>
        <Card className="operational-kpi"><span>Ordens</span><strong>{ordens.length}</strong></Card>
      </section>

      {formOpen ? (
        <Card className="operational-action-panel">
          <header>
            <strong>Porcionar item do estoque</strong>
            <button type="button" onClick={() => setFormOpen(false)}>Fechar</button>
          </header>
          <div className="operational-form-grid">
            <label className="operational-field">
              <span>Item bruto</span>
              <select value={form.insumoId} onChange={(event) => setForm((current) => ({ ...current, insumoId: event.target.value }))}>
                <option value="">Selecione um item</option>
                {estoque.map((item) => <option key={item.id} value={item.id}>{item.nome} — {item.quantidadeAtual} {item.unidadeMedida}</option>)}
              </select>
            </label>
            <label className="operational-field">
              <span>Item porcionado no estoque</span>
              <select value={form.insumoPorcionadoId} onChange={(event) => setForm((current) => ({ ...current, insumoPorcionadoId: event.target.value }))}>
                <option value="">Não gerar outro item</option>
                {estoque.filter((item) => item.id !== form.insumoId).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            <label className="operational-field">
              <span>Quantidade a baixar</span>
              <input min="0.001" step="any" type="number" value={form.quantidade} onChange={(event) => setForm((current) => ({ ...current, quantidade: Number(event.target.value) }))} />
            </label>
            <label className="operational-field">
              <span>Número de porções</span>
              <input min="1" step="1" type="number" value={form.porcoes} onChange={(event) => setForm((current) => ({ ...current, porcoes: Number(event.target.value) }))} />
            </label>
            <label className="operational-field">
              <span>Quantidade por porção</span>
              <input min="0" step="any" type="number" value={form.quantidadePorPorcao} onChange={(event) => setForm((current) => ({ ...current, quantidadePorPorcao: Number(event.target.value) }))} />
            </label>
            <label className="operational-field">
              <span>Formato</span>
              <select value={form.formatoPorcao} onChange={(event) => setForm((current) => ({ ...current, formatoPorcao: event.target.value }))}>
                <option value="pacote">Pacote</option>
                <option value="bisnaga">Bisnaga</option>
                <option value="pote">Pote</option>
                <option value="saco">Saco</option>
                <option value="unidade">Unidade</option>
                <option value="porcao">Porção</option>
              </select>
            </label>
            <label className="operational-field">
              <span>Área</span>
              <input value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} />
            </label>
            <label className="operational-field">
              <span>Observação</span>
              <input value={form.observacao} onChange={(event) => setForm((current) => ({ ...current, observacao: event.target.value }))} />
            </label>
          </div>

          {selected ? (
            <Card className="operational-row">
              <div>
                <strong>{selected.nome}</strong>
                <span>Disponível: {selected.quantidadeAtual} {selected.unidadeMedida}</span>
              </div>
              <div>
                <Badge tone="warning">prévia</Badge>
                <small>Depois da baixa: {Math.max(0, selected.quantidadeAtual - Number(form.quantidade || 0))} {selected.unidadeMedida}</small>
              </div>
            </Card>
          ) : null}

          {formError ? <p>{formError}</p> : null}
          <div className="operational-submit">
            <Button disabled={saving} onClick={salvarPorcao}>{saving ? "Registrando..." : "Registrar porcionamento"}</Button>
          </div>
        </Card>
      ) : null}

      {error ? <EmptyState title="Erro na produção" description={error} action={<Button onClick={carregar}>Tentar novamente</Button>} /> : null}
      {loading ? <Card className="operational-feature"><span>Carregando produção...</span></Card> : null}

      {!loading && !error && porcoes.length > 0 ? (
        <section className="operational-list" aria-label="Porções disponíveis">
          {porcoes.map((porcao) => (
            <Card className="operational-row" key={porcao.id}>
              <div>
                <strong>{porcao.insumoNome}</strong>
                {porcao.insumoPorcionadoNome ? <span>Gerou estoque em: {porcao.insumoPorcionadoNome}</span> : null}
                <span>{porcao.porcoesDisponiveis}/{porcao.porcoesGeradas} {porcao.formatoPorcao} disponíveis em {porcao.area}</span>
              </div>
              <div>
                <Badge tone="success">{porcao.formatoPorcao}</Badge>
                <small>Baixado: {porcao.quantidadeBaixada} {porcao.unidade}</small>
                <small>{porcao.quantidadePorPorcao} {porcao.unidadePorcao} por porção</small>
                <small>{dateLabel(porcao.criadoEm)}</small>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {!loading && !error && fichas.length > 0 ? (
        <section className="operational-list" aria-label="Fichas técnicas operacionais">
          {fichas.map((ficha) => (
            <Card className="operational-row" key={ficha.id}>
              <div>
                <strong>{ficha.nome}</strong>
                <span>{ficha.rendimento} {ficha.unidade} · {ficha.codigo || "sem código"}</span>
                {ficha.modoPreparo ? <small>{ficha.modoPreparo}</small> : null}
              </div>
              <div>
                <Badge tone="success">ficha</Badge>
                <small>{ficha.ingredientes.length} ingredientes</small>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {!loading && !error && ordens.length > 0 ? (
        <section className="operational-list" aria-label="Ordens de produção">
          {ordens.map((ordem) => (
            <Card className="operational-row" key={ordem.id}>
              <div>
                <strong>{ordem.fichaTecnicaNome || "Ordem de produção"}</strong>
                <span>Programada: {dateLabel(ordem.dataProgramada)}</span>
              </div>
              <div>
                <Badge tone={ordem.quantidadeProduzida >= ordem.quantidadeProduzir ? "success" : "warning"}>ordem</Badge>
                <small>{ordem.quantidadeProduzida}/{ordem.quantidadeProduzir}</small>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {!loading && !error && estoque.length === 0 && porcoes.length === 0 && fichas.length === 0 && ordens.length === 0 ? (
        <EmptyState title="Nenhuma produção disponível" description="Quando houver estoque, porções ou fichas liberadas para esta loja, elas aparecerão aqui." />
      ) : null}
    </div>
  );
}
