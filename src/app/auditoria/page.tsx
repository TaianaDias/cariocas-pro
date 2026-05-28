const modulos = [
  {
    nome: "Dashboard",
    status: "Liberado",
    resumo: "Indicadores da operacao, alertas de reposicao, produtos a vencer e cards inteligentes.",
    metricas: ["Custo do dia", "Itens criticos", "Reposicao pendente"],
  },
  {
    nome: "Estoque",
    status: "Leitura",
    resumo: "Cadastro de insumos, entrada por XML, codigo de barras, imagem do produto e limites minimos/maximos.",
    metricas: ["Saldo atual", "Estoque minimo", "Sugestao de compra"],
  },
  {
    nome: "Compras",
    status: "Leitura",
    resumo: "Lista automatica por mercado ou fornecedor, WhatsApp e reposicao ate o estoque maximo.",
    metricas: ["Mercado", "Fornecedor", "Disparo WhatsApp"],
  },
  {
    nome: "Producao",
    status: "Leitura",
    resumo: "Transforma itens do estoque em porcoes por formato: pacote, bisnaga, pote, saco ou unidade.",
    metricas: ["Estoque disponivel", "Porcoes prontas", "Baixa controlada"],
  },
  {
    nome: "Precificacao Inteligente",
    status: "Plus",
    resumo: "Receitas, CMV dinamico, margem, lucro, preco minimo, preco sugerido e alertas financeiros.",
    metricas: ["CMV", "Margem", "Preco recomendado"],
  },
  {
    nome: "Desperdicio",
    status: "Leitura",
    resumo: "Registra perdas por insumo, motivo e colaborador responsavel para auditoria operacional.",
    metricas: ["Responsavel", "Impacto", "Historico"],
  },
];

const fluxoAuditoria = [
  "Este link nao exige login.",
  "Os dados exibidos sao demonstrativos.",
  "Acoes de escrita ficam bloqueadas neste modo.",
  "Dados reais seguem atras do login e das regras do Firebase.",
];

export default function AuditoriaPage() {
  return (
    <main className="audit-page">
      <section className="audit-hero">
        <div>
          <span className="audit-pill">Modo auditoria somente leitura</span>
          <h1>Carioca&apos;s Pro</h1>
          <p>
            Ambiente publico para avaliacao dos assistentes Adapta, com visao dos modulos, fluxos e regras comerciais sem expor dados reais
            nem permitir alteracoes.
          </p>
        </div>
        <aside className="audit-guard">
          <strong>Protecoes ativas</strong>
          {fluxoAuditoria.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </aside>
      </section>

      <section className="audit-strip" aria-label="Resumo do sistema">
        <div>
          <strong>Multiempresa</strong>
          <span>empresaId e lojaId por modulo</span>
        </div>
        <div>
          <strong>Premium</strong>
          <span>Free, Pro, Plus e Full</span>
        </div>
        <div>
          <strong>Mobile-first</strong>
          <span>Dashboard, dock e cards responsivos</span>
        </div>
        <div>
          <strong>Sem escrita</strong>
          <span>Botoes de alteracao desativados</span>
        </div>
      </section>

      <section className="audit-grid" aria-label="Modulos disponiveis para auditoria">
        {modulos.map((modulo) => (
          <article className="audit-card" key={modulo.nome}>
            <header>
              <span>{modulo.status}</span>
              <h2>{modulo.nome}</h2>
            </header>
            <p>{modulo.resumo}</p>
            <div>
              {modulo.metricas.map((metrica) => (
                <small key={metrica}>{metrica}</small>
              ))}
            </div>
            <button type="button" disabled>
              Somente leitura
            </button>
          </article>
        ))}
      </section>

      <section className="audit-preview">
        <div>
          <span className="audit-pill">Fluxo demonstrativo</span>
          <h2>Estoque para Producao</h2>
          <p>
            Exemplo seguro do fluxo: um item cadastrado no estoque aparece na producao, pode ser porcionado e passa a exibir saldo original e
            saldo por formato.
          </p>
        </div>
        <div className="audit-table" role="table" aria-label="Exemplo de porcionamento">
          <div role="row">
            <strong role="cell">Item</strong>
            <strong role="cell">Estoque</strong>
            <strong role="cell">Porcionado</strong>
            <strong role="cell">Formato</strong>
          </div>
          <div role="row">
            <span role="cell">Maionese da casa</span>
            <span role="cell">4 litros</span>
            <span role="cell">12 porcoes</span>
            <span role="cell">Bisnaga</span>
          </div>
          <div role="row">
            <span role="cell">Blend bovino</span>
            <span role="cell">8 kg</span>
            <span role="cell">32 porcoes</span>
            <span role="cell">Pacote</span>
          </div>
        </div>
      </section>
    </main>
  );
}
