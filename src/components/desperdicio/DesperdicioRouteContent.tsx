"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { isOperationalRole } from "../../lib/access-control";
import type { OperationalStockItem } from "../../lib/operational-stock";
import { DesperdicioPageClient } from "../operacional/OperationalPages";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../ui/PageHeader";
import { Select } from "../ui/Select";
import { TextInput } from "../ui/TextInput";

type OperationalWaste = {
  id: string;
  categoria: string;
  data: string | null;
  insumoId: string;
  insumoNome: string;
  motivo: string;
  quantidade: number;
  responsavel: string;
  unidade: string;
};

const categoryOptions = [
  { label: "Perda no preparo", value: "preparo" },
  { label: "Validade", value: "validade" },
  { label: "Avaria", value: "avaria" },
  { label: "Erro operacional", value: "erro-operacional" },
  { label: "Outro", value: "outro" },
];

function dateLabel(value: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function DesperdicioRouteContent() {
  const { user, userProfile } = useAuth();
  const operational = isOperationalRole(userProfile?.role);

  if (!operational) {
    return <DesperdicioPageClient />;
  }

  return <DesperdicioOperacional />;
}

function DesperdicioOperacional() {
  const { user } = useAuth();
  const [stock, setStock] = useState<OperationalStockItem[]>([]);
  const [items, setItems] = useState<OperationalWaste[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ categoria: "preparo", insumoId: "", motivo: "", quantidade: 1 });

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const headers = { authorization: `Bearer ${token}` };
      const [stockResponse, wasteResponse] = await Promise.all([
        fetch("/api/estoque/operacional", { headers, cache: "no-store" }),
        fetch("/api/desperdicio/operacional", { headers, cache: "no-store" }),
      ]);
      const stockData = (await stockResponse.json().catch(() => ({}))) as { error?: string; items?: OperationalStockItem[] };
      const wasteData = (await wasteResponse.json().catch(() => ({}))) as { error?: string; items?: OperationalWaste[] };

      if (!stockResponse.ok) throw new Error(stockData.error || "Não foi possível carregar os insumos.");
      if (!wasteResponse.ok) throw new Error(wasteData.error || "Não foi possível carregar os desperdícios.");

      setStock(stockData.items || []);
      setItems(wasteData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o desperdício.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const stockOptions = useMemo(
    () => [
      { label: "Selecione um insumo", value: "" },
      ...stock.map((item) => ({
        label: `${item.nome} · ${item.quantidadeAtual} ${item.unidadeMedida}`,
        value: item.id,
      })),
    ],
    [stock],
  );

  const affectedItems = new Set(items.map((item) => item.insumoId).filter(Boolean)).size;
  const totalQuantity = items.reduce((total, item) => total + (Number(item.quantidade) || 0), 0);

  async function salvar() {
    if (!user || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/desperdicio/operacional", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar o desperdício.");

      setForm({ categoria: "preparo", insumoId: "", motivo: "", quantidade: 1 });
      setSuccess("Perda registrada e estoque atualizado.");
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar o desperdício.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="operational-page">
      <PageHeader
        eyebrow="Operação"
        title="Desperdício"
        description="Registre perdas do turno sem expor custos, margens ou informações de fornecedores."
      />

      <section className="operational-kpis" aria-label="Resumo de desperdícios">
        <Card className="operational-kpi"><span>Registros recentes</span><strong>{items.length}</strong></Card>
        <Card className="operational-kpi"><span>Insumos afetados</span><strong>{affectedItems}</strong></Card>
        <Card className="operational-kpi"><span>Quantidade registrada</span><strong>{totalQuantity.toLocaleString("pt-BR")}</strong></Card>
      </section>

      <Card className="operational-action-panel">
        <header>
          <strong>Registrar perda</strong>
          <span>O responsável é identificado automaticamente pela sessão.</span>
        </header>
        <div className="operational-form-grid">
          <Select
            label="Insumo"
            options={stockOptions}
            value={form.insumoId}
            onChange={(event) => setForm((current) => ({ ...current, insumoId: event.target.value }))}
          />
          <TextInput
            label="Quantidade"
            min={0.01}
            step={0.01}
            type="number"
            value={form.quantidade}
            onChange={(event) => setForm((current) => ({ ...current, quantidade: Number(event.target.value) }))}
          />
          <Select
            label="Categoria"
            options={categoryOptions}
            value={form.categoria}
            onChange={(event) => setForm((current) => ({ ...current, categoria: event.target.value }))}
          />
          <TextInput
            label="Motivo"
            placeholder="Ex.: produto caiu durante o preparo"
            value={form.motivo}
            onChange={(event) => setForm((current) => ({ ...current, motivo: event.target.value }))}
          />
        </div>
        {error ? <p>{error}</p> : null}
        {success ? <p className="operational-success">{success}</p> : null}
        <div className="operational-submit">
          <span>O custo financeiro fica disponível somente para a gestão.</span>
          <Button disabled={saving || !form.insumoId || !form.motivo.trim() || form.quantidade <= 0} onClick={salvar}>
            {saving ? "Registrando..." : "Registrar perda"}
          </Button>
        </div>
      </Card>

      {loading ? <Card className="operational-feature"><span>Carregando registros...</span></Card> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhuma perda registrada" description="Os desperdícios informados pela equipe aparecerão aqui." />
      ) : null}
      {!loading && items.length > 0 ? (
        <section className="operational-list">
          {items.map((item) => (
            <Card className="operational-row" key={item.id}>
              <div>
                <strong>{item.insumoNome || "Insumo"}</strong>
                <span>{item.motivo || "Motivo não informado"}</span>
              </div>
              <div>
                <b>{item.quantidade} {item.unidade}</b>
                <small>{item.categoria}</small>
                <small>{dateLabel(item.data)}</small>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}
