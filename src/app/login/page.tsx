import type { Metadata } from "next";

import { LoginPageClient } from "../../components/auth/LoginPageClient";

export const metadata: Metadata = {
  title: "Login | Carioca's Pro",
};

export default function Page() {
  return <LoginPageClient />;
}
