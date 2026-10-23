"use client";

import { useMemo, useState } from "react";

import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { InsumoParaFicha, ReferenciaCustoFicha } from "./InsumoParaFicha";
import { converterUnidade, resolverCustoInsumo } from "../../domain/custos";
import { usePrecificacao } from "../../hooks/usePrecificacao";
import { canAccessPrecificacao } from "../../lib/permissions";
import { registrarAuditoria } from "../../services/auditoria.service";
import { atualizarIngredientesComEstoque, calcularCustoUnitarioUsoInsumo, normalizarUnidadePrecificacao, simularPreco } from "../../services/precificacao.service";
import type { Insumo, ReceitaIngrediente, ReceitaPrecificacao, StatusFinanceiroReceita, UnidadeMedidaPrecificacao } from "../../types";

const abas = ["Fichas Tecnicas", "CMV Dinamico", "Custos", "Precificacao", "Simulacoes", "Relatorios", "Dashboard Financeiro"];
const unidades: UnidadeMedidaPrecificacao[] = ["KG", "G", "UN", "ML", "L", "CAIXA", "PACOTE", "FATIA", "PORCAO"];

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
  const [fichaAberta, setFichaAberta] = useState<ReceitaPrecificacao | null>(null);
  const [ingrediente, setIngrediente] = useState<Partial<ReceitaIngrediente>>({
    custoUnitarioConvertido: 0,
    insumoNome: "",
    quantidade: 0,
    tipo: "insumo",
    unidade: "G",
  });
  const [buscaInsumo, setBuscaInsumo] = useState("");
  const [ingredienteError, setIngredienteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [salvando, setSalvando] = useState(false);
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
  const fichaAtual = fichaAberta ? precificacao.receitas.find((item) => item.id === fichaAberta.id) || null : null;
  const abasDisponiveis = precificacao.canUseFullModule ? abas : ["Fichas Tecnicas"];
  const simulacao = useMemo(() => simularPreco(simulador), [simulador]);
  const insumosFiltrados = useMemo(() => {
    const termo = buscaInsumo.trim().toLowerCase();
    const base = termo
      ? precificacao.insumos.filter((insumo) => {
          const campos = [insumo.nome, insumo.sku, insumo.marca, insumo.codigoBarras, insumo.categoriaId];
          return campos.some((campo) => String(campo || "").toLowerCase().includes(termo));
        })
      : precificacao.insumos;

    return base.slice(0, 20);
  }, [buscaInsumo, precificacao.insumos]);

  if (precificacao.loading && !allowed) return <p role="status">Carregando fichas e custos...</p>;

  if (!allowed) {
    return (
      <EmptyState
        title="Precificação Inteligente bloqueada"
        description="Este módulo premium esta disponível nos planos Plus e Full. O plano Pro acessa apenas ficha técnica simples."
        action={<Button>Falar com comercial</Button>}
      />
    );
  }

  function adicionarIngrediente() {
    const insumoNome = ingrediente.insumoNome?.trim() || "";
    const quantidade = parseNumber(ingrediente.quantidade);
    const selecionado = precificacao.insumos.find((item) => item.id === ingrediente.insumoId);
    const custo = selecionado ? resolverCustoInsumo(selecionado).valor : null;
    const conversao = selecionado ? converterUnidade(1, ingrediente.unidade || "G", selecionado.unidadeUso) : null;
    const custoUnitarioConvertido = custo === null || conversao === null ? null : custo * conversao;

    if (!insumoNome || !ingrediente.insumoId) {
      setIngredienteError("Selecione um insumo cadastrado ou cadastre-o antes da primeira compra.");
      return;
    }

    if (quantidade <= 0) {
      setIngredienteError("Informe uma quantidade maior que zero.");
      return;
    }

    const novoIngrediente: ReceitaIngrediente = {
      custoTotal: custoUnitarioConvertido === null ? null : quantidade * custoUnitarioConvertido,
      custoUnitarioConvertido,
      empresaId: precificacao.empresaId,
      insumoId: ingrediente.insumoId!,
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
    setBuscaInsumo("");
  }

  function selecionarInsumo(insumoId: string) {
    const insumo = precificacao.insumos.find((item) => item.id === insumoId);
    if (!insumo) {
      setIngrediente({ custoUnitarioConvertido: 0, insumoId: "", insumoNome: "", quantidade: 0, tipo: "insumo", unidade: "G" });
      return;
    }

    setIngrediente((current) => ({
      ...current,
      custoUnitarioConvertido: calcularCustoUnitarioUsoInsumo(insumo),
      insumoId: insumo.id,
      insumoNome: insumo.nome,
      tipo: "insumo",
      unidade: normalizarUnidadePrecificacao(insumo.unidadeUso || insumo.unidadeMedida || insumo.unidadeCompra),
    }));
    setBuscaInsumo(insumo.nome || "");
    setIngredienteError(null);
  }

  async function salvarReceita() {
    setSalvando(true); setActionError(null);
    try {
      await precificacao.salvarReceita(form);
      setForm(receitaInicial); setFichaAberta(null);
    } catch (error) { setActionError(error instanceof Error ? error.message : "Não foi possível salvar a ficha."); }
    finally { setSalvando(false); }
  }

  function editarReceita(receita: ReceitaPrecificacao) {
    setForm({
      ...receita,
      ingredientes: receita.ingredientes || [],
    });
    setFichaAberta(null);
    setAbaAtiva("Fichas Tecnicas");
    setActionError(null);
  }

  async function recalcularReceitaIndividual(receita: ReceitaPrecificacao) {
    setActionError(null);
    try {
      await precificacao.salvarReceita(receita);
      await registrarAuditoria({
        acao: "recalcular_receita",
        empresaId: precificacao.empresaId,
        lojaId: precificacao.lojaId,
        modulo: "precificacao",
        recursoId: receita.id,
        recursoNome: receita.nome,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível recalcular a receita.");
    }
  }

  async function aplicarPrecoSugerido(receita: ReceitaPrecificacao, tipo: "recomendado" | "premium") {
    setActionError(null);
    try {
      const novoPreco = tipo === "premium" ? receita.precoPremium : receita.precoSugerido;
      if (novoPreco === null || receita.custoSituacao === "pendente") throw new Error("Complete os custos antes de aplicar um preço sugerido.");
      await precificacao.salvarReceita({ ...receita, precoVenda: novoPreco });
      await registrarAuditoria({
        acao: "aplicar_preco_sugerido",
        detalhes: { precoAnterior: receita.precoVenda, precoNovo: novoPreco, tipo },
        empresaId: precificacao.empresaId,
        lojaId: precificacao.lojaId,
        modulo: "precificacao",
        recursoId: receita.id,
        recursoNome: receita.nome,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível aplicar o preço sugerido.");
    }
  }

  async function recalcularTudo() {
    setRecalculando(true);
    setActionError(null);

    try {
      await precificacao.recalcularAgora();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível recalcular.");
    } finally {
      setRecalculando(false);
    }
  }

  return (
    <main className="precificacao-page">
      {precificacao.loading ? <p role="status">Atualizando fichas e custos...</p> : null}
      <section className="precificacao-hero">
        <div>
          <span className="precificacao-eyebrow">Módulo premium PLUS</span>
          <h1>Precificação Inteligente</h1>
          <p>Fichas técnicas, CMV dinâmico, custos fixos, simulações e sugestão automática de preço para evitar prejuízo.</p>
        </div>
        <div className="precificacao-hero__actions">
          <Button onClick={() => setAbaAtiva("Fichas Tecnicas")}>+ Nova Receita</Button>
          <Button variant="secondary" onClick={recalcularTudo} disabled={recalculando || !precificacao.canRecalculate}>
            {recalculando ? "Recalculando..." : "Recalcular CMV"}
          </Button>
        </div>
      </section>
      {actionError || precificacao.error ? <p className="precificacao-inline-error" role="alert">{actionError || precificacao.error}</p> : null}
      <p className="precificacao-ingredients-empty">Valores por ficha são simulações com as referências informadas. Custos fixos, taxas e embalagens devem ser conferidos. Não representam lucro apurado da loja.</p>

      <nav className="precificacao-tabs" aria-label="Abas de precificação">
        {abasDisponiveis.map((aba) => (
          <button className={abaAtiva === aba ? "is-active" : ""} key={aba} onClick={() => setAbaAtiva(aba)}>
            {aba}
          </button>
        ))}
      </nav>

      {precificacao.canSeeMoney ? (
        <>
        <section className="precificacao-kpis">
          <Kpi label="Fichas com custo pendente" value={String(precificacao.receitas.filter((item) => item.custoSituacao === "pendente").length)} />
          <Kpi label="CMV médio por ficha (estimado)" value={precificacao.kpis.totalFichas ? percent(precificacao.kpis.cmvMedio) : "Sem fichas"} />
          <Kpi label="Margem média por ficha (simulada)" value={precificacao.kpis.totalFichas ? percent(precificacao.kpis.margemMedia) : "Sem fichas"} />
          <Kpi label="Receitas críticas" value={String(precificacao.kpis.criticas)} tone={precificacao.kpis.criticas ? "danger" : "success"} />
        </section>
        <p className="precificacao-ingredients-empty">Médias calculadas sobre {precificacao.kpis.fichasNaMedia} de {precificacao.kpis.totalFichas} fichas.</p>
        </>
      ) : (
        <Card className="precificacao-simple-mode">
          <strong>Ficha técnica simples</strong>
          <p>Seu acesso permite cadastrar receitas e ingredientes sem visualizar custos, lucro, margem, CMV avançado ou sugestões de preço.</p>
        </Card>
      )}

      {abaAtiva === "Fichas Tecnicas" ? (
        <section className="precificacao-grid">
          <Card className="precificacao-form">
            <header>
              <strong>Cadastro de Receita</strong>
              <span>Receita, ficha técnica e ingrediente base reutilizavel.</span>
            </header>
            <div className="precificacao-form__grid">
              <Field label="Nome" value={form.nome || ""} onChange={(value) => setForm({ ...form, nome: value })} />
              <Field label="Categoria" value={form.categoria || ""} onChange={(value) => setForm({ ...form, categoria: value })} />
              <Field label="Preço de venda" type="number" value={String(form.precoVenda || "")} onChange={(value) => setForm({ ...form, precoVenda: Number(value) })} />
              <Field label="Imagem URL" value={form.imagemUrl || ""} onChange={(value) => setForm({ ...form, imagemUrl: value })} />
            </div>
            <label className="precificacao-field precificacao-field--full">
              <span>Descrição</span>
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
                <label className="precificacao-field precificacao-stock-search">
                  <span>Insumo do estoque</span>
                  <input
                    type="search"
                    value={buscaInsumo}
                    placeholder="Pesquisar por nome, marca, SKU ou código"
                    onChange={(event) => {
                      setBuscaInsumo(event.target.value);
                      setIngrediente((current) => ({ ...current, insumoId: "", insumoNome: event.target.value }));
                    }}
                  />
                  <div className="precificacao-stock-search__list">
                    {insumosFiltrados.length ? (
                      insumosFiltrados.map((insumo) => (
                        <button
                          className={ingrediente.insumoId === insumo.id ? "is-selected" : ""}
                          key={insumo.id || insumo.nome}
                          type="button"
                          onClick={() => selecionarInsumo(insumo.id || "")}
                        >
                          <strong>{insumo.nome}</strong>
                          <span>{getInsumoConversionLabel(insumo)}</span>
                        </button>
                      ))
                    ) : (
                      <small>Nenhum insumo encontrado.</small>
                    )}
                  </div>
                </label>
                <Field label="Quantidade" value={String(ingrediente.quantidade || "")} onChange={(value) => setIngrediente({ ...ingrediente, quantidade: parseNumber(value) })} />
                <label className="precificacao-field">
                  <span>Unidade</span>
                  <select value={ingrediente.unidade} onChange={(event) => setIngrediente({ ...ingrediente, unidade: event.target.value as UnidadeMedidaPrecificacao })}>
                    {unidades.map((unidade) => <option key={unidade}>{unidade}</option>)}
                  </select>
                </label>
                {precificacao.canSeeMoney ? <p>Custo por {ingrediente.unidade}: {unitMoney(custoAtualSelecionado(precificacao.insumos, ingrediente))}</p> : null}
              </div>
              {ingrediente.insumoId && precificacao.canSeeMoney ? (
                <p className="precificacao-ingredients-empty">
                  Conversao do estoque aplicada: {getSelectedInsumoSummary(precificacao.insumos, ingrediente.insumoId)}
                </p>
              ) : null}
              {ingredienteError ? <p className="precificacao-inline-error">{ingredienteError}</p> : null}
              <Button variant="secondary" onClick={adicionarIngrediente}>Adicionar Ingrediente</Button>
              {precificacao.canConfigure ? <InsumoParaFicha salvar={precificacao.criarInsumoFicha} /> : null}
              {precificacao.canConfigure && precificacao.insumos.find((item) => item.id === ingrediente.insumoId) ? <ReferenciaCustoFicha
                key={ingrediente.insumoId}
                insumo={precificacao.insumos.find((item) => item.id === ingrediente.insumoId)!}
                salvar={precificacao.atualizarReferencia}
              /> : null}
            </div>

            <ListaIngredientes ingredientes={atualizarIngredientesComEstoque(form.ingredientes || [], precificacao.insumos)} canSeeMoney={precificacao.canSeeMoney} onRemove={(index) => setForm((current) => ({ ...current, ingredientes: (current.ingredientes || []).filter((_, itemIndex) => itemIndex !== index) }))} />
            <Button onClick={salvarReceita} disabled={salvando || !precificacao.canConfigure} fullWidth>
              {salvando ? "Salvando..." : "Salvar Receita"}
            </Button>
          </Card>

          <div className="precificacao-side">
            {fichaAtual ? (
              <FichaTecnicaVisual
                canSeeMoney={precificacao.canSeeMoney}
                onClose={() => setFichaAberta(null)}
                receita={fichaAtual}
              />
            ) : null}
            <ReceitasGrid
              canApplyPrice={precificacao.canConfigure}
              canSeeMoney={precificacao.canSeeMoney}
              onAplicarPreco={aplicarPrecoSugerido}
              onEditar={editarReceita}
              onRecalcular={recalcularReceitaIndividual}
              onVerFicha={setFichaAberta}
              receitas={precificacao.receitas}
            />
          </div>
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
            <span>Resultado da simulação</span>
            <strong>{money(simulacao.lucro)}</strong>
            <p>Margem {simulacao.margem.toFixed(1)}% | CMV {simulacao.cmv.toFixed(1)}% | Risco {labelStatus(simulacao.risco)}</p>
          </Card>
        </section>
      ) : null}

      {precificacao.canUseFullModule && (abaAtiva === "Dashboard Financeiro" || abaAtiva === "Relatorios" || abaAtiva === "CMV Dinamico") ? (
        <section className="precificacao-grid">
          <Card className="precificacao-list">
            <strong>Alertas Inteligentes</strong>
            {precificacao.alertas.length ? precificacao.alertas.map((alerta) => <p key={alerta}>{alerta}</p>) : <p>Nenhum alerta financeiro crítico agora.</p>}
          </Card>
          <Card className="precificacao-list">
            <strong>Inteligencia de Reajuste</strong>
            <p>Mais lucrativa: {precificacao.kpis.maisLucrativa?.nome || "Sem dados"}</p>
            <p>Pior CMV: {precificacao.kpis.piorCmv?.nome || "Sem dados"}</p>
            <p>Histórico e restauração usam as coleções receitas, receitaIngredientes e historicoCustosInsumos.</p>
          </Card>
        </section>
      ) : null}
    </main>
  );
}

function custoAtualSelecionado(insumos: Insumo[], ingrediente: Partial<ReceitaIngrediente>) {
  const selecionado = insumos.find((item) => item.id === ingrediente.insumoId);
  if (!selecionado) return null;
  const custo = resolverCustoInsumo(selecionado).valor;
  const fator = converterUnidade(1, ingrediente.unidade || "G", selecionado.unidadeUso);
  return custo === null || fator === null ? null : custo * fator;
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

function getInsumoConversionLabel(insumo: Insumo) {
  const unidadeUso = insumo.unidadeUso || insumo.unidadeMedida || insumo.unidadeCompra || "UN";
  const conversao = Math.max(Number(insumo.conversao) || 1, 1);
  const custoUnitario = calcularCustoUnitarioUsoInsumo(insumo);
  const metodo = insumo.metodoCusto === "manual_travado" ? "travado" : `${conversao} ${unidadeUso}`;
  return `${metodo} | ${unitMoney(custoUnitario)} por ${unidadeUso}`;
}

function getSelectedInsumoSummary(insumos: Insumo[], insumoId?: string) {
  const insumo = insumos.find((item) => item.id === insumoId);
  if (!insumo) return "Insumo não encontrado.";
  const custo = resolverCustoInsumo(insumo);
  if (custo.valor === null) return custo.motivo || "Custo pendente.";
  const origem = custo.fonte === "estimado" ? "Referência estimada" : custo.fonte === "manual" ? "Referência manual" : "Legado: origem ainda não confirmada";
  const data = custo.informadoEm ? new Date(custo.informadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "data não informada";
  return `${origem}: ${unitMoney(custo.valor)} por ${insumo.unidadeUso}. ${data}.`;
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

function ListaIngredientes({ canSeeMoney, ingredientes, onRemove }: { ingredientes: ReceitaIngrediente[]; canSeeMoney: boolean; onRemove?: (index: number) => void }) {
  if (!ingredientes.length) {
    return <p className="precificacao-ingredients-empty">Nenhum ingrediente adicionado ainda.</p>;
  }

  return (
    <div className="precificacao-ingredients-list">
      {ingredientes.map((item, index) => (
        <div key={`${item.insumoId}-${item.insumoNome}-${index}`}>
          <span>{item.insumoNome}</span>
          <strong>{item.quantidade} {item.unidade}</strong>
          <small>{canSeeMoney ? unitMoney(item.custoUnitarioConvertido) : "Custo bloqueado"}</small>
          {onRemove ? <Button variant="ghost" onClick={() => onRemove(index)} aria-label={`Remover ${item.insumoNome}`}>Remover</Button> : null}
        </div>
      ))}
    </div>
  );
}

function FichaTecnicaVisual({
  canSeeMoney,
  onClose,
  receita,
}: {
  canSeeMoney: boolean;
  onClose: () => void;
  receita: ReceitaPrecificacao;
}) {
  return (
    <Card className="precificacao-ficha">
      <header>
        <div>
          <span>Ficha técnica · {receita.versaoFicha ? `versão salva ${receita.versaoFicha}` : "legado sem versão"}</span>
          <strong>{receita.nome}</strong>
        </div>
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
      </header>
      <dl>
        <div><dt>Preço</dt><dd>{money(receita.precoVenda)}</dd></div>
        <div><dt>Custo CMV</dt><dd>{canSeeMoney ? money(receita.custoCmv ?? receita.custoIngredientes) : "Bloqueado"}</dd></div>
        <div><dt>CMV</dt><dd>{canSeeMoney ? percent(receita.cmv) : "Bloqueado"}</dd></div>
        <div><dt>Margem</dt><dd>{canSeeMoney ? percent(receita.margem) : "Bloqueado"}</dd></div>
        <div><dt>Resultado simulado</dt><dd>{canSeeMoney ? money(receita.lucro) : "Bloqueado"}</dd></div>
      </dl>
      <div className="precificacao-ficha__ingredients">
        <strong>Ingredientes</strong>
        {receita.ingredientes.length ? receita.ingredientes.map((item) => (
          <div key={`${item.insumoId}-${item.insumoNome}`}>
            <span>{item.insumoNome}</span>
            <small>{item.quantidade} {item.unidade}</small>
            <b>{canSeeMoney ? money(item.custoTotal) : "Custo bloqueado"}</b>
            {canSeeMoney ? <small>{origemDoCusto(item)}</small> : null}
          </div>
        )) : <p>Nenhum ingrediente vinculado.</p>}
      </div>
      {receita.modoPreparo ? (
        <p className="precificacao-ficha__prep">{receita.modoPreparo}</p>
      ) : null}
    </Card>
  );
}

function ReceitasGrid({
  canApplyPrice,
  canSeeMoney,
  onAplicarPreco,
  onEditar,
  onRecalcular,
  onVerFicha,
  receitas,
}: {
  canApplyPrice: boolean;
  canSeeMoney: boolean;
  onAplicarPreco: (receita: ReceitaPrecificacao, tipo: "recomendado" | "premium") => void;
  onEditar: (receita: ReceitaPrecificacao) => void;
  onRecalcular: (receita: ReceitaPrecificacao) => void;
  onVerFicha: (receita: ReceitaPrecificacao) => void;
  receitas: ReceitaPrecificacao[];
}) {
  if (!receitas.length) {
    return <EmptyState title="Nenhuma receita cadastrada" description="Cadastre a primeira ficha técnica para calcular CMV e preço sugerido." />;
  }

  return (
    <div className="receitas-grid">
      {receitas.map((receita) => (
        <Card className={`receita-card receita-card--${receita.status}`} key={receita.id || receita.nome}>
          <div className="receita-card__image">{receita.imagemUrl ? <img alt="" src={receita.imagemUrl} /> : <span>{receita.nome.slice(0, 2).toUpperCase()}</span>}</div>
          <div className="receita-card__body">
            <span>{labelStatus(receita.status)} · {receita.custoSituacao === "pendente" ? "custo incompleto" : "estimativa"}</span>
            {receita.custoPendencias?.length ? <p role="status">{receita.custoPendencias.join(" ")}</p> : null}
            <h2>{receita.nome}</h2>
            <dl>
              <div><dt>Preço atual</dt><dd>{money(receita.precoVenda)}</dd></div>
              <div><dt>Custo total</dt><dd>{canSeeMoney ? money(receita.custoTotalReal) : "Bloqueado"}</dd></div>
              <div><dt>Resultado simulado</dt><dd>{canSeeMoney ? money(receita.lucro) : "Bloqueado"}</dd></div>
              <div><dt>Margem</dt><dd>{canSeeMoney ? percent(receita.margem) : "Bloqueado"}</dd></div>
              <div><dt>CMV</dt><dd>{percent(receita.cmv)}</dd></div>
            </dl>
            {canSeeMoney ? (
              <div className="receita-card__prices">
                <span>Minimo {money(receita.precoMinimo)}</span>
                <span>Recomendado {money(receita.precoSugerido)}</span>
                <span>Premium {money(receita.precoPremium)}</span>
              </div>
            ) : null}
            <div className="receita-card__actions">
              <Button variant="secondary" onClick={() => onEditar(receita)}>Editar</Button>
              <Button variant="ghost" onClick={() => onVerFicha(receita)}>Ver Ficha</Button>
              <Button variant="ghost" onClick={() => onRecalcular(receita)}>Recalcular CMV</Button>
              {canSeeMoney && canApplyPrice && receita.custoSituacao !== "pendente" ? (
                <>
                  <Button variant="ghost" onClick={() => onAplicarPreco(receita, "recomendado")}>Aplicar recomendado</Button>
                  <Button variant="ghost" onClick={() => onAplicarPreco(receita, "premium")}>Aplicar premium</Button>
                </>
              ) : null}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function origemDoCusto(item: ReceitaIngrediente) {
  if (item.custoPendencia) return item.custoPendencia;
  const origem = item.custoOrigem === "estimado" ? "Referência estimada" : item.custoOrigem === "manual" ? "Referência manual" : "Origem legada não confirmada";
  const data = item.custoInformadoEm ? new Date(item.custoInformadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "data não informada";
  return `${origem} · ${data} · ${unitMoney(item.custoUnitarioConvertido)} por ${item.unidade}`;
}

function money(value: number | null | undefined) {
  return value == null ? "Pendente" : new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(value);
}

function unitMoney(value: number | null | undefined) {
  return value == null ? "Pendente" : new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency", minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(value);
}

function percent(value: number | null) { return value === null ? "Pendente" : `${value.toFixed(1)}%`; }

function labelStatus(status: StatusFinanceiroReceita) {
  return status === "pendente" ? "Custo pendente" : status === "saudavel" ? "Saudavel" : status === "atencao" ? "Atencao" : "Critico";
}
