"use client";

import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";

import { db } from "../../lib/firebase";
import type { Historico } from "../../types";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";

type Props = {
  produtoId: string | null;
};

export function ProdutoAbaHistorico({ produtoId }: Props) {
  const [movimentos, setMovimentos] = useState<Historico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!produtoId) {
      setLoading(false);
      return;
    }

    const consulta = query(collection(db, "historico"), where("insumoId", "==", produtoId), orderBy("criadoEm", "desc"));
    return onSnapshot(
      consulta,
      (snapshot) => {
        setMovimentos(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Historico));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [produtoId]);

  if (loading) return <Spinner />;
  if (!produtoId) return <EmptyState title="Selecione um produto" description="Salve o produto primeiro para ver o historico." />;
  if (movimentos.length === 0) return <EmptyState title="Nenhuma movimentacao" description="Este produto ainda nao tem movimentacoes registradas." />;

  return (
    <div className="timeline">
      {movimentos.map((movimento) => (
        <article className="timeline__item" key={movimento.id}>
          <div>
            <strong>{movimento.tipo || "movimento"}</strong>
            <span>{movimento.criadoEm && typeof movimento.criadoEm === "object" && "toDate" in movimento.criadoEm ? (movimento.criadoEm as { toDate: () => Date }).toDate().toLocaleString("pt-BR") : "-"}</span>
          </div>
          <p>{movimento.quantidade} {movimento.unidade || "un"} {movimento.custoTotal ? `- R$ ${movimento.custoTotal.toFixed(2)}` : ""}</p>
          {movimento.observacao ? <small>{movimento.observacao}</small> : null}
        </article>
      ))}
    </div>
  );
}
