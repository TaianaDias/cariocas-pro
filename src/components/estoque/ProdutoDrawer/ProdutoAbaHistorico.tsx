import { useEffect, useState } from "react";

import { getHistoricoPorInsumo } from "../../../services/historico.service";
import type { Historico } from "../../../types";
import { EmptyState } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";

type ProdutoAbaHistoricoProps = {
  insumoId?: string;
};

export function ProdutoAbaHistorico({ insumoId }: ProdutoAbaHistoricoProps) {
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!insumoId) {
      setHistorico([]);
      return;
    }

    setLoading(true);
    getHistoricoPorInsumo(insumoId)
      .then((dados) => {
        if (mounted) setHistorico(dados);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [insumoId]);

  return (
    <section className="drawer-tab" id="historico">
      <h3>Historico</h3>
      {loading ? (
        <Skeleton lines={3} />
      ) : historico.length === 0 ? (
        <EmptyState title="Nenhuma movimentacao registrada" />
      ) : (
        <div className="drawer-timeline">
          {historico.map((evento) => (
            <article key={evento.id ?? `${evento.insumoId}-${evento.criadoEm}`}>
              <span>{evento.responsavel}</span>
              <strong>
                {evento.quantidade} · {evento.observacao}
              </strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
