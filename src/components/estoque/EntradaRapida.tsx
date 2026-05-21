"use client";

import { useEffect, useState } from "react";

import { useBarcode } from "../../hooks/useBarcode";
import type { Insumo } from "../../types";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Select } from "../ui/Select";
import { TextInput } from "../ui/TextInput";

type MovimentoRapido = {
  custoTotal?: number;
  fornecedorId?: string;
  insumoId: string;
  insumoNome: string;
  observacao?: string;
  quantidade: number;
  tipo: "entrada" | "saida";
};

type EntradaRapidaProps = {
  focusBarcode?: boolean;
  onFechar?: () => void;
  onRegistrar: (dados: MovimentoRapido) => void;
};

const UNIDADES = [
  { label: "Unidade", value: "unidade" },
  { label: "Pacote", value: "pacote" },
  { label: "Caixa", value: "caixa" },
  { label: "Fardo", value: "fardo" },
  { label: "Kg", value: "kg" },
  { label: "Gramas", value: "g" },
  { label: "ml", value: "ml" },
  { label: "Litros", value: "l" },
];

export function EntradaRapida({ focusBarcode = false, onFechar, onRegistrar }: EntradaRapidaProps) {
  const [codigo, setCodigo] = useState("");
  const [produto, setProduto] = useState<Insumo | null>(null);
  const [produtoNome, setProdutoNome] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [unidade, setUnidade] = useState("unidade");
  const [custoTotal, setCustoTotal] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { buscarExterno, buscarPorCodigo } = useBarcode();

  useEffect(() => {
    if (focusBarcode) {
      setFeedback("Campo pronto para leitura de codigo de barras.");
    }
  }, [focusBarcode]);

  async function handleBuscar() {
    if (!codigo.trim()) return;

    const local = await buscarPorCodigo(codigo);
    if (local) {
      setProduto(local);
      setProdutoNome(local.nome);
      setFeedback("Produto localizado no estoque.");
      return;
    }

    const externo = await buscarExterno(codigo);
    if (externo) {
      setProdutoNome(externo.nome);
      setFeedback("Produto encontrado em base externa. Confira antes de registrar.");
      return;
    }

    setFeedback("Produto nao encontrado. Use Novo Insumo para cadastrar.");
  }

  function registrar(tipo: "entrada" | "saida") {
    if (!produto?.id) {
      setFeedback("Selecione um produto existente antes de registrar movimento.");
      return;
    }

    onRegistrar({
      custoTotal: tipo === "entrada" ? custoTotal : undefined,
      fornecedorId: produto.fornecedorPrincipal,
      insumoId: produto.id,
      insumoNome: produto.nome,
      observacao: `Movimento rapido em ${unidade}`,
      quantidade,
      tipo,
    });
  }

  const custoUnitario = custoTotal > 0 && quantidade > 0 ? (custoTotal / quantidade).toFixed(2) : "--";

  return (
    <Card className="estoque-quick-entry">
      <div className="estoque-panel__header">
        <div>
          <span>Operacao rapida</span>
          <h2>Entrada / Saida Rapida</h2>
        </div>
        {onFechar ? <Button variant="ghost" onClick={onFechar}>Fechar</Button> : null}
      </div>

      <div className="estoque-form-grid">
        <TextInput label="Codigo de Barras" value={codigo} onChange={(event) => setCodigo(event.target.value)} placeholder="Digite ou escaneie" />
        <TextInput label="Produto" value={produtoNome} onChange={(event) => setProdutoNome(event.target.value)} placeholder="Produto localizado" />
        <Select label="Unidade" options={UNIDADES} value={unidade} onChange={(event) => setUnidade(event.target.value)} />
        <TextInput label="Quantidade" min={0} type="number" value={quantidade} onChange={(event) => setQuantidade(Number(event.target.value))} />
        <TextInput label="Custo Total (R$)" min={0} step={0.01} type="number" value={custoTotal} onChange={(event) => setCustoTotal(Number(event.target.value))} />
        <div className="estoque-cost-preview">
          <span>Custo unitario</span>
          <strong>R$ {custoUnitario}</strong>
        </div>
      </div>

      <div className="estoque-row-actions">
        <Button variant="secondary" onClick={handleBuscar} disabled={!codigo}>Buscar Codigo</Button>
        <Button variant="primary" onClick={() => registrar("entrada")} disabled={!produto || custoTotal <= 0}>Registrar Entrada</Button>
        <Button variant="secondary" onClick={() => registrar("saida")} disabled={!produto}>Registrar Saida</Button>
      </div>

      {feedback ? <p className="estoque-feedback">{feedback}</p> : null}
    </Card>
  );
}
