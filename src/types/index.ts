// ===== USUARIO =====
export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  fotoUrl?: string;
  plano?: "free" | "essencial" | "pro" | "plus" | "full";
  role?: "admin" | "dono" | "proprietario" | "gerente" | "funcionario" | "user";
  empresaId?: string;
  lojaId?: string;
  permissoes?: PermissaoFuncionario[];
  funcionarioAtivo?: boolean;
  criadoEm: Date;
  ultimoAcesso: Date;
}

// ===== INSUMO =====
export interface Insumo {
  id?: string;
  nome: string;
  nomeNormalizado?: string;
  sku: string;
  codigoBarras: string;
  codigoBarrasNormalizado?: string;
  codigoInterno?: string;
  marca: string;
  categoriaId: string;
  tipoCategoria?: string;
  status?: string;
  statusProduto?: string;
  imagemUrl?: string;
  imagemUploadUrl?: string;
  imagemCosmosUrl?: string;
  imagemPrincipal?: string;
  quantidadeAtual: number;
  estoqueMinimo: number;
  estoqueMaximo: number;
  localArmazenamento: string;
  unidadeMedida: string;
  unidadeCompra: string;
  unidadeUso: string;
  conversao: number;
  custoCompra: number;
  custoUnitario?: number;
  custoAnterior?: number;
  precoVenda?: number;
  custoPromocional?: number;
  promocaoAtiva: boolean;
  promocaoInicio?: Date | string;
  promocaoFim?: Date | string;
  validadeOriginal: number;
  validadeAposAberto: number;
  validadeAposProducao: number;
  loteInterno: string;
  fornecedorPrincipal?: string;
  fornecedores?: FornecedorVinculo[];
  frequenciaPedido: string;
  diasPedido: number;
  diasEntrega: number;
  quantidadePadraoPedido: number;
  responsavel: string;
  observacao: string;
  tipoEtiqueta: string;
  etiquetaResponsavel?: string;
  etiquetaObservacao?: string;
  fichaTecnicaVinculos?: string[];
  fichaTecnicaObservacoes?: string;
  fichaTecnicaIngredientes?: FichaIngrediente[];
  precosVenda: { produtoId: string; nome: string; preco: number }[];
  margemEstimada: number;
  cmv: number;
  origemCadastro?: string;
  createdBy: string;
  criadoEm: Date | unknown;
  atualizadoEm: Date | unknown;
}

// ===== CATEGORIA =====
export interface Categoria {
  id?: string;
  nome: string;
  cor: string;
  icone: string;
  ordem: number;
  criadoEm: Date;
}

// ===== FORNECEDOR =====
export interface Fornecedor {
  id?: string;
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  observacoes: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface Mercado {
  id?: string;
  nome: string;
  telefone: string;
  endereco: string;
  observacoes: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface FornecedorVinculo {
  fornecedorId?: string;
  fornecedorNome: string;
  cnpjFornecedor?: string;
  telefoneFornecedor?: string;
  conversao: number;
  custo: number;
  custoUnitario: number;
  custoPromocional?: number;
  promocaoAtiva?: boolean;
  promocaoInicio?: string;
  promocaoFim?: string;
  principal: boolean;
  frequenciaPedido: string;
  diasPedido: number;
  diasEntrega: number;
  quantidadePadrao: number;
  unidadeUso?: string;
}

export interface FichaIngrediente {
  insumoId: string;
  insumoNome: string;
  quantidade: number;
  unidade: string;
}

// ===== HISTORICO =====
export interface Historico {
  id?: string;
  tipo?: string;
  insumoId: string;
  insumoNome: string;
  quantidade: number;
  unidade?: string;
  custoUnitario?: number;
  custoTotal?: number;
  observacao: string;
  responsavel: string;
  fornecedorId?: string;
  xmlId?: string;
  criadoEm: Date;
}

// ===== XML =====
export interface XmlItem {
  codigo: string;
  codigoBarras?: string;
  codigoBarrasNormalizado?: string;
  codigoProduto?: string;
  nome: string;
  ncm: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  produtoExistenteId?: string;
}

export interface XmlImport {
  id?: string;
  arquivoNome: string;
  fornecedorNome: string;
  fornecedorCnpj: string;
  itens: XmlItem[];
  totalItens: number;
  itensVinculados: number;
  itensCriados: number;
  criadoEm: Date;
  createdBy: string;
}

// ===== DASHBOARD =====
export interface DashboardKpis {
  custoDoDia: number;
  variacaoCusto: number;
  desperdicioPercentual: number;
  variacaoDesperdicio: number;
  itensCriticos: number;
  reposicaoPendente: number;
}

export interface ProdutoVencimento {
  insumo: Insumo;
  diasRestantes: number;
}

export interface Ruptura {
  insumo: Insumo;
  probabilidade: number;
  previsaoDias: number;
}

export interface CompraRecomendada {
  insumo: Insumo;
  quantidadeRecomendada: number;
  custoEstimado: number;
}

export interface CmvForaIdeal {
  insumo: Insumo;
  cmvAtual: number;
  cmvIdeal: number;
  variacao: number;
}

// ===== AUTOMACAO =====
export interface Automacao {
  id?: string;
  nome: string;
  condicoes: AutomacaoCondicao[];
  acoes: AutomacaoAcao[];
  ativo: boolean;
  horario?: string;
  diasSemana?: number[];
  ultimaExecucao?: Date;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface AutomacaoCondicao {
  campo: string;
}

export interface AutomacaoAcao {
  parametros: Record<string, unknown>;
}

// ===== ALERTA / NOTIFICACAO =====
export interface Alerta {
  id?: string;
  insumoId?: string;
  insumoNome?: string;
  mensagem: string;
  lido: boolean;
  resolvido: boolean;
  criadoEm: Date;
}

// ===== PEDIDO DE COMPRA =====
export interface PedidoCompra {
  id?: string;
  numero: string;
  status?: string;
  origemCompra?: "fornecedor" | "mercado";
  fornecedorId: string;
  fornecedorNome: string;
  mercadoId?: string;
  mercadoNome?: string;
  linkDisparo?: string;
  itens: PedidoCompraItem[];
  valorTotal: number;
  dataPedido: Date;
  dataPrevisaoEntrega?: Date;
  dataRecebimento?: Date;
  observacoes: string;
  criadoEm: Date;
  atualizadoEm: Date;
  createdBy: string;
}

export interface PedidoCompraItem {
  insumoId: string;
  insumoNome: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

// ===== DESPERDICIO =====
export interface Desperdicio {
  id?: string;
  insumoId: string;
  insumoNome: string;
  categoria?: string;
  quantidade: number;
  unidade: string;
  custoEstimado: number;
  motivo: string;
  responsavel: string;
  data: Date;
  observacao: string;
  criadoEm: Date;
}

// ===== FICHA TECNICA / PRODUCAO =====
export interface FichaTecnica {
  id?: string;
  nome: string;
  codigo: string;
  rendimento: number;
  unidade: string;
  ingredientes: FichaTecnicaIngrediente[];
  modoPreparo: string;
  custoTotal: number;
  precoSugerido: number;
  margem: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface FichaTecnicaIngrediente {
  insumoId: string;
  insumoNome: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number;
  custoTotal: number;
}

export interface OrdemProducao {
  id?: string;
  fichaTecnicaId: string;
  fichaTecnicaNome: string;
  quantidadeProduzir: number;
  quantidadeProduzida: number;
  dataProgramada: Date;
  dataInicio?: Date;
  dataFim?: Date;
  responsavel: string;
  insumosBaixados: { insumoId: string; insumoNome: string; quantidade: number }[];
  observacao: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface ProducaoPorcao {
  id?: string;
  insumoId: string;
  insumoNome: string;
  quantidadeBaixada: number;
  unidade: string;
  formatoPorcao?: string;
  quantidadePorPorcao?: number;
  unidadePorcao?: string;
  porcoesGeradas: number;
  porcoesDisponiveis: number;
  area: string;
  custoUnitario: number;
  custoTotal: number;
  custoPorPorcao: number;
  responsavel: string;
  observacao: string;
  status: "disponivel" | "parcial" | "finalizado";
  criadoEm: Date;
  atualizadoEm: Date;
}

// ===== FUNCIONARIO =====
export interface Funcionario {
  id?: string;
  nome: string;
  cargo: string;
  telefone: string;
  email: string;
  turno: string;
  role?: PapelUsuario;
  permissoes?: PermissaoFuncionario[];
  dataContratacao: Date;
  ativo: boolean;
  observacao: string;
  criadoEm: Date;
}

// ===== CONFIGURACOES =====
export interface ConfiguracaoEstabelecimento {
  nome: string;
  endereco: string;
  telefone: string;
  whatsapp: string;
  horarioFuncionamento: string;
  margemIdeal: number;
  cmvAlvo: number;
  diasAlertaValidade: number;
  notificarEstoqueBaixo: boolean;
  notificarVencimento: boolean;
  notificarWhatsApp: boolean;
  numeroWhatsAppNotificacao: string;
}

export type PlanoSaas = "free" | "essencial" | "pro" | "plus" | "full";
export type PapelUsuario = "admin" | "dono" | "proprietario" | "gerente" | "funcionario" | "user";
export type PermissaoFuncionario =
  | "dashboard.ver"
  | "estoque.ver"
  | "compras.ver"
  | "producao.ver"
  | "desperdicio.ver"
  | "fornecedores.ver"
  | "funcionarios.gerenciar"
  | "financeiro.ver"
  | "precificacao.ver"
  | "relatorios.ver"
  | "configuracoes.ver"
  | "ia.ver"
  | "whatsapp.ver";
export type UnidadeMedidaPrecificacao = "KG" | "G" | "UN" | "ML" | "L" | "CAIXA" | "PACOTE" | "FATIA" | "PORCAO";
export type MetodoCusto = "medio_automatico" | "ultimo_custo_compra" | "manual_travado";
export type CanalVenda = "balcao" | "delivery_proprio" | "ifood" | "99food" | "parceiros";
export type StatusFinanceiroReceita = "saudavel" | "atencao" | "critico";

export interface ReceitaIngrediente {
  id?: string;
  receitaId: string;
  insumoId: string;
  insumoNome: string;
  quantidade: number;
  unidade: UnidadeMedidaPrecificacao;
  custoUnitarioConvertido: number;
  custoTotal: number;
  tipo: "insumo" | "receita_base";
  empresaId: string;
  lojaId?: string;
  criadoEm?: unknown;
  atualizadoEm?: unknown;
}

export interface PrecificacaoCanal {
  canal: CanalVenda;
  precoVenda: number;
  taxaPercentual: number;
  taxaFixa: number;
  embalagem: number;
  margemDesejada: number;
  precoMinimo: number;
  precoSugerido: number;
  lucroReal: number;
  margemReal: number;
  cmvReal: number;
}

export interface ReceitaPrecificacao {
  id?: string;
  nome: string;
  descricao: string;
  modoPreparo: string;
  categoria: string;
  imagemUrl?: string;
  precoVenda: number;
  fracionado: boolean;
  ingrediente: boolean;
  ativa: boolean;
  observacoesInternas?: string;
  ingredientes: ReceitaIngrediente[];
  globalEmpresa?: boolean;
  canais: PrecificacaoCanal[];
  custoIngredientes: number;
  custoFixoRateado: number;
  custosVariaveis: number;
  custoTotalReal: number;
  lucro: number;
  margem: number;
  cmv: number;
  precoMinimo: number;
  precoSugerido: number;
  precoPremium: number;
  margemDesejada: number;
  status: StatusFinanceiroReceita;
  congelarPreco?: boolean;
  congelarCusto?: boolean;
  congelarCmv?: boolean;
  empresaId: string;
  lojaId?: string;
  createdBy: string;
  criadoEm?: unknown;
  atualizadoEm?: unknown;
}

export interface CustosFixosPrecificacao {
  id?: string;
  aluguel: number;
  energia: number;
  agua: number;
  internet: number;
  salarios: number;
  contador: number;
  sistema: number;
  marketing: number;
  manutencao: number;
  encargos: number;
  outros: number;
  pedidosMensais: number;
  custoFixoPorPedido: number;
  empresaId: string;
  lojaId?: string;
  atualizadoEm?: unknown;
}

export interface CustosVariaveisPrecificacao {
  embalagem: number;
  taxaCartaoPercentual: number;
  taxaIfoodPercentual: number;
  taxa99FoodPercentual: number;
  taxaDelivery: number;
  comissaoPercentual: number;
  cashback: number;
  cupom: number;
  embalagemDelivery: number;
}

export interface MetaFinanceiraPrecificacao {
  id?: string;
  cmvMaximo: number;
  margemMinima: number;
  lucroMinimo: number;
  margemDesejada: number;
  empresaId: string;
  lojaId?: string;
}

export interface HistoricoCustoInsumo {
  id?: string;
  insumoId: string;
  insumoNome: string;
  custoAnterior: number;
  custoNovo: number;
  percentual: number;
  motivo: "compra" | "entrada" | "xml" | "ajuste" | "desperdicio" | "manual";
  compraId?: string;
  usuario: string;
  receitasImpactadas: string[];
  empresaId: string;
  lojaId?: string;
  data?: unknown;
}

export interface SimulacaoPreco {
  id?: string;
  receitaId?: string;
  nome: string;
  custo: number;
  margem: number;
  taxa: number;
  embalagem: number;
  desconto: number;
  promocao: number;
  precoVenda: number;
  lucro: number;
  cmv: number;
  risco: StatusFinanceiroReceita;
  empresaId: string;
  lojaId?: string;
  criadoEm?: unknown;
}
