import { z } from "zod";

export const fornecedorSchema = z.object({
  fornecedorId: z.string().optional(),
  fornecedorNome: z.string().min(1, "Nome do fornecedor e obrigatorio"),
  cnpjFornecedor: z.string().optional(),
  telefoneFornecedor: z.string().optional(),
  conversao: z.number().min(1).default(1),
  custo: z.number().min(0).default(0),
  custoUnitario: z.number().min(0).default(0),
  custoPromocional: z.number().optional(),
  promocaoAtiva: z.boolean().default(false),
  promocaoInicio: z.string().optional(),
  promocaoFim: z.string().optional(),
  principal: z.boolean().default(false),
  frequenciaPedido: z.string().optional(),
  diasPedido: z.number().min(0).default(0),
  diasEntrega: z.number().min(0).default(0),
  quantidadePadrao: z.number().min(0).default(0),
  unidadeUso: z.string().optional(),
});

export type FornecedorVinculoData = z.infer<typeof fornecedorSchema>;
