export function ProdutoAbaEtiqueta() {
  return (
    <section className="drawer-tab" id="etiqueta">
      <h3>Etiqueta</h3>
      <div className="etiqueta-preview">
        <span>QR</span>
        <strong>Etiqueta do insumo</strong>
        <small>Codigo, lote, validade e localizacao</small>
      </div>
      <button type="button">Gerar etiqueta</button>
    </section>
  );
}
