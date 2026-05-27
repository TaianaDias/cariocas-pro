"use client";

import type { Insumo } from "../../types";
import { Select } from "../ui/Select";
import { TextInput } from "../ui/TextInput";
import { ProdutoImagem } from "./ProdutoImagem";

type ProdutoAbaDadosGeraisProps = {
  onChange: (dados: Partial<Insumo>) => void;
  produto: Partial<Insumo>;
};

export function ProdutoAbaDadosGerais({ onChange, produto }: ProdutoAbaDadosGeraisProps) {
  return (
    <section className="drawer-tab">
      <ProdutoImagem produto={produto} />
      <div className="drawer-form-grid">
        <TextInput label="Nome" value={produto.nome || ""} onChange={(event) => onChange({ nome: event.target.value })} />
        <TextInput label="SKU" value={produto.sku || ""} onChange={(event) => onChange({ sku: event.target.value })} />
        <TextInput label="Marca" value={produto.marca || ""} onChange={(event) => onChange({ marca: event.target.value })} />
        <TextInput label="Codigo de barras" value={produto.codigoBarras || ""} onChange={(event) => onChange({ codigoBarras: event.target.value })} />
        <TextInput label="Categoria" value={produto.categoriaId || ""} onChange={(event) => onChange({ categoriaId: event.target.value })} />
        <TextInput label="Codigo interno" value={produto.codigoInterno || ""} onChange={(event) => onChange({ codigoInterno: event.target.value })} />
        <Select
          label="Status"
          value={produto.statusProduto || "ativo"}
          onChange={(event) => onChange({ statusProduto: event.target.value as Insumo["statusProduto"] })}
          options={[
            { label: "Ativo", value: "ativo" },
            { label: "Pausado", value: "pausado" },
            { label: "Sem ficha", value: "sem_ficha" },
            { label: "Parado", value: "parado" },
          ]}
        />
        <TextInput label="Observacao" value={produto.observacao || ""} onChange={(event) => onChange({ observacao: event.target.value })} />
      </div>
    </section>
  );
}
