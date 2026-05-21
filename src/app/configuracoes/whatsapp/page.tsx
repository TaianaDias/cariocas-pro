"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Spinner } from "../../../components/ui/Spinner";
import { Title } from "../../../components/ui/Title";

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

export default function WhatsAppConfigPage() {
  const [status, setStatus] = useState<StatusInstancia>({ status: "offline" });
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);

  const verificarStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ status: "offline" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verificarStatus();
    const interval = window.setInterval(verificarStatus, 5000);

    return () => window.clearInterval(interval);
  }, [verificarStatus]);

  async function handleCriarInstancia() {
    setCriando(true);

    try {
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = await res.json();

      if (data.status === "qrcode") {
        setStatus({ status: "qrcode", qrcode: data.qrcode });
      } else {
        setStatus({ status: data.status || "connecting" });
      }
    } catch {
      window.alert("Erro ao conectar WhatsApp");
    } finally {
      setCriando(false);
    }
  }

  async function handleDesconectar() {
    if (!window.confirm("Tem certeza? Voce precisara escanear o QR Code novamente.")) return;

    await fetch("/api/whatsapp/disconnect", { method: "POST" });
    setStatus({ status: "offline" });
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
          Conecte a IA Carioquinha ao WhatsApp da sua hamburgueria
        </span>
      </div>

      <Card className="whatsapp-config__card">
        <div className="whatsapp-config__status">
          <div>
            <strong>Status da Conexao</strong>
            <span>
              {status.owner
                ? `Conectado como: ${status.profileName || status.owner}`
                : "Numero ainda nao conectado"}
            </span>
          </div>
          <Badge tone={info.tone}>{info.label}</Badge>
        </div>

        {status.status === "qrcode" && status.qrcode ? (
          <div className="whatsapp-config__qrcode">
            <img src={`data:image/png;base64,${status.qrcode}`} alt="QR Code WhatsApp" />
            <strong>Abra o WhatsApp, entre em Dispositivos conectados e escaneie o QR Code.</strong>
            <span>O QR Code atualiza automaticamente. Escaneie antes de expirar.</span>
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
        </div>
      </Card>

      <Card className="whatsapp-config__card">
        <strong>Como usar</strong>
        <p>
          Apos conectar, clientes e funcionarios podem enviar mensagens no WhatsApp da hamburgueria.
          A IA Carioquinha responde automaticamente com dados reais do estoque.
        </p>
        <p>Exemplos: "O que devo repor?", "Resumo do dia", "Itens criticos".</p>
      </Card>

      <Card className="whatsapp-config__card">
        <strong>Pre-requisitos</strong>
        <p>Docker instalado, Evolution API rodando na porta 8080 e Next.js ativo na porta 3000.</p>
      </Card>
    </div>
  );
}
