import type { Insumo } from "../../../types";

type ProdutoAbaDadosProps = {
  insumo: Partial<Insumo>;
  onSave: (dados: Partial<Insumo>) => void;
};

export function ProdutoAbaDados({ insumo, onSave }: ProdutoAbaDadosProps) {
  return (
    <section className="drawer-tab" id="dados">
      <h3>Dados</h3>
      <div className="drawer-form-grid">
        <label>
          Nome do insumo
          <input defaultValue={insumo.nome ?? ""} onBlur={(event) => onSave({ nome: event.target.value })} placeholder="Nome do insumo" />
        </label>
        <label>
          Categoria
          <input defaultValue={insumo.categoriaId ?? ""} onBlur={(event) => onSave({ categoriaId: event.target.value })} placeholder="Categoria" />
        </label>
        <label>
          Marca
          <input defaultValue={insumo.marca ?? ""} onBlur={(event) => onSave({ marca: event.target.value })} placeholder="Marca" />
        </label>
        <label>
          SKU
          <input defaultValue={insumo.sku ?? ""} onBlur={(event) => onSave({ sku: event.target.value })} placeholder="SKU" />
        </label>
        <label>
          Codigo de barras
          <input defaultValue={insumo.codigoBarras ?? ""} onBlur={(event) => onSave({ codigoBarras: event.target.value })} placeholder="Codigo de barras" />
        </label>
        <label>
          Status
          <select defaultValue={insumo.status ?? "ativo"} onChange={(event) => onSave({ status: event.target.value })}>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="critico">Critico</option>
          </select>
        </label>
      </div>
    </section>
  );
}
