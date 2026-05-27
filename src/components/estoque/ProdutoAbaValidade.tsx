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

export function ProdutoAbaValidade({ onChange, produto }: Props) {
  return (
    <section className="drawer-tab">
      <h3>Validade</h3>
      <div className="drawer-form-grid">
        <TextInput label="Validade original em dias" type="number" min="0" value={produto.validadeOriginal ?? 0} onChange={(event) => onChange({ validadeOriginal: numberValue(event.target.value) })} />
        <TextInput label="Apos aberto em dias" type="number" min="0" value={produto.validadeAposAberto ?? 0} onChange={(event) => onChange({ validadeAposAberto: numberValue(event.target.value) })} />
        <TextInput label="Apos producao em dias" type="number" min="0" value={produto.validadeAposProducao ?? 0} onChange={(event) => onChange({ validadeAposProducao: numberValue(event.target.value) })} />
        <TextInput label="Lote interno" value={produto.loteInterno || ""} onChange={(event) => onChange({ loteInterno: event.target.value })} />
      </div>
    </section>
  );
}
