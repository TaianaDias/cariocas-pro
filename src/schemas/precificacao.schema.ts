import { z } from "zod";
import { converterUnidade } from "../domain/custos";

export const unidadeFichaSchema = z.enum(["KG", "G", "UN", "ML", "L", "CAIXA", "PACOTE", "FATIA", "PORCAO"]);
const id = z.string().min(1).max(180).regex(/^[A-Za-z0-9_-]+$/, "Identificador inválido.");
const valor = z.number().finite().min(0).max(1_000_000);
const operacaoId = z.string().uuid();

export const criarInsumoFichaSchema = z.object({
  acao: z.literal("criarInsumo"), operacaoId,
  nome: z.string().trim().min(2).max(160),
  unidadeCompra: unidadeFichaSchema, unidadeUso: unidadeFichaSchema,
  fatorConversao: z.number().finite().positive().max(1_000_000),
  custoEstimado: valor.nullable(),
}).strict().superRefine((data, ctx) => {
  const fisicas = ["KG", "G", "L", "ML"];
  if (data.unidadeCompra === data.unidadeUso || (fisicas.includes(data.unidadeCompra) && fisicas.includes(data.unidadeUso))) {
    const fator = converterUnidade(1, data.unidadeCompra, data.unidadeUso);
    if (fator === null || Math.abs(fator - data.fatorConversao) > 1e-8) ctx.addIssue({ code: "custom", path: ["fatorConversao"], message: "Fator incompatível com as unidades. Massa e volume exigem dados específicos e não podem ser convertidos aqui." });
  }
});

export const atualizarCustoFichaSchema = z.object({
  acao: z.literal("atualizarCusto"), operacaoId,
  insumoId: id, versaoCusto: z.number().int().min(0), custoEstimado: valor.nullable(),
}).strict();

export const salvarFichaSchema = z.object({
  acao: z.literal("salvarFicha"), operacaoId,
  id: id.optional(), versaoFicha: z.number().int().min(0).default(0),
  nome: z.string().trim().min(2).max(160), categoria: z.string().trim().max(100).default("Hamburguer"),
  descricao: z.string().max(2000).default(""), modoPreparo: z.string().max(5000).default(""),
  imagemUrl: z.string().max(1000).default(""), observacoesInternas: z.string().max(2000).default(""),
  precoVenda: valor.positive(), margemDesejada: z.number().min(0).lt(100).default(35),
  ativa: z.boolean().default(true), fracionado: z.boolean().default(false), ingrediente: z.boolean().default(false),
  ingredientes: z.array(z.object({
    insumoId: id, quantidade: z.number().finite().positive().max(1_000_000), unidade: unidadeFichaSchema,
    tipo: z.literal("insumo").default("insumo"),
  }).strict()).min(1).max(100),
}).strict().superRefine((data, ctx) => {
  const ids = data.ingredientes.map((item) => item.insumoId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["ingredientes"], message: "Some a quantidade do ingrediente repetido em uma única linha." });
});

export type CriarInsumoFichaInput = z.infer<typeof criarInsumoFichaSchema>;
export type AtualizarCustoFichaInput = z.infer<typeof atualizarCustoFichaSchema>;
export type SalvarFichaInput = z.infer<typeof salvarFichaSchema>;
