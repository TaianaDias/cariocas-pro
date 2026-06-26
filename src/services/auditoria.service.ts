import { criarDocumento } from "./db";

type AuditoriaInput = {
  acao: string;
  detalhes?: Record<string, unknown>;
  empresaId?: string;
  lojaId?: string;
  modulo: string;
  recursoId?: string;
  recursoNome?: string;
  usuarioId?: string;
};

export async function registrarAuditoria(dados: AuditoriaInput): Promise<void> {
  try {
    if (!dados.empresaId) return;

    await criarDocumento(`empresas/${dados.empresaId}/auditoria`, {
      acao: dados.acao,
      detalhes: dados.detalhes || {},
      empresaId: dados.empresaId,
      lojaId: dados.lojaId || null,
      modulo: dados.modulo,
      recursoId: dados.recursoId || "",
      recursoNome: dados.recursoNome || "",
      usuarioId: dados.usuarioId || "sistema",
    });
  } catch (error) {
    console.warn("Falha ao registrar auditoria", error);
  }
}

export async function registrarLogSeguranca(dados: AuditoriaInput & { severidade?: "baixa" | "media" | "alta" }): Promise<void> {
  try {
    if (!dados.empresaId) return;

    await criarDocumento(`empresas/${dados.empresaId}/logsSeguranca`, {
      ...dados,
      detalhes: dados.detalhes || {},
      lojaId: dados.lojaId || null,
      severidade: dados.severidade || "media",
      usuarioId: dados.usuarioId || "sistema",
    });
  } catch (error) {
    console.warn("Falha ao registrar log de seguranca", error);
  }
}
