import { z } from "zod";

export const xmlItemSchema = z.object({
  codigo: z.string(),
  nome: z.string(),
  ncm: z.string().optional(),
  quantidade: z.number().positive(),
  unidade: z.string(),
  valorUnitario: z.number().min(0),
  valorTotal: z.number().min(0),
  produtoExistenteId: z.string().optional(),
  acao: z.enum(["vincular", "criar", "ignorar"]).default("criar"),
});

export const xmlImportSchema = z.object({
  arquivoNome: z.string(),
  fornecedorNome: z.string(),
  fornecedorCnpj: z.string(),
  itens: z.array(xmlItemSchema),
  status: z.enum(["processando", "concluido", "erro"]).default("processando"),
});

export type XmlItemData = z.infer<typeof xmlItemSchema>;
export type XmlImportData = z.infer<typeof xmlImportSchema>;
