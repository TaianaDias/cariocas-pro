"use client";

import type { Insumo } from "../../types";

type ProdutoImagemProps = {
  produto: Partial<Insumo> | null;
};

function getImagemProduto(produto: Partial<Insumo> | null) {
  return produto?.imagemUrl || produto?.imagemPrincipal || produto?.imagemUploadUrl || produto?.imagemCosmosUrl || "";
}

export function ProdutoImagem({ produto }: ProdutoImagemProps) {
  const inicial = produto?.nome?.charAt(0)?.toUpperCase() || "P";
  const imagem = getImagemProduto(produto);

  return (
    <div className="produto-imagem">
      {imagem ? <img alt={produto?.nome || "Produto"} src={imagem} /> : <span>{inicial}</span>}
    </div>
  );
}
