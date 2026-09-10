"use client";

type FaixaEstoqueProps = {
  atual: number;
  maximo: number;
  minimo: number;
};

export function FaixaEstoque({ atual, maximo, minimo }: FaixaEstoqueProps) {
  const max = maximo > 0 ? maximo : minimo * 2 || 100;
  const percentual = Math.min(Math.max((atual / max) * 100, 0), 100);
  const minimoPercentual = Math.min(Math.max((minimo / max) * 100, 0), 100);
  const tone = atual <= minimo ? "danger" : atual <= minimo * 1.5 ? "warning" : "success";

  return (
    <div className="estoque-range" aria-label={`Estoque atual ${atual}, mínimo ${minimo}, máximo ${maximo}`}>
      <div className="estoque-range__track">
        <span className="estoque-range__minimum" style={{ left: `${minimoPercentual}%` }} />
        <span className={`estoque-range__fill estoque-range__fill--${tone}`} style={{ width: `${percentual}%` }} />
      </div>
      <div className="estoque-range__labels" aria-hidden="true">
        <span>0</span>
        <span className="estoque-range__min-label">mín: {minimo}</span>
        <span>máx: {maximo}</span>
      </div>
    </div>
  );
}
