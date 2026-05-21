"use client";

type FaixaEstoqueProps = {
  atual: number;
  maximo: number;
  minimo: number;
};

export function FaixaEstoque({ atual, maximo, minimo }: FaixaEstoqueProps) {
  const max = maximo > 0 ? maximo : minimo * 2 || 100;
  const percentual = Math.min((atual / max) * 100, 100);
  const minimoPercentual = Math.min((minimo / max) * 100, 100);
  const cor = atual <= minimo ? "var(--crimson)" : atual <= minimo * 1.5 ? "var(--yellow-warn)" : "var(--green-success)";

  return (
    <div>
      <div
        style={{
          background: "var(--coal-800)",
          borderRadius: 4,
          height: 8,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <span
          style={{
            background: "var(--crimson)",
            height: "100%",
            left: `${minimoPercentual}%`,
            opacity: 0.7,
            position: "absolute",
            width: 2,
          }}
        />
        <span
          style={{
            background: cor,
            borderRadius: 4,
            display: "block",
            height: "100%",
            transition: "width 0.3s, background 0.3s",
            width: `${percentual}%`,
          }}
        />
      </div>
      <div style={{ color: "var(--text-soft)", display: "flex", fontSize: 11, justifyContent: "space-between", marginTop: 4 }}>
        <span>0</span>
        <span style={{ color: "var(--crimson)" }}>min: {minimo}</span>
        <span>max: {maximo}</span>
      </div>
    </div>
  );
}
