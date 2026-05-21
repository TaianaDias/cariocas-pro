import type { Insumo } from "../../../types";

type ProdutoAbaValidadeProps = {
  insumo: Partial<Insumo>;
  onSave: (dados: Partial<Insumo>) => void;
};

export function ProdutoAbaValidade({ insumo, onSave }: ProdutoAbaValidadeProps) {
  return (
    <section className="drawer-tab" id="validade">
      <h3>Validade</h3>
      <div className="drawer-form-grid">
        <label>
          Validade padrao
          <input defaultValue={insumo.validadeOriginal ?? 0} onBlur={(event) => onSave({ validadeOriginal: Number(event.target.value) })} placeholder="Dias" />
        </label>
        <label>
          Validade apos aberto
          <input defaultValue={insumo.validadeAposAberto ?? 0} onBlur={(event) => onSave({ validadeAposAberto: Number(event.target.value) })} placeholder="Dias" />
        </label>
        <label>
          Validade apos producao
          <input defaultValue={insumo.validadeAposProducao ?? 0} onBlur={(event) => onSave({ validadeAposProducao: Number(event.target.value) })} placeholder="Dias" />
        </label>
        <label>
          Lote atual
          <input defaultValue={insumo.loteInterno ?? ""} onBlur={(event) => onSave({ loteInterno: event.target.value })} placeholder="Lote de entrada" />
        </label>
      </div>
    </section>
  );
}
