"use client";

import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { db } from "../../lib/firebase";
import { produtoSchema } from "../../schemas/produto.schema";
import type { Insumo } from "../../types";
import { Button } from "../ui/Button";
import { TextInput } from "../ui/TextInput";
import { ProdutoImagem } from "./ProdutoImagem";

type ProdutoAbaDadosGeraisProps = {
  produto: Insumo | null;
  produtoId: string | null;
  onSalvo: () => void;
  salvando?: boolean;
  setSalvando?: (salvando: boolean) => void;
};

export function ProdutoAbaDadosGerais({ produto, produtoId, onSalvo, setSalvando }: ProdutoAbaDadosGeraisProps) {
  const [form, setForm] = useState({
    codigoBarras: "",
    marca: "",
    nome: "",
    sku: "",
  });
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      codigoBarras: produto?.codigoBarras || "",
      marca: produto?.marca || "",
      nome: produto?.nome || "",
      sku: produto?.sku || "",
    });
  }, [produto]);

  async function handleSalvar() {
    setErro(null);
    setSalvando?.(true);

    try {
      const validado = produtoSchema.parse({
        ...form,
        codigoBarrasNormalizado: form.codigoBarras.replace(/\D/g, ""),
        custoCompra: produto?.custoCompra || 0,
        quantidadeAtual: produto?.quantidadeAtual || 0,
      });
      const payload = {
        ...validado,
        atualizadoEm: serverTimestamp(),
        nomeNormalizado: validado.nome.toLowerCase(),
      };

      if (produtoId) {
        await updateDoc(doc(db, "insumos", produtoId), payload);
      } else {
        await addDoc(collection(db, "insumos"), {
          ...payload,
          criadoEm: serverTimestamp(),
        });
      }

      onSalvo();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Nao foi possivel salvar.");
    } finally {
      setSalvando?.(false);
    }
  }

  return (
    <section className="drawer-tab">
      <ProdutoImagem produto={produto || form} />
      <div className="drawer-form-grid">
        <TextInput label="Nome" value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} />
        <TextInput label="SKU" value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} />
        <TextInput label="Marca" value={form.marca} onChange={(event) => setForm((current) => ({ ...current, marca: event.target.value }))} />
        <TextInput label="Codigo de barras" value={form.codigoBarras} onChange={(event) => setForm((current) => ({ ...current, codigoBarras: event.target.value }))} />
      </div>
      {erro ? <p className="estoque-feedback">{erro}</p> : null}
      <Button variant="primary" onClick={handleSalvar}>Salvar Dados</Button>
    </section>
  );
}
