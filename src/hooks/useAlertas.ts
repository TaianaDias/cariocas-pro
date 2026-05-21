"use client";

import { useEffect, useState } from "react";

import {
  marcarAlertaComoLido,
  ouvirAlertasAtivos,
  resolverAlerta,
  type AlertaReposicao,
} from "../services/alertas.service";

export function useAlertas() {
  const [alertas, setAlertas] = useState<AlertaReposicao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = ouvirAlertasAtivos((items) => {
      setAlertas(items);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const criticos = alertas.filter((alerta) => alerta.nivel === "critical");
  const warnings = alertas.filter((alerta) => alerta.nivel === "warning");
  const contagemNaoLidos = alertas.filter((alerta) => !alerta.lido).length;

  return {
    alertas,
    contagemNaoLidos,
    criticos,
    loading,
    marcarLido: marcarAlertaComoLido,
    resolver: resolverAlerta,
    warnings,
  };
}
