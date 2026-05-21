"use client";

import type { Insumo } from "../../types";

type ProdutoImagemProps = {
  produto: Partial<Insumo> | null;
};

export function ProdutoImagem({ produto }: ProdutoImagemProps) {
  const inicial = produto?.nome?.charAt(0)?.toUpperCase() || "P";

  return (
    <div className="produto-imagem">
      {produto?.imagemUrl ? <img alt={produto.nome || "Produto"} src={produto.imagemUrl} /> : <span>{inicial}</span>}
    </div>
  );
}
