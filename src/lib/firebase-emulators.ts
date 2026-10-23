// Configuração exclusiva para desenvolvimento/testes com dados fabricados.
// Não aceita projetos reais, produção ou destinos remotos.
export function firebaseEmulators(settings: {
  enabled: boolean;
  environment: string | undefined;
  projectId: string | undefined;
  authHost: string | undefined;
  firestoreHost: string | undefined;
}) {
  if (!settings.enabled) return null;
  if (!["development", "test"].includes(settings.environment || "") || !settings.projectId?.startsWith("demo-")) {
    throw new Error("Emulação Firebase exige desenvolvimento/teste e projeto demo-.");
  }
  function address(value: string | undefined) {
    const match = /^(127\.0\.0\.1|localhost):(\d{1,5})$/.exec(value || "");
    const port = Number(match?.[2]);
    if (!match || port < 1 || port > 65535) throw new Error("Emuladores Firebase exigem host local e porta explícita.");
    return { host: match[1], port };
  }
  return { auth: address(settings.authHost), firestore: address(settings.firestoreHost) };
}
