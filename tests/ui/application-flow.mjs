import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { chromium } from "playwright";

const projectId = "demo-cariocas-pro";
const localAddress = /^(127\.0\.0\.1|localhost):\d{1,5}$/;
for (const key of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
  if (!localAddress.test(process.env[key] || "")) throw new Error("Execute este teste com os emuladores locais do projeto demo-.");
}
const artifacts = await mkdtemp(join(tmpdir(), "cariocas-app-e2e-"));
const app = initializeApp({ projectId });
const db = getFirestore(app);
const email = `operacao-${randomUUID()}@example.test`;
const password = "senha-somente-no-emulador-123";
const signup = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-only`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }),
});
assert.equal(signup.status, 200);
const { localId: uid } = await signup.json();
await db.collection("usuarios").doc(uid).set({ uid, empresaId: uid, lojaId: "matriz", nome: "Operação de teste", email, role: "dono", plano: "plus", plan: "plus", ativo: true, permissoes: ["*"] });

const origin = "http://127.0.0.1:3105";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3105"], {
  cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], detached: true,
  env: {
    ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", FIREBASE_PROJECT_ID: projectId,
    FIREBASE_CLIENT_EMAIL: "", FIREBASE_PRIVATE_KEY: "", GOOGLE_APPLICATION_CREDENTIALS: "",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId, NEXT_PUBLIC_FIREBASE_API_KEY: "local-only",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${projectId}.firebaseapp.com`, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  },
});
let serverLog = "";
server.stdout.on("data", (value) => { serverLog = (serverLog + value).slice(-100000); });
server.stderr.on("data", (value) => { serverLog = (serverLog + value).slice(-100000); });
let browser;
let page;
async function ready() {
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    if (server.exitCode !== null) throw new Error(`Next encerrou: ${server.exitCode}`);
    if (await fetch(`${origin}/api/health`).then((r) => r.ok).catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Next não iniciou dentro do prazo.");
}
async function submit(targetPage, button, expected = 200) {
  const [response] = await Promise.all([
    targetPage.waitForResponse((r) => r.url().endsWith("/api/precificacao/catalogo") && r.request().method() === "POST"),
    button.click(),
  ]);
  assert.equal(response.status(), expected, JSON.stringify(await response.json()));
}
async function selectIngredient(name) {
  await page.getByRole("searchbox", { name: "Insumo do estoque" }).fill(name);
  await page.getByRole("button", { name: new RegExp(name) }).click();
}
function card(name, targetPage = page) { return targetPage.locator(".receita-card").filter({ hasText: name }); }
async function costInOpenSheet(expected) {
  const value = page.locator(".precificacao-ficha dl > div").filter({ hasText: "Custo CMV" }).locator("dd");
  await value.filter({ hasText: expected }).waitFor();
}

try {
  await ready();
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: JSON.parse(process.env.CHROMIUM_ARGS || "[]") }
    : { channel: "chromium" }) });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(`${origin}/login`);
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByPlaceholder("Sua senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 45000 });
  await page.goto(`${origin}/precificacao`);
  await page.getByRole("heading", { name: "Precificação Inteligente" }).waitFor();
  const meat = "Carne fluxo completo";
  const burger = "Burger fluxo completo";
  await page.getByText("Cadastrar insumo antes da primeira compra", { exact: true }).click();
  await page.getByRole("textbox", { name: "Nome do novo insumo" }).fill(meat);
  await page.getByRole("textbox", { name: "Custo estimado por KG (R$)" }).fill("35,00");
  await submit(page, page.getByRole("button", { name: "Salvar insumo sem entrada de estoque" }));
  console.log("Aplicação: login e cadastro pré-compra persistidos.");
  await selectIngredient(meat);
  await page.getByLabel("Nome", { exact: true }).fill(burger);
  await page.getByLabel("Preço de venda", { exact: true }).fill("20");
  await page.getByLabel("Quantidade", { exact: true }).fill("160");
  await page.getByRole("button", { name: "Adicionar Ingrediente", exact: true }).click();
  await submit(page, page.getByRole("button", { name: "Salvar Receita", exact: true }));
  await card(burger).getByRole("button", { name: "Ver Ficha", exact: true }).click();
  await costInOpenSheet(/5,60/);
  await page.reload();
  await card(burger).getByRole("button", { name: "Ver Ficha", exact: true }).click();
  await costInOpenSheet(/5,60/);
  console.log("Aplicação: ficha salva e relida com custo de R$ 5,60.");

  await selectIngredient(meat);
  await page.getByText(`Atualizar custo estimado de ${meat}`, { exact: true }).click();
  await page.getByRole("textbox", { name: "Estimativa por KG (R$)" }).fill("25");
  await submit(page, page.getByRole("button", { name: "Salvar referência estimada", exact: true }));
  // A ficha permanece aberta: precisa atualizar sem reabrir ou recarregar.
  await costInOpenSheet(/4,00/);
  console.log("Aplicação: ficha aberta atualiza a referência para R$ 4,00.");

  const second = await context.newPage();
  second.setDefaultTimeout(20000);
  await second.goto(`${origin}/precificacao`);
  await card(burger, second).getByRole("button", { name: "Editar", exact: true }).click();
  await second.getByLabel("Nome", { exact: true }).fill("Edição em sessão antiga");
  await card(burger).getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Preço de venda", { exact: true }).fill("21");
  await submit(page, page.getByRole("button", { name: "Salvar Receita", exact: true }));
  await submit(second, second.getByRole("button", { name: "Salvar Receita", exact: true }), 409);
  await second.getByRole("alert").filter({ hasText: "outra sessão" }).waitFor();
  assert.equal(await second.getByLabel("Nome", { exact: true }).inputValue(), "Edição em sessão antiga");
  await second.close();
  console.log("Aplicação: duas sessões não sobrescrevem a ficha e o erro preserva o formulário.");

  const unknown = "Insumo sem custo conhecido";
  await page.getByText("Cadastrar insumo antes da primeira compra", { exact: true }).click();
  await page.getByRole("textbox", { name: "Nome do novo insumo" }).fill(unknown);
  await page.getByRole("textbox", { name: "Custo estimado por KG (R$)" }).fill("");
  await submit(page, page.getByRole("button", { name: "Salvar insumo sem entrada de estoque" }));
  await selectIngredient(unknown);
  await page.getByLabel("Nome", { exact: true }).fill("Ficha pendente de custo");
  await page.getByLabel("Preço de venda", { exact: true }).fill("10");
  await page.getByLabel("Quantidade", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Adicionar Ingrediente", exact: true }).click();
  await submit(page, page.getByRole("button", { name: "Salvar Receita", exact: true }));
  const pending = card("Ficha pendente de custo");
  await pending.getByText(/Custo pendente/).waitFor();
  assert.equal(await pending.getByRole("button", { name: "Aplicar recomendado" }).count(), 0);
  await pending.getByRole("button", { name: "Ver Ficha", exact: true }).click();
  await costInOpenSheet(/Pendente/);
  await page.getByText("Médias calculadas sobre 1 de 2 fichas.", { exact: true }).waitFor();
  await selectIngredient(meat);
  await page.getByText(`Atualizar custo estimado de ${meat}`, { exact: true }).click();
  await page.getByRole("textbox", { name: "Estimativa por KG (R$)" }).fill("");
  await submit(page, page.getByRole("button", { name: "Salvar referência estimada", exact: true }));
  await page.getByText("Médias calculadas sobre 0 de 2 fichas.", { exact: true }).waitFor();
  assert.equal(await page.locator(".precificacao-kpi").filter({ hasText: "CMV médio por ficha" }).locator("strong").innerText(), "Pendente");
  assert.equal(await page.locator(".precificacao-kpi").filter({ hasText: "Margem média por ficha" }).locator("strong").innerText(), "Pendente");
  await page.screenshot({ path: join(artifacts, "fluxo-390.png"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Aplicação com rolagem horizontal em 390px");
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Aplicação com rolagem horizontal em 1440px");
  await page.screenshot({ path: join(artifacts, "fluxo-1440.png"), fullPage: true });

  const tenant = db.collection("empresas").doc(uid);
  const ingredients = await tenant.collection("insumos").get();
  assert.equal(ingredients.size, 2);
  for (const item of ingredients.docs) { assert.equal(item.data().estoqueAtual, 0); assert.equal(item.data().custoCompra, 0); }
  assert.equal((await tenant.collection("historicoEstoque").get()).size, 0);
  assert.equal((await tenant.collection("historicoReceitas").get()).size, 3);
  console.log("Aplicação: custo pendente sem margem artificial, saldo preservado e layout validado em 390/1440px.");
  console.log(`Evidências locais: ${artifacts}`);
} catch (error) {
  if (page && !page.isClosed()) { await page.screenshot({ path: join(artifacts, "falha.png"), fullPage: true }).catch(() => {}); console.error((await page.locator("body").innerText().catch(() => "")).slice(-7000)); }
  console.error(`Evidências da falha: ${artifacts}`);
  throw error;
} finally {
  await browser?.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch {}
  await writeFile(join(artifacts, "next.log"), serverLog);
  await db.terminate(); await deleteApp(app);
}
