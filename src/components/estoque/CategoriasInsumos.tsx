"use client";

import { useState } from "react";

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
        <strong>Insumos por Categoria</strong>
        <Button variant="ghost" onClick={() => setModalAberto(true)}>Nova Categoria</Button>
      </div>

      <div className="categorias-scroll">
        <button className={`categoria-pill ${categoriaAtiva === "todas" ? "ativa" : ""}`} onClick={() => onSelect("todas")} type="button">
          Todos
        </button>
        {categorias.map((categoria) => (
          <span className="categoria-pill-wrap" key={categoria.id || categoria.nome}>
            <button
              className={`categoria-pill ${categoriaAtiva === categoria.id ? "ativa" : ""}`}
              onClick={() => categoria.id && onSelect(categoria.id)}
              style={{ background: categoriaAtiva === categoria.id ? categoria.cor : undefined }}
              type="button"
            >
              {categoria.icone} {categoria.nome}
            </button>
            {categoria.id ? (
              <button className="categoria-remove-btn" onClick={() => onOcultarCategoria(categoria.id!)} title="Ocultar categoria" type="button">
                x
              </button>
            ) : null}
          </span>
        ))}
      </div>

      {modalAberto ? (
        <div className="estoque-mini-modal">
          <div className="estoque-mini-modal__content">
            <strong>Nova Categoria</strong>
            <TextInput label="Nome da categoria" value={nome} onChange={(event) => setNome(event.target.value)} />
            <div className="estoque-color-row">
              {CORES.map((item) => (
                <button
                  aria-label={`Cor ${item}`}
                  key={item}
                  onClick={() => setCor(item)}
                  style={{ background: item, borderColor: cor === item ? "#fff" : "transparent" }}
                  type="button"
                />
              ))}
            </div>
            <div className="estoque-mini-modal__actions">
              <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button variant="primary" disabled={salvando || !nome.trim()} onClick={handleCriar}>{salvando ? "Criando..." : "Criar"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
