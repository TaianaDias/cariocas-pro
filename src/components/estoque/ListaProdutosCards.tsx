"use client";

import { useState } from "react";

import type { Insumo } from "../../types";
import { AcordeaoProduto } from "./AcordeaoProduto";
import { FaixaEstoque } from "./FaixaEstoque";
import { StatusBadge } from "./StatusBadge";

type ListaProdutosCardsProps = {
  insumos: Insumo[];
  onEditar: (id: string) => void;
  onEntrada: (id: string) => void;
  onExcluir: (id: string, nome: string) => void;
  onSaida: (id: string) => void;
};

function getStatus(insumo: Insumo) {
  if (insumo.quantidadeAtual <= insumo.estoqueMinimo) return "critical";
  if (insumo.estoqueMaximo > 0 && insumo.quantidadeAtual <= insumo.estoqueMaximo * 0.5) return "warning";
  return "success";
}

export function ListaProdutosCards({ insumos, onEditar, onEntrada, onExcluir, onSaida }: ListaProdutosCardsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="produtos-grid">
      {insumos.map((insumo) => (
        <article className="produto-card" key={insumo.id}>
          <div style={{ display: "flex", gap: "var(--space-3)", padding: "var(--space-4)" }}>
            <div
              style={{
                alignItems: "center",
                background: "var(--coal-800)",
                borderRadius: "var(--radius-sm)",
                color: "var(--crimson)",
                display: "flex",
                flexShrink: 0,
                fontSize: 20,
                fontWeight: 800,
                height: 56,
                justifyContent: "center",
                overflow: "hidden",
                width: 56,
              }}
            >
              {insumo.imagemUrl ? <img alt={insumo.nome} src={insumo.imagemUrl} style={{ height: "100%", objectFit: "cover", width: "100%" }} /> : insumo.nome?.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{insumo.nome}</strong>
              <div style={{ color: "var(--text-soft)", fontSize: 12, marginTop: 2 }}>
                {insumo.sku || "Sem SKU"} · {insumo.marca || "Sem marca"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                <StatusBadge status={getStatus(insumo)} />
                {insumo.statusProduto === "parado" ? <StatusBadge status="parado" /> : null}
                {insumo.margemEstimada > 0 && insumo.margemEstimada < 30 ? <StatusBadge status="margem_baixa" /> : null}
              </div>
            </div>
          </div>

          <div style={{ padding: "0 var(--space-4) var(--space-3)" }}>
            <FaixaEstoque atual={insumo.quantidadeAtual} maximo={insumo.estoqueMaximo} minimo={insumo.estoqueMinimo} />
          </div>

          <div
            style={{
              color: "var(--text-soft)",
              display: "grid",
              fontSize: 12,
              gap: 4,
              gridTemplateColumns: "1fr 1fr",
              padding: "0 var(--space-4) var(--space-3)",
            }}
          >
            <span>Estoque: {insumo.quantidadeAtual} {insumo.unidadeMedida}</span>
            <span>Minimo: {insumo.estoqueMinimo}</span>
            <span>Custo: R$ {(insumo.custoCompra || 0).toFixed(2)}</span>
            <span>Forn.: {insumo.fornecedores?.length || 0}</span>
          </div>

          <div style={{ borderTop: "1px solid var(--coal-800)", display: "flex" }}>
            <CardAction label="Editar" onClick={() => insumo.id && onEditar(insumo.id)} />
            <CardAction label="Entrada" onClick={() => insumo.id && onEntrada(insumo.id)} />
            <CardAction label="Saida" onClick={() => insumo.id && onSaida(insumo.id)} />
            <CardAction danger label="Excluir" onClick={() => insumo.id && onExcluir(insumo.id, insumo.nome)} />
            <CardAction label={expandedId === insumo.id ? "Menos" : "Mais"} onClick={() => setExpandedId(expandedId === insumo.id ? null : insumo.id || null)} />
          </div>

          {expandedId === insumo.id ? <AcordeaoProduto insumo={insumo} /> : null}
        </article>
      ))}
    </div>
  );
}

function CardAction({ danger = false, label, onClick }: { danger?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`action-btn ${danger ? "action-btn--danger" : ""}`.trim()}
      onClick={onClick}
      style={{ background: "transparent", border: 0, color: danger ? "var(--crimson)" : "var(--text-soft)", cursor: "pointer", flex: 1, padding: 10 }}
    >
      {label}
    </button>
  );
}
