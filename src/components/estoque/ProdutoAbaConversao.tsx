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
  const metodoCusto = produto.metodoCusto || "ultimo_custo_compra";
  const custoUnitario = metodoCusto === "manual_travado" ? Number(produto.custoManualTravado) || 0 : (produto.custoCompra || 0) / conversao;
  const unidadeUso = produto.unidadeUso || "un";

  return (
    <section className="drawer-tab">
      <h3>Conversao para Ficha Tecnica</h3>
      <p className="estoque-feedback">Informe quanto a compra rende na unidade usada nas receitas. Ex: 1 KG de bacon rende 50 FATIAS.</p>
      <div className="drawer-form-grid">
        <label className="field">
          <span className="field__label">Metodo de custo</span>
          <select className="select-input" value={metodoCusto} onChange={(event) => onChange({ metodoCusto: event.target.value as Insumo["metodoCusto"] })}>
            <option value="ultimo_custo_compra">Ultimo custo de compra</option>
            <option value="medio_automatico">Custo medio automatico</option>
            <option value="manual_travado">Manual travado</option>
          </select>
        </label>
        <TextInput label="Unidade de compra" value={produto.unidadeCompra || "un"} onChange={(event) => onChange({ unidadeCompra: event.target.value })} />
        <TextInput label="Unidade usada na receita" value={unidadeUso} onChange={(event) => onChange({ unidadeUso: event.target.value })} />
        <TextInput label="Rendimento da compra" helperText="Ex: 1 KG rende 1000 G, 50 FATIAS ou 20 PORCOES" type="number" min="1" value={produto.conversao ?? 1} onChange={(event) => onChange({ conversao: Math.max(1, numberValue(event.target.value)) })} />
        <TextInput label="Custo de compra" type="number" min="0" step="0.01" value={produto.custoCompra ?? 0} onChange={(event) => onChange({ custoCompra: numberValue(event.target.value) })} />
        {metodoCusto === "manual_travado" ? (
          <TextInput label={`Custo fixo por ${unidadeUso}`} helperText="Ex: alface = R$ 0,25 por folha" type="number" min="0" step="0.01" value={produto.custoManualTravado ?? 0} onChange={(event) => onChange({ custoManualTravado: numberValue(event.target.value) })} />
        ) : null}
        <TextInput label="Custo promocional" type="number" min="0" step="0.01" value={produto.custoPromocional ?? ""} onChange={(event) => onChange({ custoPromocional: event.target.value ? numberValue(event.target.value) : undefined })} />
        <TextInput label="Preco de venda" type="number" min="0" step="0.01" value={produto.precoVenda ?? 0} onChange={(event) => onChange({ precoVenda: numberValue(event.target.value) })} />
      </div>
      <div className="drawer-list">
        <article><span>Custo por {unidadeUso}{metodoCusto === "manual_travado" ? " travado" : ""}</span><strong>R$ {custoUnitario.toFixed(2)}</strong></article>
      </div>
    </section>
  );
}
