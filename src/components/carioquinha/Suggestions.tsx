type SuggestionsProps = {
  onSelect: (texto: string) => void;
};

const suggestions = [
  "O que devo repor hoje?",
  "Criar solicitação de reposição",
  "Status das compras",
  "Resumo do dia",
  "Quais itens críticos?",
  "Como está o CMV?",
  "Cadastrar insumo",
  "Porções disponíveis",
];

export function Suggestions({ onSelect }: SuggestionsProps) {
  return (
    <div className="carioquinha-suggestions" aria-label="Sugestões rápidas">
      {suggestions.map((suggestion) => (
        <button type="button" key={suggestion} onClick={() => onSelect(suggestion)}>
          {suggestion}
        </button>
      ))}
    </div>
  );
}
