"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { atualizarPedido, criarPedido, deletarPedido, listarPedidos } from "../../services/compras.service";
import { getConfiguracao } from "../../services/configuracoes.service";
import { listarDesperdicios, registrarDesperdicio } from "../../services/desperdicio.service";
import { listarInsumos } from "../../services/estoque.service";
import { criarFornecedor, listarFornecedores } from "../../services/fornecedores.service";
import { criarFuncionario, listarFuncionarios } from "../../services/funcionarios.service";
import { criarMercado, listarMercados } from "../../services/mercados.service";
import { criarFichaTecnica, listarFichasTecnicas, listarOrdensProducao } from "../../services/producao.service";
import type { Desperdicio, FichaTecnica, Fornecedor, Funcionario, Insumo, Mercado, OrdemProducao, PedidoCompra } from "../../types";

type Status = "idle" | "loading" | "ready" | "error";

const listarTodosDesperdicios = () => listarDesperdicios();

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

function SubmitRow({ loading, onSubmit }: { loading: boolean; onSubmit: () => void }) {
  return (
    <div className="operational-submit">
      <Button onClick={onSubmit} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
    </div>
  );
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
  const { data: pedidos, error, loading, refetch } = useAsyncData<PedidoCompra>(listarPedidos);
  const { data: insumos, error: insumosError, loading: insumosLoading } = useAsyncData<Insumo>(listarInsumos);
  const { data: fornecedores, error: fornecedoresError, loading: fornecedoresLoading } = useAsyncData<Fornecedor>(listarFornecedores);
  const { data: mercados, error: mercadosError, loading: mercadosLoading, refetch: refetchMercados } = useAsyncData<Mercado>(listarMercados);
  const [formAberto, setFormAberto] = useState(false);
  const [pedidoEditando, setPedidoEditando] = useState<PedidoCompra | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingMercado, setSavingMercado] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mercadoError, setMercadoError] = useState<string | null>(null);
  const [adminWhatsapp, setAdminWhatsapp] = useState("");
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
      await deletarPedido(pedido.id);
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
        fornecedorId: form.origemCompra === "fornecedor" ? form.fornecedorId : "",
        fornecedorNome: nomeDestino,
        itens,
        linkDisparo,
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
        await criarPedido(dadosPedido, "admin");
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
            <div className="operational-buy-list">
              {insumos.map((insumo) => {
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
  const { data: desperdicios, error, loading, refetch } = useAsyncData<Desperdicio>(listarTodosDesperdicios);
  const [formAberto, setFormAberto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ custoEstimado: 0, insumoNome: "", motivo: "", quantidade: 1 });
  const total = desperdicios.reduce((acc, item) => acc + (item.custoEstimado || 0), 0);
  const categorias = new Set(desperdicios.map((item) => item.categoria || "Sem categoria")).size;

  async function salvar() {
    setSaving(true);
    setFormError(null);
    try {
      await registrarDesperdicio({
        categoria: "perda",
        custoEstimado: Number(form.custoEstimado) || 0,
        data: new Date(),
        insumoId: "",
        insumoNome: form.insumoNome,
        motivo: form.motivo,
        observacao: "",
        quantidade: Number(form.quantidade) || 1,
        responsavel: "admin",
        unidade: "un",
      });
      setForm({ custoEstimado: 0, insumoNome: "", motivo: "", quantidade: 1 });
      setFormAberto(false);
      refetch();
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
            <Field label="Insumo" value={form.insumoNome} onChange={(value) => setForm((current) => ({ ...current, insumoNome: value }))} />
            <Field label="Motivo" value={form.motivo} onChange={(value) => setForm((current) => ({ ...current, motivo: value }))} />
            <Field label="Quantidade" type="number" value={form.quantidade} onChange={(value) => setForm((current) => ({ ...current, quantidade: Number(value) }))} />
            <Field label="Custo estimado" type="number" value={form.custoEstimado} onChange={(value) => setForm((current) => ({ ...current, custoEstimado: Number(value) }))} />
          </div>
          <SubmitRow loading={saving} onSubmit={salvar} />
        </ActionPanel>
      ) : null}

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
                <span>{item.motivo || "Motivo nao informado"}</span>
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
  const { data: fornecedores, error, loading, refetch } = useAsyncData<Fornecedor>(listarFornecedores);
  const [formAberto, setFormAberto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ cnpj: "", email: "", nome: "", telefone: "" });
  const comContato = fornecedores.filter((item) => item.telefone || item.email).length;

  async function salvar() {
    setSaving(true);
    setFormError(null);
    try {
      await criarFornecedor({ ...form, endereco: "", observacoes: "" });
      setForm({ cnpj: "", email: "", nome: "", telefone: "" });
      setFormAberto(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell actions={<Button onClick={() => setFormAberto(true)}>Novo Fornecedor</Button>} eyebrow="Fornecedores" subtitle="Base de parceiros, contatos e compras recorrentes." title="Fornecedores">
      <section className="operational-kpis">
        <Kpi label="Fornecedores" value={String(fornecedores.length)} />
        <Kpi label="Com contato" value={String(comContato)} />
        <Kpi label="Sem contato" value={String(Math.max(fornecedores.length - comContato, 0))} />
      </section>
      {formAberto ? (
        <ActionPanel title="Novo fornecedor" error={formError} onClose={() => setFormAberto(false)}>
          <div className="operational-form-grid">
            <Field label="Nome" value={form.nome} onChange={(value) => setForm((current) => ({ ...current, nome: value }))} />
            <Field label="CNPJ" value={form.cnpj} onChange={(value) => setForm((current) => ({ ...current, cnpj: value }))} />
            <Field label="Telefone" value={form.telefone} onChange={(value) => setForm((current) => ({ ...current, telefone: value }))} />
            <Field label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
          </div>
          <SubmitRow loading={saving} onSubmit={salvar} />
        </ActionPanel>
      ) : null}
      {loading ? <LoadingGrid /> : error ? <EmptyState title="Erro ao carregar fornecedores" description={error} /> : null}
      {!loading && !error && fornecedores.length === 0 ? (
        <EmptyState title="Nenhum fornecedor cadastrado" description="Cadastre fornecedores para organizar compras, prazos e custos." action={<Button onClick={() => setFormAberto(true)}>Novo Fornecedor</Button>} />
      ) : null}
      {!loading && fornecedores.length ? (
        <section className="operational-list">
          {fornecedores.map((fornecedor) => (
            <Card className="operational-row" key={fornecedor.id || fornecedor.cnpj || fornecedor.nome}>
              <div>
                <strong>{fornecedor.nome}</strong>
                <span>{fornecedor.cnpj || "CNPJ nao informado"}</span>
              </div>
              <div>
                <Badge>{fornecedor.telefone || "Sem telefone"}</Badge>
                <small>{fornecedor.email || "Sem email"}</small>
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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ cargo: "", email: "", nome: "", telefone: "", turno: "" });
  const ativos = funcionarios.filter((item) => item.ativo).length;

  async function salvar() {
    setSaving(true);
    setFormError(null);
    try {
      await criarFuncionario({ ...form, ativo: true, dataContratacao: new Date(), observacao: "" });
      setForm({ cargo: "", email: "", nome: "", telefone: "", turno: "" });
      setFormAberto(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell actions={<Button onClick={() => setFormAberto(true)}>Novo Funcionario</Button>} eyebrow="Equipe" subtitle="Acompanhe cargos, turnos, contatos e status da equipe." title="Funcionarios">
      <section className="operational-kpis">
        <Kpi label="Funcionarios" value={String(funcionarios.length)} />
        <Kpi label="Ativos" value={String(ativos)} />
        <Kpi label="Inativos" value={String(Math.max(funcionarios.length - ativos, 0))} />
      </section>
      {formAberto ? (
        <ActionPanel title="Novo funcionario" error={formError} onClose={() => setFormAberto(false)}>
          <div className="operational-form-grid">
            <Field label="Nome" value={form.nome} onChange={(value) => setForm((current) => ({ ...current, nome: value }))} />
            <Field label="Cargo" value={form.cargo} onChange={(value) => setForm((current) => ({ ...current, cargo: value }))} />
            <Field label="Turno" value={form.turno} onChange={(value) => setForm((current) => ({ ...current, turno: value }))} />
            <Field label="Telefone" value={form.telefone} onChange={(value) => setForm((current) => ({ ...current, telefone: value }))} />
            <Field label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
          </div>
          <SubmitRow loading={saving} onSubmit={salvar} />
        </ActionPanel>
      ) : null}
      {loading ? <LoadingGrid /> : error ? <EmptyState title="Erro ao carregar funcionarios" description={error} /> : null}
      {!loading && !error && funcionarios.length === 0 ? (
        <EmptyState title="Nenhum funcionario cadastrado" description="Cadastre a equipe para controlar acesso, funcoes e operacao." action={<Button onClick={() => setFormAberto(true)}>Novo Funcionario</Button>} />
      ) : null}
      {!loading && funcionarios.length ? (
        <section className="operational-list">
          {funcionarios.map((funcionario) => (
            <Card className="operational-row" key={funcionario.id || funcionario.email || funcionario.nome}>
              <div>
                <strong>{funcionario.nome}</strong>
                <span>{funcionario.cargo || "Cargo nao informado"} - {funcionario.turno || "Turno nao informado"}</span>
              </div>
              <div>
                <Badge tone={funcionario.ativo ? "success" : "neutral"}>{funcionario.ativo ? "ativo" : "inativo"}</Badge>
                <small>{funcionario.email || funcionario.telefone || "Sem contato"}</small>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </PageShell>
  );
}

export function ProducaoPageClient() {
  const { data: fichas, error: fichasError, loading: fichasLoading, refetch: refetchFichas } = useAsyncData<FichaTecnica>(listarFichasTecnicas);
  const { data: ordens, error: ordensError, loading: ordensLoading } = useAsyncData<OrdemProducao>(listarOrdensProducao);
  const [formAberto, setFormAberto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ custoTotal: 0, nome: "", rendimento: 1, unidade: "un" });
  const custoFichas = fichas.reduce((acc, item) => acc + (item.custoTotal || 0), 0);
  const loading = fichasLoading || ordensLoading;
  const error = fichasError || ordensError;

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

  return (
    <PageShell actions={<Button onClick={() => setFormAberto(true)}>Nova Ficha</Button>} eyebrow="Producao" subtitle="Fichas tecnicas, ordens de producao e porcoes." title="Producao">
      <section className="operational-kpis">
        <Kpi label="Fichas tecnicas" value={String(fichas.length)} />
        <Kpi label="Ordens" value={String(ordens.length)} />
        <Kpi label="Custo fichas" value={money(custoFichas)} />
      </section>
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
        <EmptyState title="Nenhuma producao cadastrada" description="Crie fichas tecnicas e ordens para controlar preparos e baixas de estoque." action={<Button onClick={() => setFormAberto(true)}>Nova Ficha</Button>} />
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
