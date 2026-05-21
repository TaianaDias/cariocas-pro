"use client";

import type { Insumo } from "../../types";

type Props = { produto: Insumo | null; produtoId: string | null; onSalvo: () => void };

export function ProdutoAbaValidade({ produto }: Props) {
  return (
    <section className="drawer-tab">
      <h3>Validade</h3>
      <div className="drawer-list">
        <article><span>Original</span><strong>{produto?.validadeOriginal || 0} dias</strong></article>
        <article><span>Apos aberto</span><strong>{produto?.validadeAposAberto || 0} dias</strong></article>
        <article><span>Apos producao</span><strong>{produto?.validadeAposProducao || 0} dias</strong></article>
        <article><span>Lote</span><strong>{produto?.loteInterno || "-"}</strong></article>
      </div>
    </section>
  );
}
