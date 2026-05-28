"use client";

import { useCallback, useMemo, useState } from "react";

import { CategoriasInsumos } from "../../components/estoque/CategoriasInsumos";
import { EntradaRapida } from "../../components/estoque/EntradaRapida";
import { EstoqueHeader } from "../../components/estoque/EstoqueHeader";
import { EstoqueKpis } from "../../components/estoque/EstoqueKpis";
import { ImportarXml } from "../../components/estoque/ImportarXml";
import { ListaProdutosCards } from "../../components/estoque/ListaProdutosCards";
import { ListaProdutosTabela } from "../../components/estoque/ListaProdutosTabela";
import { ProdutoDrawer } from "../../components/estoque/ProdutoDrawer";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useCategoriasInsumos } from "../../hooks/useCategoriasInsumos";
import { useEstoque } from "../../hooks/useEstoque";

export default function EstoquePage() {
  const { criarInsumoComEntrada, deletarInsumo, error, insumos, kpis, loading, refetch, registrarMovimento } = useEstoque();
  const { categoriasList, criarCategoria, ocultarCategoria } = useCategoriasInsumos();
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("todas");
  const [modoVisualizacao, setModoVisualizacao] = useState<"cards" | "tabela">("cards");
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [produtoEditandoId, setProdutoEditandoId] = useState<string | null>(null);
  const [mostrarEntradaRapida, setMostrarEntradaRapida] = useState(false);
  const [mostrarImportarXml, setMostrarImportarXml] = useState(false);

  const insumosFiltrados = useMemo(() => {
    let filtrados = [...insumos];

    if (categoriaAtiva !== "todas") {
      filtrados = filtrados.filter((insumo) => insumo.categoriaId === categoriaAtiva);
    }

    if (busca.trim()) {
      const termo = busca.toLowerCase();
      filtrados = filtrados.filter(
        (insumo) =>
          insumo.nome?.toLowerCase().includes(termo) ||
          insumo.sku?.toLowerCase().includes(termo) ||
          insumo.marca?.toLowerCase().includes(termo) ||
          insumo.codigoBarras?.includes(termo),
      );
    }

    return filtrados;
  }, [busca, categoriaAtiva, insumos]);

  const handleNovoInsumo = useCallback(() => {
    setProdutoEditandoId(null);
    setDrawerAberto(true);
  }, []);

  const handleEditarInsumo = useCallback((id: string) => {
    setProdutoEditandoId(id);
    setDrawerAberto(true);
  }, []);

  const handleExcluirInsumo = useCallback(
    async (id: string, nome: string) => {
      const confirmou = window.confirm(`Excluir "${nome}" do estoque? Esta acao nao pode ser desfeita.`);
      if (!confirmou) return;

      await deletarInsumo(id, nome, "admin");
      if (produtoEditandoId === id) {
        setProdutoEditandoId(null);
        setDrawerAberto(false);
      }
      refetch();
    },
    [deletarInsumo, produtoEditandoId, refetch],
  );

  const handleFecharDrawer = useCallback(() => {
    setDrawerAberto(false);
    setProdutoEditandoId(null);
  }, []);

  const handleSalvo = useCallback(() => {
    refetch();
    handleFecharDrawer();
  }, [handleFecharDrawer, refetch]);

  const handleRegistrarEntrada = useCallback(
    async (dados: {
      custoTotal?: number;
      fornecedorId?: string;
      imagemUrl?: string;
      insumoId: string;
      insumoNome: string;
      observacao?: string;
      quantidade: number;
      tipo: "entrada" | "saida";
    }) => {
      await registrarMovimento({
        ...dados,
        responsavel: "admin",
      });
      setMostrarEntradaRapida(false);
      refetch();
    },
    [refetch, registrarMovimento],
  );

  const handleCriarEntradaRapida = useCallback(
    async (dados: {
      codigoBarras?: string;
      custoTotal: number;
      imagemUrl?: string;
      marca?: string;
      nome: string;
      quantidade: number;
      unidade: string;
    }) => {
      await criarInsumoComEntrada({
        ...dados,
        responsavel: "admin",
      });
      setMostrarEntradaRapida(false);
      refetch();
    },
    [criarInsumoComEntrada, refetch],
  );

  if (error) {
    return (
      <EmptyState
        title="Erro ao carregar estoque"
        description={error}
        action={<Button onClick={refetch}>Tentar novamente</Button>}
      />
    );
  }

  return (
    <div className="estoque-module-page">
      <EstoqueHeader
        busca={busca}
        modoVisualizacao={modoVisualizacao}
        onBuscaChange={setBusca}
        onEntradaRapida={() => setMostrarEntradaRapida(true)}
        onImportarXml={() => setMostrarImportarXml(true)}
        onModoChange={setModoVisualizacao}
        onNovoInsumo={handleNovoInsumo}
      />

      <EstoqueKpis kpis={kpis} loading={loading} />

      <CategoriasInsumos
        categorias={categoriasList}
        categoriaAtiva={categoriaAtiva}
        onCriarCategoria={criarCategoria}
        onOcultarCategoria={ocultarCategoria}
        onSelect={setCategoriaAtiva}
      />

      {mostrarEntradaRapida ? (
        <EntradaRapida
          onCriarEntrada={handleCriarEntradaRapida}
          onRegistrar={handleRegistrarEntrada}
          onFechar={() => setMostrarEntradaRapida(false)}
          focusBarcode
        />
      ) : null}

      {mostrarImportarXml ? (
        <ImportarXml
          onFechar={() => setMostrarImportarXml(false)}
          onFinalizar={() => {
            setMostrarImportarXml(false);
            refetch();
          }}
        />
      ) : null}

      {loading ? (
        <EstoqueSkeleton />
      ) : insumosFiltrados.length === 0 ? (
        <EmptyState
          title="Nenhum insumo encontrado"
          description={busca ? "Tente alterar os filtros ou buscar por outro termo." : "Cadastre seu primeiro insumo para comecar."}
          action={busca ? undefined : <Button onClick={handleNovoInsumo}>Novo Insumo</Button>}
        />
      ) : modoVisualizacao === "cards" ? (
        <ListaProdutosCards
          insumos={insumosFiltrados}
          onEditar={handleEditarInsumo}
          onExcluir={handleExcluirInsumo}
          onEntrada={(id) => {
            setProdutoEditandoId(id);
            setMostrarEntradaRapida(true);
          }}
          onSaida={(id) => {
            setProdutoEditandoId(id);
            setMostrarEntradaRapida(true);
          }}
        />
      ) : (
        <ListaProdutosTabela insumos={insumosFiltrados} onEditar={handleEditarInsumo} onExcluir={handleExcluirInsumo} />
      )}

      <ProdutoDrawer aberto={drawerAberto} produtoId={produtoEditandoId} onFechar={handleFecharDrawer} onSalvo={handleSalvo} />
    </div>
  );
}

function EstoqueSkeleton() {
  return (
    <div className="produtos-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <article className="produto-card" key={index} style={{ padding: "var(--space-4)" }}>
          <Skeleton lines={4} />
        </article>
      ))}
    </div>
  );
}
