"use client";

import type { Insumo } from "../../types";
import { TextInput } from "../ui/TextInput";

type Props = {
  onChange: (dados: Partial<Insumo>) => void;
  produto: Partial<Insumo>;
};

export function ProdutoAbaEtiqueta({ onChange, produto }: Props) {
  return (
    <section className="drawer-tab">
      <h3>Etiqueta</h3>
      <div className="etiqueta-preview">
        <span>QR</span>
        <strong>{produto.nome || "Etiqueta do insumo"}</strong>
        <small>{produto.codigoBarras || produto.loteInterno || "Codigo, lote, validade e localizacao"}</small>
      </div>
      <div className="drawer-form-grid">
        <TextInput label="Tipo de etiqueta" value={produto.tipoEtiqueta || ""} onChange={(event) => onChange({ tipoEtiqueta: event.target.value })} />
        <TextInput label="Responsavel pela etiqueta" value={produto.etiquetaResponsavel || ""} onChange={(event) => onChange({ etiquetaResponsavel: event.target.value })} />
        <TextInput label="Observacao da etiqueta" value={produto.etiquetaObservacao || ""} onChange={(event) => onChange({ etiquetaObservacao: event.target.value })} />
      </div>
    </section>
  );
}
