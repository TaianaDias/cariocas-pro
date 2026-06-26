import Link from "next/link";

import { Card } from "../../../components/ui/Card";

const capacidades = [
  {
    label: "Estoque",
    texto: "Consulta produtos criticos, itens abaixo do minimo, entradas recentes e sugestoes de reposicao.",
  },
  {
    label: "Compras",
    texto: "Ajuda a montar pedidos para fornecedores ou mercado usando estoque minimo e maximo.",
  },
  {
    label: "Producao",
    texto: "Orienta porcionamento, saldos brutos, porcoes disponiveis e necessidades da cozinha.",
  },
  {
    label: "Desperdicio",
    texto: "Resume perdas, custo estimado, motivos frequentes e impacto operacional.",
  },
];

const comandos = [
  "Quais itens estao abaixo do minimo?",
  "Monte uma lista de compras para hoje.",
  "O que preciso repor primeiro?",
  "Quanto perdi em desperdicio esta semana?",
  "Quais produtos precisam de atencao no estoque?",
  "Como esta minha producao porcionada?",
];

const regras = [
  "Usa somente dados da empresa e loja conectadas.",
  "Respeita permissoes do usuario logado.",
  "Nao deve expor custo, margem ou lucro para funcionario sem permissao.",
  "Acoes criticas continuam dependendo de confirmacao no sistema.",
];

export default function CarioquinhaConfigPage() {
  return (
    <main className="carioquinha-page">
      <section className="carioquinha-page__hero">
        <div className="carioquinha-page__eyebrow">Assistente operacional</div>
        <div className="carioquinha-page__hero-grid">
          <div>
            <h1>IA Carioquinha</h1>
            <p>
              Sua assistente para acompanhar estoque, compras, producao e desperdicio com respostas
              diretas para a rotina da hamburgueria.
            </p>
          </div>
          <div className="carioquinha-page__actions">
            <Link className="button button--primary" href="/configuracoes/whatsapp">
              Conectar WhatsApp
            </Link>
            <Link className="button button--secondary" href="/estoque">
              Ver estoque
            </Link>
          </div>
        </div>
      </section>

      <section className="carioquinha-page__metrics" aria-label="Status da IA">
        <Card className="carioquinha-page__metric">
          <span>Status</span>
          <strong>Pronta para configurar</strong>
          <small>Conecte o WhatsApp para operar por mensagem.</small>
        </Card>
        <Card className="carioquinha-page__metric">
          <span>Canais</span>
          <strong>Painel + WhatsApp</strong>
          <small>Uso interno no sistema e atendimento operacional.</small>
        </Card>
        <Card className="carioquinha-page__metric">
          <span>Contexto</span>
          <strong>Empresa e loja</strong>
          <small>Respostas baseadas no ambiente logado.</small>
        </Card>
      </section>

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
