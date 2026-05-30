"use client";

import { useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { importarArquivoXml, parseNfeXml } from "../../services/xml.service";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextInput } from "../ui/TextInput";
import type { XmlItem } from "../../types";

type ImportarXmlProps = {
  onFechar?: () => void;
  onFinalizar?: () => void;
  onImportar?: (dados: Record<string, unknown>) => void;
};

export function ImportarXml({ onFechar, onFinalizar, onImportar }: ImportarXmlProps) {
  const { user, userProfile } = useAuth();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [chaveNfe, setChaveNfe] = useState("");
  const [itensPreview, setItensPreview] = useState<XmlItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChave, setLoadingChave] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function aplicarXmlNoPreview(xmlText: string, origem: string) {
    const parseado = parseNfeXml(xmlText);
    setItensPreview(parseado.itens);
    setResultado(`${parseado.itens.length} itens encontrados de ${parseado.fornecedorNome}.`);
    setArquivo(new File([xmlText], origem, { type: "text/xml" }));
  }

  async function handleSelecionarArquivo(file: File | null) {
    setArquivo(file);
    setResultado(null);
    setErro(null);
    setItensPreview([]);

    if (!file) return;

    try {
      const text = await file.text();
      aplicarXmlNoPreview(text, file.name);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Nao foi possivel ler o XML.");
    }
  }

  async function handleLerCodigoNota() {
    if (!chaveNfe.trim() || loadingChave) return;

    setLoadingChave(true);
    setResultado(null);
    setErro(null);
    setItensPreview([]);

    try {
      const entrada = chaveNfe.trim();
      if (entrada.includes("<")) {
        aplicarXmlNoPreview(entrada, "nota-colada.xml");
        return;
      }

      const chave = entrada.replace(/\D/g, "");
      if (chave.length !== 44) {
        throw new Error("Escaneie ou digite a chave de acesso da NF-e com 44 digitos.");
      }

      const response = await fetch("/api/nfe/consulta", {
        body: JSON.stringify({ chave }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel consultar a NF-e pela chave.");
      }

      if (!data.xml) {
        setResultado(data.statusMessage || "Consulta enviada. Aguarde alguns segundos e clique em Ler nota novamente.");
        return;
      }

      aplicarXmlNoPreview(data.xml, `nfe-${chave}.xml`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Nao foi possivel ler a nota fiscal pelo codigo.");
    } finally {
      setLoadingChave(false);
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
        itens: itensPreview,
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

  function atualizarCodigoPreview(index: number, codigo: string) {
    const codigoBarrasNormalizado = codigo.replace(/\D/g, "");
    setItensPreview((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              codigo: codigoBarrasNormalizado || codigo || item.codigo,
              codigoBarras: codigo,
              codigoBarrasNormalizado,
            }
          : item,
      ),
    );
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

      <div className="nfe-code-reader">
        <div>
          <strong>Ler por codigo de barras da NF-e</strong>
          <span>Escaneie a chave de acesso de 44 digitos da nota ou cole o XML completo para montar o preview.</span>
        </div>
        <TextInput
          label="Chave de acesso ou XML da NF-e"
          placeholder="Escaneie a chave da NF-e ou cole o XML"
          value={chaveNfe}
          onChange={(event) => setChaveNfe(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleLerCodigoNota();
            }
          }}
        />
        <Button variant="secondary" onClick={handleLerCodigoNota} disabled={!chaveNfe.trim() || loadingChave}>
          {loadingChave ? "Lendo..." : "Ler nota"}
        </Button>
      </div>

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
            {itensPreview.slice(0, 8).map((item, index) => (
              <article key={`${item.codigo}-${item.nome}`}>
                <span>{item.nome}</span>
                <small>
                  {item.quantidade} {item.unidade} · R$ {item.valorTotal.toFixed(2)} · Cod. barras: {item.codigoBarras || "nao informado"}
                </small>
                <TextInput
                  label="Codigo de barras para cadastro"
                  value={item.codigoBarras || ""}
                  onChange={(event) => atualizarCodigoPreview(index, event.target.value)}
                />
              </article>
            ))}
          </div>
          {itensPreview.length > 8 ? <small>+ {itensPreview.length - 8} itens na nota</small> : null}
        </div>
      ) : null}
    </Card>
  );
}
