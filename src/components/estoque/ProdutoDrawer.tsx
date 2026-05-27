"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { produtoSchema } from "../../schemas/produto.schema";
import { atualizarInsumo, criarInsumo } from "../../services/estoque.service";
import type { Insumo } from "../../types";
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
import { useProduto } from "../../hooks/useProduto";

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

const produtoVazio: Partial<Insumo> = {
  categoriaId: "",
  codigoBarras: "",
  codigoInterno: "",
  conversao: 1,
  custoCompra: 0,
  diasEntrega: 0,
  diasPedido: 0,
  estoqueMaximo: 0,
  estoqueMinimo: 0,
  fichaTecnicaVinculos: [],
  fornecedorPrincipal: "",
  frequenciaPedido: "",
  loteInterno: "",
  marca: "",
  nome: "",
  observacao: "",
  precoVenda: 0,
  precosVenda: [],
  promocaoAtiva: false,
  quantidadeAtual: 0,
  quantidadePadraoPedido: 0,
  sku: "",
  statusProduto: "ativo",
  tipoEtiqueta: "",
  unidadeCompra: "un",
  unidadeMedida: "un",
  unidadeUso: "un",
  validadeAposAberto: 0,
  validadeAposProducao: 0,
  validadeOriginal: 0,
};

function prepararPayload(produto: Partial<Insumo>) {
  const conversao = Math.max(Number(produto.conversao) || 1, 1);
  const custoCompra = Number(produto.custoCompra) || 0;

  return produtoSchema.parse({
    ...produtoVazio,
    ...produto,
    codigoBarrasNormalizado: (produto.codigoBarras || "").replace(/\D/g, ""),
    conversao,
    custoCompra,
    custoUnitario: custoCompra / conversao,
    nomeNormalizado: (produto.nome || "").toLowerCase(),
    origemCadastro: "manual",
  });
}

export function ProdutoDrawer({ aberto, onFechar, onSalvo, produtoId }: ProdutoDrawerProps) {
  const { user } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<AbaId>("dados");
  const [draft, setDraft] = useState<Partial<Insumo>>(produtoVazio);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { error, loading, produto } = useProduto(aberto ? produtoId : null);
  const isNovo = !produtoId;

  useEffect(() => {
    if (!aberto) return;
    setAbaAtiva("dados");
    setErroSalvar(null);
  }, [aberto, produtoId]);

  useEffect(() => {
    if (!aberto) return;
    setDraft({ ...produtoVazio, ...(produto || {}) });
  }, [aberto, produto]);

  const titulo = useMemo(() => (isNovo ? "Novo Insumo" : draft.nome || "Editar Insumo"), [draft.nome, isNovo]);

  function updateDraft(dados: Partial<Insumo>) {
    setDraft((current) => ({ ...current, ...dados }));
  }

  async function handleSalvar() {
    setErroSalvar(null);
    setSalvando(true);

    try {
      const payload = prepararPayload(draft);
      const payloadCompleto = {
        ...payload,
        cmv: Number(draft.cmv) || 0,
        margemEstimada: Number(draft.margemEstimada) || 0,
        observacao: draft.observacao || "",
        precosVenda: draft.precosVenda || [],
      } as Omit<Insumo, "id" | "criadoEm" | "atualizadoEm" | "createdBy">;
      if (produtoId) {
        await atualizarInsumo(produtoId, payloadCompleto);
      } else {
        await criarInsumo(payloadCompleto, user?.uid || "sistema");
      }
      onSalvo();
    } catch (errorSalvar) {
      setErroSalvar(errorSalvar instanceof Error ? errorSalvar.message : "Nao foi possivel salvar o insumo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Drawer
      open={aberto}
      title={titulo}
      footer={
        <div className="estoque-row-actions">
          <Button variant="ghost" onClick={onFechar}>Fechar</Button>
          <Button variant="primary" onClick={handleSalvar} disabled={salvando || loading}>
            {salvando ? "Salvando..." : "Salvar Insumo"}
          </Button>
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
            {abaAtiva === "dados" ? <ProdutoAbaDadosGerais produto={draft} onChange={updateDraft} /> : null}
            {abaAtiva === "estoque" ? <ProdutoAbaEstoque produto={draft} onChange={updateDraft} /> : null}
            {abaAtiva === "conversao" ? <ProdutoAbaConversao produto={draft} onChange={updateDraft} /> : null}
            {abaAtiva === "validade" ? <ProdutoAbaValidade produto={draft} onChange={updateDraft} /> : null}
            {abaAtiva === "fornecedores" ? <ProdutoAbaFornecedores produto={draft} onChange={updateDraft} /> : null}
            {abaAtiva === "etiqueta" ? <ProdutoAbaEtiqueta produto={draft} onChange={updateDraft} /> : null}
            {abaAtiva === "ficha" ? <ProdutoAbaFichaTecnica produto={draft} onChange={updateDraft} /> : null}
            {abaAtiva === "historico" ? <ProdutoAbaHistorico produtoId={produtoId} /> : null}
          </div>
          {erroSalvar ? <p className="estoque-feedback">{erroSalvar}</p> : null}
        </div>
      ) : null}
    </Drawer>
  );
}
