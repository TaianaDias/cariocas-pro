"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Title } from "../ui/Title";

export function FinanceiroHeader() {
  const pathname = usePathname();
  const isRelatorios = pathname.includes("/relatorios");

  return (
    <header className="financeiro-header">
      <div>
        <Title eyebrow="Financeiro">{isRelatorios ? "Relatórios" : "Dashboard Financeiro"}</Title>
        <p>{isRelatorios ? "Compras, fornecedores e movimentações por período." : "KPIs financeiros, CMV e evolução de custos."}</p>
      </div>

      <nav aria-label="Navegacao financeira">
        <Link className={!isRelatorios ? "active" : ""} href="/financeiro">
          Dashboard
        </Link>
        <Link className={isRelatorios ? "active" : ""} href="/financeiro/relatorios">
          Relatorios
        </Link>
      </nav>
    </header>
  );
}
