import { strict as assert } from "node:assert";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";

const temp = await mkdtemp(join(tmpdir(), "cariocas-form-"));
const output = join(temp, "fixture.js");
await build({ entryPoints: ["tests/ui/insumo-form.fixture.tsx"], bundle: true, outfile: output, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' } });
const css = (await Promise.all(["tokens", "theme", "global", "components", "precificacao"].map((name) => readFile(`src/styles/${name}.css`, "utf8")))).join("\n");
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH
  ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: JSON.parse(process.env.CHROMIUM_ARGS || "[]") }
  : { channel: "chromium" }) });
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setContent(`<html lang="pt-BR" data-theme="light"><head><meta name="viewport" content="width=device-width"><style>${css}</style></head><body><div id="root"></div></body></html>`);
    await page.addScriptTag({ content: await readFile(output, "utf8") });
    await page.getByText("Cadastrar insumo antes da primeira compra", { exact: true }).click();
    const nome = page.getByRole("textbox", { name: "Nome do novo insumo" });
    await nome.fill("Carne sem primeira compra");
    await page.getByRole("button", { name: "Salvar insumo sem entrada de estoque" }).click();
    await page.getByRole("status").filter({ hasText: "Falha temporária simulada" }).waitFor();
    assert.equal(await nome.inputValue(), "Carne sem primeira compra");
    await page.getByRole("button", { name: "Salvar insumo sem entrada de estoque" }).click();
    await page.getByRole("status").filter({ hasText: "Insumo salvo" }).waitFor();
    const payload = await page.evaluate(() => window.fichaPayloads[0]);
    assert.deepEqual(payload, { nome: "Carne sem primeira compra", unidadeCompra: "KG", unidadeUso: "G", fatorConversao: 1000, custoEstimado: null });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `Overflow em ${width}px`);
    assert.ok((await nome.boundingBox()).height >= 44);
    await nome.focus(); await page.keyboard.press("Tab");
    assert.equal(await page.getByRole("combobox", { name: "Unidade de compra", exact: true }).evaluate((node) => node === document.activeElement), true);
    await page.close();
    console.log(`Formulário ${width}px: erro preserva dados, cadastro sem custo envia null, teclado e largura aprovados.`);
  }
} finally { await browser.close(); await rm(temp, { recursive: true, force: true }); }
