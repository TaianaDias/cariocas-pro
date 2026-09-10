"use client";

import type { Insumo } from "../../types";

type AcordeaoProdutoProps = {
  administrative?: boolean;
  insumo: Insumo;
};

export function AcordeaoProduto({ administrative = false, insumo }: AcordeaoProdutoProps) {
  const margemSaudavel = insumo.margemEstimada >= 40;

  return (
    <div className="produto-card__details">
      {administrative ? (
        <div>
          <strong>Fornecedores</strong>
          <p>
            {insumo.fornecedores?.length
              ? insumo.fornecedores.map((item) => item.fornecedorNome).join(", ")
              : "Nenhum fornecedor vinculado"}
          </p>
        </div>
      ) : null}

      <div className="produto-card__details-grid">
        {administrative ? <span>Frequência: {insumo.frequenciaPedido || "-"}</span> : null}
        {administrative ? <span>Entrega: {insumo.diasEntrega || 0}d</span> : null}
        <span>Validade: {insumo.validadeOriginal || 0}d</span>
        <span>Local: {insumo.localArmazenamento || "-"}</span>
      </div>

      {administrative && insumo.margemEstimada > 0 ? (
        <span className={`produto-card__margin ${margemSaudavel ? "is-healthy" : "is-low"}`}>
          Margem estimada: {insumo.margemEstimada.toFixed(1)}%
        </span>
      ) : null}
    </div>
  );
}
