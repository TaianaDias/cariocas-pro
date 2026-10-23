import { strict as assert } from "node:assert";
import { test } from "node:test";
import { converterUnidade, resolverCustoInsumo } from "../../src/domain/custos";
import { atualizarIngredientesComEstoque, calcularCustoMedioPonderado, recalcularReceita, custosVariaveisPadrao, custosFixosPadrao } from "../../src/domain/precificacao";
import { criarInsumoFichaSchema } from "../../src/schemas/precificacao.schema";
import { validarAtorFicha } from "../../src/server/catalogo-fichas";
import type { Insumo, ReceitaIngrediente } from "../../src/types";

const ingrediente = (quantidade = 160, unidade: ReceitaIngrediente["unidade"] = "G"): ReceitaIngrediente => ({ insumoId: "carne", insumoNome: "Carne", receitaId: "burger", quantidade, unidade, custoUnitarioConvertido: null, custoTotal: null, tipo: "insumo", empresaId: "a", lojaId: "matriz" });
const carne = (preco: number | null): Partial<Insumo> => ({ id: "carne", nome: "Carne", unidadeCompra: "KG", unidadeUso: "G", conversao: 1000, custoReferencia: { valorCompra: preco, origem: "estimado", informadoEm: "2026-10-22T12:00:00.000Z", versao: 1 } });
function ficha(insumo: Partial<Insumo>, quantidade = 160, unidade: ReceitaIngrediente["unidade"] = "G") {
  return recalcularReceita({ nome: "Burger", precoVenda: 20, ingredientes: atualizarIngredientesComEstoque([ingrediente(quantidade, unidade)], [insumo]) });
}

test("A: média ponderada 30/kg; 160 g custam 4,80 na média e 5,60 na reposição", () => {
  const media = calcularCustoMedioPonderado(10, 25, 10, 35);
  assert.equal(media, 30);
  assert.equal(ficha(carne(media)).custoIngredientes, 4.8);
  assert.equal(ficha(carne(35)).custoIngredientes, 5.6);
});
test("preserva oito decimais no custo unitário; arredonda somente o total monetário", () => {
  assert.equal(resolverCustoInsumo(carne(35)).valor, 0.035);
  assert.equal(ficha(carne(35), 0.16, "KG").custoIngredientes, 5.6);
  assert.equal(ficha(carne(25)).custoIngredientes, 4);
});
test("B direto: aumento e redução atualizam sem mutar a ficha de origem", () => {
  const original = ingrediente(); const antes = structuredClone(original);
  assert.equal(ficha(carne(25)).custoIngredientes, 4);
  assert.equal(ficha(carne(35)).custoIngredientes, 5.6);
  assert.equal(ficha(carne(20)).custoIngredientes, 3.2);
  atualizarIngredientesComEstoque([original], [carne(35)]);
  assert.deepEqual(original, antes);
});
test("C: custo ausente é null, enquanto zero explícito é estimativa válida", () => {
  const ausente = ficha(carne(null));
  for (const campo of ["custoIngredientes", "custoTotalReal", "cmv", "margem", "lucro", "precoSugerido"] as const) assert.equal(ausente[campo], null);
  assert.equal(ausente.status, "pendente");
  assert.equal(ficha(carne(0)).custoIngredientes, 0);
  assert.equal(ficha({ ...carne(10), custoReferencia: undefined, custoUnitarioUso: 0 }).status, "pendente");
});
test("conversão incompatível e insumo órfão bloqueiam conclusão; receita_base não é simulada como insumo", () => {
  assert.equal(converterUnidade(1, "KG", "ML"), null);
  assert.equal(ficha({ ...carne(35), conversao: 1 }).custoIngredientes, null);
  assert.equal(ficha(carne(35), 160, "ML").custoIngredientes, null);
  assert.equal(atualizarIngredientesComEstoque([ingrediente()], [])[0].custoTotal, null);
  assert.equal(atualizarIngredientesComEstoque([{ ...ingrediente(), tipo: "receita_base" }], [carne(35)])[0].custoTotal, null);
});
test("preço sugerido considera a taxa no preço proposto, não no preço antigo", () => {
  const variaveis = { ...custosVariaveisPadrao, embalagem: 0, taxaCartaoPercentual: 10 };
  const recipe = { precoVenda: 20, margemDesejada: 40, ingredientes: atualizarIngredientesComEstoque([ingrediente(1000)], [carne(10)]) };
  assert.equal(recalcularReceita(recipe, custosFixosPadrao, variaveis).precoSugerido, 20);
  assert.equal(recalcularReceita({ ...recipe, margemDesejada: 0 }, custosFixosPadrao, variaveis).precoSugerido, 11.11);
  assert.equal(recalcularReceita({ ...recipe, margemDesejada: 95 }, custosFixosPadrao, variaveis).precoSugerido, null);
  assert.equal(recalcularReceita({ ...recipe, precoVenda: 100 }, custosFixosPadrao, variaveis).precoSugerido, 20);
});
test("cadastro exige fator correto e rejeita campos de saldo/tenant fornecidos pelo cliente", () => {
  const input = { acao: "criarInsumo", operacaoId: "a52f0816-1a10-4117-80d1-f268911acb2b", nome: "Carne", unidadeCompra: "KG", unidadeUso: "G", fatorConversao: 1000, custoEstimado: null };
  assert.equal(criarInsumoFichaSchema.safeParse(input).success, true);
  assert.equal(criarInsumoFichaSchema.safeParse({ ...input, estoqueAtual: 10 }).success, false);
  assert.equal(criarInsumoFichaSchema.safeParse({ ...input, empresaId: "b" }).success, false);
  assert.equal(criarInsumoFichaSchema.safeParse({ ...input, unidadeUso: "ML" }).success, false);
  assert.equal(criarInsumoFichaSchema.safeParse({ ...input, fatorConversao: 1 }).success, false);
});
test("autoriza somente perfil explícito ativo, plano e tenant definidos", () => {
  const p = { uid: "ana", empresaId: "a", lojaId: "matriz", role: "dono", plano: "plus" };
  assert.deepEqual(validarAtorFicha(p), { uid: "ana", empresaId: "a", lojaId: "matriz" });
  for (const invalid of [null, { ...p, role: "desconhecido" }, { ...p, role: "funcionario" }, { ...p, ativo: false }, { ...p, plano: "free" }, { ...p, empresaId: "" }]) assert.throws(() => validarAtorFicha(invalid));
});
