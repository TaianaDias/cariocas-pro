"use client";

import { useState } from "react";

import { processarLoteXml } from "../../services/xml.service";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

type ImportarXmlProps = {
  onFechar?: () => void;
  onFinalizar?: () => void;
  onImportar?: (dados: Record<string, unknown>) => void;
};

export function ImportarXml({ onFechar, onFinalizar, onImportar }: ImportarXmlProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function handleProcessar() {
    if (!arquivo || loading) return;
    setLoading(true);

    try {
      const processado = await processarLoteXml([], "", arquivo.name);
      const mensagem = `${processado.criados} criados, ${processado.vinculados} vinculados, ${processado.erros.length} erros`;
      setResultado(mensagem);
      onImportar?.({ arquivoNome: arquivo.name, resultado: processado });
      onFinalizar?.();
    } catch {
      setResultado("Nao foi possivel processar o XML.");
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
        <input type="file" accept=".xml" onChange={(event) => setArquivo(event.target.files?.[0] ?? null)} />
      </label>

      <div className="xml-summary">
        <article><span>Arquivo</span><strong>{arquivo?.name || "-"}</strong></article>
        <article><span>Status</span><strong>{resultado ? "Finalizado" : "Aguardando"}</strong></article>
        <article><span>Resultado</span><strong>{resultado || "-"}</strong></article>
      </div>
    </Card>
  );
}
