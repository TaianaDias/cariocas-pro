"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../ui/PageHeader";

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

type Waste = {
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

function dateLabel(value: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function RelatoriosOperacionais() {
  const { user } = useAuth();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [wastes, setWastes] = useState<Waste[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const headers = { authorization: `Bearer ${token}` };
      const [movementResponse, wasteResponse] = await Promise.all([
        fetch("/api/movimentacoes/operacional", { headers, cache: "no-store" }),
        fetch("/api/desperdicio/operacional", { headers, cache: "no-store" }),
      ]);
      const movementData = (await movementResponse.json().catch(() => ({}))) as { error?: string; items?: Movement[] };
      const wasteData = (await wasteResponse.json().catch(() => ({}))) as { error?: string; items?: Waste[] };

      if (!movementResponse.ok) throw new Error(movementData.error || "Não foi possível carregar as movimentações.");
      if (!wasteResponse.ok) throw new Error(wasteData.error || "Não foi possível carregar os desperdícios.");

      setMovements(movementData.items || []);
      setWastes(wasteData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o relatório operacional.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const entries = useMemo(() => movements.filter((item) => item.tipo.includes("entrada")).length, [movements]);
  const exits = useMemo(() => movements.filter((item) => item.tipo.includes("saida")).length, [movements]);

  function exportCsv() {
    const rows = [
      ["tipo", "insumo", "quantidade", "unidade", "data", "observacao"],
      ...movements.map((item) => [item.tipo, item.insumoNome, item.quantidade, item.unidade, dateLabel(item.data), item.observacao]),
      ...wastes.map((item) => ["desperdicio", item.insumoNome, item.quantidade, item.unidade, dateLabel(item.data), item.motivo]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-operacional-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="operational-page">
      <PageHeader
        eyebrow="Relatórios"
        title="Movimentações operacionais"
        description="Resumo de entradas, saídas e desperdícios sem custos, margens ou fornecedores."
        actions={
          <>
            <Button variant="secondary" onClick={() => window.print()}>Imprimir</Button>
            <Button variant="secondary" disabled={loading || (!movements.length && !wastes.length)} onClick={exportCsv}>Exportar CSV</Button>
            <Button disabled={loading} onClick={carregar}>{loading ? "Atualizando..." : "Atualizar"}</Button>
          </>
        }
      />

      <section className="operational-kpis" aria-label="Resumo do relatório operacional">
        <Card className="operational-kpi"><span>Movimentações</span><strong>{movements.length}</strong></Card>
        <Card className="operational-kpi"><span>Entradas</span><strong>{entries}</strong></Card>
        <Card className="operational-kpi"><span>Saídas</span><strong>{exits}</strong></Card>
        <Card className="operational-kpi"><span>Desperdícios</span><strong>{wastes.length}</strong></Card>
      </section>

      {error ? <EmptyState title="Erro no relatório" description={error} action={<Button onClick={carregar}>Tentar novamente</Button>} /> : null}
      {loading ? <Card className="operational-feature"><span>Carregando relatório...</span></Card> : null}
      {!loading && !error && movements.length === 0 && wastes.length === 0 ? (
        <EmptyState title="Sem movimentações" description="Quando a equipe registrar entradas, saídas ou perdas, elas aparecerão aqui." />
      ) : null}

      {!loading && movements.length > 0 ? (
        <section className="operational-list" aria-label="Movimentações recentes">
          {movements.map((item) => (
            <Card className="operational-row" key={`mov-${item.id}`}>
              <div>
                <strong>{item.insumoNome || "Insumo"}</strong>
                <span>{item.observacao || "Sem observação"}</span>
              </div>
              <div>
                <b>{item.tipo}</b>
                <small>{item.quantidade} {item.unidade}</small>
                <small>{dateLabel(item.data)}</small>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {!loading && wastes.length > 0 ? (
        <section className="operational-list" aria-label="Desperdícios recentes">
          {wastes.map((item) => (
            <Card className="operational-row" key={`waste-${item.id}`}>
              <div>
                <strong>{item.insumoNome || "Insumo"}</strong>
                <span>{item.motivo || "Motivo não informado"}</span>
              </div>
              <div>
                <b>Desperdício</b>
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
