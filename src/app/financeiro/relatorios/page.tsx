"use client";

import { useState } from "react";

import { FiltroPeriodo } from "../../../components/financeiro/FiltroPeriodo";
import { FinanceiroHeader } from "../../../components/financeiro/FinanceiroHeader";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Spinner } from "../../../components/ui/Spinner";
import { useRelatorios } from "../../../hooks/useRelatorios";

export default function RelatoriosFinanceirosPage() {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [dataFim, setDataFim] = useState(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59));
  const [gerado, setGerado] = useState(false);
  const { compras, error, gerarRelatorio, loading, produtos, resumo } = useRelatorios();

  function handleGerar() {
    setGerado(true);
    gerarRelatorio(dataInicio, dataFim);
  }

  function exportarCsv() {
    const linhas = [
      ["tipo", "nome", "quantidade", "valor", "observacao"],
      ...compras.map((item) => ["compra", item.fornecedor, String(item.totalPedidos), item.valorTotal.toFixed(2), "pedidos por fornecedor"]),
      ...produtos.map((item) => ["produto", item.nome, String(item.quantidadeComprada), item.valorTotal.toFixed(2), item.sku || ""]),
      ...(resumo ? [
        ["resumo", "custo_compras", "", resumo.custoCompras.toFixed(2), ""],
        ["resumo", "custo_desperdicio", "", resumo.custoDesperdicio.toFixed(2), ""],
        ["resumo", "movimentacoes", String(resumo.totalMovimentacoes), "", ""],
      ] : []),
    ];
    const csv = linhas.map((linha) => linha.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-cariocas-pro-${dataInicio.toISOString().slice(0, 10)}-${dataFim.toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="financeiro-page">
      <FinanceiroHeader />

      <section className="financeiro-report-toolbar">
        <FiltroPeriodo dataFim={dataFim} dataInicio={dataInicio} onChangeFim={setDataFim} onChangeInicio={setDataInicio} />
        <Button disabled={loading} onClick={handleGerar}>
          {loading ? "Gerando..." : "Gerar Relatorio"}
        </Button>
        <Button disabled={!gerado || loading || !resumo} variant="secondary" onClick={exportarCsv}>
          Exportar CSV
        </Button>
      </section>

      {loading ? <Spinner /> : null}
      {error ? <EmptyState title="Erro no relatorio" description={error} /> : null}

      {!loading && !error && !gerado ? (
        <EmptyState title="Selecione o periodo" description="Clique em gerar relatorio para visualizar os dados financeiros." />
      ) : null}

      {!loading && !error && gerado && resumo ? (
        <>
          <section className="financeiro-kpi-grid">
            <ResumoCard label="Custo em Compras" value={`R$ ${resumo.custoCompras.toFixed(2)}`} />
            <ResumoCard label="Custo em Desperdicio" value={`R$ ${resumo.custoDesperdicio.toFixed(2)}`} />
            <ResumoCard label="Movimentacoes" value={String(resumo.totalMovimentacoes)} />
            <ResumoCard label="Fornecedores" value={String(resumo.topFornecedores.length)} />
          </section>

          <section className="financeiro-grid financeiro-grid--summary">
            <Card className="financeiro-card financeiro-list-card">
              <strong>Top Fornecedores</strong>
              {resumo.topFornecedores.length ? (
                resumo.topFornecedores.map((item) => <ListaLinha key={item.nome} label={item.nome} value={`${item.total} pedidos`} />)
              ) : (
                <p>Nenhuma compra no periodo.</p>
              )}
            </Card>

            <Card className="financeiro-card financeiro-list-card">
              <strong>Top Insumos Movimentados</strong>
              {resumo.topInsumos.length ? (
                resumo.topInsumos.map((item) => <ListaLinha key={item.nome} label={item.nome} value={`${item.total} un`} />)
              ) : (
                <p>Nenhuma movimentacao no periodo.</p>
              )}
            </Card>
          </section>

          <section className="financeiro-grid financeiro-grid--summary">
            <Card className="financeiro-card financeiro-list-card">
              <strong>Compras por Fornecedor</strong>
              {compras.length ? (
                compras.map((item) => (
                  <ListaLinha key={item.fornecedor} label={item.fornecedor} value={`R$ ${item.valorTotal.toFixed(2)} - ${item.totalPedidos} pedidos`} />
                ))
              ) : (
                <p>Nenhuma compra encontrada.</p>
              )}
            </Card>

            <Card className="financeiro-card financeiro-list-card">
              <strong>Produtos por Entrada</strong>
              {produtos.length ? (
                produtos.slice(0, 10).map((item) => (
                  <ListaLinha key={`${item.nome}-${item.sku}`} label={item.nome} value={`${item.quantidadeComprada} un - R$ ${item.valorTotal.toFixed(2)}`} />
                ))
              ) : (
                <p>Nenhuma entrada encontrada.</p>
              )}
            </Card>
          </section>
        </>
      ) : null}
    </main>
  );
}

function ResumoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="financeiro-mini-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}

function ListaLinha({ label, value }: { label: string; value: string }) {
  return (
    <div className="financeiro-list-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
