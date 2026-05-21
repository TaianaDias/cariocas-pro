"use client";

import type { Insumo } from "../../types";
import { StatusBadge } from "./StatusBadge";

type ListaProdutosTabelaProps = {
  insumos: Insumo[];
  onEditar: (id: string) => void;
};

export function ListaProdutosTabela({ insumos, onEditar }: ListaProdutosTabelaProps) {
  return (
    <div className="produto-table-wrap">
      <table className="produto-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>SKU</th>
            <th>Marca</th>
            <th>Estoque</th>
            <th>Minimo</th>
            <th>Custo</th>
            <th>Status</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {insumos.map((insumo) => {
            const status = insumo.quantidadeAtual <= insumo.estoqueMinimo ? "critical" : "success";
            return (
              <tr key={insumo.id}>
                <td>{insumo.nome}</td>
                <td>{insumo.sku || "-"}</td>
                <td>{insumo.marca || "-"}</td>
                <td>{insumo.quantidadeAtual} {insumo.unidadeMedida}</td>
                <td>{insumo.estoqueMinimo}</td>
                <td>R$ {(insumo.custoCompra || 0).toFixed(2)}</td>
                <td><StatusBadge status={status} /></td>
                <td><button type="button" onClick={() => insumo.id && onEditar(insumo.id)}>Editar</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
