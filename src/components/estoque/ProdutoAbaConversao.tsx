"use client";

import type { Insumo } from "../../types";
import { TextInput } from "../ui/TextInput";

type Props = {
  onChange: (dados: Partial<Insumo>) => void;
  produto: Partial<Insumo>;
};

function numberValue(value: string) {
  return Number(value.replace(",", ".")) || 0;
}

export function ProdutoAbaConversao({ onChange, produto }: Props) {
  const conversao = produto.conversao || 1;
  const custoUnitario = (produto.custoCompra || 0) / conversao;

  return (
    <section className="drawer-tab">
      <h3>Compra e Conversao</h3>
      <div className="drawer-form-grid">
        <TextInput label="Unidade de compra" value={produto.unidadeCompra || "un"} onChange={(event) => onChange({ unidadeCompra: event.target.value })} />
        <TextInput label="Unidade de uso" value={produto.unidadeUso || "un"} onChange={(event) => onChange({ unidadeUso: event.target.value })} />
        <TextInput label="Conversao" helperText="Ex: caixa com 24 unidades = 24" type="number" min="1" value={produto.conversao ?? 1} onChange={(event) => onChange({ conversao: Math.max(1, numberValue(event.target.value)) })} />
        <TextInput label="Custo de compra" type="number" min="0" step="0.01" value={produto.custoCompra ?? 0} onChange={(event) => onChange({ custoCompra: numberValue(event.target.value) })} />
        <TextInput label="Custo promocional" type="number" min="0" step="0.01" value={produto.custoPromocional ?? ""} onChange={(event) => onChange({ custoPromocional: event.target.value ? numberValue(event.target.value) : undefined })} />
        <TextInput label="Preco de venda" type="number" min="0" step="0.01" value={produto.precoVenda ?? 0} onChange={(event) => onChange({ precoVenda: numberValue(event.target.value) })} />
      </div>
      <div className="drawer-list">
        <article><span>Custo unitario calculado</span><strong>R$ {custoUnitario.toFixed(2)}</strong></article>
      </div>
    </section>
  );
}
