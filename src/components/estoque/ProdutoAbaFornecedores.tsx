"use client";

import type { Insumo } from "../../types";
import { TextInput } from "../ui/TextInput";

type Props = {
  onChange: (dados: Partial<Insumo>) => void;
  produto: Partial<Insumo>;
};

function numberValue(value: string) {
  return Number(value.replace(",", ".")) || 0;
}

export function ProdutoAbaFornecedores({ onChange, produto }: Props) {
  return (
    <section className="drawer-tab">
      <h3>Fornecedores e Reposicao</h3>
      <div className="drawer-form-grid">
        <TextInput label="Fornecedor principal" value={produto.fornecedorPrincipal || ""} onChange={(event) => onChange({ fornecedorPrincipal: event.target.value })} />
        <TextInput label="Frequencia de pedido" value={produto.frequenciaPedido || ""} onChange={(event) => onChange({ frequenciaPedido: event.target.value })} />
        <TextInput label="Dias para pedido" type="number" min="0" value={produto.diasPedido ?? 0} onChange={(event) => onChange({ diasPedido: numberValue(event.target.value) })} />
        <TextInput label="Dias de entrega" type="number" min="0" value={produto.diasEntrega ?? 0} onChange={(event) => onChange({ diasEntrega: numberValue(event.target.value) })} />
        <TextInput label="Quantidade padrao por pedido" type="number" min="0" value={produto.quantidadePadraoPedido ?? 0} onChange={(event) => onChange({ quantidadePadraoPedido: numberValue(event.target.value) })} />
      </div>
      {produto.fornecedores?.length ? (
        <div className="drawer-list">
          {produto.fornecedores.map((fornecedor, index) => (
            <article key={`${fornecedor.fornecedorId || fornecedor.fornecedorNome}-${index}`}>
              <span>{fornecedor.fornecedorNome}</span>
              <strong>R$ {(fornecedor.custoUnitario || fornecedor.custo || 0).toFixed(2)}</strong>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
