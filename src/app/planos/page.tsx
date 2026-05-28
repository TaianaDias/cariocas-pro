import type { Metadata } from "next";

import { PlanosPageClient } from "../../components/planos/PlanosPageClient";

export const metadata: Metadata = {
  title: "Planos | Carioca's Pro",
  description: "Compare os planos Free, Essencial, Pro, Plus e Full do Carioca's Pro.",
};

export default function PlanosPage() {
  return <PlanosPageClient />;
}
