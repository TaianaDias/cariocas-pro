import type { Insumo } from "../../../types";

type ProdutoAbaEstoqueProps = {
  insumo: Partial<Insumo>;
  onSave: (dados: Partial<Insumo>) => void;
};

export function ProdutoAbaEstoque({ insumo, onSave }: ProdutoAbaEstoqueProps) {
  return (
    <section className="drawer-tab" id="estoque">
      <h3>Estoque</h3>
      <div className="drawer-form-grid">
        <label>
          Saldo atual
          <input defaultValue={insumo.quantidadeAtual ?? 0} onBlur={(event) => onSave({ quantidadeAtual: Number(event.target.value) })} placeholder="0,00" />
        </label>
        <label>
          Estoque minimo
          <input defaultValue={insumo.estoqueMinimo ?? 0} onBlur={(event) => onSave({ estoqueMinimo: Number(event.target.value) })} placeholder="0,00" />
        </label>
        <label>
          Estoque maximo
          <input defaultValue={insumo.estoqueMaximo ?? 0} onBlur={(event) => onSave({ estoqueMaximo: Number(event.target.value) })} placeholder="0,00" />
        </label>
        <label>
          Localizacao
          <input defaultValue={insumo.localArmazenamento ?? ""} onBlur={(event) => onSave({ localArmazenamento: event.target.value })} placeholder="Camara fria, prateleira..." />
        </label>
        <label>
          Unidade de medida
          <input defaultValue={insumo.unidadeMedida ?? ""} onBlur={(event) => onSave({ unidadeMedida: event.target.value })} placeholder="kg, un, lt" />
        </label>
      </div>
    </section>
  );
}
