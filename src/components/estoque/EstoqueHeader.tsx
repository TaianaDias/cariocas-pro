"use client";

import { Button } from "../ui/Button";
import { TextInput } from "../ui/TextInput";

type EstoqueHeaderProps = {
  busca: string;
  modoVisualizacao: "cards" | "tabela";
  onBuscaChange: (value: string) => void;
  onEntradaRapida: () => void;
  onImportarXml: () => void;
  onModoChange: (modo: "cards" | "tabela") => void;
  onNovoInsumo: () => void;
};

export function EstoqueHeader({
  busca,
  modoVisualizacao,
  onBuscaChange,
  onEntradaRapida,
  onImportarXml,
  onModoChange,
  onNovoInsumo,
}: EstoqueHeaderProps) {
  return (
    <header className="estoque-module-header">
      <div className="estoque-module-header__top">
        <h1>Cadastro de Insumos</h1>
        <div className="estoque-module-header__actions">
          <ToggleViewButton modo={modoVisualizacao} onChange={onModoChange} />
          <Button variant="ghost" onClick={onEntradaRapida}>Entrada Rapida</Button>
          <Button variant="secondary" onClick={onImportarXml}>Importar NF-e</Button>
          <Button variant="primary" onClick={onNovoInsumo}>Novo Insumo</Button>
        </div>
      </div>
      <TextInput
        placeholder="Buscar por nome, SKU, marca ou codigo de barras..."
        value={busca}
        onChange={(event) => onBuscaChange(event.target.value)}
        style={{ maxWidth: 520 }}
      />
    </header>
  );
}

function ToggleViewButton({ modo, onChange }: { modo: "cards" | "tabela"; onChange: (modo: "cards" | "tabela") => void }) {
  return (
    <div className="estoque-toggle-view">
      <button className={modo === "cards" ? "active" : ""} onClick={() => onChange("cards")} type="button">Cards</button>
      <button className={modo === "tabela" ? "active" : ""} onClick={() => onChange("tabela")} type="button">Tabela</button>
    </div>
  );
}
