import { getSugestoesRapidas } from "../../services/carioquinha.service";

type SuggestionsProps = {
  onSelect: (texto: string) => void;
};

export function Suggestions({ onSelect }: SuggestionsProps) {
  const suggestions = getSugestoesRapidas();

  return (
    <div className="carioquinha-suggestions" aria-label="Sugestoes rapidas">
      {suggestions.map((suggestion) => (
        <button type="button" key={suggestion} onClick={() => onSelect(suggestion)}>
          {suggestion}
        </button>
      ))}
    </div>
  );
}
