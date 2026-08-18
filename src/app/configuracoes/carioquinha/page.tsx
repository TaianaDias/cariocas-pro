"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Spinner } from "../../../components/ui/Spinner";

type StatusInstancia = {
  owner?: string | null;
  profileName?: string | null;
  qrcode?: string | null;
  status: "offline" | "qrcode" | "connecting" | "open" | "close" | "error";
  webhookAtivo?: boolean;
};

const capacidades = [
  {
    label: "Estoque",
    texto: "Consulta produtos criticos, itens abaixo do mínimo, entradas recentes e sugestoes de reposicao.",
  },
  {
    label: "Compras",
    texto: "Ajuda a montar pedidos para fornecedores ou mercado usando estoque mínimo e máximo.",
  },
  {
    label: "Produção",
    texto: "Orienta porcionamento, saldos brutos, porções disponíveis e necessidades da cozinha.",
  },
  {
    label: "Desperdício",
    texto: "Resume perdas, custo estimado, motivos frequentes e impacto operacional.",
  },
];

const comandos = [
  "Quais itens estao abaixo do mínimo?",
  "Monte uma lista de compras para hoje.",
  "O que preciso repor primeiro?",
  "Quanto perdi em desperdicio esta semana?",
  "Quais produtos precisam de atencao no estoque?",
  "Como esta minha produção porcionada?",
];

const regras = [
  "Usa somente dados da empresa e loja conectadas.",
  "Respeita permissoes do usuário logado.",
  "Não deve expor custo, margem ou lucro para funcionario sem permissão.",
  "Ações críticas continuam dependendo de confirmacao no sistema.",
];

const statusInfo = {
  close: { label: "Desconectado", tone: "danger" as const },
  connecting: { label: "Conectando", tone: "warning" as const },
  error: { label: "Erro", tone: "danger" as const },
  offline: { label: "Desconectado", tone: "danger" as const },
  open: { label: "Conectado", tone: "success" as const },
  qrcode: { label: "Aguardando QR Code", tone: "warning" as const },
};

export default function CarioquinhaConfigPage() {
  const [status, setStatus] = useState<StatusInstancia>({ status: "offline" });
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const verificarStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/whatsapp/status", { cache: "no-store" });
      const data = await response.json();
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

  async function conectarWhatsApp() {
    setCriando(true);
    setErro(null);

    try {
      const response = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = await response.json();

      if (!response.ok || data.status === "error") {
        throw new Error(data.message || "Não foi possível conectar o WhatsApp.");
      }

      setStatus({
        qrcode: data.qrcode || null,
        status: data.status || "connecting",
        webhookAtivo: true,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível conectar o WhatsApp.");
    } finally {
      setCriando(false);
    }
  }

  async function desconectarWhatsApp() {
    const confirmou = window.confirm("Desconectar o WhatsApp da IA Carioquinha?");
    if (!confirmou) return;

    setErro(null);
    await fetch("/api/whatsapp/disconnect", { method: "POST" });
    setStatus({ status: "offline", webhookAtivo: false });
  }

  async function recriarSessaoWhatsApp() {
    const confirmou = window.confirm(
      "Recriar a sessao do WhatsApp? Use quando o QR Code expirar ou quando aparecer conectado, mas a IA nao responder.",
    );
    if (!confirmou) return;

    setRecuperando(true);
    setErro(null);

    try {
      const response = await fetch("/api/whatsapp/reconnect", { method: "POST" });
      const data = await response.json();

      if (!response.ok || data.status === "error") {
        throw new Error(data.message || "Nao foi possivel recriar a sessao do WhatsApp.");
      }

      setStatus({
        qrcode: data.qrcode || null,
        status: data.status || "connecting",
        webhookAtivo: data.webhookAtivo,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Nao foi possivel recriar a sessao do WhatsApp.");
    } finally {
      setRecuperando(false);
    }
  }

  const info = statusInfo[status.status] || statusInfo.offline;
  const conectado = status.status === "open";
  const aguardandoQr = status.status === "qrcode" && status.qrcode;

  return (
    <main className="carioquinha-page">
      <section className="carioquinha-page__hero">
        <div className="carioquinha-page__eyebrow">Assistente operacional</div>
        <div className="carioquinha-page__hero-grid">
          <div>
            <h1>IA Carioquinha</h1>
            <p>
              Sua assistente para acompanhar estoque, compras, producao e desperdicio com respostas
              diretas pelo painel e pelo WhatsApp da hamburgueria.
            </p>
          </div>
          <div className="carioquinha-page__actions">
            {conectado ? (
              <Button variant="secondary" onClick={desconectarWhatsApp}>
                Desconectar WhatsApp
              </Button>
            ) : (
              <Button variant="primary" onClick={conectarWhatsApp} disabled={criando}>
                {criando ? "Conectando..." : "Conectar WhatsApp"}
              </Button>
            )}
            <Button variant="secondary" onClick={recriarSessaoWhatsApp} disabled={recuperando || criando}>
              {recuperando ? "Recriando..." : "Recriar sessao"}
            </Button>
            <Link className="button button--secondary" href="/estoque">
              Ver estoque
            </Link>
          </div>
        </div>
      </section>

      <section className="carioquinha-page__metrics" aria-label="Status da IA">
        <Card className="carioquinha-page__metric">
          <span>Status</span>
          <strong>{info.label}</strong>
          <Badge tone={info.tone}>{info.label}</Badge>
        </Card>
        <Card className="carioquinha-page__metric">
          <span>WhatsApp</span>
          <strong>{status.owner ? status.profileName || status.owner : "Não conectado"}</strong>
          <small>{conectado ? "Pronto para receber mensagens." : "Escaneie o QR Code para ativar."}</small>
        </Card>
        <Card className="carioquinha-page__metric">
          <span>Webhook</span>
          <strong>{status.webhookAtivo ? "Ativo" : "Pendente"}</strong>
          <small>Canal que entrega as mensagens do WhatsApp para a IA.</small>
        </Card>
      </section>

      {loading ? (
        <Card className="carioquinha-page__panel carioquinha-page__loading">
          <Spinner label="Verificando WhatsApp" />
        </Card>
      ) : null}

      {erro ? <p className="carioquinha-page__feedback">{erro}</p> : null}

      {aguardandoQr ? (
        <Card className="carioquinha-page__qr">
          <div className="carioquinha-page__section-heading">
            <span>Ligacao com WhatsApp</span>
            <h2>Escaneie o QR Code</h2>
          </div>
          <img src={`data:image/png;base64,${status.qrcode}`} alt="QR Code para conectar WhatsApp" />
          <p>Abra o WhatsApp, acesse Dispositivos conectados e aponte a camera para este codigo.</p>
          <Button variant="secondary" onClick={conectarWhatsApp} disabled={criando}>
            {criando ? "Gerando..." : "Gerar novo QR Code"}
          </Button>
          <Button variant="secondary" onClick={recriarSessaoWhatsApp} disabled={recuperando}>
            {recuperando ? "Recriando..." : "Recriar sessao"}
          </Button>
        </Card>
      ) : null}

      <section className="carioquinha-page__content">
        <Card className="carioquinha-page__panel carioquinha-page__panel--large">
          <div className="carioquinha-page__section-heading">
            <span>O que ela faz</span>
            <h2>Comandos pensados para operacao real</h2>
          </div>

          <div className="carioquinha-page__capabilities">
            {capacidades.map((item) => (
              <article key={item.label}>
                <strong>{item.label}</strong>
                <p>{item.texto}</p>
              </article>
            ))}
          </div>
        </Card>

        <Card className="carioquinha-page__panel carioquinha-page__chat">
          <div className="carioquinha-page__section-heading">
            <span>Preview</span>
            <h2>Exemplo de conversa</h2>
          </div>

          <div className="carioquinha-page__messages" aria-label="Exemplo de conversa">
            <article className="carioquinha-page__bubble carioquinha-page__bubble--user">
              <span>Voce</span>
              <p>O que preciso comprar hoje?</p>
            </article>
            <article className="carioquinha-page__bubble carioquinha-page__bubble--ai">
              <span>IA Carioquinha</span>
              <p>
                Vou priorizar itens abaixo do minimo, calcular a quantidade para chegar ao estoque
                maximo e separar por fornecedor ou mercado.
              </p>
            </article>
          </div>
        </Card>

        <Card className="carioquinha-page__panel">
          <div className="carioquinha-page__section-heading">
            <span>Comandos rapidos</span>
            <h2>Perguntas prontas</h2>
          </div>

          <div className="carioquinha-page__commands">
            {comandos.map((comando) => (
              <button key={comando} type="button">
                {comando}
              </button>
            ))}
          </div>
        </Card>

        <Card className="carioquinha-page__panel">
          <div className="carioquinha-page__section-heading">
            <span>Seguranca</span>
            <h2>Regras de uso</h2>
          </div>

          <ul className="carioquinha-page__rules">
            {regras.map((regra) => (
              <li key={regra}>{regra}</li>
            ))}
          </ul>
        </Card>
      </section>
    </main>
  );
}
