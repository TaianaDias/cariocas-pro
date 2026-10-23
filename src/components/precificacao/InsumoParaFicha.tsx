"use client";

import { useState } from "react";
import type { Insumo } from "../../types";
import { converterUnidade } from "../../domain/custos";
import { Button } from "../ui/Button";

const unidades = ["KG", "G", "UN", "L", "ML", "CAIXA", "PACOTE", "FATIA", "PORCAO"];
export type NovoInsumoFicha = { nome: string; unidadeCompra: string; unidadeUso: string; fatorConversao: number; custoEstimado: number | null };

function decimal(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const normalizado = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) throw new Error("Informe um valor numérico válido, como 35,00, ou deixe o custo vazio.");
  return numero;
}

export function InsumoParaFicha({ salvar }: { salvar: (dados: NovoInsumoFicha) => Promise<unknown> }) {
  const [nome, setNome] = useState("");
  const [compra, setCompra] = useState("KG");
  const [uso, setUso] = useState("G");
  const [fator, setFator] = useState("1000");
  const [custo, setCusto] = useState("");
  const [busy, setBusy] = useState(false);
  const [mensagem, setMensagem] = useState("");

  function mudarUnidade(nextCompra: string, nextUso: string) {
    setCompra(nextCompra); setUso(nextUso);
    const padrao = converterUnidade(1, nextCompra, nextUso);
    if (padrao !== null) setFator(String(padrao));
  }

  return <details className="precificacao-novo-insumo">
    <summary>Cadastrar insumo antes da primeira compra</summary>
    <p>O cadastro começa com saldo zero. O custo informado é uma estimativa por unidade de compra, identificada pela data.</p>
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setMensagem("");
      try {
        await salvar({ nome, unidadeCompra: compra, unidadeUso: uso, fatorConversao: decimal(fator) ?? 0, custoEstimado: decimal(custo) });
        setNome(""); setCusto(""); setMensagem("Insumo salvo. Selecione-o na busca para compor a ficha.");
      } catch (error) { setMensagem(error instanceof Error ? error.message : "Não foi possível salvar."); }
      finally { setBusy(false); }
    }}>
      <div className="precificacao-form__grid">
        <label className="precificacao-field"><span>Nome do novo insumo</span><input required minLength={2} maxLength={160} value={nome} onChange={(event) => setNome(event.target.value)} /></label>
        <label className="precificacao-field"><span>Unidade de compra</span><select value={compra} onChange={(event) => mudarUnidade(event.target.value, uso)}>{unidades.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="precificacao-field"><span>Unidade de utilização</span><select value={uso} onChange={(event) => mudarUnidade(compra, event.target.value)}>{unidades.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="precificacao-field"><span>Unidades de utilização por compra</span><input required inputMode="decimal" value={fator} onChange={(event) => setFator(event.target.value)} /></label>
        <label className="precificacao-field"><span>Custo estimado por {compra} (R$)</span><input inputMode="decimal" placeholder="Deixe vazio se desconhecido" value={custo} onChange={(event) => setCusto(event.target.value)} /></label>
      </div>
      <Button disabled={busy} type="submit">{busy ? "Salvando..." : "Salvar insumo sem entrada de estoque"}</Button>
    </form>
    {mensagem ? <p role="status">{mensagem}</p> : null}
  </details>;
}

export function ReferenciaCustoFicha({ insumo, salvar }: { insumo: Insumo; salvar: (insumo: Insumo, custo: number | null, versao: number) => Promise<{ versao: number }> }) {
  const [custo, setCusto] = useState(String(insumo.custoReferencia?.valorCompra ?? ""));
  const [versao, setVersao] = useState(insumo.custoReferencia?.versao || 0);
  const [busy, setBusy] = useState(false);
  const [mensagem, setMensagem] = useState("");
  return <details className="precificacao-novo-insumo">
    <summary>Atualizar custo estimado de {insumo.nome}</summary>
    <p>Esta referência atualiza a simulação das fichas. O valor dos lotes, o saldo e os registros anteriores são preservados.</p>
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setMensagem("");
      try { const resultado = await salvar(insumo, decimal(custo), versao); setVersao(resultado.versao); setMensagem("Referência salva. Confira o custo atualizado nas fichas."); }
      catch (error) { setMensagem(error instanceof Error ? error.message : "Não foi possível salvar."); }
      finally { setBusy(false); }
    }}>
      <label className="precificacao-field"><span>Estimativa por {insumo.unidadeCompra} (R$)</span><input inputMode="decimal" placeholder="Vazio = custo pendente" value={custo} onChange={(event) => setCusto(event.target.value)} /></label>
      <Button disabled={busy} type="submit">{busy ? "Salvando..." : "Salvar referência estimada"}</Button>
    </form>
    {mensagem ? <p role="status">{mensagem}</p> : null}
  </details>;
}
