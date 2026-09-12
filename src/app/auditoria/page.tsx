const modulos = [
  {
    nome: "Dashboard",
    status: "Liberado",
    resumo: "Indicadores da operação, alertas de reposição, produtos a vencer e cards inteligentes.",
    metricas: ["Custo do dia", "Itens críticos", "Reposição pendente"],
  },
  {
    nome: "Estoque",
    status: "Leitura",
    resumo: "Cadastro de insumos, entrada por XML, código de barras, imagem do produto e limites mínimos/máximos.",
    metricas: ["Saldo atual", "Estoque mínimo", "Sugestão de compra"],
  },
  {
    nome: "Compras",
    status: "Leitura",
    resumo: "Lista automática por mercado ou fornecedor, WhatsApp e reposição até o estoque máximo.",
    metricas: ["Mercado", "Fornecedor", "Disparo WhatsApp"],
  },
  {
    nome: "Produção",
    status: "Leitura",
    resumo: "Transforma itens do estoque em porções por formato: pacote, bisnaga, pote, saco ou unidade.",
    metricas: ["Estoque disponível", "Porções prontas", "Baixa controlada"],
  },
  {
    nome: "Precificação Inteligente",
    status: "Plus",
    resumo: "Receitas, CMV dinâmico, margem, lucro, preço mínimo, preço sugerido e alertas financeiros.",
    metricas: ["CMV", "Margem", "Preço recomendado"],
  },
  {
    nome: "Desperdício",
    status: "Leitura",
    resumo: "Registra perdas por insumo, motivo e colaborador responsável para auditoria operacional.",
    metricas: ["Responsável", "Impacto", "Histórico"],
  },
];

const fluxoAuditoria = [
  "Este link não exige login.",
  "Os dados exibidos são demonstrativos.",
  "Ações de escrita ficam bloqueadas neste modo.",
  "Dados reais seguem atrás do login e das regras do Firebase.",
];

export default function AuditoriaPage() {
  return (
    <main className="audit-page">
      <section className="audit-hero">
        <div>
          <span className="audit-pill">Modo auditoria somente leitura</span>
          <h1>Carioca's Pro</h1>
          <p>
            Ambiente público para avaliação dos assistentes Adapta, com visão dos módulos, fluxos e regras comerciais sem expor dados reais
            nem permitir alterações.
          </p>
        </div>
        <aside className="audit-guard">
          <strong>Proteções ativas</strong>
          {fluxoAuditoria.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </aside>
      </section>

      <section className="audit-strip" aria-label="Resumo do sistema">
        <div>
          <strong>Multiempresa</strong>
          <span>empresaId e lojaId por módulo</span>
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
          <span>Botões de alteração desativados</span>
        </div>
      </section>

      <section className="audit-grid" aria-label="Módulos disponíveis para auditoria">
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
          <h2>Estoque para Produção</h2>
          <p>
            Exemplo seguro do fluxo: um item cadastrado no estoque aparece na produção, pode ser porcionado e passa a exibir saldo original e
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
            <span role="cell">12 porções</span>
            <span role="cell">Bisnaga</span>
          </div>
          <div role="row">
            <span role="cell">Blend bovino</span>
            <span role="cell">8 kg</span>
            <span role="cell">32 porções</span>
            <span role="cell">Pacote</span>
          </div>
        </div>
      </section>
    </main>
  );
}
