import type { EvolutionInstanceStatus } from "./whatsapp.types";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "http://localhost:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "cariocas-pro-evolution-key-2026";
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE || process.env.EVOLUTION_INSTANCE_NAME || "cariocas-pro";

type EvolutionFetchOptions = RequestInit & {
  timeoutMs?: number;
};

async function evolutionFetch(endpoint: string, options: EvolutionFetchOptions = {}): Promise<Response> {
  const url = endpoint.startsWith("http") ? endpoint : `${EVOLUTION_API_URL}${endpoint}`;
  const { headers, timeoutMs = 12000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
        ...headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(
        JSON.stringify({
          error: "timeout",
          message: `Evolution API demorou mais de ${Math.round(timeoutMs / 1000)}s para responder`,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 504,
        },
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

function normalizeQrCode(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.replace(/^data:image\/png;base64,/, "");
}

function extractQrCode(data: any): string | undefined {
  return normalizeQrCode(
    data?.qrcode?.base64 || data?.qrcode || data?.instance?.qrcode?.base64 || data?.instance?.qrcode || data?.base64,
  );
}

function isInstanceAlreadyCreated(error?: string): boolean {
  return Boolean(error && /already|existe|exist|in use|uso/i.test(error));
}

function normalizePhone(numero: string): string {
  return numero.replace("@s.whatsapp.net", "").replace(/\D/g, "");
}

function normalizeStatus(status?: string | null) {
  if (!status) return undefined;
  if (status === "open") return "open";
  if (status === "qrcode") return "qrcode";
  if (["close", "closed", "disconnected"].includes(status)) return "close";
  if (["connecting", "connection", "loading"].includes(status)) return "connecting";
  return status;
}

function normalizeInstance(found: any): EvolutionInstanceStatus["instance"] {
  return {
    ...found,
    owner: found?.ownerJid || found?.owner,
    profileName: found?.profileName || found?.name,
    qrcode: extractQrCode(found),
    status: normalizeStatus(found?.connectionStatus || found?.status || found?.state) as EvolutionInstanceStatus["instance"]["status"],
  };
}

export async function enviarWhatsApp(numero: string, texto: string): Promise<boolean> {
  try {
    const numeroLimpo = normalizePhone(numero);
    const payloads = [
      {
        number: numeroLimpo,
        text: texto,
        options: {
          delay: 1200,
          linkPreview: false,
          mentioned: [],
        },
      },
      {
        number: numeroLimpo,
        textMessage: {
          text: texto,
        },
        options: {
          delay: 1200,
          linkPreview: false,
          mentioned: [],
        },
      },
    ];

    for (const payload of payloads) {
      const response = await evolutionFetch(`/message/sendText/${INSTANCE_NAME}`, {
        method: "POST",
        timeoutMs: 10000,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return true;
      }

      const erro = await response.text();
      console.error("Evolution API send error:", erro);
    }

    return false;
  } catch (error) {
    console.error("Erro ao enviar WhatsApp:", error);
    return false;
  }
}

export async function criarInstancia(options: { verificarExistente?: boolean } = {}): Promise<{ success: boolean; qrcode?: string; error?: string }> {
  try {
    if (options.verificarExistente !== false) {
      const existente = await getStatusInstancia();

      if (existente?.status === "open") {
        return { success: true };
      }

      if (existente) {
        const qrcode = await getQrCode();
        return { success: true, qrcode: qrcode || undefined };
      }
    }

    const response = await evolutionFetch("/instance/create", {
      method: "POST",
      timeoutMs: 15000,
      body: JSON.stringify({
        instanceName: INSTANCE_NAME,
        token: EVOLUTION_API_KEY,
        qrcode: true,
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
      const error = extractEvolutionError(data, `Evolution API retornou ${response.status}`);

      if (isInstanceAlreadyCreated(error)) {
        const qrcode = await getQrCode();
        return { success: true, qrcode: qrcode || undefined };
      }

      return {
        success: false,
        error,
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
    const instancesResponse = await evolutionFetch("/instance/fetchInstances", { timeoutMs: 8000 });
    const instancesData = await readEvolutionResponse(instancesResponse);
    const instances = Array.isArray(instancesData) ? instancesData : [];
    const found = instances.find((item: any) => item?.name === INSTANCE_NAME || item?.instanceName === INSTANCE_NAME);

    if (found) {
      return normalizeInstance(found);
    }

    const response = await evolutionFetch(`/instance/connectionState/${INSTANCE_NAME}`, { timeoutMs: 8000 });
    const data = await readEvolutionResponse(response);
    const instance = data?.instance || null;

    if (!instance) return null;

    return {
      ...instance,
      qrcode: extractQrCode(instance),
      status: normalizeStatus(instance.status || instance.state || instance.connectionStatus) as EvolutionInstanceStatus["instance"]["status"],
    };
  } catch {
    return null;
  }
}

export async function getQrCode(): Promise<string | null> {
  try {
    const response = await evolutionFetch(`/instance/connect/${INSTANCE_NAME}`, { method: "GET", timeoutMs: 10000 });
    const data = await readEvolutionResponse(response);
    const qrcode = extractQrCode(data);

    if (qrcode) return qrcode;

    const instancia = await getStatusInstancia();
    return instancia?.qrcode || null;
  } catch {
    return null;
  }
}

export async function logoutInstancia(): Promise<boolean> {
  try {
    const response = await evolutionFetch(`/instance/logout/${INSTANCE_NAME}`, { method: "DELETE", timeoutMs: 6000 });
    return response.ok;
  } catch {
    return false;
  }
}

export async function deletarInstancia(): Promise<boolean> {
  try {
    const response = await evolutionFetch(`/instance/delete/${INSTANCE_NAME}`, { method: "DELETE", timeoutMs: 6000 });
    return response.ok;
  } catch {
    return false;
  }
}

export async function recriarInstancia(): Promise<{ success: boolean; qrcode?: string; error?: string }> {
  try {
    await logoutInstancia();
    await deletarInstancia();

    const criada = await criarInstancia({ verificarExistente: false });
    if (!criada.success) return criada;

    const qrcode = criada.qrcode || (await getQrCode()) || undefined;
    return { success: true, qrcode };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao recriar sessao do WhatsApp",
    };
  }
}

export async function verificarWebhook(): Promise<boolean> {
  try {
    const response = await evolutionFetch(`/webhook/find/${INSTANCE_NAME}`, { timeoutMs: 8000 });
    const data = await readEvolutionResponse(response);
    const url = data?.webhook?.url || data?.url;
    return Boolean(data?.enabled !== false && url?.includes("api/whatsapp/webhook"));
  } catch {
    return false;
  }
}

export async function configurarWebhook(url: string): Promise<boolean> {
  try {
    const response = await evolutionFetch(`/webhook/set/${INSTANCE_NAME}`, {
      method: "POST",
      timeoutMs: 8000,
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
