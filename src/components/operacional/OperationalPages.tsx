"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { listarPedidos } from "../../services/compras.service";
import { listarDesperdicios } from "../../services/desperdicio.service";
import { listarFornecedores } from "../../services/fornecedores.service";
import { listarFuncionarios } from "../../services/funcionarios.service";
import { listarFichasTecnicas, listarOrdensProducao } from "../../services/producao.service";
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

  useEffect(() => {
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
  }, [loader]);

  return { data, error, loading: status === "loading", status };
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

export function ComprasPageClient() {
  const { data: pedidos, error, loading } = useAsyncData<PedidoCompra>(listarPedidos);
  const total = pedidos.reduce((acc, pedido) => acc + (pedido.valorTotal || 0), 0);
  const pendentes = pedidos.filter((pedido) => pedido.status !== "recebido").length;

  return (
    <PageShell
      actions={<Button>Novo Pedido</Button>}
      eyebrow="Compras"
      subtitle="Acompanhe pedidos, fornecedores e entradas previstas."
      title="Compras"
    >
      <section className="operational-kpis">
        <Kpi label="Pedidos" value={String(pedidos.length)} />
        <Kpi label="Pendentes" value={String(pendentes)} />
        <Kpi label="Valor total" value={money(total)} />
      </section>

      {loading ? <LoadingGrid /> : error ? <EmptyState title="Erro ao carregar compras" description={error} /> : null}
      {!loading && !error && pedidos.length === 0 ? (
        <EmptyState title="Nenhum pedido registrado" description="Os proximos pedidos de compra aparecerao aqui." action={<Button>Novo Pedido</Button>} />
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
  const { data: desperdicios, error, loading } = useAsyncData<Desperdicio>(listarTodosDesperdicios);
  const total = desperdicios.reduce((acc, item) => acc + (item.custoEstimado || 0), 0);
  const categorias = new Set(desperdicios.map((item) => item.categoria || "Sem categoria")).size;

  return (
    <PageShell
      actions={<Button>Registrar Perda</Button>}
      eyebrow="Desperdicio"
      subtitle="Controle perdas por insumo, motivo, responsavel e impacto financeiro."
      title="Desperdicio"
    >
      <section className="operational-kpis">
        <Kpi label="Registros" value={String(desperdicios.length)} />
        <Kpi label="Categorias" value={String(categorias)} />
        <Kpi label="Custo estimado" value={money(total)} />
      </section>

      {loading ? <LoadingGrid /> : error ? <EmptyState title="Erro ao carregar desperdicio" description={error} /> : null}
      {!loading && !error && desperdicios.length === 0 ? (
        <EmptyState title="Nenhuma perda registrada" description="Registre desperdicios para medir impacto em CMV e margem." action={<Button>Registrar Perda</Button>} />
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
  const { data: fornecedores, error, loading } = useAsyncData<Fornecedor>(listarFornecedores);
  const comContato = fornecedores.filter((item) => item.telefone || item.email).length;

  return (
    <PageShell actions={<Button>Novo Fornecedor</Button>} eyebrow="Fornecedores" subtitle="Base de parceiros, contatos e compras recorrentes." title="Fornecedores">
      <section className="operational-kpis">
        <Kpi label="Fornecedores" value={String(fornecedores.length)} />
        <Kpi label="Com contato" value={String(comContato)} />
        <Kpi label="Sem contato" value={String(Math.max(fornecedores.length - comContato, 0))} />
      </section>
      {loading ? <LoadingGrid /> : error ? <EmptyState title="Erro ao carregar fornecedores" description={error} /> : null}
      {!loading && !error && fornecedores.length === 0 ? (
        <EmptyState title="Nenhum fornecedor cadastrado" description="Cadastre fornecedores para organizar compras, prazos e custos." action={<Button>Novo Fornecedor</Button>} />
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
  const { data: funcionarios, error, loading } = useAsyncData<Funcionario>(listarFuncionarios);
  const ativos = funcionarios.filter((item) => item.ativo).length;

  return (
    <PageShell actions={<Button>Novo Funcionario</Button>} eyebrow="Equipe" subtitle="Acompanhe cargos, turnos, contatos e status da equipe." title="Funcionarios">
      <section className="operational-kpis">
        <Kpi label="Funcionarios" value={String(funcionarios.length)} />
        <Kpi label="Ativos" value={String(ativos)} />
        <Kpi label="Inativos" value={String(Math.max(funcionarios.length - ativos, 0))} />
      </section>
      {loading ? <LoadingGrid /> : error ? <EmptyState title="Erro ao carregar funcionarios" description={error} /> : null}
      {!loading && !error && funcionarios.length === 0 ? (
        <EmptyState title="Nenhum funcionario cadastrado" description="Cadastre a equipe para controlar acesso, funcoes e operacao." action={<Button>Novo Funcionario</Button>} />
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
  const { data: fichas, error: fichasError, loading: fichasLoading } = useAsyncData<FichaTecnica>(listarFichasTecnicas);
  const { data: ordens, error: ordensError, loading: ordensLoading } = useAsyncData<OrdemProducao>(listarOrdensProducao);
  const custoFichas = fichas.reduce((acc, item) => acc + (item.custoTotal || 0), 0);
  const loading = fichasLoading || ordensLoading;
  const error = fichasError || ordensError;

  return (
    <PageShell actions={<Button>Nova Producao</Button>} eyebrow="Producao" subtitle="Fichas tecnicas, ordens de producao e porcoes." title="Producao">
      <section className="operational-kpis">
        <Kpi label="Fichas tecnicas" value={String(fichas.length)} />
        <Kpi label="Ordens" value={String(ordens.length)} />
        <Kpi label="Custo fichas" value={money(custoFichas)} />
      </section>
      {loading ? <LoadingGrid /> : error ? <EmptyState title="Erro ao carregar producao" description={error} /> : null}
      {!loading && !error && fichas.length === 0 && ordens.length === 0 ? (
        <EmptyState title="Nenhuma producao cadastrada" description="Crie fichas tecnicas e ordens para controlar preparos e baixas de estoque." action={<Button>Nova Producao</Button>} />
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
