"use client";

import type { Insumo } from "../../types";
import { StatusBadge } from "./StatusBadge";

type ListaProdutosTabelaProps = {
  administrative: boolean;
  insumos: Insumo[];
  onEditar: (id: string) => void;
  onExcluir: (id: string, nome: string) => void;
};

export function ListaProdutosTabela({ administrative, insumos, onEditar, onExcluir }: ListaProdutosTabelaProps) {
  return (
    <div className="produto-table-wrap">
      <table className="produto-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>SKU</th>
            <th>Marca</th>
            <th>Estoque</th>
            <th>Mínimo</th>
            {administrative ? <th>Custo</th> : null}
            <th>Status</th>
            {administrative ? <th>Ações</th> : null}
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
                {administrative ? <td>R$ {(insumo.custoCompra || 0).toFixed(2)}</td> : null}
                <td><StatusBadge status={status} /></td>
                {administrative ? (
                  <td>
                    <div className="produto-table-actions">
                      <button type="button" onClick={() => insumo.id && onEditar(insumo.id)}>Editar</button>
                      <button type="button" className="produto-table-actions__danger" onClick={() => insumo.id && onExcluir(insumo.id, insumo.nome)}>Excluir</button>
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
