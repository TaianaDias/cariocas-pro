"use client";

import type { FornecedorVinculo } from "../../types";
import { StatusBadge } from "./StatusBadge";

type FornecedorProdutoRowProps = {
  fornecedor: FornecedorVinculo;
};

export function FornecedorProdutoRow({ fornecedor }: FornecedorProdutoRowProps) {
  return (
    <article className="fornecedor-produto-row">
      <div>
        <strong>{fornecedor.fornecedorNome}</strong>
        <span>{fornecedor.cnpjFornecedor || "Sem CNPJ"}</span>
      </div>
      <span>R$ {(fornecedor.custoUnitario || fornecedor.custo || 0).toFixed(2)}</span>
      {fornecedor.principal ? <StatusBadge status="ativo" /> : null}
    </article>
  );
}
