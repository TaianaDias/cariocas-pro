import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "../lib/firebase";

type AutomacaoEvento = {
  tipo: string;
  insumoId?: string;
  insumoNome?: string;
  quantidade?: number;
  responsavel?: string;
  dados?: Record<string, unknown>;
};

const EVOLUTION_API_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "http://localhost:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "cariocas-pro-evolution-key-2026";
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "cariocas-pro";
const COLECAO_LOGS = "automacaoLogs";

async function enviarWhatsApp(numero: string, texto: string): Promise<boolean> {
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apiKey: EVOLUTION_API_KEY },
      body: JSON.stringify({
        number: numero.replace(/\D/g, ""),
        options: { delay: 1200, linkPreview: false },
        text: texto,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

function montarMensagem(evento: AutomacaoEvento) {
  switch (evento.tipo) {
    case "entrada":
      return `Entrada de Estoque\n\nProduto: ${evento.insumoNome}\nQuantidade: ${evento.quantidade}\nResponsavel: ${evento.responsavel}`;
    case "saida":
      return `Saida de Estoque\n\nProduto: ${evento.insumoNome}\nQuantidade: ${evento.quantidade}\nResponsavel: ${evento.responsavel}`;
    case "estoque_baixo":
      return `Estoque Baixo\n\nProduto: ${evento.insumoNome}\nEstoque atual: ${evento.dados?.atual || 0}\nMinimo: ${evento.dados?.minimo || 0}`;
    case "vencendo":
      return `Produto Proximo do Vencimento\n\nProduto: ${evento.insumoNome}\nLote: ${evento.dados?.lote || "-"}\nValidade: ${evento.dados?.validade || "-"}`;
    case "vencido":
      return `Produto Vencido\n\nProduto: ${evento.insumoNome}\nLote: ${evento.dados?.lote || "-"}`;
    case "sugestao_compra":
      return `Sugestao de Compra\n\nProduto: ${evento.insumoNome}\nQtd sugerida: ${evento.quantidade}\nFornecedor: ${evento.dados?.fornecedor || "-"}`;
    default:
      return `Notificacao Carioca's\n\nEvento: ${evento.tipo}\nProduto: ${evento.insumoNome || "-"}`;
  }
}

export async function dispararAutomacao(evento: AutomacaoEvento, numeroAdmin: string) {
  const mensagem = montarMensagem(evento);
  const destino = String(evento.dados?.whatsappNumber || numeroAdmin || "");
  const enviado = destino ? await enviarWhatsApp(destino, mensagem) : false;

  await addDoc(collection(db, COLECAO_LOGS), {
    ...evento,
    criadoEm: serverTimestamp(),
    destino,
    enviado,
    mensagem,
  });

  return { enviado, mensagem };
}
