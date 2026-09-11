"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { isOperationalRole } from "../../lib/access-control";
import type { OperationalStockItem } from "../../lib/operational-stock";
import { ComprasPageClient } from "../operacional/OperationalPages";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../ui/PageHeader";
import { Select } from "../ui/Select";
import { TextInput } from "../ui/TextInput";

type OperationalMovement = {
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

const movementOptions = [
  { label: "Entrada", value: "entrada" },
  { label: "Saída", value: "saida" },
];

function dateLabel(value: string | null) {
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
  return "Movimentação";
}

export function ComprasRouteContent() {
  const { userProfile } = useAuth();
  if (!isOperationalRole(userProfile?.role)) return <ComprasPageClient />;
  return <MovimentacoesOperacionais />;
}

function MovimentacoesOperacionais() {
  const { user } = useAuth();
  const [stock, setStock] = useState<OperationalStockItem[]>([]);
  const [movements, setMovements] = useState<OperationalMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ insumoId: "", observacao: "", quantidade: 1, tipo: "entrada" as "entrada" | "saida" });

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const headers = { authorization: `Bearer ${token}` };
      const [stockResponse, movementsResponse] = await Promise.all([
        fetch("/api/estoque/operacional", { headers, cache: "no-store" }),
        fetch("/api/movimentacoes/operacional", { headers, cache: "no-store" }),
      ]);
      const stockData = (await stockResponse.json().catch(() => ({}))) as { error?: string; items?: OperationalStockItem[] };
      const movementData = (await movementsResponse.json().catch(() => ({}))) as { error?: string; items?: OperationalMovement[] };

      if (!stockResponse.ok) throw new Error(stockData.error || "Não foi possível carregar os insumos.");
      if (!movementsResponse.ok) throw new Error(movementData.error || "Não foi possível carregar as movimentações.");

      setStock(stockData.items || []);
      setMovements(movementData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as movimentações.");
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

  const selected = stock.find((item) => item.id === form.insumoId);
  const belowMinimum = stock.filter((item) => item.estoqueMinimo > 0 && item.quantidadeAtual <= item.estoqueMinimo).length;
  const today = new Date().toISOString().slice(0, 10);
  const movementsToday = movements.filter((item) => item.data?.slice(0, 10) === today).length;

  async function salvar() {
    if (!user || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/estoque/operacional", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar a movimentação.");

      setForm({ insumoId: "", observacao: "", quantidade: 1, tipo: "entrada" });
      setSuccess("Movimentação registrada e estoque atualizado.");
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a movimentação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="operational-page">
      <PageHeader
        eyebrow="Operação"
        title="Compras / Movimentações"
        description="Registre entradas e saídas do estoque. Custos, fornecedores e pedidos financeiros ficam restritos à gestão."
      />

      <section className="operational-kpis" aria-label="Resumo de movimentações">
        <Card className="operational-kpi"><span>Insumos</span><strong>{stock.length}</strong></Card>
        <Card className="operational-kpi"><span>Abaixo do mínimo</span><strong>{belowMinimum}</strong></Card>
        <Card className="operational-kpi"><span>Movimentações hoje</span><strong>{movementsToday}</strong></Card>
      </section>

      <Card className="operational-action-panel">
        <header>
          <strong>Nova movimentação</strong>
          <span>O usuário responsável é registrado automaticamente.</span>
        </header>
        <div className="operational-form-grid">
          <Select
            label="Insumo"
            options={stockOptions}
            value={form.insumoId}
            onChange={(event) => setForm((current) => ({ ...current, insumoId: event.target.value }))}
          />
          <Select
            label="Tipo"
            options={movementOptions}
            value={form.tipo}
            onChange={(event) => setForm((current) => ({ ...current, tipo: event.target.value as "entrada" | "saida" }))}
          />
          <TextInput
            label="Quantidade"
            min={0.01}
            step={0.01}
            type="number"
            value={form.quantidade}
            onChange={(event) => setForm((current) => ({ ...current, quantidade: Number(event.target.value) }))}
          />
          <TextInput
            label="Observação"
            placeholder="Ex.: recebimento do turno"
            value={form.observacao}
            onChange={(event) => setForm((current) => ({ ...current, observacao: event.target.value }))}
          />
        </div>
        {selected ? (
          <div className="operational-feature">
            <strong>{selected.nome}</strong>
            <span>Estoque atual: {selected.quantidadeAtual} {selected.unidadeMedida}</span>
            <span>Mínimo: {selected.estoqueMinimo} · Máximo: {selected.estoqueMaximo || "não definido"}</span>
            <span>Local: {selected.localArmazenamento || "não informado"}</span>
          </div>
        ) : null}
        {error ? <p>{error}</p> : null}
        {success ? <p className="operational-success">{success}</p> : null}
        <div className="operational-submit">
          <span>Nenhum custo é exibido ou enviado ao navegador da equipe.</span>
          <Button disabled={saving || !form.insumoId || form.quantidade <= 0} onClick={salvar}>
            {saving ? "Registrando..." : "Registrar movimentação"}
          </Button>
        </div>
      </Card>

      {loading ? <Card className="operational-feature"><span>Carregando movimentações...</span></Card> : null}
      {!loading && !error && movements.length === 0 ? (
        <EmptyState title="Nenhuma movimentação registrada" description="As entradas e saídas da operação aparecerão aqui." />
      ) : null}
      {!loading && movements.length > 0 ? (
        <section className="operational-list">
          {movements.map((item) => (
            <Card className="operational-row" key={item.id}>
              <div>
                <strong>{item.insumoNome || "Insumo"}</strong>
                <span>{item.observacao || "Sem observação"}</span>
              </div>
              <div>
                <b>{movementLabel(item.tipo)}</b>
                <small>{item.quantidade} {item.unidade}</small>
                <small>{dateLabel(item.data)}</small>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}
