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

function getImagemProduto(insumo: Insumo) {
  return insumo.imagemUrl || insumo.imagemPrincipal || insumo.imagemUploadUrl || insumo.imagemCosmosUrl || "";
}

export function ListaProdutosCards({ insumos, onEditar, onEntrada, onExcluir, onSaida }: ListaProdutosCardsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  function toggleExpanded(id?: string) {
    setExpandedId(expandedId === id ? null : id || null);
  }

  function closeActionMenu() {
    setActionMenuId(null);
  }

  return (
    <div className="produtos-grid">
      {insumos.map((insumo) => {
        const id = insumo.id || "";
        const actionMenuOpen = actionMenuId === id;
        const imagem = getImagemProduto(insumo);

        return (
          <article className="produto-card produto-card--mobile-ready" key={id || insumo.nome}>
            <div className="produto-card__top produto-card__top--with-menu">
              <div className="produto-avatar">
                {imagem ? <img alt={insumo.nome} src={imagem} /> : insumo.nome?.charAt(0)}
              </div>

              <div className="produto-card__identity">
                <strong>{insumo.nome}</strong>
                <small>{insumo.sku || "Sem SKU"} - {insumo.marca || "Sem marca"}</small>
                <div className="produto-card__badges">
                  <StatusBadge status={getStatus(insumo)} />
                  {insumo.statusProduto === "parado" ? <StatusBadge status="parado" /> : null}
                  {insumo.margemEstimada > 0 && insumo.margemEstimada < 30 ? <StatusBadge status="margem_baixa" /> : null}
                </div>
              </div>

              <div className="produto-card__mobile-menu">
                <button
                  type="button"
                  aria-label={`Abrir acoes de ${insumo.nome}`}
                  aria-expanded={actionMenuOpen}
                  onClick={() => setActionMenuId(actionMenuOpen ? null : id)}
                >
                  ...
                </button>
                {actionMenuOpen ? (
                  <div className="produto-card__mobile-actions">
                    <button type="button" onClick={() => { closeActionMenu(); id && onEditar(id); }}>Editar</button>
                    <button type="button" onClick={() => { closeActionMenu(); id && onEntrada(id); }}>Entrada</button>
                    <button type="button" onClick={() => { closeActionMenu(); id && onSaida(id); }}>Saida</button>
                    <button type="button" onClick={() => { closeActionMenu(); toggleExpanded(id); }}>{expandedId === id ? "Menos detalhes" : "Mais detalhes"}</button>
                    <button className="is-danger" type="button" onClick={() => { closeActionMenu(); id && onExcluir(id, insumo.nome); }}>Excluir</button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="produto-card__stock">
              <FaixaEstoque atual={insumo.quantidadeAtual} maximo={insumo.estoqueMaximo} minimo={insumo.estoqueMinimo} />
            </div>

            <div className="produto-card__metrics">
              <span>Estoque: {insumo.quantidadeAtual} {insumo.unidadeMedida}</span>
              <span>Minimo: {insumo.estoqueMinimo}</span>
              <span>Custo: R$ {(insumo.custoCompra || 0).toFixed(2)}</span>
              <span>Forn.: {insumo.fornecedores?.length || 0}</span>
            </div>

            <div className="produto-card__desktop-actions">
              <CardAction label="Editar" onClick={() => id && onEditar(id)} />
              <CardAction label="Entrada" onClick={() => id && onEntrada(id)} />
              <CardAction label="Saida" onClick={() => id && onSaida(id)} />
              <CardAction danger label="Excluir" onClick={() => id && onExcluir(id, insumo.nome)} />
              <CardAction label={expandedId === id ? "Menos" : "Mais"} onClick={() => toggleExpanded(id)} />
            </div>

            {expandedId === id ? <AcordeaoProduto insumo={insumo} /> : null}
          </article>
        );
      })}
    </div>
  );
}

function CardAction({ danger = false, label, onClick }: { danger?: boolean; label: string; onClick: () => void }) {
  return (
    <button className={`action-btn ${danger ? "action-btn--danger" : ""}`.trim()} onClick={onClick}>
      {label}
    </button>
  );
}
