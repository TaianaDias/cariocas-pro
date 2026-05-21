"use client";

import type { Insumo } from "../../types";

type AcordeaoProdutoProps = {
  insumo: Insumo;
};

export function AcordeaoProduto({ insumo }: AcordeaoProdutoProps) {
  return (
    <div
      style={{
        background: "var(--coal-800)",
        borderTop: "1px solid var(--coal-700)",
        color: "var(--text-base)",
        display: "grid",
        fontSize: 13,
        gap: "var(--space-3)",
        padding: "var(--space-4)",
      }}
    >
      <div>
        <strong>Fornecedores</strong>
        <div style={{ color: "var(--text-soft)", marginTop: 4 }}>
          {insumo.fornecedores?.length
            ? insumo.fornecedores.map((item) => item.fornecedorNome).join(", ")
            : "Nenhum fornecedor vinculado"}
        </div>
      </div>
      <div style={{ display: "grid", gap: "var(--space-2)", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <span>Frequencia: {insumo.frequenciaPedido || "-"}</span>
        <span>Entrega: {insumo.diasEntrega || 0}d</span>
        <span>Validade: {insumo.validadeOriginal || 0}d</span>
        <span>Local: {insumo.localArmazenamento || "-"}</span>
      </div>
      {insumo.margemEstimada > 0 ? (
        <span style={{ color: insumo.margemEstimada >= 40 ? "var(--green-success)" : "var(--crimson)", fontWeight: 700 }}>
          Margem estimada: {insumo.margemEstimada.toFixed(1)}%
        </span>
      ) : null}
    </div>
  );
}
