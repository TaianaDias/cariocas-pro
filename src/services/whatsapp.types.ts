export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
      imageMessage?: unknown;
      audioMessage?: unknown;
    };
    messageType: string;
    messageTimestamp: number;
    pushName: string;
  };
}

export interface EvolutionSendMessageResponse {
  status: string;
  message: string;
  key: {
    id: string;
  };
}

export interface EvolutionInstanceStatus {
  instance: {
    instanceName: string;
    status?: "open" | "close" | "connecting" | "qrcode";
    state?: "open" | "close" | "connecting" | "qrcode";
    qrcode?: string;
    owner?: string;
    profileName?: string;
  };
}
