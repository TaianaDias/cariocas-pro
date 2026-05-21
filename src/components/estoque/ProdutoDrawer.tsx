"use client";

import { useState } from "react";

import { useProduto } from "../../hooks/useProduto";
import { Button } from "../ui/Button";
import { Drawer } from "../ui/Drawer";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import { ProdutoAbaConversao } from "./ProdutoAbaConversao";
import { ProdutoAbaDadosGerais } from "./ProdutoAbaDadosGerais";
import { ProdutoAbaEstoque } from "./ProdutoAbaEstoque";
import { ProdutoAbaEtiqueta } from "./ProdutoAbaEtiqueta";
import { ProdutoAbaFichaTecnica } from "./ProdutoAbaFichaTecnica";
import { ProdutoAbaFornecedores } from "./ProdutoAbaFornecedores";
import { ProdutoAbaHistorico } from "./ProdutoAbaHistorico";
import { ProdutoAbaValidade } from "./ProdutoAbaValidade";

type ProdutoDrawerProps = {
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
  produtoId: string | null;
};

const ABAS = [
  { id: "dados", label: "Dados Gerais" },
  { id: "estoque", label: "Estoque" },
  { id: "conversao", label: "Compra e Conversao" },
  { id: "validade", label: "Validade" },
  { id: "fornecedores", label: "Fornecedores" },
  { id: "etiqueta", label: "Etiqueta" },
  { id: "ficha", label: "Ficha Tecnica" },
  { id: "historico", label: "Historico" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

export function ProdutoDrawer({ aberto, onFechar, onSalvo, produtoId }: ProdutoDrawerProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaId>("dados");
  const [salvando, setSalvando] = useState(false);
  const { error, loading, produto } = useProduto(aberto ? produtoId : null);
  const isNovo = !produtoId;

  return (
    <Drawer
      open={aberto}
      title={isNovo ? "Novo Insumo" : produto?.nome || "Editar Insumo"}
      footer={
        <div className="estoque-row-actions">
          <Button variant="ghost" onClick={onFechar}>Fechar</Button>
        </div>
      }
    >
      {loading ? <Spinner /> : null}
      {error ? <EmptyState title="Erro ao carregar produto" description={error} /> : null}

      {!loading && !error ? (
        <div className="produto-drawer-module">
          <nav className="produto-abas">
            {ABAS.map((aba) => (
              <button className={abaAtiva === aba.id ? "active" : ""} key={aba.id} onClick={() => setAbaAtiva(aba.id)} type="button">
                {aba.label}
              </button>
            ))}
          </nav>

          <div className="produto-aba-content">
            {abaAtiva === "dados" ? <ProdutoAbaDadosGerais produto={produto} produtoId={produtoId} onSalvo={onSalvo} salvando={salvando} setSalvando={setSalvando} /> : null}
            {abaAtiva === "estoque" ? <ProdutoAbaEstoque produto={produto} produtoId={produtoId} onSalvo={onSalvo} /> : null}
            {abaAtiva === "conversao" ? <ProdutoAbaConversao produto={produto} produtoId={produtoId} onSalvo={onSalvo} /> : null}
            {abaAtiva === "validade" ? <ProdutoAbaValidade produto={produto} produtoId={produtoId} onSalvo={onSalvo} /> : null}
            {abaAtiva === "fornecedores" ? <ProdutoAbaFornecedores produto={produto} produtoId={produtoId} onSalvo={onSalvo} /> : null}
            {abaAtiva === "etiqueta" ? <ProdutoAbaEtiqueta produto={produto} produtoId={produtoId} onSalvo={onSalvo} /> : null}
            {abaAtiva === "ficha" ? <ProdutoAbaFichaTecnica produto={produto} produtoId={produtoId} onSalvo={onSalvo} /> : null}
            {abaAtiva === "historico" ? <ProdutoAbaHistorico produtoId={produtoId} /> : null}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
