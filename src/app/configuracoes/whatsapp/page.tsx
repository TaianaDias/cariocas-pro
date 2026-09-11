"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Spinner } from "../../../components/ui/Spinner";
import { Title } from "../../../components/ui/Title";
import { useAuth } from "../../../hooks/useAuth";

interface StatusInstancia {
  status: "offline" | "qrcode" | "connecting" | "open" | "close";
  qrcode?: string;
  owner?: string;
  profileName?: string;
}

const badgeStatus = {
  offline: { tone: "danger" as const, label: "Desconectado" },
  close: { tone: "danger" as const, label: "Desconectado" },
  qrcode: { tone: "warning" as const, label: "Aguardando QR Code" },
  connecting: { tone: "warning" as const, label: "Conectando..." },
  open: { tone: "success" as const, label: "Conectado" },
};

async function lerRespostaJson(response: Response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const resumo = text.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(
      `A rota retornou HTML em vez de JSON (${response.status}). Publique a versão nova na VPS ou verifique o log do servidor. Retorno: ${resumo}`,
    );
  }
}

export default function WhatsAppConfigPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusInstancia>({ status: "offline" });
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      if (!user) {
        throw new Error("Usuário não autenticado.");
      }

      const token = await user.getIdToken();
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);

      return fetch(input, { ...init, headers });
    },
    [user],
  );

  const verificarStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const res = await authFetch("/api/whatsapp/status", { cache: "no-store" });
      const data = await lerRespostaJson(res);
      setStatus(data);
    } catch {
      setStatus({ status: "offline" });
    } finally {
      setLoading(false);
    }
  }, [authFetch, user]);

  useEffect(() => {
    verificarStatus();
    const interval = window.setInterval(verificarStatus, 5000);

    return () => window.clearInterval(interval);
  }, [verificarStatus]);

  async function handleCriarInstancia() {
    setCriando(true);

    try {
      const res = await authFetch("/api/whatsapp/connect", { method: "POST" });
      const data = await lerRespostaJson(res);

      if (!res.ok) {
        throw new Error(data.message || "Erro ao conectar o WhatsApp.");
      }

      if (data.status === "qrcode") {
        setStatus({ status: "qrcode", qrcode: data.qrcode });
      } else {
        setStatus({ status: data.status || "connecting" });
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Erro ao conectar o WhatsApp.");
    } finally {
      setCriando(false);
    }
  }

  async function handleDesconectar() {
    if (!window.confirm("Tem certeza? Você precisará escanear o QR Code novamente para reconectar.")) return;

    const res = await authFetch("/api/whatsapp/disconnect", { method: "POST" });
    if (!res.ok) {
      window.alert("Não foi possível desconectar o WhatsApp agora.");
      return;
    }

    setStatus({ status: "offline" });
  }

  async function handleRecriarSessao() {
    if (!window.confirm("Reconectar o WhatsApp? Use esta opção se a conexão parar de responder ou o QR Code falhar.")) return;

    setRecuperando(true);

    try {
      const res = await authFetch("/api/whatsapp/reconnect", { method: "POST" });
      const data = await lerRespostaJson(res);

      if (!res.ok || data.status === "error") {
        throw new Error(data.message || "Erro ao reconectar o WhatsApp.");
      }

      setStatus({
        qrcode: data.qrcode || undefined,
        status: data.status || "connecting",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Erro ao reconectar o WhatsApp.");
    } finally {
      setRecuperando(false);
    }
  }

  if (loading) {
    return (
      <div className="whatsapp-config whatsapp-config--loading">
        <Spinner />
      </div>
    );
  }

  const info = badgeStatus[status.status] || badgeStatus.offline;

  return (
    <div className="whatsapp-config">
      <div>
        <Title>WhatsApp</Title>
        <span className="whatsapp-config__subtitle">
          Conecte a IA Carioquinha ao WhatsApp da sua operação
        </span>
      </div>

      <Card className="whatsapp-config__card">
        <div className="whatsapp-config__status">
          <div>
            <strong>Status da conexão</strong>
            <span>
              {status.owner
                ? `Conectado como: ${status.profileName || status.owner}`
                : "Número ainda não conectado"}
            </span>
          </div>
          <Badge tone={info.tone}>{info.label}</Badge>
        </div>

        {status.status === "qrcode" && status.qrcode ? (
          <div className="whatsapp-config__qrcode">
            <img src={`data:image/png;base64,${status.qrcode}`} alt="QR Code do WhatsApp" />
            <strong>Abra o WhatsApp, entre em Dispositivos conectados e escaneie o QR Code.</strong>
            <span>O QR Code é atualizado automaticamente. Escaneie antes de expirar.</span>
          </div>
        ) : null}

        <div className="whatsapp-config__actions">
          {status.status === "offline" || status.status === "close" ? (
            <Button variant="primary" onClick={handleCriarInstancia} disabled={criando}>
              {criando ? "Conectando..." : "Conectar WhatsApp"}
            </Button>
          ) : null}

          {status.status === "open" ? (
            <Button variant="secondary" onClick={handleDesconectar}>
              Desconectar
            </Button>
          ) : null}

          {status.status === "qrcode" ? (
            <Button variant="secondary" onClick={handleCriarInstancia} disabled={criando}>
              Gerar novo QR Code
            </Button>
          ) : null}

          <Button variant="secondary" onClick={handleRecriarSessao} disabled={recuperando || criando}>
            {recuperando ? "Reconectando..." : "Reconectar WhatsApp"}
          </Button>
        </div>
      </Card>

      <Card className="whatsapp-config__card">
        <strong>Como usar</strong>
        <p>
          Após conectar, gestores e funcionários autorizados podem conversar com a Carioquinha pelo WhatsApp da operação.
          A assistente responde usando os dados disponíveis no Carioca&apos;s Pro conforme as permissões e funcionalidades habilitadas.
        </p>
        <p>Exemplos: "O que devo repor?", "Resumo do dia" e "Itens críticos".</p>
      </Card>

      <Card className="whatsapp-config__card">
        <strong>Conexão gerenciada pelo Carioca&apos;s Pro</strong>
        <p>
          A infraestrutura técnica do WhatsApp é administrada pelo sistema. Sua empresa só precisa vincular o número pelo QR Code quando solicitado.
        </p>
      </Card>
    </div>
  );
}
