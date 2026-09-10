"use client";

import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { SegmentedControl } from "../ui/SegmentedControl";
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

const viewOptions = [
  { label: "Cards", value: "cards" as const },
  { label: "Tabela", value: "tabela" as const },
];

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
    <PageHeader
      eyebrow="Estoque"
      title="Cadastro de insumos"
      description="Cadastre, localize e movimente os insumos da operação em uma única tela."
      actions={
        <>
          <SegmentedControl
            ariaLabel="Modo de visualização do estoque"
            onChange={onModoChange}
            options={viewOptions}
            value={modoVisualizacao}
          />
          <Button variant="ghost" onClick={onEntradaRapida}>Entrada rápida</Button>
          <Button variant="secondary" onClick={onImportarXml}>Importar NF-e</Button>
          <Button variant="primary" onClick={onNovoInsumo}>Novo insumo</Button>
        </>
      }
    >
      <TextInput
        className="estoque-search-field"
        aria-label="Buscar insumos"
        placeholder="Buscar por nome, SKU, marca ou código de barras..."
        value={busca}
        onChange={(event) => onBuscaChange(event.target.value)}
      />
    </PageHeader>
  );
}
