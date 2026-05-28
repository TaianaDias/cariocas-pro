"use client";

import { useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { importarArquivoXml, parseNfeXml } from "../../services/xml.service";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { XmlItem } from "../../types";

type ImportarXmlProps = {
  onFechar?: () => void;
  onFinalizar?: () => void;
  onImportar?: (dados: Record<string, unknown>) => void;
};

export function ImportarXml({ onFechar, onFinalizar, onImportar }: ImportarXmlProps) {
  const { user, userProfile } = useAuth();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [itensPreview, setItensPreview] = useState<XmlItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSelecionarArquivo(file: File | null) {
    setArquivo(file);
    setResultado(null);
    setErro(null);
    setItensPreview([]);

    if (!file) return;

    try {
      const text = await file.text();
      const parseado = parseNfeXml(text);
      setItensPreview(parseado.itens);
      setResultado(`${parseado.itens.length} itens encontrados de ${parseado.fornecedorNome}.`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Nao foi possivel ler o XML.");
    }
  }

  async function handleProcessar() {
    if (!arquivo || loading) return;
    setLoading(true);
    setErro(null);

    try {
      if (!user) {
        throw new Error("Entre na conta para importar a nota fiscal.");
      }

      const text = await arquivo.text();
      const processado = await importarArquivoXml(text, {
        arquivoNome: arquivo.name,
        empresaId: userProfile?.empresaId || user.uid,
        lojaId: userProfile?.lojaId || "matriz",
        uid: user.uid,
      });
      const mensagem = `${processado.totalItens} itens lidos, ${processado.criados} criados, ${processado.vinculados} atualizados, ${processado.erros.length} erros`;
      setResultado(mensagem);
      onImportar?.({ arquivoNome: arquivo.name, resultado: processado });
      setTimeout(() => onFinalizar?.(), 900);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Nao foi possivel processar o XML.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="estoque-panel estoque-panel--xml">
      <header className="estoque-panel__header">
        <div>
          <span>Nota fiscal</span>
          <h2>Importacao XML NF-e</h2>
        </div>
        <div className="estoque-row-actions">
          {onFechar ? <Button variant="ghost" onClick={onFechar}>Fechar</Button> : null}
          <Button variant="primary" onClick={handleProcessar} disabled={!arquivo || loading}>
            {loading ? "Processando..." : "Importar XML"}
          </Button>
        </div>
      </header>

      <label className="xml-dropzone">
        <strong>Selecione o XML da nota fiscal</strong>
        <span>O processamento cria ou vincula insumos e prepara entradas no historico.</span>
        <input type="file" accept=".xml,text/xml,application/xml" onChange={(event) => handleSelecionarArquivo(event.target.files?.[0] ?? null)} />
      </label>

      <div className="xml-summary">
        <article><span>Arquivo</span><strong>{arquivo?.name || "-"}</strong></article>
        <article><span>Status</span><strong>{resultado ? "Finalizado" : "Aguardando"}</strong></article>
        <article><span>Resultado</span><strong>{resultado || "-"}</strong></article>
      </div>

      {erro ? <p className="estoque-feedback">{erro}</p> : null}

      {itensPreview.length ? (
        <div className="xml-preview">
          <strong>Itens encontrados</strong>
          <div>
            {itensPreview.slice(0, 8).map((item) => (
              <article key={`${item.codigo}-${item.nome}`}>
                <span>{item.nome}</span>
                <small>
                  {item.quantidade} {item.unidade} · R$ {item.valorTotal.toFixed(2)} · Cod. barras: {item.codigoBarras || "nao informado"}
                </small>
              </article>
            ))}
          </div>
          {itensPreview.length > 8 ? <small>+ {itensPreview.length - 8} itens na nota</small> : null}
        </div>
      ) : null}
    </Card>
  );
}
