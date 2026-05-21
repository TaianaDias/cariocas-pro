"use client";

import type { AlertaReposicao } from "../../services/alertas.service";

type CardAlertaProps = {
  alerta: AlertaReposicao;
  onMarcarLido: (id: string) => void;
  onResolver: (id: string) => void;
};

export function CardAlerta({ alerta, onMarcarLido, onResolver }: CardAlertaProps) {
  const nivelCor = alerta.nivel === "critical" ? "var(--crimson)" : "var(--yellow-warn)";
  const nivelLabel = alerta.nivel === "critical" ? "Critico" : "Aviso";

  return (
    <article
      className="alerta-card"
      style={{
        borderLeftColor: nivelCor,
        opacity: alerta.lido ? 0.72 : 1,
      }}
    >
      <header className="alerta-card__header">
        <strong>{alerta.insumoNome || "Alerta"}</strong>
        <span style={{ color: nivelCor }}>{nivelLabel}</span>
      </header>

      <p>{alerta.mensagem}</p>

      <div className="alerta-card__metrics">
        <span>Estoque: <strong>{alerta.estoqueAtual ?? "-"}</strong></span>
        <span>Minimo: <strong>{alerta.estoqueMinimo ?? "-"}</strong></span>
        <span>Consumo: <strong>{alerta.consumoDiario ?? 0}/dia</strong></span>
        <span>Cobertura: <strong>{alerta.diasCobertura ?? "-"}d</strong></span>
        <span>Sugerido: <strong>{alerta.qtdSugerida ?? 0}</strong></span>
        <span>Custo: <strong>R$ {(alerta.custoEstimado ?? 0).toFixed(2)}</strong></span>
      </div>

      {alerta.melhorFornecedor ? (
        <small>Fornecedor: {alerta.melhorFornecedor.fornecedorNome}</small>
      ) : null}

      <footer className="alerta-card__actions">
        {alerta.linkWhatsApp ? (
          <a href={alerta.linkWhatsApp} target="_blank" rel="noopener noreferrer">
            Pedir via WhatsApp
          </a>
        ) : null}
        {!alerta.lido && alerta.id ? <button type="button" onClick={() => onMarcarLido(alerta.id!)}>OK</button> : null}
        {!alerta.resolvido && alerta.id ? <button type="button" onClick={() => onResolver(alerta.id!)}>Resolver</button> : null}
      </footer>
    </article>
  );
}
