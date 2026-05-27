"use client";

import type { Insumo } from "../../types";
import { TextInput } from "../ui/TextInput";
import { FaixaEstoque } from "./FaixaEstoque";

type Props = {
  onChange: (dados: Partial<Insumo>) => void;
  produto: Partial<Insumo>;
};

function numberValue(value: string) {
  return Number(value.replace(",", ".")) || 0;
}

export function ProdutoAbaEstoque({ onChange, produto }: Props) {
  return (
    <section className="drawer-tab">
      <h3>Estoque</h3>
      <FaixaEstoque atual={produto.quantidadeAtual || 0} maximo={produto.estoqueMaximo || 0} minimo={produto.estoqueMinimo || 0} />
      <div className="drawer-form-grid">
        <TextInput label="Quantidade atual" type="number" min="0" value={produto.quantidadeAtual ?? 0} onChange={(event) => onChange({ quantidadeAtual: numberValue(event.target.value) })} />
        <TextInput label="Estoque minimo" type="number" min="0" value={produto.estoqueMinimo ?? 0} onChange={(event) => onChange({ estoqueMinimo: numberValue(event.target.value) })} />
        <TextInput label="Estoque maximo" type="number" min="0" value={produto.estoqueMaximo ?? 0} onChange={(event) => onChange({ estoqueMaximo: numberValue(event.target.value) })} />
        <TextInput label="Unidade de medida" value={produto.unidadeMedida || "un"} onChange={(event) => onChange({ unidadeMedida: event.target.value })} />
        <TextInput label="Local de armazenamento" value={produto.localArmazenamento || ""} onChange={(event) => onChange({ localArmazenamento: event.target.value })} />
        <TextInput label="Responsavel" value={produto.responsavel || ""} onChange={(event) => onChange({ responsavel: event.target.value })} />
      </div>
    </section>
  );
}
