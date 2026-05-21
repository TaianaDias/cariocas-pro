import type { Metadata } from "next";

import { CadastroPageClient } from "../../components/auth/CadastroPageClient";

export const metadata: Metadata = {
  title: "Cadastro | Carioca's Pro",
};

export default function Page() {
  return <CadastroPageClient />;
}
