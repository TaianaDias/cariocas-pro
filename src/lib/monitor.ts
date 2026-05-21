type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  context?: Record<string, unknown>;
  level: LogLevel;
  message: string;
  timestamp: string;
}

function writeLog(entry: LogEntry) {
  const payload = JSON.stringify(entry);

  if (entry.level === "error") {
    console.error("[Monitor]", payload);
    return;
  }

  if (entry.level === "warn") {
    console.warn("[Monitor]", payload);
    return;
  }

  console.info("[Monitor]", payload);
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  writeLog({
    context,
    level: "info",
    message,
    timestamp: new Date().toISOString(),
  });
}

export function logWarn(message: string, context?: Record<string, unknown>) {
  writeLog({
    context,
    level: "warn",
    message,
    timestamp: new Date().toISOString(),
  });
}

export function logError(error: Error, context?: Record<string, unknown>) {
  writeLog({
    context,
    level: "error",
    message: error.message,
    timestamp: new Date().toISOString(),
  });
}

export function measurePerformance(label: string): () => void {
  const start = performance.now();

  return () => {
    const duration = performance.now() - start;
    logInfo(`Performance: ${label}`, { durationMs: Math.round(duration * 100) / 100 });
  };
}

