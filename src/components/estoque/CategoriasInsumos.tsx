"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

import type { Categoria } from "../../types";
import { Button } from "../ui/Button";
import { TextInput } from "../ui/TextInput";

type CategoriasInsumosProps = {
  categoriaAtiva: string;
  categorias: Categoria[];
  onCriarCategoria: (nome: string, cor: string, icone: string) => Promise<void>;
  onOcultarCategoria: (id: string) => Promise<void>;
  onSelect: (id: string) => void;
};

const CORES = ["#DC2626", "#D97706", "#F59E0B", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4", "#6B7280", "#F97316"];

export function CategoriasInsumos({ categoriaAtiva, categorias, onCriarCategoria, onOcultarCategoria, onSelect }: CategoriasInsumosProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [salvando, setSalvando] = useState(false);

  async function handleCriar() {
    if (!nome.trim()) return;
    setSalvando(true);
    await onCriarCategoria(nome.trim(), cor, nome.trim().charAt(0).toUpperCase());
    setNome("");
    setSalvando(false);
    setModalAberto(false);
  }

  return (
    <section className="estoque-categorias-panel">
      <div className="estoque-categorias-panel__header">
        <div>
          <span className="estoque-section-eyebrow">Organização</span>
          <strong>Insumos por categoria</strong>
        </div>
        <Button variant="ghost" onClick={() => setModalAberto(true)}>Nova categoria</Button>
      </div>

      <div className="categorias-scroll" aria-label="Categorias de insumos">
        <button className={`categoria-pill ${categoriaAtiva === "todas" ? "ativa" : ""}`} onClick={() => onSelect("todas")} type="button">
          Todos
        </button>
        {categorias.map((categoria) => {
          const ativa = categoriaAtiva === categoria.id;
          const categoryStyle = { "--category-accent": categoria.cor } as CSSProperties;

          return (
            <span className="categoria-pill-wrap" key={categoria.id || categoria.nome} style={categoryStyle}>
              <button
                className={`categoria-pill ${ativa ? "ativa" : ""}`}
                onClick={() => categoria.id && onSelect(categoria.id)}
                type="button"
              >
                <span className="categoria-pill__dot" aria-hidden="true" />
                <span>{categoria.icone} {categoria.nome}</span>
              </button>
              {categoria.id ? (
                <button className="categoria-remove-btn" onClick={() => onOcultarCategoria(categoria.id!)} title="Ocultar categoria" type="button" aria-label={`Ocultar categoria ${categoria.nome}`}>
                  ×
                </button>
              ) : null}
            </span>
          );
        })}
      </div>

      {modalAberto ? (
        <div className="estoque-mini-modal" role="dialog" aria-modal="true" aria-label="Nova categoria">
          <div className="estoque-mini-modal__content">
            <div>
              <span className="estoque-section-eyebrow">Estoque</span>
              <strong>Nova categoria</strong>
            </div>
            <TextInput label="Nome da categoria" value={nome} onChange={(event) => setNome(event.target.value)} />
            <div className="estoque-color-row" aria-label="Cor da categoria">
              {CORES.map((item) => (
                <button
                  aria-label={`Cor ${item}`}
                  className={cor === item ? "is-selected" : ""}
                  key={item}
                  onClick={() => setCor(item)}
                  style={{ background: item }}
                  type="button"
                />
              ))}
            </div>
            <div className="estoque-mini-modal__actions">
              <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button variant="primary" disabled={salvando || !nome.trim()} onClick={handleCriar}>{salvando ? "Criando..." : "Criar categoria"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
