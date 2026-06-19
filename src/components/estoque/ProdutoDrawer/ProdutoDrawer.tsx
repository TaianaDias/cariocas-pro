"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../hooks/useAuth";
import { atualizarInsumo, criarInsumo, getInsumo } from "../../../services/estoque.service";
import type { Insumo } from "../../../types";
import { EmptyState } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";
import { ProdutoAbaConversao } from "./ProdutoAbaConversao";
import { ProdutoAbaDados } from "./ProdutoAbaDados";
import { ProdutoAbaEstoque } from "./ProdutoAbaEstoque";
import { ProdutoAbaEtiqueta } from "./ProdutoAbaEtiqueta";
import { ProdutoAbaFichaTecnica } from "./ProdutoAbaFichaTecnica";
import { ProdutoAbaFornecedores } from "./ProdutoAbaFornecedores";
import { ProdutoAbaHistorico } from "./ProdutoAbaHistorico";
import { ProdutoAbaValidade } from "./ProdutoAbaValidade";

const tabs = [
  { label: "Dados", href: "#dados" },
  { label: "Estoque", href: "#estoque" },
  { label: "Conversao", href: "#conversao" },
  { label: "Validade", href: "#validade" },
  { label: "Fornecedores", href: "#fornecedores" },
  { label: "Etiqueta", href: "#etiqueta" },
  { label: "Ficha Tecnica", href: "#ficha-tecnica" },
  { label: "Historico", href: "#historico" },
];

type ProdutoDrawerProps = {
  insumoId: string | null;
  onClose: () => void;
  onSaved: () => void;
};

const emptyInsumo: Partial<Insumo> = {
  codigoBarras: "",
  conversao: 1,
  custoCompra: 0,
  estoqueMaximo: 0,
  estoqueMinimo: 0,
  loteInterno: "",
  marca: "",
  margemEstimada: 0,
  nome: "",
  observacao: "",
  precosVenda: [],
  promocaoAtiva: false,
  quantidadeAtual: 0,
  sku: "",
  status: "ativo",
  tipoEtiqueta: "",
  unidadeCompra: "",
  unidadeMedida: "",
  unidadeUso: "",
  validadeAposAberto: 0,
  validadeAposProducao: 0,
  validadeOriginal: 0,
};

export function ProdutoDrawer({ insumoId, onClose, onSaved }: ProdutoDrawerProps) {
  const { user, userProfile } = useAuth();
  const [insumo, setInsumo] = useState<Partial<Insumo>>(emptyInsumo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titulo = useMemo(() => (insumoId ? "Editar insumo" : "Novo cadastro"), [insumoId]);

  useEffect(() => {
    let mounted = true;

    async function carregar() {
      if (!insumoId) {
        setInsumo(emptyInsumo);
        setError(null);
        return;
      }

      setLoading(true);
      try {
        const dados = await getInsumo(insumoId);
        if (!mounted) return;
        setInsumo(dados ?? emptyInsumo);
        setError(dados ? null : "Insumo nao encontrado.");
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Erro ao carregar insumo.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    carregar();

    return () => {
      mounted = false;
    };
  }, [insumoId]);

  function updateLocal(dados: Partial<Insumo>) {
    setInsumo((current) => ({ ...current, ...dados }));
  }

  async function handleSalvar() {
    const empresaId = userProfile?.empresaId || user?.uid || "";
    const lojaId = userProfile?.lojaId || "matriz";

    setLoading(true);
    setError(null);

    try {
      if (!empresaId || !lojaId) {
        throw new Error("Nao foi possivel identificar empresa e loja.");
      }

      const payload = { ...insumo, empresaId, lojaId };
      if (insumoId) {
        await atualizarInsumo(insumoId, payload);
      } else {
        await criarInsumo(payload as Omit<Insumo, "id" | "criadoEm" | "atualizadoEm" | "createdBy">, user?.uid ?? "");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar o insumo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="produto-drawer" aria-label="Cadastro de produto">
      <header className="produto-drawer__header">
        <div>
          <span>{titulo}</span>
          <h2>{insumo.nome || "Insumo"}</h2>
        </div>
        <div className="produto-drawer__actions">
          <button type="button" onClick={onClose}>Fechar</button>
          <button type="button" onClick={handleSalvar} disabled={loading}>Salvar</button>
        </div>
      </header>

      {error ? <EmptyState title="Erro no cadastro" description={error} /> : null}

      <nav className="produto-drawer__tabs" aria-label="Abas do produto">
        {tabs.map((tab) => (
          <a href={tab.href} key={tab.href}>
            {tab.label}
          </a>
        ))}
      </nav>

      <div className="produto-drawer__content">
        {loading ? (
          <Skeleton lines={8} />
        ) : (
          <>
            <ProdutoAbaDados insumo={insumo} onSave={updateLocal} />
            <ProdutoAbaEstoque insumo={insumo} onSave={updateLocal} />
            <ProdutoAbaConversao insumo={insumo} onSave={updateLocal} />
            <ProdutoAbaValidade insumo={insumo} onSave={updateLocal} />
            <ProdutoAbaFornecedores fornecedorId={insumo.fornecedorPrincipal} />
            <ProdutoAbaEtiqueta />
            <ProdutoAbaFichaTecnica />
            <ProdutoAbaHistorico insumoId={insumoId ?? undefined} />
          </>
        )}
      </div>
    </aside>
  );
}
