"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { employeePermissionOptions } from "../../lib/access-control";
import { atualizarPedido, criarPedido, deletarPedido, listarPedidos, registrarRecebimentoPedido } from "../../services/compras.service";
import { getConfiguracao } from "../../services/configuracoes.service";
import { listarDesperdicios, registrarDesperdicio } from "../../services/desperdicio.service";
import { listarInsumos } from "../../services/estoque.service";
import { atualizarFornecedor, criarFornecedor, deletarFornecedor, listarFornecedores, vincularInsumoAoFornecedor } from "../../services/fornecedores.service";
import { atualizarFuncionario, criarFuncionario, listarFuncionarios } from "../../services/funcionarios.service";
import { criarMercado, listarMercados } from "../../services/mercados.service";
import { atualizarProducaoPorcao, deletarProducaoPorcao, estornarProducaoPorcao, listarPorcoesDisponiveis, registrarSaidaParaProducao } from "../../services/producao-porcoes.service";
import { criarFichaTecnica, listarFichasTecnicas, listarOrdensProducao } from "../../services/producao.service";
import type { Desperdicio, FichaTecnica, Fornecedor, Funcionario, Insumo, Mercado, OrdemProducao, PedidoCompra, PermissaoFuncionario, ProducaoPorcao } from "../../types";

type Status = "idle" | "loading" | "ready" | "error";

function useTenantContext() {
  const { user, userProfile } = useAuth();
  return {
    empresaId: userProfile?.empresaId || user?.uid || "",
    lojaId: userProfile?.lojaId || "matriz",
  };
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(value || 0);
}

function dateLabel(value: unknown) {
  if (!value) return "-";
  if (value instanceof Date) return value.toLocaleDateString("pt-BR");
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toLocaleDateString("pt-BR");
  }
  return String(value);
}

function useAsyncData<T>(loader: () => Promise<T[]>) {
  const [data, setData] = useState<T[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  function refetch() {
    let active = true;
    setStatus("loading");

    loader()
      .then((items) => {
        if (!active) return;
        setData(items);
        setError(null);
        setStatus("ready");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Nao foi possivel carregar os dados.");
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }

  useEffect(() => refetch(), [loader]);

  return { data, error, loading: status === "loading", refetch, status };
}

function PageShell({
  actions,
  children,
  eyebrow,
  subtitle,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  eyebrow: string;
  subtitle: string;
  title: string;
}) {
  return (
    <main className="operational-page">
      <section className="operational-header">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {actions ? <div className="operational-header__actions">{actions}</div> : null}
      </section>
      {children}
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="operational-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}

function LoadingGrid() {
  return (
    <section className="operational-list">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card className="operational-row operational-row--loading" key={index}>
          <div />
          <div />
        </Card>
      ))}
    </section>
  );
}

function ActionPanel({
  children,
  error,
  onClose,
  title,
}: {
  children: ReactNode;
  error?: string | null;
  onClose: () => void;
  title: string;
}) {
  return (
    <Card className="operational-action-panel">
      <header>
        <strong>{title}</strong>
        <button type="button" onClick={onClose}>Fechar</button>
      </header>
      {children}
      {error ? <p>{error}</p> : null}
    </Card>
  );
}

function Field({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string | number;
}) {
  return (
    <label className="operational-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="operational-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function SearchableInsumoField({
  descricao,
  insumos,
  label,
  onChange,
  placeholder = "Pesquisar por nome, marca, SKU ou codigo",
  value,
}: {
  descricao?: (insumo: Insumo) => string;
  insumos: Insumo[];
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const selected = insumos.find((insumo) => insumo.id === value);
  const [busca, setBusca] = useState(selected?.nome || "");
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo ? insumos.filter((insumo) => matchInsumoSearch(insumo, termo)) : insumos;
    return base.slice(0, 20);
  }, [busca, insumos]);

  useEffect(() => {
    setBusca(selected?.nome || "");
  }, [selected?.id, selected?.nome]);

  return (
    <label className="operational-field operational-search-field">
      <span>{label}</span>
      <input
        type="search"
        value={busca}
        placeholder={placeholder}
        onChange={(event) => {
          setBusca(event.target.value);
          onChange("");
        }}
      />
      <div className="operational-search-field__list">
        {filtrados.length ? (
          filtrados.map((insumo) => (
            <button
              className={value === insumo.id ? "is-selected" : ""}
              key={insumo.id || insumo.nome}
              type="button"
              onClick={() => {
                onChange(insumo.id || "");
                setBusca(insumo.nome || "");
              }}
            >
              <strong>{insumo.nome}</strong>
              <small>{descricao ? descricao(insumo) : defaultInsumoDescription(insumo)}</small>
            </button>
          ))
        ) : (
          <small>Nenhum insumo encontrado.</small>
        )}
      </div>
    </label>
  );
}

function SubmitRow({ loading, onSubmit }: { loading: boolean; onSubmit: () => void }) {
  return (
    <div className="operational-submit">
      <Button onClick={onSubmit} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
    </div>
  );
}

function matchInsumoSearch(insumo: Insumo, termo: string) {
  return [insumo.nome, insumo.sku, insumo.marca, insumo.codigoBarras, insumo.categoriaId]
    .some((campo) => String(campo || "").toLowerCase().includes(termo));
}

function defaultInsumoDescription(insumo: Insumo) {
  return `${Number(insumo.quantidadeAtual) || 0} ${insumo.unidadeMedida || insumo.unidadeCompra || "un"} em estoque`;
}

function getInsumoUnitCost(insumo: Insumo) {
  return Number(insumo.custoCompra || insumo.custoUnitario || 0);
}

function getSuggestedPurchaseQuantity(insumo: Insumo) {
  const atual = Number(insumo.quantidadeAtual) || 0;
  const maximo = Number(insumo.estoqueMaximo) || 0;
  const minimo = Number(insumo.estoqueMinimo) || 0;
  const padrao = Number(insumo.quantidadePadraoPedido) || 0;

  if (maximo > atual) return Math.ceil(maximo - atual);
  if (minimo > atual) return Math.ceil(minimo - atual);
  if (padrao > 0) return padrao;
  return 1;
}

function isInsumoAbaixoMinimo(insumo: Insumo) {
  const minimo = Number(insumo.estoqueMinimo) || 0;
  const atual = Number(insumo.quantidadeAtual) || 0;

  return minimo > 0 && atual <= minimo;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function getProfilePhone(profile: unknown) {
  if (!profile || typeof profile !== "object") return "";
  const data = profile as Record<string, unknown>;
  return String(data.whatsapp || data.telefone || data.celular || data.numeroWhatsApp || "");
}

function buildPurchaseMessage(itens: PedidoCompra["itens"], valorTotal: number, origemCompra: "fornecedor" | "mercado") {
  const linhas = itens.length
    ? itens.map((item) => `- ${item.insumoNome}: ${item.quantidade} ${item.unidade}`).join("\n")
    : "- Pedido a combinar";

  if (origemCompra === "mercado") {
    return `Lista de compras para mercado:\n\n${linhas}\n\nTotal estimado: ${money(valorTotal)}\n\nLista automatica - Carioca's Pro.`;
  }

  return `Ola! Gostaria de fazer um pedido:\n\n${linhas}\n\nTotal estimado: ${money(valorTotal)}\n\nPedido automatico - Carioca's Pro.`;
}

function buildWhatsAppLink(phone: string, itens: PedidoCompra["itens"], valorTotal: number, origemCompra: "fornecedor" | "mercado") {
  const numero = onlyDigits(phone);
  if (!numero) return "";
  const numeroComPais = numero.startsWith("55") ? numero : `55${numero}`;
  return `https://wa.me/${numeroComPais}?text=${encodeURIComponent(buildPurchaseMessage(itens, valorTotal, origemCompra))}`;
}

export function ComprasPageClient() {
  const { user, userProfile } = useAuth();
  const empresaId = userProfile?.empresaId || user?.uid || "";
  const lojaId = userProfile?.lojaId || "matriz";
  const listarInsumosTenant = useCallback(() => listarInsumos({ empresaId, lojaId }), [empresaId, lojaId]);
  const listarPedidosTenant = useCallback(() => listarPedidos({ empresaId, lojaId }), [empresaId, lojaId]);
  const { data: pedidos, error, loading, refetch } = useAsyncData<PedidoCompra>(listarPedidosTenant);
  const { data: insumos, error: insumosError, loading: insumosLoading } = useAsyncData<Insumo>(listarInsumosTenant);
  const { data: fornecedores, error: fornecedoresError, loading: fornecedoresLoading } = useAsyncData<Fornecedor>(listarFornecedores);
  const { data: mercados, error: mercadosError, loading: mercadosLoading, refetch: refetchMercados } = useAsyncData<Mercado>(listarMercados);
  const [formAberto, setFormAberto] = useState(false);
  const [pedidoEditando, setPedidoEditando] = useState<PedidoCompra | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingMercado, setSavingMercado] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mercadoError, setMercadoError] = useState<string | null>(null);
  const [adminWhatsapp, setAdminWhatsapp] = useState("");
  const [buscaInsumoCompra, setBuscaInsumoCompra] = useState("");
  const [form, setForm] = useState({
    adminWhatsapp: "",
    fornecedorId: "",
    fornecedorNome: "",
    fornecedorTelefone: "",
    mercadoId: "",
    mercadoNome: "",
    mercadoTelefone: "",
    numero: "",
    origemCompra: "fornecedor" as "fornecedor" | "mercado",
    quantidades: {} as Record<string, number>,
    selectedIds: [] as string[],
    valorManual: 0,
  });
  const [novoMercado, setNovoMercado] = useState({ endereco: "", nome: "", observacoes: "", telefone: "" });
  const total = pedidos.reduce((acc, pedido) => acc + (pedido.valorTotal || 0), 0);
  const pendentes = pedidos.filter((pedido) => pedido.status !== "recebido").length;
  const insumosAbaixoMinimo = insumos.filter(isInsumoAbaixoMinimo);
  const insumosCompraFiltrados = useMemo(() => {
    const termo = buscaInsumoCompra.trim().toLowerCase();
    const base = termo ? insumos.filter((insumo) => matchInsumoSearch(insumo, termo)) : insumos;
    const selecionados = new Set(form.selectedIds);
    return [...base].sort((a, b) => Number(selecionados.has(b.id || "")) - Number(selecionados.has(a.id || ""))).slice(0, 60);
  }, [buscaInsumoCompra, form.selectedIds, insumos]);
  const selectedFornecedor = fornecedores.find((fornecedor) => fornecedor.id === form.fornecedorId);
  const selectedMercado = mercados.find((mercado) => mercado.id === form.mercadoId);
  const selectedInsumos = form.selectedIds
    .map((id) => insumos.find((insumo) => insumo.id === id))
    .filter((insumo): insumo is Insumo => Boolean(insumo?.id));
  const contatoDestino =
    form.origemCompra === "fornecedor"
      ? selectedFornecedor?.telefone || form.fornecedorTelefone
      : form.adminWhatsapp || adminWhatsapp;

  useEffect(() => {
    let active = true;

    async function loadAdminWhatsapp() {
      const profilePhone = getProfilePhone(userProfile);
      let phone = profilePhone;

      if (user?.uid) {
        const configUsuario = await getConfiguracao(user.uid);
        phone = configUsuario.numeroWhatsAppNotificacao || configUsuario.whatsapp || configUsuario.telefone || phone;
      }

      if (!phone) {
        const configEstabelecimento = await getConfiguracao("estabelecimento");
        phone = configEstabelecimento.numeroWhatsAppNotificacao || configEstabelecimento.whatsapp || configEstabelecimento.telefone || "";
      }

      if (!active) return;
      setAdminWhatsapp(phone);
      setForm((current) => (current.adminWhatsapp ? current : { ...current, adminWhatsapp: phone }));
    }

    loadAdminWhatsapp();

    return () => {
      active = false;
    };
  }, [user?.uid, userProfile]);

  function setQuantidadeInsumo(insumo: Insumo, quantidade: number) {
    if (!insumo.id) return;
    setForm((current) => ({
      ...current,
      quantidades: {
        ...current.quantidades,
        [insumo.id as string]: Math.max(Number(quantidade) || 0, 0),
      },
    }));
  }

  function selecionarInsumo(insumo: Insumo, abrirFormulario = false) {
    if (!insumo.id) return;
    setForm((current) => ({
      ...current,
      quantidades: {
        ...current.quantidades,
        [insumo.id as string]: current.quantidades[insumo.id as string] || getSuggestedPurchaseQuantity(insumo),
      },
      selectedIds: current.selectedIds.includes(insumo.id as string) ? current.selectedIds : [...current.selectedIds, insumo.id as string],
    }));
    if (abrirFormulario) setFormAberto(true);
  }

  function toggleInsumo(insumo: Insumo) {
    if (!insumo.id) return;
    setForm((current) => {
      const exists = current.selectedIds.includes(insumo.id as string);
      return {
        ...current,
        quantidades: exists
          ? current.quantidades
          : { ...current.quantidades, [insumo.id as string]: getSuggestedPurchaseQuantity(insumo) },
        selectedIds: exists
          ? current.selectedIds.filter((id) => id !== insumo.id)
          : [...current.selectedIds, insumo.id as string],
      };
    });
  }

  function selecionarAbaixoMinimo() {
    setForm((current) => {
      const ids = new Set(current.selectedIds);
      const quantidades = { ...current.quantidades };

      for (const insumo of insumosAbaixoMinimo) {
        if (!insumo.id) continue;
        ids.add(insumo.id);
        quantidades[insumo.id] = quantidades[insumo.id] || getSuggestedPurchaseQuantity(insumo);
      }

      return { ...current, quantidades, selectedIds: Array.from(ids) };
    });
    setFormAberto(true);
  }

  function limparFormulario() {
    setForm({
      adminWhatsapp,
      fornecedorId: "",
      fornecedorNome: "",
      fornecedorTelefone: "",
      mercadoId: "",
      mercadoNome: "",
      mercadoTelefone: "",
      numero: "",
      origemCompra: "fornecedor",
      quantidades: {},
      selectedIds: [],
      valorManual: 0,
    });
    setPedidoEditando(null);
  }

  function abrirNovoPedido() {
    limparFormulario();
    setFormAberto(true);
  }

  function editarPedidoMercado(pedido: PedidoCompra) {
    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
    const quantidades = Object.fromEntries(itens.map((item) => [item.insumoId, item.quantidade]));
    const totalItens = itens.reduce((acc, item) => acc + (Number(item.valorTotal) || 0), 0);

    setPedidoEditando(pedido);
    setForm({
      adminWhatsapp,
      fornecedorId: "",
      fornecedorNome: "",
      fornecedorTelefone: "",
      mercadoId: pedido.mercadoId || "",
      mercadoNome: pedido.mercadoNome || pedido.fornecedorNome || "",
      mercadoTelefone: "",
      numero: pedido.numero || "",
      origemCompra: "mercado",
      quantidades,
      selectedIds: itens.map((item) => item.insumoId).filter(Boolean),
      valorManual: Math.max((Number(pedido.valorTotal) || 0) - totalItens, 0),
    });
    setFormAberto(true);
  }

  async function excluirPedidoMercado(pedido: PedidoCompra) {
    if (!pedido.id) return;
    const confirmou = window.confirm(`Excluir a lista de mercado ${pedido.numero || ""}?`);
    if (!confirmou) return;

    setSaving(true);
    setFormError(null);
    try {
      await deletarPedido(pedido.id, { empresaId, lojaId });
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel excluir.");
    } finally {
      setSaving(false);
    }
  }

  function montarItensPedido() {
    return selectedInsumos.map((insumo) => {
      const id = insumo.id || "";
      const quantidade = Number(form.quantidades[id]) || getSuggestedPurchaseQuantity(insumo);
      const valorUnitario = getInsumoUnitCost(insumo);

      return {
        insumoId: id,
        insumoNome: insumo.nome,
        quantidade,
        unidade: insumo.unidadeCompra || insumo.unidadeMedida || "un",
        valorUnitario,
        valorTotal: quantidade * valorUnitario,
      };
    });
  }

  function valorTotalPedido(itens: PedidoCompra["itens"]) {
    return itens.reduce((acc, item) => acc + item.valorTotal, 0) + (Number(form.valorManual) || 0);
  }

  async function salvarMercado() {
    if (!novoMercado.nome.trim()) {
      setMercadoError("Informe o nome do mercado.");
      return;
    }

    setSavingMercado(true);
    setMercadoError(null);
    try {
      const id = await criarMercado({
        endereco: novoMercado.endereco,
        nome: novoMercado.nome,
        observacoes: novoMercado.observacoes,
        telefone: novoMercado.telefone,
      });
      setNovoMercado({ endereco: "", nome: "", observacoes: "", telefone: "" });
      setForm((current) => ({ ...current, mercadoId: id, mercadoNome: novoMercado.nome, mercadoTelefone: novoMercado.telefone }));
      refetchMercados();
    } catch (err) {
      setMercadoError(err instanceof Error ? err.message : "Nao foi possivel cadastrar o mercado.");
    } finally {
      setSavingMercado(false);
    }
  }

  async function salvar() {
    setSaving(true);
    setFormError(null);
    try {
      const itens = montarItensPedido();
      const valorTotal = valorTotalPedido(itens);
      const linkDisparo = buildWhatsAppLink(contatoDestino, itens, valorTotal, form.origemCompra);
      const nomeDestino =
        form.origemCompra === "fornecedor"
          ? selectedFornecedor?.nome || form.fornecedorNome || "Fornecedor nao informado"
          : selectedMercado?.nome || form.mercadoNome || "Mercado nao informado";

      const dadosPedido = {
        dataPedido: new Date(),
        empresaId,
        fornecedorId: form.origemCompra === "fornecedor" ? form.fornecedorId : "",
        fornecedorNome: nomeDestino,
        itens,
        linkDisparo,
        lojaId,
        mercadoId: form.origemCompra === "mercado" ? form.mercadoId : "",
        mercadoNome: form.origemCompra === "mercado" ? nomeDestino : "",
        numero: form.numero || `PED-${Date.now()}`,
        observacoes: "",
        origemCompra: form.origemCompra,
        status: "pendente",
        valorTotal,
      };

      if (pedidoEditando?.id) {
        await atualizarPedido(pedidoEditando.id, dadosPedido);
      } else {
        await criarPedido(dadosPedido, user?.uid || "admin");
      }
      limparFormulario();
      setFormAberto(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  const previewItens = montarItensPedido();
  const previewTotal = valorTotalPedido(previewItens);
  const previewLink = buildWhatsAppLink(contatoDestino, previewItens, previewTotal, form.origemCompra);

  async function receberPedido(pedido: PedidoCompra) {
    if (!pedido.id || !empresaId || !lojaId || !user?.uid) return;
    const confirmou = window.confirm(`Registrar recebimento do pedido ${pedido.numero || ""} e atualizar o estoque?`);
    if (!confirmou) return;

    setSaving(true);
    setFormError(null);
    try {
      await registrarRecebimentoPedido(pedido.id, { empresaId, lojaId, uid: user.uid });
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel registrar o recebimento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      actions={<Button onClick={abrirNovoPedido}>Novo Pedido</Button>}
      eyebrow="Compras"
      subtitle="Acompanhe pedidos, fornecedores e entradas previstas."
      title="Compras"
    >
      <section className="operational-kpis">
        <Kpi label="Pedidos" value={String(pedidos.length)} />
        <Kpi label="Pendentes" value={String(pendentes)} />
        <Kpi label="Valor total" value={money(total)} />
        <Kpi label="Reposicao" value={String(insumosAbaixoMinimo.length)} />
      </section>

      {insumosAbaixoMinimo.length ? (
        <Card className="operational-restock">
          <header>
            <div>
              <strong>Lista de compras sugerida</strong>
              <span>Insumos que chegaram ao estoque minimo aparecem aqui automaticamente.</span>
            </div>
            <Button onClick={selecionarAbaixoMinimo}>Comprar todos</Button>
          </header>
          <div className="operational-restock__grid">
            {insumosAbaixoMinimo.map((insumo) => (
              <div className="operational-restock__item" key={insumo.id || insumo.nome}>
                <div>
                  <strong>{insumo.nome}</strong>
                  <span>
                    Atual: {Number(insumo.quantidadeAtual) || 0} {insumo.unidadeMedida || insumo.unidadeCompra || "un"} | Minimo: {Number(insumo.estoqueMinimo) || 0} | Maximo: {Number(insumo.estoqueMaximo) || 0}
                  </span>
                  <span>Sugestao de compra: {getSuggestedPurchaseQuantity(insumo)} {insumo.unidadeCompra || insumo.unidadeMedida || "un"}</span>
                </div>
                <button type="button" onClick={() => selecionarInsumo(insumo, true)}>Adicionar</button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {insumosError ? <EmptyState title="Erro ao carregar insumos" description={insumosError} /> : null}
      {fornecedoresError ? <EmptyState title="Erro ao carregar fornecedores" description={fornecedoresError} /> : null}
      {mercadosError ? <EmptyState title="Erro ao carregar mercados" description={mercadosError} /> : null}

      {formAberto ? (
        <ActionPanel title={pedidoEditando ? "Editar lista de mercado" : "Novo pedido de compra"} error={formError} onClose={() => setFormAberto(false)}>
          <div className="operational-segmented" role="group" aria-label="Origem da compra">
            <button
              type="button"
              className={form.origemCompra === "fornecedor" ? "is-active" : ""}
              onClick={() => setForm((current) => ({ ...current, origemCompra: "fornecedor" }))}
            >
              Fornecedor
            </button>
            <button
              type="button"
              className={form.origemCompra === "mercado" ? "is-active" : ""}
              onClick={() => setForm((current) => ({ ...current, origemCompra: "mercado" }))}
            >
              Mercado
            </button>
          </div>
          <div className="operational-form-grid">
            <Field label="Numero" value={form.numero} onChange={(value) => setForm((current) => ({ ...current, numero: value }))} />
            {form.origemCompra === "fornecedor" ? (
              <SelectField
                label="Fornecedor cadastrado"
                value={form.fornecedorId}
                onChange={(value) => {
                  const fornecedor = fornecedores.find((item) => item.id === value);
                  setForm((current) => ({
                    ...current,
                    fornecedorId: value,
                    fornecedorNome: fornecedor?.nome || "",
                    fornecedorTelefone: fornecedor?.telefone || "",
                  }));
                }}
              >
                <option value="">{fornecedoresLoading ? "Carregando fornecedores..." : "Selecione um fornecedor"}</option>
                {fornecedores.map((fornecedor) => (
                  <option key={fornecedor.id || fornecedor.nome} value={fornecedor.id || ""}>{fornecedor.nome}</option>
                ))}
              </SelectField>
            ) : (
              <SelectField
                label="Mercado cadastrado"
                value={form.mercadoId}
                onChange={(value) => {
                  const mercado = mercados.find((item) => item.id === value);
                  setForm((current) => ({
                    ...current,
                    mercadoId: value,
                    mercadoNome: mercado?.nome || "",
                    mercadoTelefone: mercado?.telefone || "",
                  }));
                }}
              >
                <option value="">{mercadosLoading ? "Carregando mercados..." : "Selecione um mercado"}</option>
                {mercados.map((mercado) => (
                  <option key={mercado.id || mercado.nome} value={mercado.id || ""}>{mercado.nome}</option>
                ))}
              </SelectField>
            )}
            <Field label="Valor manual/extra" type="number" value={form.valorManual} onChange={(value) => setForm((current) => ({ ...current, valorManual: Number(value) }))} />
          </div>
          {form.origemCompra === "mercado" ? (
            <div className="operational-market-form">
              <strong>Cadastrar mercado</strong>
              <div className="operational-form-grid">
                <Field label="Nome do mercado" value={novoMercado.nome} onChange={(value) => setNovoMercado((current) => ({ ...current, nome: value }))} />
                <Field label="Telefone/WhatsApp" value={novoMercado.telefone} onChange={(value) => setNovoMercado((current) => ({ ...current, telefone: value }))} />
                <Field label="Endereco" value={novoMercado.endereco} onChange={(value) => setNovoMercado((current) => ({ ...current, endereco: value }))} />
              </div>
              <Field label="WhatsApp do admin/dono para receber a lista" value={form.adminWhatsapp} onChange={(value) => setForm((current) => ({ ...current, adminWhatsapp: value }))} />
              <div className="operational-submit">
                {mercadoError ? <span>{mercadoError}</span> : null}
                <Button onClick={salvarMercado} disabled={savingMercado}>{savingMercado ? "Cadastrando..." : "Cadastrar mercado"}</Button>
              </div>
            </div>
          ) : null}
          <div className="operational-buy-box">
            <header>
              <div>
                <strong>Selecionar insumos do estoque</strong>
                <span>Marque os itens que voce quer comprar. Os itens no minimo ja aparecem como sugestao.</span>
              </div>
              <Badge tone="neutral">{insumosLoading ? "carregando" : `${selectedInsumos.length} selecionados`}</Badge>
            </header>
            <label className="operational-field operational-search-field operational-search-field--inline">
              <span>Pesquisar insumo</span>
              <input
                type="search"
                value={buscaInsumoCompra}
                placeholder="Pesquisar por nome, marca, SKU ou codigo"
                onChange={(event) => setBuscaInsumoCompra(event.target.value)}
              />
            </label>
            <div className="operational-buy-list">
              {insumosCompraFiltrados.map((insumo) => {
                const id = insumo.id || "";
                const checked = form.selectedIds.includes(id);
                const quantidade = Number(form.quantidades[id]) || getSuggestedPurchaseQuantity(insumo);
                const unitCost = getInsumoUnitCost(insumo);

                return (
                  <label className="operational-buy-item" key={id || insumo.nome}>
                    <input type="checkbox" checked={checked} onChange={() => toggleInsumo(insumo)} />
                    <div>
                      <strong>{insumo.nome}</strong>
                      <span>
                        Estoque: {Number(insumo.quantidadeAtual) || 0} | Minimo: {Number(insumo.estoqueMinimo) || 0} | Maximo: {Number(insumo.estoqueMaximo) || 0}
                        {isInsumoAbaixoMinimo(insumo) ? " | Repor agora" : ""}
                      </span>
                    </div>
                    <input
                      aria-label={`Quantidade de ${insumo.nome}`}
                      disabled={!checked}
                      min="0"
                      type="number"
                      value={quantidade}
                      onChange={(event) => setQuantidadeInsumo(insumo, Number(event.target.value))}
                    />
                    <b>{money(quantidade * unitCost)}</b>
                  </label>
                );
              })}
              {!insumosLoading && insumos.length === 0 ? <span className="operational-buy-empty">Nenhum insumo cadastrado no estoque.</span> : null}
              {!insumosLoading && insumos.length > 0 && insumosCompraFiltrados.length === 0 ? <span className="operational-buy-empty">Nenhum insumo encontrado para essa busca.</span> : null}
            </div>
            <footer>
              <span>Total estimado</span>
              <strong>{money(previewTotal)}</strong>
            </footer>
          </div>
          {previewLink ? (
            <a className="operational-link-button" href={previewLink} target="_blank" rel="noopener noreferrer">
              {form.origemCompra === "mercado" ? "Enviar lista para admin/dono" : "Disparar pedido no WhatsApp"}
            </a>
          ) : (
            <span className="operational-link-hint">
              {form.origemCompra === "mercado"
                ? "Informe o WhatsApp do admin/dono para enviar a lista de mercado."
                : "Informe um fornecedor com telefone para liberar o disparo automatico."}
            </span>
          )}
          <SubmitRow loading={saving} onSubmit={salvar} />
        </ActionPanel>
      ) : null}

      {loading ? <LoadingGrid /> : error ? <EmptyState title="Erro ao carregar compras" description={error} /> : null}
      {!loading && !error && pedidos.length === 0 ? (
        <EmptyState title="Nenhum pedido registrado" description="Os proximos pedidos de compra aparecerao aqui." action={<Button onClick={abrirNovoPedido}>Novo Pedido</Button>} />
      ) : null}
      {!loading && pedidos.length ? (
        <section className="operational-list">
          {pedidos.map((pedido) => (
            <Card className="operational-row" key={pedido.id || pedido.numero}>
              <div>
                <strong>{pedido.numero || "Pedido sem numero"}</strong>
                <span>{pedido.fornecedorNome || "Fornecedor nao informado"}</span>
              </div>
              <div>
                <Badge tone={pedido.status === "recebido" ? "success" : "warning"}>{pedido.status || "pendente"}</Badge>
                <b>{money(pedido.valorTotal)}</b>
                <small>{pedido.origemCompra === "mercado" ? "Mercado" : "Fornecedor"}</small>
                <small>{pedido.itens?.length || 0} itens</small>
                {pedido.linkDisparo ? <a href={pedido.linkDisparo} target="_blank" rel="noopener noreferrer">WhatsApp</a> : null}
                {pedido.origemCompra === "mercado" ? (
                  <div className="operational-row__actions">
                    <button type="button" onClick={() => editarPedidoMercado(pedido)}>Editar</button>
                    <button type="button" onClick={() => excluirPedidoMercado(pedido)}>Excluir</button>
                  </div>
                ) : null}
                {pedido.status !== "recebido" ? (
                  <div className="operational-row__actions">
                    <button type="button" onClick={() => receberPedido(pedido)} disabled={saving}>Registrar recebimento</button>
                  </div>
                ) : null}
                <small>{dateLabel(pedido.dataPedido)}</small>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </PageShell>
  );
}

export function DesperdicioPageClient() {
  const { empresaId, lojaId } = useTenantContext();
  const listarDesperdiciosTenant = useCallback(() => listarDesperdicios(undefined, undefined, { empresaId, lojaId }), [empresaId, lojaId]);
  const listarInsumosTenant = useCallback(() => listarInsumos({ empresaId, lojaId }), [empresaId, lojaId]);
  const { data: desperdicios, error, loading, refetch } = useAsyncData<Desperdicio>(listarDesperdiciosTenant);
  const { data: insumos, error: insumosError, loading: insumosLoading, refetch: refetchInsumos } = useAsyncData<Insumo>(listarInsumosTenant);
  const { data: funcionarios, error: funcionariosError, loading: funcionariosLoading } = useAsyncData<Funcionario>(listarFuncionarios);
  const [formAberto, setFormAberto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ colaboradorId: "", insumoId: "", motivo: "", quantidade: 1, responsavel: "" });
  const total = desperdicios.reduce((acc, item) => acc + (item.custoEstimado || 0), 0);
  const categorias = new Set(desperdicios.map((item) => item.categoria || "Sem categoria")).size;

  async function salvar() {
    setSaving(true);
    setFormError(null);
    try {
      await registrarDesperdicio({
        categoria: "perda",
        colaboradorId: form.colaboradorId,
        custoEstimado: 0,
        data: new Date(),
        empresaId,
        insumoId: form.insumoId,
        insumoNome: insumos.find((item) => item.id === form.insumoId)?.nome || "",
        lojaId,
        motivo: form.motivo,
        observacao: "",
        quantidade: Number(form.quantidade) || 1,
        responsavel: form.responsavel || "Responsavel nao informado",
        unidade: "un",
      });
      setForm({ colaboradorId: "", insumoId: "", motivo: "", quantidade: 1, responsavel: "" });
      setFormAberto(false);
      refetch();
      refetchInsumos();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      actions={<Button onClick={() => setFormAberto(true)}>Registrar Perda</Button>}
      eyebrow="Desperdicio"
      subtitle="Controle perdas por insumo, motivo, responsavel e impacto financeiro."
      title="Desperdicio"
    >
      <section className="operational-kpis">
        <Kpi label="Registros" value={String(desperdicios.length)} />
        <Kpi label="Categorias" value={String(categorias)} />
        <Kpi label="Custo estimado" value={money(total)} />
      </section>

      {formAberto ? (
        <ActionPanel title="Registrar perda" error={formError} onClose={() => setFormAberto(false)}>
          <div className="operational-form-grid">
            <SearchableInsumoField
              label="Insumo"
              value={form.insumoId}
              insumos={insumos}
              descricao={(insumo) => `${Number(insumo.quantidadeAtual) || 0} ${insumo.unidadeUso || insumo.unidadeMedida || "un"} disponivel`}
              onChange={(value) => setForm((current) => ({ ...current, insumoId: value }))}
            />
            <Field label="Motivo" value={form.motivo} onChange={(value) => setForm((current) => ({ ...current, motivo: value }))} />
            <Field label="Quantidade" type="number" value={form.quantidade} onChange={(value) => setForm((current) => ({ ...current, quantidade: Number(value) }))} />
            <SelectField
              label="Responsavel"
              value={form.responsavel}
              onChange={(value) => {
                const funcionario = funcionarios.find((item) => item.nome === value);
                setForm((current) => ({ ...current, colaboradorId: funcionario?.id || funcionario?.email || value, responsavel: value }));
              }}
            >
              <option value="">{funcionariosLoading ? "Carregando colaboradores..." : "Selecione o colaborador"}</option>
              {funcionarios.map((funcionario) => (
                <option key={funcionario.id || funcionario.email || funcionario.nome} value={funcionario.nome}>
                  {funcionario.nome}
                </option>
              ))}
            </SelectField>
          </div>
          <SubmitRow loading={saving} onSubmit={salvar} />
        </ActionPanel>
      ) : null}

      {funcionariosError ? <EmptyState title="Erro ao carregar colaboradores" description={funcionariosError} /> : null}
      {insumosError ? <EmptyState title="Erro ao carregar insumos" description={insumosError} /> : null}
      {loading ? <LoadingGrid /> : error ? <EmptyState title="Erro ao carregar desperdicio" description={error} /> : null}
      {!loading && !error && desperdicios.length === 0 ? (
        <EmptyState title="Nenhuma perda registrada" description="Registre desperdicios para medir impacto em CMV e margem." action={<Button onClick={() => setFormAberto(true)}>Registrar Perda</Button>} />
      ) : null}
      {!loading && desperdicios.length ? (
        <section className="operational-list">
          {desperdicios.map((item) => (
            <Card className="operational-row" key={item.id || `${item.insumoId}-${item.data}`}>
              <div>
                <strong>{item.insumoNome}</strong>
                <span>{item.motivo || "Motivo nao informado"} | Responsavel: {item.responsavel || "nao informado"}</span>
              </div>
              <div>
                <Badge tone="danger">{item.categoria || "perda"}</Badge>
                <b>{money(item.custoEstimado)}</b>
                <small>{dateLabel(item.data)}</small>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </PageShell>
  );
}

export function FornecedoresPageClient() {
  const { empresaId, lojaId } = useTenantContext();
  const listarInsumosTenant = useCallback(() => listarInsumos({ empresaId, lojaId }), [empresaId, lojaId]);
  const { data: fornecedores, error, loading, refetch } = useAsyncData<Fornecedor>(listarFornecedores);
  const { data: insumos, error: insumosError, loading: insumosLoading, refetch: refetchInsumos } = useAsyncData<Insumo>(listarInsumosTenant);
  const [formAberto, setFormAberto] = useState(false);
  const [fornecedorEditando, setFornecedorEditando] = useState<Fornecedor | null>(null);
  const [fornecedorVinculo, setFornecedorVinculo] = useState<Fornecedor | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingVinculo, setSavingVinculo] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ cnpj: "", email: "", endereco: "", nome: "", observacoes: "", telefone: "" });
  const [vinculoForm, setVinculoForm] = useState({
    conversao: 1,
    custoUnitario: 0,
    diasEntrega: 0,
    diasPedido: 0,
    frequenciaPedido: "",
    insumoId: "",
    principal: true,
    quantidadePadrao: 1,
    unidadeUso: "",
  });
  const comContato = fornecedores.filter((item) => item.telefone || item.email).length;
  const loadingPage = loading || insumosLoading;
  const pageError = error || insumosError;
  const vinculosPorFornecedor = fornecedores.reduce<Record<string, Insumo[]>>((acc, fornecedor) => {
    if (!fornecedor.id) return acc;
    acc[fornecedor.id] = insumos.filter((insumo) => insumo.fornecedores?.some((item) => item.fornecedorId === fornecedor.id));
    return acc;
  }, {});

  function abrirNovoFornecedor() {
    setFornecedorEditando(null);
    setForm({ cnpj: "", email: "", endereco: "", nome: "", observacoes: "", telefone: "" });
    setFormError(null);
    setFormAberto(true);
  }

  function abrirEditarFornecedor(fornecedor: Fornecedor) {
    setFornecedorEditando(fornecedor);
    setForm({
      cnpj: fornecedor.cnpj || "",
      email: fornecedor.email || "",
      endereco: fornecedor.endereco || "",
      nome: fornecedor.nome || "",
      observacoes: fornecedor.observacoes || "",
      telefone: fornecedor.telefone || "",
    });
    setFormError(null);
    setFormAberto(true);
  }

  function abrirVinculoFornecedor(fornecedor: Fornecedor) {
    setFornecedorVinculo(fornecedor);
    setVinculoForm({
      conversao: 1,
      custoUnitario: 0,
      diasEntrega: 0,
      diasPedido: 0,
      frequenciaPedido: "",
      insumoId: "",
      principal: true,
      quantidadePadrao: 1,
      unidadeUso: "",
    });
    setFormError(null);
  }

  function melhorCustoDoInsumo(insumo: Insumo) {
    const fornecedoresInsumo = insumo.fornecedores || [];
    if (!fornecedoresInsumo.length) return null;
    return [...fornecedoresInsumo].sort((a, b) => (Number(a.custoUnitario || a.custo) || 0) - (Number(b.custoUnitario || b.custo) || 0))[0];
  }

  async function salvar() {
    setSaving(true);
    setFormError(null);
    try {
      if (fornecedorEditando?.id) {
        await atualizarFornecedor(fornecedorEditando.id, form);
      } else {
        await criarFornecedor(form);
      }
      setForm({ cnpj: "", email: "", endereco: "", nome: "", observacoes: "", telefone: "" });
      setFornecedorEditando(null);
      setFormAberto(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function excluirFornecedor(fornecedor: Fornecedor) {
    if (!fornecedor.id) return;
    const confirmou = window.confirm(`Excluir "${fornecedor.nome}"? O fornecedor tambem sera removido dos vinculos dos insumos.`);
    if (!confirmou) return;

    setFormError(null);
    try {
      await deletarFornecedor(fornecedor.id);
      refetch();
      refetchInsumos();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel excluir o fornecedor.");
    }
  }

  async function salvarVinculo() {
    if (!fornecedorVinculo?.id) return;
    const insumo = insumos.find((item) => item.id === vinculoForm.insumoId);
    if (!insumo?.id) {
      setFormError("Selecione um insumo.");
      return;
    }

    setSavingVinculo(true);
    setFormError(null);
    try {
      await vincularInsumoAoFornecedor(fornecedorVinculo, insumo, {
        conversao: Number(vinculoForm.conversao) || 1,
        custoUnitario: Number(vinculoForm.custoUnitario) || 0,
        diasEntrega: Number(vinculoForm.diasEntrega) || 0,
        diasPedido: Number(vinculoForm.diasPedido) || 0,
        frequenciaPedido: vinculoForm.frequenciaPedido,
        principal: vinculoForm.principal,
        quantidadePadrao: Number(vinculoForm.quantidadePadrao) || 1,
        unidadeUso: vinculoForm.unidadeUso || insumo.unidadeCompra || insumo.unidadeMedida,
      });
      setFornecedorVinculo(null);
      refetchInsumos();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel vincular o insumo.");
    } finally {
      setSavingVinculo(false);
    }
  }

  return (
    <PageShell actions={<Button onClick={abrirNovoFornecedor}>Novo Fornecedor</Button>} eyebrow="Fornecedores" subtitle="Base de parceiros, contatos, custos por insumo e compras recorrentes." title="Fornecedores">
      <section className="operational-kpis">
        <Kpi label="Fornecedores" value={String(fornecedores.length)} />
        <Kpi label="Com contato" value={String(comContato)} />
        <Kpi label="Insumos vinculados" value={String(insumos.filter((item) => item.fornecedores?.length).length)} />
        <Kpi label="Sem contato" value={String(Math.max(fornecedores.length - comContato, 0))} />
      </section>
      {formAberto ? (
        <ActionPanel title={fornecedorEditando ? "Editar fornecedor" : "Novo fornecedor"} error={formError} onClose={() => setFormAberto(false)}>
          <div className="operational-form-grid">
            <Field label="Nome" value={form.nome} onChange={(value) => setForm((current) => ({ ...current, nome: value }))} />
            <Field label="CNPJ" value={form.cnpj} onChange={(value) => setForm((current) => ({ ...current, cnpj: value }))} />
            <Field label="Telefone" value={form.telefone} onChange={(value) => setForm((current) => ({ ...current, telefone: value }))} />
            <Field label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
            <Field label="Endereco" value={form.endereco} onChange={(value) => setForm((current) => ({ ...current, endereco: value }))} />
            <Field label="Observacoes" value={form.observacoes} onChange={(value) => setForm((current) => ({ ...current, observacoes: value }))} />
          </div>
          <SubmitRow loading={saving} onSubmit={salvar} />
        </ActionPanel>
      ) : null}

      {fornecedorVinculo ? (
        <ActionPanel title={`Insumos de ${fornecedorVinculo.nome}`} error={formError} onClose={() => setFornecedorVinculo(null)}>
          <div className="operational-form-grid">
            <SearchableInsumoField
              label="Insumo"
              value={vinculoForm.insumoId}
              insumos={insumos}
              onChange={(value) => {
                const insumo = insumos.find((item) => item.id === value);
                setVinculoForm((current) => ({ ...current, insumoId: value, unidadeUso: insumo?.unidadeCompra || insumo?.unidadeMedida || current.unidadeUso }));
              }}
            />
            <Field label="Custo unitario" type="number" value={vinculoForm.custoUnitario} onChange={(value) => setVinculoForm((current) => ({ ...current, custoUnitario: Number(value) }))} />
            <Field label="Unidade compra/uso" value={vinculoForm.unidadeUso} onChange={(value) => setVinculoForm((current) => ({ ...current, unidadeUso: value }))} />
            <Field label="Conversao" type="number" value={vinculoForm.conversao} onChange={(value) => setVinculoForm((current) => ({ ...current, conversao: Number(value) }))} />
            <Field label="Qtd padrao pedido" type="number" value={vinculoForm.quantidadePadrao} onChange={(value) => setVinculoForm((current) => ({ ...current, quantidadePadrao: Number(value) }))} />
            <Field label="Dias entrega" type="number" value={vinculoForm.diasEntrega} onChange={(value) => setVinculoForm((current) => ({ ...current, diasEntrega: Number(value) }))} />
            <Field label="Dias pedido" type="number" value={vinculoForm.diasPedido} onChange={(value) => setVinculoForm((current) => ({ ...current, diasPedido: Number(value) }))} />
            <Field label="Frequencia pedido" value={vinculoForm.frequenciaPedido} onChange={(value) => setVinculoForm((current) => ({ ...current, frequenciaPedido: value }))} />
            <SelectField label="Fornecedor principal deste insumo" value={vinculoForm.principal ? "sim" : "nao"} onChange={(value) => setVinculoForm((current) => ({ ...current, principal: value === "sim" }))}>
              <option value="sim">Sim</option>
              <option value="nao">Nao</option>
            </SelectField>
          </div>
          <SubmitRow loading={savingVinculo} onSubmit={salvarVinculo} />
        </ActionPanel>
      ) : null}

      {loadingPage ? <LoadingGrid /> : pageError ? <EmptyState title="Erro ao carregar fornecedores" description={pageError} /> : null}
      {!loadingPage && !pageError && fornecedores.length === 0 ? (
        <EmptyState title="Nenhum fornecedor cadastrado" description="Cadastre fornecedores para organizar compras, prazos e custos." action={<Button onClick={abrirNovoFornecedor}>Novo Fornecedor</Button>} />
      ) : null}
      {!loadingPage && fornecedores.length ? (
        <section className="operational-list">
          {fornecedores.map((fornecedor) => (
            <Card className="operational-row" key={fornecedor.id || fornecedor.cnpj || fornecedor.nome}>
              <div>
                <strong>{fornecedor.nome}</strong>
                <span>{fornecedor.cnpj || "CNPJ nao informado"} - {(fornecedor.id && vinculosPorFornecedor[fornecedor.id]?.length) || 0} insumos</span>
                {fornecedor.id && vinculosPorFornecedor[fornecedor.id]?.length ? (
                  <small>
                    {vinculosPorFornecedor[fornecedor.id].slice(0, 4).map((insumo) => {
                      const vinculo = insumo.fornecedores?.find((item) => item.fornecedorId === fornecedor.id);
                      const melhor = melhorCustoDoInsumo(insumo);
                      const melhorValor = melhor?.fornecedorId === fornecedor.id;
                      return `${insumo.nome}: ${money(Number(vinculo?.custoUnitario || vinculo?.custo) || 0)}${melhorValor ? " (melhor valor)" : ""}`;
                    }).join(" | ")}
                  </small>
                ) : null}
              </div>
              <div>
                <Badge>{fornecedor.telefone || "Sem telefone"}</Badge>
                <small>{fornecedor.email || "Sem email"}</small>
                <div className="operational-row__actions">
                  <button type="button" onClick={() => abrirVinculoFornecedor(fornecedor)}>Insumos</button>
                  <button type="button" onClick={() => abrirEditarFornecedor(fornecedor)}>Editar</button>
                  <button type="button" onClick={() => excluirFornecedor(fornecedor)}>Excluir</button>
                </div>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </PageShell>
  );
}

export function FuncionariosPageClient() {
  const { data: funcionarios, error, loading, refetch } = useAsyncData<Funcionario>(listarFuncionarios);
  const [formAberto, setFormAberto] = useState(false);
  const [funcionarioEditando, setFuncionarioEditando] = useState<Funcionario | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    ativo: true,
    cargo: "",
    email: "",
    nome: "",
    observacao: "",
    permissoes: ["dashboard.ver"] as PermissaoFuncionario[],
    role: "funcionario",
    telefone: "",
    turno: "",
  });
  const ativos = funcionarios.filter((item) => item.ativo).length;
  const comAcesso = funcionarios.filter((item) => item.ativo && item.permissoes?.length).length;

  function abrirNovoFuncionario() {
    setFuncionarioEditando(null);
    setForm({
      ativo: true,
      cargo: "",
      email: "",
      nome: "",
      observacao: "",
      permissoes: ["dashboard.ver"],
      role: "funcionario",
      telefone: "",
      turno: "",
    });
    setFormError(null);
    setFormAberto(true);
  }

  function abrirEdicaoFuncionario(funcionario: Funcionario) {
    setFuncionarioEditando(funcionario);
    setForm({
      ativo: funcionario.ativo,
      cargo: funcionario.cargo || "",
      email: funcionario.email || "",
      nome: funcionario.nome || "",
      observacao: funcionario.observacao || "",
      permissoes: funcionario.permissoes?.length ? funcionario.permissoes : ["dashboard.ver"],
      role: funcionario.role || "funcionario",
      telefone: funcionario.telefone || "",
      turno: funcionario.turno || "",
    });
    setFormError(null);
    setFormAberto(true);
  }

  function togglePermissao(permissao: PermissaoFuncionario) {
    setForm((current) => {
      const existe = current.permissoes.includes(permissao);
      const permissoes = existe ? current.permissoes.filter((item) => item !== permissao) : [...current.permissoes, permissao];
      return { ...current, permissoes };
    });
  }

  async function salvar() {
    setSaving(true);
    setFormError(null);
    try {
      if (!form.nome.trim()) throw new Error("Informe o nome do funcionario.");
      if (!form.email.trim()) throw new Error("Informe o email usado no login do funcionario.");
      if (!form.permissoes.length) throw new Error("Libere pelo menos um acesso.");

      const dados = {
        ativo: form.ativo,
        cargo: form.cargo,
        email: form.email.trim().toLowerCase(),
        observacao: form.observacao,
        permissoes: form.permissoes,
        role: form.role as Funcionario["role"],
        telefone: form.telefone,
        turno: form.turno,
      };

      if (funcionarioEditando?.id) {
        await atualizarFuncionario(funcionarioEditando.id, { ...dados, nome: form.nome });
      } else {
        await criarFuncionario({ ...dados, nome: form.nome, dataContratacao: new Date() });
      }

      setForm({ ativo: true, cargo: "", email: "", nome: "", observacao: "", permissoes: ["dashboard.ver"], role: "funcionario", telefone: "", turno: "" });
      setFuncionarioEditando(null);
      setFormAberto(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell actions={<Button onClick={abrirNovoFuncionario}>Novo Funcionario</Button>} eyebrow="Equipe" subtitle="Controle equipe, papel e liberacoes por modulo com bloqueio de rota." title="Funcionarios">
      <section className="operational-kpis">
        <Kpi label="Funcionarios" value={String(funcionarios.length)} />
        <Kpi label="Ativos" value={String(ativos)} />
        <Kpi label="Com acesso" value={String(comAcesso)} />
        <Kpi label="Inativos" value={String(Math.max(funcionarios.length - ativos, 0))} />
      </section>
      {formAberto ? (
        <ActionPanel title={funcionarioEditando ? "Editar acessos do funcionario" : "Novo funcionario"} error={formError} onClose={() => setFormAberto(false)}>
          <div className="operational-form-grid">
            <Field label="Nome" value={form.nome} onChange={(value) => setForm((current) => ({ ...current, nome: value }))} />
            <Field label="Cargo" value={form.cargo} onChange={(value) => setForm((current) => ({ ...current, cargo: value }))} />
            <Field label="Turno" value={form.turno} onChange={(value) => setForm((current) => ({ ...current, turno: value }))} />
            <Field label="Telefone" value={form.telefone} onChange={(value) => setForm((current) => ({ ...current, telefone: value }))} />
            <Field label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
            <SelectField label="Papel" value={form.role} onChange={(value) => setForm((current) => ({ ...current, role: value }))}>
              <option value="funcionario">Funcionario</option>
              <option value="gerente">Gerente</option>
            </SelectField>
            <SelectField label="Status" value={form.ativo ? "ativo" : "inativo"} onChange={(value) => setForm((current) => ({ ...current, ativo: value === "ativo" }))}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </SelectField>
            <Field label="Observacao" value={form.observacao} onChange={(value) => setForm((current) => ({ ...current, observacao: value }))} />
          </div>
          <div className="operational-permissions">
            <strong>Modulos liberados</strong>
            <span>O funcionario so conseguira abrir os modulos marcados abaixo. Rotas diretas tambem sao bloqueadas.</span>
            <div className="operational-permissions__grid">
              {employeePermissionOptions.map((item) => {
                const checked = form.permissoes.includes(item.permission);
                return (
                  <label className={`operational-permission ${checked ? "is-active" : ""}`} key={item.permission}>
                    <input checked={checked} type="checkbox" onChange={() => togglePermissao(item.permission)} />
                    <span>
                      <b>{item.label}</b>
                      <small>{item.risk || "Acesso operacional"}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <SubmitRow loading={saving} onSubmit={salvar} />
        </ActionPanel>
      ) : null}
      {loading ? <LoadingGrid /> : error ? <EmptyState title="Erro ao carregar funcionarios" description={error} /> : null}
      {!loading && !error && funcionarios.length === 0 ? (
        <EmptyState title="Nenhum funcionario cadastrado" description="Cadastre a equipe para controlar acesso, funcoes e operacao." action={<Button onClick={abrirNovoFuncionario}>Novo Funcionario</Button>} />
      ) : null}
      {!loading && funcionarios.length ? (
        <section className="operational-list">
          {funcionarios.map((funcionario) => (
            <Card className="operational-row" key={funcionario.id || funcionario.email || funcionario.nome}>
              <div>
                <strong>{funcionario.nome}</strong>
                <span>{funcionario.cargo || "Cargo nao informado"} - {funcionario.turno || "Turno nao informado"}</span>
                <small>{(funcionario.permissoes || []).map((permissao) => employeePermissionOptions.find((item) => item.permission === permissao)?.label || permissao).join(" | ") || "Sem modulos liberados"}</small>
              </div>
              <div>
                <Badge tone={funcionario.ativo ? "success" : "neutral"}>{funcionario.ativo ? "ativo" : "inativo"}</Badge>
                <Badge>{funcionario.role || "funcionario"}</Badge>
                <small>{funcionario.email || funcionario.telefone || "Sem contato"}</small>
                <div className="operational-row__actions">
                  <button type="button" onClick={() => abrirEdicaoFuncionario(funcionario)}>Editar acessos</button>
                </div>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </PageShell>
  );
}

export function ProducaoPageClient() {
  const { empresaId, lojaId } = useTenantContext();
  const listarInsumosTenant = useCallback(() => listarInsumos({ empresaId, lojaId }), [empresaId, lojaId]);
  const { data: fichas, error: fichasError, loading: fichasLoading, refetch: refetchFichas } = useAsyncData<FichaTecnica>(listarFichasTecnicas);
  const { data: ordens, error: ordensError, loading: ordensLoading } = useAsyncData<OrdemProducao>(listarOrdensProducao);
  const { data: insumos, error: insumosError, loading: insumosLoading, refetch: refetchInsumos } = useAsyncData<Insumo>(listarInsumosTenant);
  const listarPorcoesTenant = useCallback(() => listarPorcoesDisponiveis({ empresaId, lojaId }), [empresaId, lojaId]);
  const { data: porcoes, error: porcoesError, loading: porcoesLoading, refetch: refetchPorcoes } = useAsyncData<ProducaoPorcao>(listarPorcoesTenant);
  const [formAberto, setFormAberto] = useState(false);
  const [porcaoAberta, setPorcaoAberta] = useState(false);
  const [porcaoEditando, setPorcaoEditando] = useState<ProducaoPorcao | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingEdicaoPorcao, setSavingEdicaoPorcao] = useState(false);
  const [savingPorcao, setSavingPorcao] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ custoTotal: 0, nome: "", rendimento: 1, unidade: "un" });
  const [porcaoForm, setPorcaoForm] = useState({
    area: "producao",
    formatoPorcao: "pacote",
    insumoId: "",
    insumoPorcionadoId: "",
    porcoes: 1,
    quantidade: 1,
    quantidadePorPorcao: 1,
  });
  const [porcaoEditForm, setPorcaoEditForm] = useState({
    area: "",
    formatoPorcao: "pacote",
    observacao: "",
    porcoesDisponiveis: 1,
    porcoesGeradas: 1,
    quantidadePorPorcao: 1,
    unidadePorcao: "un",
  });
  const custoFichas = fichas.reduce((acc, item) => acc + (item.custoTotal || 0), 0);
  const loading = fichasLoading || ordensLoading || insumosLoading || porcoesLoading;
  const error = fichasError || ordensError || insumosError || porcoesError;
  const insumoSelecionado = insumos.find((item) => item.id === porcaoForm.insumoId);
  const insumoPorcionadoSelecionado = insumos.find((item) => item.id === porcaoForm.insumoPorcionadoId);
  const porcoesPorInsumo = porcoes.reduce<Record<string, number>>((acc, item) => {
    acc[item.insumoId] = (acc[item.insumoId] || 0) + (Number(item.porcoesDisponiveis) || 0);
    return acc;
  }, {});
  const itensDisponiveisProducao = insumos.filter((item) => (Number(item.quantidadeAtual) || 0) > 0);
  const totalPorcoes = porcoes.reduce((acc, item) => acc + (Number(item.porcoesDisponiveis) || 0), 0);

  async function salvar() {
    setSaving(true);
    setFormError(null);
    try {
      await criarFichaTecnica({
        codigo: `FT-${Date.now()}`,
        custoTotal: Number(form.custoTotal) || 0,
        ingredientes: [],
        margem: 0,
        modoPreparo: "",
        nome: form.nome,
        precoSugerido: 0,
        rendimento: Number(form.rendimento) || 1,
        unidade: form.unidade || "un",
      });
      setForm({ custoTotal: 0, nome: "", rendimento: 1, unidade: "un" });
      setFormAberto(false);
      refetchFichas();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function salvarPorcao() {
    if (!insumoSelecionado?.id) {
      setFormError("Selecione um item do estoque.");
      return;
    }

    setSavingPorcao(true);
    setFormError(null);
    try {
      await registrarSaidaParaProducao({
        area: porcaoForm.area,
        empresaId,
        formatoPorcao: porcaoForm.formatoPorcao,
        insumoId: insumoSelecionado.id,
        insumoNome: insumoSelecionado.nome,
        insumoPorcionadoId: insumoPorcionadoSelecionado?.id,
        insumoPorcionadoNome: insumoPorcionadoSelecionado?.nome,
        lojaId,
        observacao: `Porcionado em formato ${porcaoForm.formatoPorcao}`,
        porcoes: Number(porcaoForm.porcoes) || 1,
        quantidade: Number(porcaoForm.quantidade) || 1,
        quantidadePorPorcao: Number(porcaoForm.quantidadePorPorcao) || 0,
        responsavel: "admin",
        unidade: insumoSelecionado.unidadeMedida || "un",
        unidadePorcao: insumoSelecionado.unidadeMedida || "un",
      });
      setPorcaoForm({ area: "producao", formatoPorcao: "pacote", insumoId: "", insumoPorcionadoId: "", porcoes: 1, quantidade: 1, quantidadePorPorcao: 1 });
      setPorcaoAberta(false);
      refetchPorcoes();
      refetchInsumos();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel gerar porcoes.");
    } finally {
      setSavingPorcao(false);
    }
  }

  function abrirEdicaoPorcao(porcao: ProducaoPorcao) {
    setFormError(null);
    setPorcaoEditando(porcao);
    setPorcaoEditForm({
      area: porcao.area || "producao",
      formatoPorcao: porcao.formatoPorcao || "porcao",
      observacao: porcao.observacao || "",
      porcoesDisponiveis: Number(porcao.porcoesDisponiveis) || 0,
      porcoesGeradas: Number(porcao.porcoesGeradas) || 1,
      quantidadePorPorcao: Number(porcao.quantidadePorPorcao) || 0,
      unidadePorcao: porcao.unidadePorcao || porcao.unidade || "un",
    });
  }

  async function salvarEdicaoPorcao() {
    if (!porcaoEditando?.id) return;

    setSavingEdicaoPorcao(true);
    setFormError(null);
    try {
      await atualizarProducaoPorcao(porcaoEditando.id, {
        area: porcaoEditForm.area,
        empresaId,
        formatoPorcao: porcaoEditForm.formatoPorcao,
        lojaId,
        observacao: porcaoEditForm.observacao,
        porcoesDisponiveis: Number(porcaoEditForm.porcoesDisponiveis) || 0,
        porcoesGeradas: Number(porcaoEditForm.porcoesGeradas) || 1,
        quantidadePorPorcao: Number(porcaoEditForm.quantidadePorPorcao) || 0,
        unidadePorcao: porcaoEditForm.unidadePorcao,
      });
      setPorcaoEditando(null);
      refetchPorcoes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel editar a porcao.");
    } finally {
      setSavingEdicaoPorcao(false);
    }
  }

  async function excluirPorcao(porcao: ProducaoPorcao) {
    if (!porcao.id) return;
    const confirmou = window.confirm(`Excluir a porcao de "${porcao.insumoNome}"? Esta acao remove o controle da porcao, mas nao devolve automaticamente a baixa ao estoque.`);
    if (!confirmou) return;

    setFormError(null);
    try {
      await deletarProducaoPorcao(porcao.id, { empresaId, lojaId });
      refetchPorcoes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel excluir a porcao.");
    }
  }

  async function estornarPorcao(porcao: ProducaoPorcao) {
    if (!porcao.id || !empresaId || !lojaId) return;
    const confirmou = window.confirm(`Estornar a producao de "${porcao.insumoNome}"? O insumo bruto volta ao estoque e as porcoes serao removidas.`);
    if (!confirmou) return;

    setFormError(null);
    try {
      await estornarProducaoPorcao(porcao.id, { empresaId, lojaId, responsavel: "admin" });
      refetchPorcoes();
      refetchInsumos();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel estornar a porcao.");
    }
  }

  return (
    <PageShell
      actions={
        <>
          <Button onClick={() => setPorcaoAberta(true)}>Porcionar Estoque</Button>
          <Button onClick={() => setFormAberto(true)}>Nova Ficha</Button>
        </>
      }
      eyebrow="Producao"
      subtitle="Transforme itens do estoque em porcoes operacionais e acompanhe saldos por formato."
      title="Producao"
    >
      <section className="operational-kpis">
        <Kpi label="Fichas tecnicas" value={String(fichas.length)} />
        <Kpi label="Itens disponiveis" value={String(itensDisponiveisProducao.length)} />
        <Kpi label="Porcoes prontas" value={String(totalPorcoes)} />
        <Kpi label="Custo fichas" value={money(custoFichas)} />
      </section>

      {porcaoAberta ? (
        <ActionPanel title="Porcionar item do estoque" error={formError} onClose={() => setPorcaoAberta(false)}>
          <div className="operational-form-grid">
            <SearchableInsumoField
              label="Item em estoque"
              value={porcaoForm.insumoId}
              insumos={itensDisponiveisProducao}
              descricao={(insumo) => `${Number(insumo.quantidadeAtual) || 0} ${insumo.unidadeMedida || insumo.unidadeCompra || "un"} disponivel`}
              onChange={(value) => setPorcaoForm((current) => ({ ...current, insumoId: value }))}
            />
            <SearchableInsumoField
              label="Item porcionado"
              value={porcaoForm.insumoPorcionadoId}
              insumos={insumos}
              descricao={(insumo) => `${Number(insumo.quantidadeAtual) || 0} ${insumo.unidadeUso || insumo.unidadeMedida || "un"} em estoque`}
              onChange={(value) => setPorcaoForm((current) => ({ ...current, insumoPorcionadoId: value }))}
            />
            <Field label="Quantidade a baixar" type="number" value={porcaoForm.quantidade} onChange={(value) => setPorcaoForm((current) => ({ ...current, quantidade: Number(value) }))} />
            <Field label="Quantidade de porcoes" type="number" value={porcaoForm.porcoes} onChange={(value) => setPorcaoForm((current) => ({ ...current, porcoes: Number(value) }))} />
            <SelectField label="Formato" value={porcaoForm.formatoPorcao} onChange={(value) => setPorcaoForm((current) => ({ ...current, formatoPorcao: value }))}>
              <option value="pacote">Pacote</option>
              <option value="bisnaga">Bisnaga</option>
              <option value="pote">Pote</option>
              <option value="saco">Saco</option>
              <option value="unidade">Unidade</option>
            </SelectField>
            <Field label="Qtd por porcao" type="number" value={porcaoForm.quantidadePorPorcao} onChange={(value) => setPorcaoForm((current) => ({ ...current, quantidadePorPorcao: Number(value) }))} />
            <Field label="Area" value={porcaoForm.area} onChange={(value) => setPorcaoForm((current) => ({ ...current, area: value }))} />
          </div>
          {insumoSelecionado ? (
            <Card className="operational-row">
              <div>
                <strong>{insumoSelecionado.nome}</strong>
                <span>Estoque atual: {insumoSelecionado.quantidadeAtual} {insumoSelecionado.unidadeMedida} | Porcionado: {porcoesPorInsumo[insumoSelecionado.id || ""] || 0} porcoes</span>
              </div>
              <div>
                <Badge tone="warning">{porcaoForm.formatoPorcao}</Badge>
                <small>Depois da baixa: {Math.max(0, (Number(insumoSelecionado.quantidadeAtual) || 0) - (Number(porcaoForm.quantidade) || 0))} {insumoSelecionado.unidadeMedida}</small>
              </div>
            </Card>
          ) : null}
          <SubmitRow loading={savingPorcao} onSubmit={salvarPorcao} />
        </ActionPanel>
      ) : null}

      {porcaoEditando ? (
        <ActionPanel title={`Editar porcao - ${porcaoEditando.insumoNome}`} error={formError} onClose={() => setPorcaoEditando(null)}>
          <div className="operational-form-grid">
            <Field label="Porcoes geradas" type="number" value={porcaoEditForm.porcoesGeradas} onChange={(value) => setPorcaoEditForm((current) => ({ ...current, porcoesGeradas: Number(value) }))} />
            <Field label="Porcoes disponiveis" type="number" value={porcaoEditForm.porcoesDisponiveis} onChange={(value) => setPorcaoEditForm((current) => ({ ...current, porcoesDisponiveis: Number(value) }))} />
            <SelectField label="Formato" value={porcaoEditForm.formatoPorcao} onChange={(value) => setPorcaoEditForm((current) => ({ ...current, formatoPorcao: value }))}>
              <option value="pacote">Pacote</option>
              <option value="bisnaga">Bisnaga</option>
              <option value="pote">Pote</option>
              <option value="saco">Saco</option>
              <option value="unidade">Unidade</option>
              <option value="porcao">Porcao</option>
            </SelectField>
            <Field label="Qtd por porcao" type="number" value={porcaoEditForm.quantidadePorPorcao} onChange={(value) => setPorcaoEditForm((current) => ({ ...current, quantidadePorPorcao: Number(value) }))} />
            <Field label="Unidade da porcao" value={porcaoEditForm.unidadePorcao} onChange={(value) => setPorcaoEditForm((current) => ({ ...current, unidadePorcao: value }))} />
            <Field label="Area" value={porcaoEditForm.area} onChange={(value) => setPorcaoEditForm((current) => ({ ...current, area: value }))} />
            <Field label="Observacao" value={porcaoEditForm.observacao} onChange={(value) => setPorcaoEditForm((current) => ({ ...current, observacao: value }))} />
          </div>
          <Card className="operational-row">
            <div>
              <strong>Baixa original preservada</strong>
              <span>{porcaoEditando.quantidadeBaixada} {porcaoEditando.unidade} ja foram baixados do estoque quando essa porcao foi criada.</span>
            </div>
            <div>
              <Badge tone="warning">controle</Badge>
              <small>Editar aqui nao devolve estoque bruto.</small>
            </div>
          </Card>
          <SubmitRow loading={savingEdicaoPorcao} onSubmit={salvarEdicaoPorcao} />
        </ActionPanel>
      ) : null}

      {formAberto ? (
        <ActionPanel title="Nova ficha tecnica" error={formError} onClose={() => setFormAberto(false)}>
          <div className="operational-form-grid">
            <Field label="Nome" value={form.nome} onChange={(value) => setForm((current) => ({ ...current, nome: value }))} />
            <Field label="Rendimento" type="number" value={form.rendimento} onChange={(value) => setForm((current) => ({ ...current, rendimento: Number(value) }))} />
            <Field label="Unidade" value={form.unidade} onChange={(value) => setForm((current) => ({ ...current, unidade: value }))} />
            <Field label="Custo total" type="number" value={form.custoTotal} onChange={(value) => setForm((current) => ({ ...current, custoTotal: Number(value) }))} />
          </div>
          <SubmitRow loading={saving} onSubmit={salvar} />
        </ActionPanel>
      ) : null}
      {loading ? <LoadingGrid /> : error ? <EmptyState title="Erro ao carregar producao" description={error} /> : null}
      {!loading && !error && fichas.length === 0 && ordens.length === 0 ? (
        <EmptyState title="Nenhuma producao cadastrada" description="Escolha um item do estoque para transformar em porcao ou crie fichas tecnicas." action={<Button onClick={() => setPorcaoAberta(true)}>Porcionar Estoque</Button>} />
      ) : null}
      {!loading && !error && itensDisponiveisProducao.length ? (
        <section className="operational-list">
          {itensDisponiveisProducao.slice(0, 8).map((insumo) => (
            <Card className="operational-row" key={insumo.id || insumo.nome}>
              <div>
                <strong>{insumo.nome}</strong>
                <span>Estoque: {insumo.quantidadeAtual} {insumo.unidadeMedida} | Porcionado: {porcoesPorInsumo[insumo.id || ""] || 0} porcoes</span>
              </div>
              <div>
                <Badge tone={(porcoesPorInsumo[insumo.id || ""] || 0) > 0 ? "success" : "neutral"}>{insumo.unidadeCompra || insumo.unidadeMedida || "un"}</Badge>
                <button type="button" onClick={() => {
                  setPorcaoForm((current) => ({ ...current, insumoId: insumo.id || "", quantidade: 1 }));
                  setPorcaoAberta(true);
                }}>Porcionar</button>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
      {!loading && !error && porcoes.length ? (
        <section className="operational-list">
          {porcoes.map((porcao) => (
            <Card className="operational-row" key={porcao.id || `${porcao.insumoId}-${porcao.criadoEm}`}>
              <div>
                <strong>{porcao.insumoNome}</strong>
                {porcao.insumoPorcionadoNome ? <span>Gerou estoque em: {porcao.insumoPorcionadoNome}</span> : null}
                <span>{porcao.porcoesDisponiveis}/{porcao.porcoesGeradas} {porcao.formatoPorcao || "porcoes"} disponiveis em {porcao.area}</span>
              </div>
              <div>
                <Badge tone="success">{porcao.formatoPorcao || "porcao"}</Badge>
                <small>Baixado: {porcao.quantidadeBaixada} {porcao.unidade}</small>
                <small>{porcao.quantidadePorPorcao ? `${porcao.quantidadePorPorcao} ${porcao.unidadePorcao || porcao.unidade} por porcao` : money(porcao.custoPorPorcao)}</small>
                <div className="operational-row__actions">
                  <button type="button" onClick={() => abrirEdicaoPorcao(porcao)}>Editar</button>
                  <button type="button" onClick={() => estornarPorcao(porcao)}>Estornar</button>
                  <button type="button" onClick={() => excluirPorcao(porcao)}>Excluir</button>
                </div>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
      {!loading && (fichas.length || ordens.length) ? (
        <section className="operational-list">
          {fichas.map((ficha) => (
            <Card className="operational-row" key={ficha.id || ficha.codigo || ficha.nome}>
              <div>
                <strong>{ficha.nome}</strong>
                <span>{ficha.rendimento} {ficha.unidade} - {ficha.codigo || "sem codigo"}</span>
              </div>
              <div>
                <Badge tone="success">ficha</Badge>
                <b>{money(ficha.custoTotal)}</b>
              </div>
            </Card>
          ))}
          {ordens.map((ordem) => (
            <Card className="operational-row" key={ordem.id || `${ordem.fichaTecnicaId}-${ordem.dataProgramada}`}>
              <div>
                <strong>{ordem.fichaTecnicaNome}</strong>
                <span>Programada para {dateLabel(ordem.dataProgramada)}</span>
              </div>
              <div>
                <Badge tone={ordem.quantidadeProduzida >= ordem.quantidadeProduzir ? "success" : "warning"}>ordem</Badge>
                <small>{ordem.quantidadeProduzida}/{ordem.quantidadeProduzir}</small>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </PageShell>
  );
}

export function ConfiguracoesPageClient() {
  return (
    <PageShell eyebrow="Configuracoes" subtitle="Central de preferencias do estabelecimento, canais e automacoes." title="Configuracoes">
      <section className="operational-cards">
        <Card className="operational-feature"><strong>IA Carioquinha</strong><span>Assistente e sugestoes inteligentes.</span><a href="/configuracoes/carioquinha">Abrir</a></Card>
        <Card className="operational-feature"><strong>WhatsApp</strong><span>Conexao, webhooks e mensagens.</span><a href="/configuracoes/whatsapp">Abrir</a></Card>
        <Card className="operational-feature"><strong>Planos</strong><span>Recursos premium e permissao por modulo.</span><a href="/precificacao">Ver Plus</a></Card>
      </section>
    </PageShell>
  );
}

export function ReposicaoPageClient() {
  return (
    <PageShell eyebrow="Reposicao" subtitle="Alertas de compra, cobertura de estoque e sugestoes por fornecedor." title="Reposicao Inteligente">
      <section className="operational-cards">
        <Card className="operational-feature"><strong>Alertas de estoque</strong><span>Produtos zerados, abaixo do minimo e com baixa cobertura.</span><a href="/estoque">Ver estoque</a></Card>
        <Card className="operational-feature"><strong>Compras recomendadas</strong><span>Pedidos sugeridos com base em minimo, maximo e consumo.</span><a href="/compras">Ver compras</a></Card>
        <Card className="operational-feature"><strong>Fornecedores</strong><span>Melhor custo, prazo e contato para reposicao.</span><a href="/fornecedores">Ver fornecedores</a></Card>
      </section>
    </PageShell>
  );
}
