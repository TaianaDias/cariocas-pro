"use client";

import { useState } from "react";

import { useAlertas } from "../../hooks/useAlertas";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import { CardAlerta } from "./CardAlerta";

type PainelAlertasProps = {
  aberto: boolean;
  onFechar: () => void;
};

type Filtro = "todos" | "critical" | "warning";

export function PainelAlertas({ aberto, onFechar }: PainelAlertasProps) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const { alertas, criticos, loading, marcarLido, resolver, warnings } = useAlertas();

  if (!aberto) return null;

  const filtrados = filtro === "todos" ? alertas : alertas.filter((alerta) => alerta.nivel === filtro);

  async function handleResolver(id: string) {
    await resolver(id, "admin", "Resolvido via painel");
  }

  return (
    <aside className="alertas-panel">
      <header className="alertas-panel__header">
        <div>
          <strong>Alertas</strong>
          <span>{criticos.length} criticos · {warnings.length} avisos</span>
        </div>
        <button type="button" onClick={onFechar}>Fechar</button>
      </header>

      <div className="alertas-panel__filters">
        {[
          { key: "todos", label: "Todos" },
          { key: "critical", label: "Criticos" },
          { key: "warning", label: "Avisos" },
        ].map((item) => (
          <button
            className={filtro === item.key ? "active" : ""}
            key={item.key}
            onClick={() => setFiltro(item.key as Filtro)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="alertas-panel__body">
        {loading ? (
          <Spinner />
        ) : filtrados.length === 0 ? (
          <EmptyState title="Tudo em dia" description="Nenhum alerta pendente no momento." />
        ) : (
          filtrados.map((alerta) => (
            <CardAlerta key={alerta.id} alerta={alerta} onMarcarLido={marcarLido} onResolver={handleResolver} />
          ))
        )}
      </div>
    </aside>
  );
}
