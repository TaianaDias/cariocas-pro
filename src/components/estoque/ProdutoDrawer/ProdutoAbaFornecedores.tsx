import { useEffect, useState } from "react";

import { listarProdutosDoFornecedor } from "../../../services/fornecedores.service";
import { EmptyState } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";

type ProdutoAbaFornecedoresProps = {
  fornecedorId?: string;
};

type VinculoFornecedor = {
  id?: string;
  fornecedorNome?: string;
  custoUnitario?: number;
  diasEntrega?: number;
};

export function ProdutoAbaFornecedores({ fornecedorId }: ProdutoAbaFornecedoresProps) {
  const [fornecedores, setFornecedores] = useState<VinculoFornecedor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!fornecedorId) {
      setFornecedores([]);
      return;
    }

    setLoading(true);
    listarProdutosDoFornecedor(fornecedorId)
      .then((dados) => {
        if (mounted) setFornecedores(dados);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [fornecedorId]);

  return (
    <section className="drawer-tab" id="fornecedores">
      <h3>Fornecedores</h3>
      {loading ? (
        <Skeleton lines={3} />
      ) : fornecedores.length === 0 ? (
        <EmptyState title="Nenhum fornecedor vinculado" />
      ) : (
        <div className="drawer-list">
          {fornecedores.map((fornecedor) => (
            <article key={fornecedor.id ?? fornecedor.fornecedorNome}>
              <span>{fornecedor.fornecedorNome ?? "Fornecedor"}</span>
              <strong>
                R$ {(fornecedor.custoUnitario ?? 0).toFixed(2)} · {fornecedor.diasEntrega ?? 0} dias
              </strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
