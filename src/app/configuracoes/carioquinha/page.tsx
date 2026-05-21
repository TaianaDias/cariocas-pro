import { Card } from "../../../components/ui/Card";
import { Title } from "../../../components/ui/Title";

export default function CarioquinhaConfigPage() {
  return (
    <div className="whatsapp-config">
      <Title>IA Carioquinha</Title>
      <Card className="whatsapp-config__card">
        <strong>Configuracao da IA</strong>
        <p>
          A IA Carioquinha sera operada pelo WhatsApp. Use a pagina de WhatsApp para conectar o
          numero e ativar as respostas automaticas.
        </p>
      </Card>
    </div>
  );
}
