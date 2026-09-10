export function AppLoading() {
  return (
    <main className="app-loading" role="status" aria-live="polite" aria-label="Carregando Carioca's Pro">
      <section className="app-loading__card">
        <div className="app-loading__brand" aria-hidden="true">
          <span className="app-loading__brand-mark">CP</span>
          <div>
            <strong>Carioca&apos;s Pro</strong>
            <small>Central de operação</small>
          </div>
        </div>

        <div className="app-loading__content">
          <span className="app-loading__eyebrow">Preparando seu painel</span>
          <h1>Organizando a operação para você.</h1>
          <p>Carregando módulos, permissões e alertas da sua unidade.</p>
        </div>

        <div className="app-loading__progress" aria-hidden="true">
          <span />
        </div>
      </section>
    </main>
  );
}
