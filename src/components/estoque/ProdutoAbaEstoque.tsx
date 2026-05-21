"use client";

import type { Insumo } from "../../types";
import { FaixaEstoque } from "./FaixaEstoque";

type Props = { produto: Insumo | null; produtoId: string | null; onSalvo: () => void };

export function ProdutoAbaEstoque({ produto }: Props) {
  return (
    <section className="drawer-tab">
      <h3>Estoque</h3>
      <FaixaEstoque atual={produto?.quantidadeAtual || 0} maximo={produto?.estoqueMaximo || 0} minimo={produto?.estoqueMinimo || 0} />
      <div className="drawer-list">
        <article><span>Atual</span><strong>{produto?.quantidadeAtual || 0} {produto?.unidadeMedida || "un"}</strong></article>
        <article><span>Minimo</span><strong>{produto?.estoqueMinimo || 0}</strong></article>
        <article><span>Local</span><strong>{produto?.localArmazenamento || "-"}</strong></article>
      </div>
    </section>
  );
}
