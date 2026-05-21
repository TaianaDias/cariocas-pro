"use client";

import type { Insumo } from "../../types";
import { EmptyState } from "../ui/EmptyState";

type Props = { produto: Insumo | null; produtoId: string | null; onSalvo: () => void };

export function ProdutoAbaFichaTecnica({ produto }: Props) {
  if (!produto?.fichaTecnicaIngredientes?.length) {
    return <EmptyState title="Sem ficha tecnica" description="Nenhuma ficha tecnica vinculada a este insumo." />;
  }

  return (
    <section className="drawer-tab">
      <h3>Ficha Tecnica</h3>
      <div className="drawer-list">
        {produto.fichaTecnicaIngredientes.map((item) => (
          <article key={item.insumoId}>
            <span>{item.insumoNome}</span>
            <strong>{item.quantidade} {item.unidade}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
