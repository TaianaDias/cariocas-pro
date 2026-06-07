"use client";

import { useMemo, useState } from "react";

import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { usePrecificacao } from "../../hooks/usePrecificacao";
import { canAccessPrecificacao } from "../../lib/permissions";
import { simularPreco } from "../../services/precificacao.service";
import type { ReceitaIngrediente, ReceitaPrecificacao, StatusFinanceiroReceita, UnidadeMedidaPrecificacao } from "../../types";

const abas = ["Fichas Tecnicas", "CMV Dinamico", "Custos", "Precificacao", "Simulacoes", "Relatorios", "Dashboard Financeiro"];
const unidades: UnidadeMedidaPrecificacao[] = ["KG", "G", "UN", "ML", "L", "CAIXA", "PACOTE"];

const receitaInicial: Partial<ReceitaPrecificacao> = {
  ativa: true,
  categoria: "Hamburguer",
  descricao: "",
  fracionado: false,
  ingrediente: false,
  ingredientes: [],
  margemDesejada: 35,
  modoPreparo: "",
  nome: "",
  observacoesInternas: "",
  precoVenda: 0,
};

export function PrecificacaoPageClient() {
  const precificacao = usePrecificacao();
  const [abaAtiva, setAbaAtiva] = useState(abas[0]);
  const [form, setForm] = useState<Partial<ReceitaPrecificacao>>(receitaInicial);
  const [ingrediente, setIngrediente] = useState<Partial<ReceitaIngrediente>>({
    custoUnitarioConvertido: 0,
    insumoNome: "",
    quantidade: 0,
    tipo: "insumo",
    unidade: "G",
  });
  const [ingredienteError, setIngredienteError] = useState<string | null>(null);
  const [simulador, setSimulador] = useState({
    custo: 12,
    desconto: 0,
    embalagem: 2,
    margem: 35,
    precoVenda: 29.9,
    promocao: 0,
    taxa: 3.5,
  });

  const allowed = canAccessPrecificacao(precificacao.plan, precificacao.role);
  const abasDisponiveis = precificacao.canUseFullModule ? abas : ["Fichas Tecnicas"];
  const simulacao = useMemo(() => simularPreco(simulador), [simulador]);

  if (!allowed) {
    return (
      <EmptyState
        title="Precificacao Inteligente bloqueada"
        description="Este modulo premium esta disponivel nos planos Plus e Full. O plano Pro acessa apenas ficha tecnica simples."
        action={<Button>Falar com comercial</Button>}
      />
    );
  }

  function adicionarIngrediente() {
    const insumoNome = ingrediente.insumoNome?.trim() || "";
    const quantidade = parseNumber(ingrediente.quantidade);
    const custoUnitarioConvertido = precificacao.canSeeMoney ? parseNumber(ingrediente.custoUnitarioConvertido) : 0;

    if (!insumoNome) {
      setIngredienteError("Informe o insumo ou receita base.");
      return;
    }

    if (quantidade <= 0) {
      setIngredienteError("Informe uma quantidade maior que zero.");
      return;
    }

    const novoIngrediente: ReceitaIngrediente = {
      custoTotal: quantidade * custoUnitarioConvertido,
      custoUnitarioConvertido,
      empresaId: precificacao.empresaId,
      insumoId: ingrediente.insumoId || crypto.randomUUID(),
      insumoNome,
      quantidade,
      receitaId: form.id || "nova",
      tipo: ingrediente.tipo || "insumo",
      unidade: ingrediente.unidade || "G",
      lojaId: precificacao.lojaId,
    };

    setForm((current) => ({
      ...current,
      ingredientes: [...(current.ingredientes || []), novoIngrediente],
    }));
    setIngredienteError(null);
    setIngrediente({ custoUnitarioConvertido: 0, insumoNome: "", quantidade: 0, tipo: "insumo", unidade: "G" });
  }

  async function salvarReceita() {
    await precificacao.salvarReceita(form);
    setForm(receitaInicial);
  }

  return (
    <main className="precificacao-page">
      <section className="precificacao-hero">
        <div>
          <span className="precificacao-eyebrow">Modulo premium PLUS</span>
          <h1>Precificacao Inteligente</h1>
          <p>Fichas tecnicas, CMV dinamico, custos fixos, simulacoes e sugestao automatica de preco para evitar prejuizo.</p>
        </div>
        <div className="precificacao-hero__actions">
          <Button onClick={() => setAbaAtiva("Fichas Tecnicas")}>+ Nova Receita</Button>
          <Button variant="secondary" onClick={precificacao.refetch}>Recalcular CMV</Button>
        </div>
      </section>

      <nav className="precificacao-tabs" aria-label="Abas de precificacao">
        {abasDisponiveis.map((aba) => (
          <button className={abaAtiva === aba ? "is-active" : ""} key={aba} onClick={() => setAbaAtiva(aba)}>
            {aba}
          </button>
        ))}
      </nav>

      {precificacao.canSeeMoney ? (
        <section className="precificacao-kpis">
          <Kpi label="Lucro estimado" value={money(precificacao.kpis.lucroTotal)} />
          <Kpi label="CMV medio" value={`${precificacao.kpis.cmvMedio.toFixed(1)}%`} />
          <Kpi label="Margem media" value={`${precificacao.kpis.margemMedia.toFixed(1)}%`} />
          <Kpi label="Receitas criticas" value={String(precificacao.kpis.criticas)} tone={precificacao.kpis.criticas ? "danger" : "success"} />
        </section>
      ) : (
        <Card className="precificacao-simple-mode">
          <strong>Ficha tecnica simples</strong>
          <p>Seu acesso permite cadastrar receitas e ingredientes sem visualizar custos, lucro, margem, CMV avancado ou sugestoes de preco.</p>
        </Card>
      )}

      {abaAtiva === "Fichas Tecnicas" ? (
        <section className="precificacao-grid">
          <Card className="precificacao-form">
            <header>
              <strong>Cadastro de Receita</strong>
              <span>Receita, ficha tecnica e ingrediente base reutilizavel.</span>
            </header>
            <div className="precificacao-form__grid">
              <Field label="Nome" value={form.nome || ""} onChange={(value) => setForm({ ...form, nome: value })} />
              <Field label="Categoria" value={form.categoria || ""} onChange={(value) => setForm({ ...form, categoria: value })} />
              <Field label="Preco de venda" type="number" value={String(form.precoVenda || "")} onChange={(value) => setForm({ ...form, precoVenda: Number(value) })} />
              <Field label="Imagem URL" value={form.imagemUrl || ""} onChange={(value) => setForm({ ...form, imagemUrl: value })} />
            </div>
            <label className="precificacao-field precificacao-field--full">
              <span>Descricao</span>
              <textarea value={form.descricao || ""} onChange={(event) => setForm({ ...form, descricao: event.target.value })} />
            </label>
            <label className="precificacao-field precificacao-field--full">
              <span>Modo de preparo</span>
              <textarea value={form.modoPreparo || ""} onChange={(event) => setForm({ ...form, modoPreparo: event.target.value })} />
            </label>
            <div className="precificacao-switches">
              <Switch label="E fracionado?" checked={Boolean(form.fracionado)} onChange={(value) => setForm({ ...form, fracionado: value })} />
              <Switch label="E ingrediente?" checked={Boolean(form.ingrediente)} onChange={(value) => setForm({ ...form, ingrediente: value })} />
              <Switch label="Receita ativa?" checked={Boolean(form.ativa)} onChange={(value) => setForm({ ...form, ativa: value })} />
            </div>

            <div className="precificacao-ingredient">
              <strong>Adicionar Ingrediente</strong>
              <div className="precificacao-form__grid">
                <Field label="Insumo ou receita base" value={ingrediente.insumoNome || ""} onChange={(value) => setIngrediente({ ...ingrediente, insumoNome: value })} />
                <Field label="Quantidade" value={String(ingrediente.quantidade || "")} onChange={(value) => setIngrediente({ ...ingrediente, quantidade: parseNumber(value) })} />
                <label className="precificacao-field">
                  <span>Unidade</span>
                  <select value={ingrediente.unidade} onChange={(event) => setIngrediente({ ...ingrediente, unidade: event.target.value as UnidadeMedidaPrecificacao })}>
                    {unidades.map((unidade) => <option key={unidade}>{unidade}</option>)}
                  </select>
                </label>
                {precificacao.canSeeMoney ? (
                  <Field label="Custo unitario convertido" value={String(ingrediente.custoUnitarioConvertido || "")} onChange={(value) => setIngrediente({ ...ingrediente, custoUnitarioConvertido: parseNumber(value) })} />
                ) : null}
              </div>
              {ingredienteError ? <p className="precificacao-inline-error">{ingredienteError}</p> : null}
              <Button variant="secondary" onClick={adicionarIngrediente}>Adicionar Ingrediente</Button>
            </div>

            <ListaIngredientes ingredientes={form.ingredientes || []} canSeeMoney={precificacao.canSeeMoney} />
            <Button onClick={salvarReceita} disabled={!precificacao.canConfigure && precificacao.plan !== "pro"} fullWidth>
              Salvar Receita
            </Button>
          </Card>

          <ReceitasGrid receitas={precificacao.receitas} canSeeMoney={precificacao.canSeeMoney} />
        </section>
      ) : null}

      {precificacao.canUseFullModule && abaAtiva === "Custos" ? (
        <Card className="precificacao-costs">
          <header>
            <strong>Custos Fixos Rateados</strong>
            <span>Custo fixo por pedido: {precificacao.canSeeMoney ? money(precificacao.custosFixos.custoFixoPorPedido) : "Bloqueado"}</span>
          </header>
          <div className="precificacao-form__grid">
            {(["aluguel", "energia", "agua", "internet", "salarios", "contador", "sistema", "marketing", "manutencao", "encargos", "outros", "pedidosMensais"] as const).map((campo) => (
              <Field
                key={campo}
                label={campo}
                type="number"
                value={String(precificacao.custosFixos[campo] || "")}
                onChange={(value) => precificacao.setCustosFixos({ ...precificacao.custosFixos, [campo]: Number(value) })}
              />
            ))}
          </div>
          <Button onClick={() => precificacao.salvarCustos(precificacao.custosFixos)} disabled={!precificacao.canConfigure}>Salvar Custos</Button>
        </Card>
      ) : null}

      {precificacao.canUseFullModule && (abaAtiva === "Simulacoes" || abaAtiva === "Precificacao") ? (
        <section className="precificacao-grid precificacao-grid--simulator">
          <Card className="precificacao-form">
            <header>
              <strong>Simulador em Tempo Real</strong>
              <span>Altere custo, taxa, embalagem, desconto e promocao.</span>
            </header>
            <div className="precificacao-form__grid">
              {Object.entries(simulador).map(([key, value]) => (
                <Field key={key} label={key} type="number" value={String(value)} onChange={(next) => setSimulador({ ...simulador, [key]: Number(next) })} />
              ))}
            </div>
          </Card>
          <Card className={`precificacao-result precificacao-result--${simulacao.risco}`}>
            <span>Resultado da simulacao</span>
            <strong>{money(simulacao.lucro)}</strong>
            <p>Margem {simulacao.margem.toFixed(1)}% | CMV {simulacao.cmv.toFixed(1)}% | Risco {labelStatus(simulacao.risco)}</p>
          </Card>
        </section>
      ) : null}

      {precificacao.canUseFullModule && (abaAtiva === "Dashboard Financeiro" || abaAtiva === "Relatorios" || abaAtiva === "CMV Dinamico") ? (
        <section className="precificacao-grid">
          <Card className="precificacao-list">
            <strong>Alertas Inteligentes</strong>
            {precificacao.alertas.length ? precificacao.alertas.map((alerta) => <p key={alerta}>{alerta}</p>) : <p>Nenhum alerta financeiro critico agora.</p>}
          </Card>
          <Card className="precificacao-list">
            <strong>Inteligencia de Reajuste</strong>
            <p>Mais lucrativa: {precificacao.kpis.maisLucrativa?.nome || "Sem dados"}</p>
            <p>Pior CMV: {precificacao.kpis.piorCmv?.nome || "Sem dados"}</p>
            <p>Historico e restauracao usam as colecoes receitas, receitaIngredientes e historicoCustosInsumos.</p>
          </Card>
        </section>
      ) : null}
    </main>
  );
}

function Field({ label, onChange, type = "text", value }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="precificacao-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;

  const trimmed = value.trim();
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="precificacao-switch">
      <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Kpi({ label, tone, value }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <Card className={`precificacao-kpi ${tone ? `precificacao-kpi--${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}

function ListaIngredientes({ canSeeMoney, ingredientes }: { ingredientes: ReceitaIngrediente[]; canSeeMoney: boolean }) {
  if (!ingredientes.length) {
    return <p className="precificacao-ingredients-empty">Nenhum ingrediente adicionado ainda.</p>;
  }

  return (
    <div className="precificacao-ingredients-list">
      {ingredientes.map((item) => (
        <div key={`${item.insumoId}-${item.insumoNome}`}>
          <span>{item.insumoNome}</span>
          <strong>{item.quantidade} {item.unidade}</strong>
          <small>{canSeeMoney ? money(item.custoUnitarioConvertido) : "Custo bloqueado"}</small>
        </div>
      ))}
    </div>
  );
}

function ReceitasGrid({ canSeeMoney, receitas }: { receitas: ReceitaPrecificacao[]; canSeeMoney: boolean }) {
  if (!receitas.length) {
    return <EmptyState title="Nenhuma receita cadastrada" description="Cadastre a primeira ficha tecnica para calcular CMV e preco sugerido." />;
  }

  return (
    <div className="receitas-grid">
      {receitas.map((receita) => (
        <Card className={`receita-card receita-card--${receita.status}`} key={receita.id || receita.nome}>
          <div className="receita-card__image">{receita.imagemUrl ? <img alt="" src={receita.imagemUrl} /> : <span>{receita.nome.slice(0, 2).toUpperCase()}</span>}</div>
          <div className="receita-card__body">
            <span>{labelStatus(receita.status)}</span>
            <h2>{receita.nome}</h2>
            <dl>
              <div><dt>Preco atual</dt><dd>{money(receita.precoVenda)}</dd></div>
              <div><dt>Custo total</dt><dd>{canSeeMoney ? money(receita.custoTotalReal) : "Bloqueado"}</dd></div>
              <div><dt>Lucro</dt><dd>{canSeeMoney ? money(receita.lucro) : "Bloqueado"}</dd></div>
              <div><dt>Margem</dt><dd>{canSeeMoney ? `${receita.margem.toFixed(1)}%` : "Bloqueado"}</dd></div>
              <div><dt>CMV</dt><dd>{receita.cmv.toFixed(1)}%</dd></div>
            </dl>
            {canSeeMoney ? (
              <div className="receita-card__prices">
                <span>Minimo {money(receita.precoMinimo)}</span>
                <span>Recomendado {money(receita.precoSugerido)}</span>
                <span>Premium {money(receita.precoPremium)}</span>
              </div>
            ) : null}
            <div className="receita-card__actions">
              <Button variant="secondary">Editar</Button>
              <Button variant="ghost">Ver Ficha</Button>
              <Button variant="ghost">Recalcular CMV</Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(value || 0);
}

function labelStatus(status: StatusFinanceiroReceita) {
  return status === "saudavel" ? "Saudavel" : status === "atencao" ? "Atencao" : "Critico";
}
