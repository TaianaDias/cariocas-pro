import type { Insumo } from "../../../types";

type ProdutoAbaConversaoProps = {
  insumo: Partial<Insumo>;
  onSave: (dados: Partial<Insumo>) => void;
};

export function ProdutoAbaConversao({ insumo, onSave }: ProdutoAbaConversaoProps) {
  const conversao = insumo.conversao || 1;
  const custoUnitario = (insumo.custoCompra || 0) / conversao;

  return (
    <section className="drawer-tab" id="conversao">
      <h3>Conversao</h3>
      <details open>
        <summary>Unidades de compra e consumo</summary>
        <div className="drawer-form-grid">
          <label>
            Unidade de compra
            <input defaultValue={insumo.unidadeCompra ?? ""} onBlur={(event) => onSave({ unidadeCompra: event.target.value })} placeholder="Caixa, pacote, kg" />
          </label>
          <label>
            Unidade de uso
            <input defaultValue={insumo.unidadeUso ?? ""} onBlur={(event) => onSave({ unidadeUso: event.target.value })} placeholder="Unidade de consumo" />
          </label>
          <label>
            Fator de conversao
            <input defaultValue={insumo.conversao ?? 1} onBlur={(event) => onSave({ conversao: Number(event.target.value) || 1 })} placeholder="Ex: 24" />
          </label>
          <label>
            Custo de compra
            <input defaultValue={insumo.custoCompra ?? 0} onBlur={(event) => onSave({ custoCompra: Number(event.target.value) })} placeholder="0,00" />
          </label>
          <label>
            Custo promocional
            <input defaultValue={insumo.custoPromocional ?? ""} onBlur={(event) => onSave({ custoPromocional: Number(event.target.value) || undefined })} placeholder="0,00" />
          </label>
        </div>
      </details>
      <p className="estoque-feedback">Custo unitario previsto: R$ {custoUnitario.toFixed(2)}</p>
    </section>
  );
}
