import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "../lib/firebase";
import { enviarWhatsApp } from "./whatsapp.service";

type AutomacaoEvento = {
  tipo: string;
  empresaId?: string;
  insumoId?: string;
  insumoNome?: string;
  lojaId?: string;
  quantidade?: number;
  responsavel?: string;
  dados?: Record<string, unknown>;
};

const COLECAO_LOGS = "automacaoLogs";

function getAutomacaoLogsCollectionPath(empresaId?: string) {
  return empresaId ? `empresas/${empresaId}/automacaoLogs` : COLECAO_LOGS;
}

function montarMensagem(evento: AutomacaoEvento) {
  switch (evento.tipo) {
    case "entrada":
      return `Entrada de Estoque\n\nProduto: ${evento.insumoNome}\nQuantidade: ${evento.quantidade}\nResponsavel: ${evento.responsavel}`;
    case "saida":
      return `Saída de Estoque\n\nProduto: ${evento.insumoNome}\nQuantidade: ${evento.quantidade}\nResponsavel: ${evento.responsavel}`;
    case "estoque_baixo":
      return `Estoque Baixo\n\nProduto: ${evento.insumoNome}\nEstoque atual: ${evento.dados?.atual || 0}\nMinimo: ${evento.dados?.minimo || 0}`;
    case "vencendo":
      return `Produto Proximo do Vencimento\n\nProduto: ${evento.insumoNome}\nLote: ${evento.dados?.lote || "-"}\nValidade: ${evento.dados?.validade || "-"}`;
    case "vencido":
      return `Produto Vencido\n\nProduto: ${evento.insumoNome}\nLote: ${evento.dados?.lote || "-"}`;
    case "sugestao_compra":
      return `Sugestão de Compra\n\nProduto: ${evento.insumoNome}\nQtd sugerida: ${evento.quantidade}\nFornecedor: ${evento.dados?.fornecedor || "-"}`;
    default:
      return `Notificacao Carioca's\n\nEvento: ${evento.tipo}\nProduto: ${evento.insumoNome || "-"}`;
  }
}

export async function dispararAutomacao(evento: AutomacaoEvento, numeroAdmin: string) {
  const mensagem = montarMensagem(evento);
  const destino = String(evento.dados?.whatsappNumber || numeroAdmin || "");
  const enviado = destino ? await enviarWhatsApp(destino, mensagem) : false;

  await addDoc(collection(db, getAutomacaoLogsCollectionPath(evento.empresaId)), {
    ...evento,
    criadoEm: serverTimestamp(),
    destino,
    enviado,
    mensagem,
  });

  return { enviado, mensagem };
}
