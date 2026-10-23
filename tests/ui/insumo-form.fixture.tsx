import { createRoot } from "react-dom/client";
import { InsumoParaFicha, type NovoInsumoFicha } from "../../src/components/precificacao/InsumoParaFicha";

declare global { interface Window { fichaPayloads: NovoInsumoFicha[] } }
window.fichaPayloads = [];
let tentativas = 0;
createRoot(document.getElementById("root")!).render(<main className="precificacao-page"><section className="precificacao-grid"><div className="precificacao-form card">
  <h1>Insumo para ficha técnica</h1>
  <InsumoParaFicha salvar={async (payload) => {
    tentativas += 1;
    if (tentativas === 1) throw new Error("Falha temporária simulada. Tente novamente.");
    window.fichaPayloads.push(payload);
  }} />
</div></section></main>);
