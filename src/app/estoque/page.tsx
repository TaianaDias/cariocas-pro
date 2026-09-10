"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
import { useAuth } from "../../hooks/useAuth";
import { useCategoriasInsumos } from "../../hooks/useCategoriasInsumos";
import { useEstoque } from "../../hooks/useEstoque";
import { isAdministrativeRole } from "../../lib/access-control";

export default function EstoquePage() {
  const { user, userProfile } = useAuth();
  const { criarInsumoComEntrada, deletarInsumo, error, insumos, kpis, loading, refetch, registrarMovimento } = useEstoque();
  const { categoriasList, criarCategoria, ocultarCategoria } = useCategoriasInsumos();
  const searchParams = useSearchParams();
  const filtroAtencao = searchParams.get("atencao");
  const administrative = isAdministrativeRole(userProfile?.role || "user");
  const responsavel = user?.uid || "sistema";
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

    if (filtroAtencao === "criticos") {
      filtrados = filtrados.filter((insumo) => Number(insumo.quantidadeAtual) <= Number(insumo.estoqueMinimo));
    }

    if (filtroAtencao === "reposicao") {
      filtrados = filtrados.filter((insumo) => Number(insumo.quantidadeAtual) <= 0);
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
  }, [busca, categoriaAtiva, filtroAtencao, insumos]);

  const filtroAtencaoLabel = filtroAtencao === "criticos" ? "Itens críticos" : filtroAtencao === "reposicao" ? "Reposição pendente" : "";

  const handleNovoInsumo = useCallback(() => {
    if (!administrative) return;
    setProdutoEditandoId(null);
    setDrawerAberto(true);
  }, [administrative]);

  const handleEditarInsumo = useCallback((id: string) => {
    if (!administrative) return;
    setProdutoEditandoId(id);
    setDrawerAberto(true);
  }, [administrative]);

  const handleExcluirInsumo = useCallback(
    async (id: string, nome: string) => {
      if (!administrative) return;
      const confirmou = window.confirm(`Excluir "${nome}" do estoque? Esta ação não pode ser desfeita.`);
      if (!confirmou) return;

      await deletarInsumo(id, nome, responsavel);
      if (produtoEditandoId === id) {
        setProdutoEditandoId(null);
        setDrawerAberto(false);
      }
      refetch();
    },
    [administrative, deletarInsumo, produtoEditandoId, refetch, responsavel],
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
        responsavel,
      });
      setMostrarEntradaRapida(false);
      refetch();
    },
    [refetch, registrarMovimento, responsavel],
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
      if (!administrative) return;
      await criarInsumoComEntrada({
        ...dados,
        responsavel,
      });
      setMostrarEntradaRapida(false);
      refetch();
    },
    [administrative, criarInsumoComEntrada, refetch, responsavel],
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
        administrative={administrative}
        busca={busca}
        modoVisualizacao={modoVisualizacao}
        onBuscaChange={setBusca}
        onEntradaRapida={() => setMostrarEntradaRapida(true)}
        onImportarXml={() => administrative && setMostrarImportarXml(true)}
        onModoChange={setModoVisualizacao}
        onNovoInsumo={handleNovoInsumo}
      />

      <EstoqueKpis administrative={administrative} kpis={kpis} loading={loading} />

      <CategoriasInsumos
        allowManagement={administrative}
        categorias={categoriasList}
        categoriaAtiva={categoriaAtiva}
        onCriarCategoria={criarCategoria}
        onOcultarCategoria={ocultarCategoria}
        onSelect={setCategoriaAtiva}
      />

      {filtroAtencaoLabel ? (
        <div className="estoque-attention-filter">
          <span>{filtroAtencaoLabel}</span>
          <strong>{insumosFiltrados.length} itens precisam de atenção</strong>
          <a href="/estoque">Limpar filtro</a>
        </div>
      ) : null}

      {mostrarEntradaRapida ? (
        <EntradaRapida
          administrative={administrative}
          onCriarEntrada={administrative ? handleCriarEntradaRapida : undefined}
          onRegistrar={handleRegistrarEntrada}
          onFechar={() => setMostrarEntradaRapida(false)}
          focusBarcode
        />
      ) : null}

      {administrative && mostrarImportarXml ? (
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
          description={busca ? "Tente alterar os filtros ou buscar por outro termo." : "Nenhum insumo está disponível para esta seleção."}
          action={!busca && administrative ? <Button onClick={handleNovoInsumo}>Novo insumo</Button> : undefined}
        />
      ) : modoVisualizacao === "cards" ? (
        <ListaProdutosCards
          administrative={administrative}
          insumos={insumosFiltrados}
          onEditar={handleEditarInsumo}
          onExcluir={handleExcluirInsumo}
          onEntrada={() => setMostrarEntradaRapida(true)}
          onSaida={() => setMostrarEntradaRapida(true)}
        />
      ) : (
        <ListaProdutosTabela
          administrative={administrative}
          insumos={insumosFiltrados}
          onEditar={handleEditarInsumo}
          onExcluir={handleExcluirInsumo}
        />
      )}

      {administrative ? (
        <ProdutoDrawer aberto={drawerAberto} produtoId={produtoEditandoId} onFechar={handleFecharDrawer} onSalvo={handleSalvo} />
      ) : null}
    </div>
  );
}

function EstoqueSkeleton() {
  return (
    <div className="produtos-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <article className="produto-card produto-card--skeleton" key={index}>
          <Skeleton lines={4} />
        </article>
      ))}
    </div>
  );
}
