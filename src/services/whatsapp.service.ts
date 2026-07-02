import type { EvolutionInstanceStatus } from "./whatsapp.types";

const EVOLUTION_API_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "http://localhost:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "cariocas-pro-evolution-key-2026";
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "cariocas-pro";

async function evolutionFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = endpoint.startsWith("http") ? endpoint : `${EVOLUTION_API_URL}${endpoint}`;

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
      ...options?.headers,
    },
  });
}

async function readEvolutionResponse(response: Response): Promise<any> {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function extractEvolutionError(data: any, fallback: string): string {
  const message = data?.response?.message || data?.message || data?.error || data?.statusMessage;
  return Array.isArray(message) ? message.join(", ") : message || fallback;
}

function extractQrCode(data: any): string | undefined {
  return data?.qrcode?.base64 || data?.qrcode || data?.instance?.qrcode || data?.instance?.qrcode?.base64 || data?.base64;
}

export async function enviarWhatsApp(numero: string, texto: string): Promise<boolean> {
  try {
    const numeroLimpo = numero.replace("@s.whatsapp.net", "").replace(/\D/g, "");

    const response = await evolutionFetch(`/message/sendText/${INSTANCE_NAME}`, {
      method: "POST",
      body: JSON.stringify({
        number: numeroLimpo,
        text: texto,
        options: {
          delay: 1200,
          linkPreview: false,
          mentioned: [],
        },
      }),
    });

    if (!response.ok) {
      const erro = await response.text();
      console.error("Evolution API send error:", erro);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Erro ao enviar WhatsApp:", error);
    return false;
  }
}

export async function criarInstancia(): Promise<{ success: boolean; qrcode?: string; error?: string }> {
  try {
    const response = await evolutionFetch("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName: INSTANCE_NAME,
        token: EVOLUTION_API_KEY,
        qrcode: true,
        number: "",
        integration: "WHATSAPP-BAILEYS",
        reject_call: true,
        groups_ignore: true,
        always_online: true,
        read_messages: true,
        read_status: true,
        sync_full_history: false,
        webhook_by_events: true,
        webhook_base64: false,
      }),
    });

    const data = await readEvolutionResponse(response);

    if (!response.ok) {
      return {
        success: false,
        error: extractEvolutionError(data, `Evolution API retornou ${response.status}`),
      };
    }

    const qrcode = extractQrCode(data);

    if (qrcode) {
      return { success: true, qrcode };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao criar instancia" };
  }
}

export async function getStatusInstancia(): Promise<EvolutionInstanceStatus["instance"] | null> {
  try {
    const response = await evolutionFetch(`/instance/connectionState/${INSTANCE_NAME}`);
    const data = await readEvolutionResponse(response);
    const instance = data?.instance || null;

    if (!instance) return null;

    return {
      ...instance,
      status: instance.status || instance.state,
    };
  } catch {
    return null;
  }
}

export async function getQrCode(): Promise<string | null> {
  try {
    const response = await evolutionFetch(`/instance/connect/${INSTANCE_NAME}`);
    const data = await readEvolutionResponse(response);
    return extractQrCode(data) || null;
  } catch {
    return null;
  }
}

export async function logoutInstancia(): Promise<boolean> {
  try {
    const response = await evolutionFetch(`/instance/logout/${INSTANCE_NAME}`, { method: "DELETE" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function deletarInstancia(): Promise<boolean> {
  try {
    const response = await evolutionFetch(`/instance/delete/${INSTANCE_NAME}`, { method: "DELETE" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function verificarWebhook(): Promise<boolean> {
  try {
    const response = await evolutionFetch(`/webhook/find/${INSTANCE_NAME}`);
    const data = await readEvolutionResponse(response);
    return data?.webhook?.url?.includes("api/whatsapp/webhook") || false;
  } catch {
    return false;
  }
}

export async function configurarWebhook(url: string): Promise<boolean> {
  try {
    const response = await evolutionFetch(`/webhook/set/${INSTANCE_NAME}`, {
      method: "POST",
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url,
          webhookByEvents: false,
          webhookBase64: false,
          events: ["MESSAGES_UPSERT"],
        },
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
