"use client";

import type { Insumo } from "../../types";
import { Button } from "../ui/Button";

type Props = { produto: Insumo | null; produtoId: string | null; onSalvo: () => void };

export function ProdutoAbaEtiqueta({ produto }: Props) {
  return (
    <section className="drawer-tab">
      <h3>Etiqueta</h3>
      <div className="etiqueta-preview">
        <span>QR</span>
        <strong>{produto?.nome || "Etiqueta do insumo"}</strong>
        <small>{produto?.codigoBarras || "Codigo, lote, validade e localizacao"}</small>
      </div>
      <Button variant="secondary">Gerar etiqueta</Button>
    </section>
  );
}
