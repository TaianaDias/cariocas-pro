"use client";

import type { Insumo } from "../../types";

type Props = { produto: Insumo | null; produtoId: string | null; onSalvo: () => void };

export function ProdutoAbaConversao({ produto }: Props) {
  const conversao = produto?.conversao || 1;
  const custoUnitario = (produto?.custoCompra || 0) / conversao;

  return (
    <section className="drawer-tab">
      <h3>Compra e Conversao</h3>
      <div className="drawer-list">
        <article><span>Unidade compra</span><strong>{produto?.unidadeCompra || "un"}</strong></article>
        <article><span>Unidade uso</span><strong>{produto?.unidadeUso || "un"}</strong></article>
        <article><span>Conversao</span><strong>{conversao}</strong></article>
        <article><span>Custo unitario</span><strong>R$ {custoUnitario.toFixed(2)}</strong></article>
      </div>
    </section>
  );
}
