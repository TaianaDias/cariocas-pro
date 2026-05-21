"use client";

import { useEffect, useState } from "react";

import { useBarcode } from "../../hooks/useBarcode";
import type { Insumo } from "../../types";
import { Button } from "../ui/Button";
import { TextInput } from "../ui/TextInput";

type BarcodeInputProps = {
  autoFocus?: boolean;
  codigo: string;
  onChange: (codigo: string) => void;
  onProdutoEncontrado?: (produto: Insumo) => void;
  placeholder?: string;
};

export function BarcodeInput({ autoFocus, codigo, onChange, onProdutoEncontrado, placeholder = "Digite ou escaneie o codigo" }: BarcodeInputProps) {
  const [scannerAtivo, setScannerAtivo] = useState(false);
  const { buscarPorCodigo } = useBarcode();

  async function handleBuscar() {
    if (!codigo.trim()) return;
    const produto = await buscarPorCodigo(codigo);
    if (produto) onProdutoEncontrado?.(produto);
  }

  useEffect(() => {
    if (codigo.length >= 8) handleBuscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  useEffect(() => {
    if (!scannerAtivo) return;
    let buffer = "";
    let lastKeyTime = 0;

    function handleKeyDown(event: KeyboardEvent) {
      const now = Date.now();
      if (now - lastKeyTime > 100) buffer = "";
      lastKeyTime = now;
      if (event.key === "Enter" && buffer.length >= 8) {
        onChange(buffer);
        buffer = "";
        return;
      }
      if (event.key.length === 1) buffer += event.key;
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onChange, scannerAtivo]);

  return (
    <div className="barcode-input">
      <TextInput autoFocus={autoFocus} label="Codigo de Barras" placeholder={placeholder} value={codigo} onChange={(event) => onChange(event.target.value)} />
      <div className="estoque-row-actions">
        <Button variant="secondary" onClick={handleBuscar} disabled={!codigo}>Buscar</Button>
        <Button variant="ghost" onClick={() => setScannerAtivo((current) => !current)}>{scannerAtivo ? "Parar Scanner" : "Scanner"}</Button>
      </div>
      {scannerAtivo ? <span className="estoque-feedback">Scanner ativo. Escaneie com o leitor.</span> : null}
    </div>
  );
}
