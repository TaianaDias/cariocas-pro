"use client";

import { useAuth } from "../../hooks/useAuth";
import { useCarioquinha } from "../../hooks/useCarioquinha";
import { InputChat } from "./InputChat";
import { MessageBubble } from "./MessageBubble";
import { Suggestions } from "./Suggestions";

type CarioquinhaDrawerProps = {
  aberto: boolean;
  onClose: () => void;
};

export function CarioquinhaDrawer({ aberto, onClose }: CarioquinhaDrawerProps) {
  const { user } = useAuth();
  const { enviar, loading, mensagens } = useCarioquinha(user?.uid ?? "");

  if (!aberto) return null;

  return (
    <aside className="carioquinha-drawer" aria-label="IA Carioquinha">
      <header className="carioquinha-header">
        <div className="carioquinha-avatar" aria-hidden="true">
          IA
        </div>
        <div>
          <span>Assistente operacional</span>
          <h2>IA Carioquinha</h2>
        </div>
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </header>

      {mensagens.length === 0 ? <Suggestions onSelect={enviar} /> : null}

      <div className="carioquinha-messages" aria-label="Mensagens">
        {mensagens.map((message) => (
          <MessageBubble author={message.sender} key={message.id}>
            {message.texto}
          </MessageBubble>
        ))}
        {loading ? <MessageBubble author="ai">Processando...</MessageBubble> : null}
      </div>

      <InputChat loading={loading} onSend={enviar} />
    </aside>
  );
}
