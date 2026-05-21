import type { Insumo } from "../../types";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";

type ListaProdutosProps = {
  insumos: Insumo[];
  loading: boolean;
  onSelect: (id: string) => void;
};

function getStatus(insumo: Insumo) {
  if (insumo.quantidadeAtual <= insumo.estoqueMinimo) return "Critico";
  if (insumo.estoqueMaximo > 0 && insumo.quantidadeAtual / insumo.estoqueMaximo <= 0.5) {
    return "Atencao";
  }
  return "Estavel";
}

function getPercentualEstoque(insumo: Insumo) {
  if (!insumo.estoqueMaximo) return 100;
  return Math.max(0, Math.min(100, Math.round((insumo.quantidadeAtual / insumo.estoqueMaximo) * 100)));
}

function getIniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

export function ListaProdutos({ insumos, loading, onSelect }: ListaProdutosProps) {
  return (
    <section className="estoque-panel lista-produtos">
      <header className="estoque-panel__header">
        <div>
          <span>Catalogo</span>
          <h2>Lista de produtos</h2>
        </div>
        <button type="button">Filtrar</button>
      </header>

      {loading ? (
        <div className="produto-card-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <article className="produto-card" key={index}>
              <Skeleton lines={4} />
            </article>
          ))}
        </div>
      ) : insumos.length === 0 ? (
        <EmptyState title="Nenhum insumo cadastrado" description="Cadastre um insumo para iniciar o controle de estoque." />
      ) : (
        <>
      <div className="produto-card-grid">
        {insumos.map((insumo) => {
          const status = getStatus(insumo);
          const percentual = getPercentualEstoque(insumo);

          return (
          <article className="produto-card" key={insumo.id ?? insumo.sku} onClick={() => insumo.id && onSelect(insumo.id)}>
            <div className="produto-card__top">
              <span className="produto-avatar">{insumo.imagemUrl ? "" : getIniciais(insumo.nome)}</span>
              <div>
                <span>{insumo.categoriaId || "Sem categoria"}</span>
                <h3>{insumo.nome}</h3>
                <small>{insumo.sku}</small>
              </div>
            </div>
            <dl>
              <div>
                <dt>Saldo</dt>
                <dd>
                  {insumo.quantidadeAtual} {insumo.unidadeMedida}
                </dd>
              </div>
              <div>
                <dt>Minimo</dt>
                <dd>
                  {insumo.estoqueMinimo} {insumo.unidadeMedida}
                </dd>
              </div>
              <div>
                <dt>Custo</dt>
                <dd>R$ {insumo.custoCompra.toFixed(2)}</dd>
              </div>
            </dl>
            <div className="produto-stock-bar" aria-label={`Estoque em ${percentual}%`}>
              <span style={{ width: `${percentual}%` }} />
            </div>
            <strong className={`produto-status produto-status--${status.toLowerCase()}`}>
              {status}
            </strong>
            <div className="produto-actions" aria-label="Acoes do produto">
              <button type="button">Editar</button>
              <button type="button">Entrada</button>
              <button type="button">Saida</button>
              <button type="button">Etiqueta</button>
              <button type="button">Historico</button>
            </div>
          </article>
          );
        })}
      </div>

      <div className="produto-table-wrap">
        <table className="produto-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>SKU</th>
              <th>Categoria</th>
              <th>Fornecedor</th>
              <th>Saldo</th>
              <th>Minimo</th>
              <th>Custo</th>
              <th>Status</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {insumos.map((insumo) => {
              const status = getStatus(insumo);

              return (
              <tr key={insumo.id ?? insumo.sku} onClick={() => insumo.id && onSelect(insumo.id)}>
                <td>{insumo.nome}</td>
                <td>{insumo.sku}</td>
                <td>{insumo.categoriaId || "Sem categoria"}</td>
                <td>{insumo.fornecedorPrincipal || "Sem fornecedor"}</td>
                <td>
                  {insumo.quantidadeAtual} {insumo.unidadeMedida}
                </td>
                <td>
                  {insumo.estoqueMinimo} {insumo.unidadeMedida}
                </td>
                <td>R$ {insumo.custoCompra.toFixed(2)}</td>
                <td>
                  <span className={`produto-status produto-status--${status.toLowerCase()}`}>{status}</span>
                </td>
                <td className="produto-table-actions">
                  <button type="button">Editar</button>
                  <button type="button">Entrada</button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        </>
      )}
    </section>
  );
}
