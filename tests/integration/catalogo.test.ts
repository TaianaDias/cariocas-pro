import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { initializeApp as initializeClient, deleteApp as deleteClient } from "firebase/app";
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore as getClientFirestore, connectFirestoreEmulator, doc, getDoc, updateDoc, setDoc, terminate } from "firebase/firestore";
import { GET, POST } from "../../src/app/api/precificacao/catalogo/route";
import { POST as atualizarConsulta } from "../../src/app/api/precificacao/recalcular/route";

const projectId = "demo-cariocas-pro";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("Execute somente via npm run test:emulators.");
const app = initializeApp({ projectId });
const db = getFirestore(app);
let tokenA: string; let tokenB: string; let tokenEquipe: string;
let emailA: string; let uidA: string;
const empresa = db.collection("empresas").doc("empresa_a");

async function criarUsuario(email: string, empresaId: string, role = "dono") {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-only`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "senha-apenas-emulador-123", returnSecureToken: true }),
  });
  const user = await response.json() as { idToken: string; localId: string };
  assert.equal(response.status, 200);
  await db.collection("usuarios").doc(user.localId).set({ uid: user.localId, empresaId, lojaId: "matriz", role, plano: "plus", ativo: true });
  if (empresaId === "empresa_a" && role === "dono") { emailA = email; uidA = user.localId; }
  return user.idToken;
}

function request(token?: string, body?: unknown) {
  return new NextRequest("http://localhost/api/precificacao/catalogo", {
    method: body ? "POST" : "GET", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function post(body: object, token = tokenA) {
  const response = await POST(request(token, body));
  return { status: response.status, data: await response.json() };
}
async function catalogo(token = tokenA) {
  const response = await GET(request(token));
  assert.equal(response.status, 200);
  return await response.json();
}
const novoInsumo = (custoEstimado: number | null = 35) => ({ acao: "criarInsumo", operacaoId: randomUUID(), nome: "Carne teste", unidadeCompra: "KG", unidadeUso: "G", fatorConversao: 1000, custoEstimado });
const novaFicha = (insumoId: string) => ({ acao: "salvarFicha", operacaoId: randomUUID(), nome: "Burger teste", precoVenda: 20, ingredientes: [{ insumoId, quantidade: 160, unidade: "G", tipo: "insumo" }] });

before(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  const suffix = randomUUID();
  tokenA = await criarUsuario(`a-${suffix}@example.test`, "empresa_a");
  tokenB = await criarUsuario(`b-${suffix}@example.test`, "empresa_b");
  tokenEquipe = await criarUsuario(`equipe-${suffix}@example.test`, "empresa_a", "funcionario");
});
after(async () => { await db.terminate(); await deleteApp(app); });

test("fluxo HTTP + Auth + Firestore: cadastro sem compra, ficha persistida, custos e histórico", async (t) => {
  const criacao = novoInsumo(); let id: string; let fichaId: string;
  await t.test("cadastro transacional repetido simultaneamente não duplica nem movimenta estoque/financeiro", async () => {
    const results = await Promise.all([post(criacao), post(criacao)]);
    assert.deepEqual(results.map((r) => r.status), [200, 200]);
    assert.equal(results[0].data.id, results[1].data.id); id = results[0].data.id;
    const data = (await empresa.collection("insumos").doc(id).get()).data()!;
    assert.equal(data.estoqueAtual, 0); assert.equal(data.quantidadeAtual, 0); assert.equal(data.custoCompra, 0);
    assert.equal(data.custoReferencia.valorCompra, 35); assert.equal(data.custoReferencia.origem, "estimado");
    for (const nome of ["historicoEstoque", "contasPagar", "lancamentosFinanceiros", "pedidos_compra"]) assert.equal((await empresa.collection(nome).get()).size, 0);
    assert.equal((await empresa.collection("insumos").get()).size, 1);
    assert.equal((await empresa.collection("auditoria").get()).size, 1);
  });
  await t.test("mesma chave com outro conteúdo é rejeitada", async () => {
    assert.equal((await post({ ...criacao, custoEstimado: 99 })).status, 409);
  });
  await t.test("ficha salva e relida custa 5,60 sem aceitar custos calculados pelo cliente", async () => {
    const input = novaFicha(id);
    const saved = await post(input); assert.equal(saved.status, 200); fichaId = saved.data.id;
    const stored = (await empresa.collection("receitas").doc(fichaId).get()).data()!;
    assert.equal(stored.custoIngredientes, 5.6); assert.equal(stored.versaoFicha, 1);
    const data = await catalogo();
    assert.equal(data.receitas.find((item: { id: string }) => item.id === fichaId).custoIngredientes, 5.6);
    assert.equal((await post({ ...novaFicha(id), custoIngredientes: 0 })).status, 400);
  });
  await t.test("redução repercute na consulta atual; custo do estoque, ficha salva e venda antiga preservados", async () => {
    await empresa.collection("vendas").doc("antiga").set({ custoHistorico: 5.6, receitaId: fichaId });
    const input = { acao: "atualizarCusto", operacaoId: randomUUID(), insumoId: id, versaoCusto: 1, custoEstimado: 25 };
    assert.equal((await post(input)).status, 200);
    const data = await catalogo();
    assert.equal(data.receitas.find((item: { id: string }) => item.id === fichaId).custoIngredientes, 4);
    assert.equal((await empresa.collection("receitas").doc(fichaId).get()).data()!.custoIngredientes, 5.6);
    assert.equal((await empresa.collection("vendas").doc("antiga").get()).data()!.custoHistorico, 5.6);
    assert.equal((await empresa.collection("insumos").doc(id).get()).data()!.custoCompra, 0);
    assert.equal((await post({ ...input, operacaoId: randomUUID() })).status, 409);
    const refreshed = await atualizarConsulta(request(tokenA, {})); assert.equal(refreshed.status, 200);
    assert.equal((await empresa.collection("historicoReceitas").get()).size, 1);
  });
  await t.test("custo não informado persiste null e impede margem artificial", async () => {
    const unknown = await post(novoInsumo(null));
    const saved = await post(novaFicha(unknown.data.id)); assert.equal(saved.status, 200);
    const stored = (await empresa.collection("receitas").doc(saved.data.id).get()).data()!;
    for (const key of ["custoIngredientes", "margem", "cmv", "lucro", "precoSugerido"]) assert.equal(stored[key], null);
    assert.equal(stored.status, "pendente");
  });
  await t.test("segurança: sem token, funcionário, identificadores de outra empresa/loja e tenant injetado", async () => {
    assert.equal((await GET(request())).status, 401);
    assert.equal((await GET(request(tokenEquipe))).status, 403);
    assert.equal((await post(novaFicha(id), tokenB)).status, 404);
    assert.equal((await post({ ...novoInsumo(), empresaId: "empresa_b" })).status, 400);
    assert.equal((await post({ ...novaFicha(id), id: fichaId, versaoFicha: 1 }, tokenB)).status, 404);
    await empresa.collection("insumos").doc("outra_loja").set({ empresaId: "empresa_a", lojaId: "filial", nome: "Privado" });
    assert.equal((await post(novaFicha("outra_loja"))).status, 404);
    assert.equal((await catalogo(tokenB)).insumos.length, 0);
  });
  await t.test("regras reais do SDK impedem elevar plano, trocar tenant/loja e forjar custos/versões", async () => {
    const client = initializeClient({ projectId, apiKey: "local-only" }, "rules-client");
    const auth = getAuth(client);
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    const clientDb = getClientFirestore(client);
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
    connectFirestoreEmulator(clientDb, host, Number(port));
    try {
      await signInWithEmailAndPassword(auth, emailA, "senha-apenas-emulador-123");
      const denied = (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "permission-denied");
      await assert.rejects(updateDoc(doc(clientDb, "usuarios", uidA), { plano: "full" }), denied);
      await assert.rejects(updateDoc(doc(clientDb, "usuarios", uidA), { empresaId: "empresa_b" }), denied);
      await assert.rejects(updateDoc(doc(clientDb, "usuarios", uidA), { lojaId: "filial" }), denied);
      await assert.rejects(updateDoc(doc(clientDb, "empresas/empresa_a/insumos", id), { custoReferencia: { valorCompra: 1 } }), denied);
      await assert.rejects(setDoc(doc(clientDb, "empresas/empresa_a/receitas", "forjada"), { empresaId: "empresa_a", lojaId: "matriz" }), denied);
      await assert.rejects(getDoc(doc(clientDb, "empresas/empresa_a/insumos", "outra_loja")), denied);
      await empresa.collection("configuracoes").doc("filial").set({ empresaId: "empresa_a", lojaId: "filial", nome: "Privado" });
      await assert.rejects(updateDoc(doc(clientDb, "empresas/empresa_a/configuracoes", "filial"), { lojaId: "matriz" }), denied);
      await assert.rejects(getDoc(doc(clientDb, "empresas/empresa_b/insumos", id)), denied);
      assert.equal((await getDoc(doc(clientDb, "empresas/empresa_a/receitas", fichaId))).exists(), true);
      await updateDoc(doc(clientDb, "usuarios", uidA), { nome: "Nome permitido" });
    } finally { await terminate(clientDb); await deleteClient(client); }
  });
  await t.test("falha de validação não deixa ficha, auditoria ou versão parcial", async () => {
    const before = (await empresa.collection("auditoria").get()).size;
    const input = novaFicha("nao_existe");
    assert.equal((await post(input)).status, 404);
    assert.equal((await empresa.collection("receitas").doc(input.operacaoId).get()).exists, false);
    assert.equal((await empresa.collection("auditoria").get()).size, before);
  });
  await t.test("edição concorrente exige versão atual e gera histórico atômico", async () => {
    const input = { ...novaFicha(id), id: fichaId, versaoFicha: 1 };
    assert.equal((await post(input)).status, 200);
    assert.equal((await post({ ...input, operacaoId: randomUUID(), nome: "Sessão antiga" })).status, 409);
    assert.equal((await empresa.collection("receitas").doc(fichaId).get()).data()!.versaoFicha, 2);
    assert.equal((await empresa.collection("historicoReceitas").where("receitaId", "==", fichaId).get()).size, 2);
  });
});
