"use client";

import { useState } from "react";

import { useBarcode } from "../../hooks/useBarcode";
import type { Insumo } from "../../types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { TextInput } from "../ui/TextInput";
import { ProdutoImagem } from "./ProdutoImagem";

type ProdutoAbaDadosGeraisProps = {
  onChange: (dados: Partial<Insumo>) => void;
  produto: Partial<Insumo>;
};

export function ProdutoAbaDadosGerais({ onChange, produto }: ProdutoAbaDadosGeraisProps) {
  const { buscarExterno, buscarPorCodigo } = useBarcode();
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [feedbackCodigo, setFeedbackCodigo] = useState<string | null>(null);

  async function reconhecerCodigo() {
    const codigo = produto.codigoBarras?.trim();
    if (!codigo || buscandoCodigo) return;

    setBuscandoCodigo(true);
    setFeedbackCodigo(null);

    try {
      const local = await buscarPorCodigo(codigo);
      if (local) {
        const imagemLocal = local.imagemUrl || local.imagemPrincipal || local.imagemUploadUrl || local.imagemCosmosUrl || "";
        const externo = imagemLocal ? null : await buscarExterno(codigo);
        const imagem = imagemLocal || externo?.imagemUrl || "";

        onChange({
          categoriaId: produto.categoriaId || local.categoriaId || "",
          codigoBarras: local.codigoBarras || codigo,
          codigoInterno: produto.codigoInterno || local.codigoInterno || "",
          imagemPrincipal: produto.imagemPrincipal || imagem,
          imagemUrl: produto.imagemUrl || imagem,
          marca: produto.marca || local.marca || "",
          nome: produto.nome || local.nome || "",
          sku: produto.sku || local.sku || "",
        });
        setFeedbackCodigo("Codigo encontrado no estoque. Dados preenchidos para conferencia.");
        return;
      }

      const externo = await buscarExterno(codigo);
      if (externo?.nome) {
        onChange({
          imagemPrincipal: produto.imagemPrincipal || externo.imagemUrl || "",
          imagemUrl: produto.imagemUrl || externo.imagemUrl || "",
          marca: produto.marca || externo.marca || "",
          nome: produto.nome || externo.nome,
        });
        setFeedbackCodigo("Produto reconhecido em base externa. Confira os dados antes de salvar.");
        return;
      }

      setFeedbackCodigo("Codigo nao encontrado. Voce pode preencher o cadastro manualmente.");
    } catch {
      setFeedbackCodigo("Nao foi possivel reconhecer este codigo agora.");
    } finally {
      setBuscandoCodigo(false);
    }
  }

  return (
    <section className="drawer-tab">
      <ProdutoImagem produto={produto} />
      <div className="drawer-form-grid">
        <TextInput label="Nome" value={produto.nome || ""} onChange={(event) => onChange({ nome: event.target.value })} />
        <TextInput label="SKU" value={produto.sku || ""} onChange={(event) => onChange({ sku: event.target.value })} />
        <TextInput label="Marca" value={produto.marca || ""} onChange={(event) => onChange({ marca: event.target.value })} />
        <TextInput
          label="Imagem do produto"
          value={produto.imagemUrl || produto.imagemPrincipal || ""}
          onChange={(event) => onChange({ imagemPrincipal: event.target.value, imagemUrl: event.target.value })}
        />
        <div className="barcode-recognition">
          <TextInput
            label="Codigo de barras"
            value={produto.codigoBarras || ""}
            onChange={(event) => {
              setFeedbackCodigo(null);
              onChange({ codigoBarras: event.target.value });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                reconhecerCodigo();
              }
            }}
          />
          <Button variant="secondary" onClick={reconhecerCodigo} disabled={!produto.codigoBarras || buscandoCodigo}>
            {buscandoCodigo ? "Buscando..." : "Reconhecer"}
          </Button>
          {feedbackCodigo ? <p className="estoque-feedback">{feedbackCodigo}</p> : null}
        </div>
        <TextInput label="Categoria" value={produto.categoriaId || ""} onChange={(event) => onChange({ categoriaId: event.target.value })} />
        <TextInput label="Codigo interno" value={produto.codigoInterno || ""} onChange={(event) => onChange({ codigoInterno: event.target.value })} />
        <Select
          label="Status"
          value={produto.statusProduto || "ativo"}
          onChange={(event) => onChange({ statusProduto: event.target.value as Insumo["statusProduto"] })}
          options={[
            { label: "Ativo", value: "ativo" },
            { label: "Pausado", value: "pausado" },
            { label: "Sem ficha", value: "sem_ficha" },
            { label: "Parado", value: "parado" },
          ]}
        />
        <TextInput label="Observacao" value={produto.observacao || ""} onChange={(event) => onChange({ observacao: event.target.value })} />
      </div>
    </section>
  );
}
