import type { Categoria } from "../../types";

type CategoriasProps = {
  categoriaAtiva: string;
  categorias: Categoria[];
  onSelect: (id: string) => void;
};

export function Categorias({ categoriaAtiva, categorias, onSelect }: CategoriasProps) {
  return (
    <section className="estoque-categorias" aria-label="Categorias de insumos">
      <button
        className={`estoque-categoria ${categoriaAtiva === "todas" ? "estoque-categoria--active" : ""}`}
        type="button"
        onClick={() => onSelect("todas")}
      >
        Todas
      </button>
      {categorias.map((categoria) => (
        <button
          className={`estoque-categoria ${categoriaAtiva === categoria.id ? "estoque-categoria--active" : ""}`}
          type="button"
          key={categoria.id ?? categoria.nome}
          onClick={() => categoria.id && onSelect(categoria.id)}
        >
          {categoria.nome}
        </button>
      ))}
    </section>
  );
}
