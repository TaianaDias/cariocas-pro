"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { criarPedido, listarPedidos } from "../../services/compras.service";
import { listarDesperdicios, registrarDesperdicio } from "../../services/desperdicio.service";
import { criarFornecedor, listarFornecedores } from "../../services/fornecedores.service";
import { criarFuncionario, listarFuncionarios } from "../../services/funcionarios.service";
import { criarFichaTecnica, listarFichasTecnicas, listarOrdensProducao } from "../../services/producao.service";
import type { Desperdicio, FichaTecnica, Fornecedor, Funcionario, OrdemProducao, PedidoCompra } from "../../types";

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

function SubmitRow({ loading, onSubmit }: { loading: boolean; onSubmit: () => void }) {
  return (
    <div className="operational-submit">
      <Button onClick={onSubmit} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
    </div>
  );
}

export function ComprasPageClient() {
  const { data: pedidos, error, loading, refetch } = useAsyncData<PedidoCompra>(listarPedidos);
  const [formAberto, setFormAberto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ fornecedorNome: "", numero: "", valorTotal: 0 });
  const total = pedidos.reduce((acc, pedido) => acc + (pedido.valorTotal || 0), 0);
  const pendentes = pedidos.filter((pedido) => pedido.status !== "recebido").length;

  async function salvar() {
    setSaving(true);
    setFormError(null);
    try {
      await criarPedido({
        dataPedido: new Date(),
        fornecedorId: "",
        fornecedorNome: form.fornecedorNome || "Fornecedor nao informado",
        itens: [],
        numero: form.numero || `PED-${Date.now()}`,
        observacoes: "",
        status: "pendente",
        valorTotal: Number(form.valorTotal) || 0,
      }, "admin");
      setForm({ fornecedorNome: "", numero: "", valorTotal: 0 });
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
      actions={<Button onClick={() => setFormAberto(true)}>Novo Pedido</Button>}
      eyebrow="Compras"
      subtitle="Acompanhe pedidos, fornecedores e entradas previstas."
      title="Compras"
    >
      <section className="operational-kpis">
        <Kpi label="Pedidos" value={String(pedidos.length)} />
        <Kpi label="Pendentes" value={String(pendentes)} />
        <Kpi label="Valor total" value={money(total)} />
      </section>

      {formAberto ? (
        <ActionPanel title="Novo pedido de compra" error={formError} onClose={() => setFormAberto(false)}>
          <div className="operational-form-grid">
            <Field label="Numero" value={form.numero} onChange={(value) => setForm((current) => ({ ...current, numero: value }))} />
            <Field label="Fornecedor" value={form.fornecedorNome} onChange={(value) => setForm((current) => ({ ...current, fornecedorNome: value }))} />
            <Field label="Valor total" type="number" value={form.valorTotal} onChange={(value) => setForm((current) => ({ ...current, valorTotal: Number(value) }))} />
          </div>
          <SubmitRow loading={saving} onSubmit={salvar} />
        </ActionPanel>
      ) : null}

      {loading ? <LoadingGrid /> : error ? <EmptyState title="Erro ao carregar compras" description={error} /> : null}
      {!loading && !error && pedidos.length === 0 ? (
        <EmptyState title="Nenhum pedido registrado" description="Os proximos pedidos de compra aparecerao aqui." action={<Button onClick={() => setFormAberto(true)}>Novo Pedido</Button>} />
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
