"use client";

import type { Insumo } from "../../types";
import { TextInput } from "../ui/TextInput";

type Props = {
  onChange: (dados: Partial<Insumo>) => void;
  produto: Partial<Insumo>;
};

export function ProdutoAbaFichaTecnica({ onChange, produto }: Props) {
  return (
    <section className="drawer-tab">
      <h3>Ficha Tecnica</h3>
      <div className="drawer-form-grid">
        <TextInput
          label="Vinculos de ficha tecnica"
          helperText="Separe codigos ou nomes por virgula."
          value={(produto.fichaTecnicaVinculos || []).join(", ")}
          onChange={(event) =>
            onChange({
              fichaTecnicaVinculos: event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
        />
        <TextInput label="Observacoes da ficha" value={produto.fichaTecnicaObservacoes || ""} onChange={(event) => onChange({ fichaTecnicaObservacoes: event.target.value })} />
      </div>
      {produto.fichaTecnicaIngredientes?.length ? (
        <div className="drawer-list">
          {produto.fichaTecnicaIngredientes.map((item) => (
            <article key={item.insumoId}>
              <span>{item.insumoNome}</span>
              <strong>{item.quantidade} {item.unidade}</strong>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
