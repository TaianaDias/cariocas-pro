"use client";

import type { Insumo } from "../../types";

type AcordeaoProdutoProps = {
  insumo: Insumo;
  showFinancial?: boolean;
};

export function AcordeaoProduto({ insumo, showFinancial = false }: AcordeaoProdutoProps) {
  const margemSaudavel = insumo.margemEstimada >= 40;

  return (
    <div className="produto-card__details">
      <div>
        <strong>Fornecedores</strong>
        <p>
          {insumo.fornecedores?.length
            ? insumo.fornecedores.map((item) => item.fornecedorNome).join(", ")
            : "Nenhum fornecedor vinculado"}
        </p>
      </div>

      <div className="produto-card__details-grid">
        <span>Frequência: {insumo.frequenciaPedido || "-"}</span>
        <span>Entrega: {insumo.diasEntrega || 0}d</span>
        <span>Validade: {insumo.validadeOriginal || 0}d</span>
        <span>Local: {insumo.localArmazenamento || "-"}</span>
      </div>

      {showFinancial && insumo.margemEstimada > 0 ? (
        <span className={`produto-card__margin ${margemSaudavel ? "is-healthy" : "is-low"}`}>
          Margem estimada: {insumo.margemEstimada.toFixed(1)}%
        </span>
      ) : null}
    </div>
  );
}
