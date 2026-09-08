import { NextRequest, NextResponse } from "next/server";

import { getAdminApp } from "../../../../lib/server-auth";
import { processarPergunta } from "../../../../services/carioquinha.service";
import { enviarWhatsAppDetalhado } from "../../../../services/whatsapp.service";

type TenantContext = {
  empresaId: string;
  lojaId: string;
  uid: string;
};

function onlyDigits(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function phoneCandidates(value?: string | null) {
  const digits = onlyDigits(value);
  const withoutBrazil = digits.startsWith("55") ? digits.slice(2) : digits;
  const withBrazil = withoutBrazil ? `55${withoutBrazil}` : digits;
  return [...new Set([digits, withoutBrazil, withBrazil].filter(Boolean))];
}

function phoneMatches(value: unknown, candidates: string[]) {
  const digits = onlyDigits(String(value || ""));
  if (!digits) return false;
  return candidates.includes(digits) || candidates.includes(digits.startsWith("55") ? digits.slice(2) : `55${digits}`);
}

function maskPhone(value?: string | null) {
  const digits = onlyDigits(value);
  if (digits.length <= 4) return digits;
  return `***${digits.slice(-4)}`;
}

function extrairEventoMensagem(body: any) {
  const data = body?.data;

  if (Array.isArray(data)) return data[0] || {};
  if (Array.isArray(data?.messages)) return data.messages[0] || {};
  if (Array.isArray(body?.messages)) return body.messages[0] || {};

  return data || body || {};
}

function extrairTextoMensagem(message: any): string | null {
  if (!message) return null;

  const texto =
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.title ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.templateButtonReplyMessage?.selectedDisplayText ||
    message.templateButtonReplyMessage?.selectedId ||
    message.interactiveResponseMessage?.body?.text;

  if (typeof texto === "string" && texto.trim()) {
    return texto.trim();
  }

  return (
    extrairTextoMensagem(message.ephemeralMessage?.message) ||
    extrairTextoMensagem(message.viewOnceMessage?.message) ||
    extrairTextoMensagem(message.viewOnceMessageV2?.message) ||
    extrairTextoMensagem(message.documentWithCaptionMessage?.message) ||
    null
  );
}

function extrairMensagem(body: any, evento: any) {
  return (
    evento?.message ||
    evento?.messages?.[0]?.message ||
    body?.data?.message ||
    body?.message ||
    body?.data?.messages?.[0]?.message ||
    body?.messages?.[0]?.message ||
    null
  );
}

function extrairRemetente(body: any, evento: any): string | null {
  return (
    evento?.key?.remoteJid ||
    evento?.remoteJid ||
    evento?.sender ||
    evento?.key?.participant ||
    body?.data?.key?.remoteJid ||
    body?.data?.remoteJid ||
    body?.sender ||
    body?.remoteJid ||
    body?.key?.remoteJid ||
    null
  );
}

async function buscarContextoPorTelefone(remetente: string): Promise<TenantContext | null> {
  const fallbackEmpresaId = process.env.CARIOQUINHA_EMPRESA_ID || process.env.NEXT_PUBLIC_CARIOQUINHA_EMPRESA_ID;
  const fallbackLojaId = process.env.CARIOQUINHA_LOJA_ID || process.env.NEXT_PUBLIC_CARIOQUINHA_LOJA_ID;
  const app = getAdminApp();
  if (!app) {
    return fallbackEmpresaId && fallbackLojaId ? { empresaId: fallbackEmpresaId, lojaId: fallbackLojaId, uid: onlyDigits(remetente) } : null;
  }

  const { getFirestore } = await import("firebase-admin/firestore");
  const firestore = getFirestore(app);
  const candidates = phoneCandidates(remetente);
  const userCollections = ["usuarios", "usuários"];
  const phoneFields = ["telefone", "whatsapp", "celular", "numeroWhatsApp", "numeroWhatsAppNotificacao"];

  try {
    for (const collectionName of userCollections) {
      for (const field of phoneFields) {
        for (const candidate of candidates) {
          const snap = await firestore.collection(collectionName).where(field, "==", candidate).limit(1).get();
          const doc = snap.docs[0];
          const data = doc?.data();
          if (data?.empresaId && data?.lojaId) {
            return { empresaId: data.empresaId, lojaId: data.lojaId, uid: data.uid || doc.id };
          }
        }
      }
    }

    for (const field of ["telefone", "whatsapp", "celular"]) {
      for (const candidate of candidates) {
        const snap = await firestore.collectionGroup("funcionarios").where(field, "==", candidate).limit(1).get();
        const doc = snap.docs[0];
        const data = doc?.data();
        if (data?.empresaId && data?.lojaId && data.ativo !== false) {
          return { empresaId: data.empresaId, lojaId: data.lojaId, uid: data.email || doc.id };
        }
      }
    }

    const funcionarios = await firestore.collectionGroup("funcionarios").limit(200).get();
    for (const doc of funcionarios.docs) {
      const data = doc.data();
      if (data?.empresaId && data?.lojaId && data.ativo !== false && phoneMatches(data.telefone || data.whatsapp || data.celular, candidates)) {
        return { empresaId: data.empresaId, lojaId: data.lojaId, uid: data.email || doc.id };
      }
    }
  } catch (error) {
    console.warn("[WhatsApp Webhook] Nao foi possivel resolver contexto por telefone via Admin SDK.", error);
  }

  return fallbackEmpresaId && fallbackLojaId ? { empresaId: fallbackEmpresaId, lojaId: fallbackLojaId, uid: onlyDigits(remetente) } : null;
}

export async function POST(request: NextRequest) {
  try {
    const body: any = await request.json();
    const evento: any = extrairEventoMensagem(body);
    const mensagem = extrairMensagem(body, evento);
    const remetente = extrairRemetente(body, evento);
    const texto = extrairTextoMensagem(mensagem);
    const nomeRemetente = evento?.pushName || body?.data?.pushName || "Cliente";
    const fromMe = Boolean(evento?.key?.fromMe || body?.data?.key?.fromMe || body?.key?.fromMe);

    console.log("[WhatsApp Webhook] Evento recebido", {
      event: body?.event,
      fromMe,
      hasSender: Boolean(remetente),
      hasText: Boolean(texto),
      instance: body?.instance,
      messageType: evento?.messageType || body?.data?.messageType,
      sender: maskPhone(remetente),
    });

    if (fromMe) {
      console.log("[WhatsApp Webhook] Mensagem propria ignorada para evitar loop.");
      return NextResponse.json({ status: "ignored", reason: "self_message" });
    }

    if (!texto || !remetente) {
      console.warn("[WhatsApp Webhook] Evento ignorado sem texto/remetente reconhecido.", {
        event: body?.event,
        instance: body?.instance,
        messageType: body?.data?.messageType,
        hasMessage: Boolean(mensagem),
        hasSender: Boolean(remetente),
      });
      return NextResponse.json({ status: "ignored", reason: "no_text_or_sender" });
    }

    console.log(`[WhatsApp Webhook] Mensagem de ${nomeRemetente} (${maskPhone(remetente)}): ${texto}`);

    if (texto.startsWith("!")) {
      return NextResponse.json({ status: "ignored", reason: "internal_command" });
    }

    const contexto = await buscarContextoPorTelefone(remetente);
    if (!contexto) {
      const respostaCadastro =
        "Oi, sou a IA Carioquinha.\n\n" +
        "Ainda nao reconheci este numero como colaborador da loja.\n\n" +
        "Cadastre este telefone em Funcionarios no Carioca's Pro para eu liberar consultas e registros com seguranca.";
      const envioCadastro = await enviarWhatsAppDetalhado(remetente, respostaCadastro);

      return NextResponse.json({
        status: "blocked",
        reason: "sender_not_linked",
        erroEnvio: envioCadastro.success ? undefined : envioCadastro.error,
        respondido: envioCadastro.success,
      });
    }

    const { resposta } = await processarPergunta(texto, contexto.uid, contexto);
    const envio = await enviarWhatsAppDetalhado(remetente, resposta);

    if (!envio.success) {
      console.error(`[WhatsApp Webhook] Falha ao enviar resposta para ${maskPhone(remetente)}`, envio.error);
    }

    return NextResponse.json({
      status: "ok",
      recebido: texto,
      erroEnvio: envio.success ? undefined : envio.error,
      respondido: envio.success,
    });
  } catch (error) {
    console.error("[WhatsApp Webhook] Erro:", error);

    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    webhook: "whatsapp-carioquinha",
    message: "Webhook da IA Carioquinha ativo. Envie mensagens no WhatsApp.",
  });
}
