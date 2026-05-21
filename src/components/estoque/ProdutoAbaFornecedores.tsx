"use client";

import type { Insumo } from "../../types";
import { EmptyState } from "../ui/EmptyState";
import { FornecedorProdutoRow } from "./FornecedorProdutoRow";

type Props = { produto: Insumo | null; produtoId: string | null; onSalvo: () => void };

export function ProdutoAbaFornecedores({ produto }: Props) {
  if (!produto?.fornecedores?.length) {
    return <EmptyState title="Nenhum fornecedor vinculado" description="Inclua fornecedores na proxima etapa do cadastro." />;
  }

  return (
    <section className="drawer-tab">
      <h3>Fornecedores</h3>
      <div className="drawer-list">
        {produto.fornecedores.map((fornecedor, index) => (
          <FornecedorProdutoRow fornecedor={fornecedor} key={`${fornecedor.fornecedorId || fornecedor.fornecedorNome}-${index}`} />
        ))}
      </div>
    </section>
  );
}
