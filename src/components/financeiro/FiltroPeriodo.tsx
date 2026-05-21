"use client";

type FiltroPeriodoProps = {
  dataInicio: Date;
  dataFim: Date;
  onChangeInicio: (data: Date) => void;
  onChangeFim: (data: Date) => void;
  onAplicar?: () => void;
};

const periodosPredefinidos = [
  { label: "Este mes", dias: 0 },
  { label: "30 dias", dias: 30 },
  { label: "90 dias", dias: 90 },
  { label: "Este ano", dias: 365 },
];

function formatDate(data: Date) {
  return data.toISOString().split("T")[0];
}

export function FiltroPeriodo({ dataFim, dataInicio, onAplicar, onChangeFim, onChangeInicio }: FiltroPeriodoProps) {
  function handlePredefinido(dias: number) {
    const hoje = new Date();

    if (dias === 0) {
      onChangeInicio(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
      onChangeFim(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59));
      return;
    }

    const inicio = new Date();
    inicio.setDate(inicio.getDate() - dias);
    onChangeInicio(inicio);
    onChangeFim(hoje);
  }

  return (
    <div className="financeiro-filter">
      {periodosPredefinidos.map((periodo) => (
        <button key={periodo.label} type="button" onClick={() => handlePredefinido(periodo.dias)}>
          {periodo.label}
        </button>
      ))}

      <input type="date" value={formatDate(dataInicio)} onChange={(event) => onChangeInicio(new Date(event.target.value))} />
      <span>ate</span>
      <input type="date" value={formatDate(dataFim)} onChange={(event) => onChangeFim(new Date(event.target.value))} />

      {onAplicar ? (
        <button className="financeiro-filter__apply" type="button" onClick={onAplicar}>
          Aplicar
        </button>
      ) : null}
    </div>
  );
}
