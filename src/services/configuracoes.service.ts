import type { ConfiguracaoEstabelecimento } from "../types";
import { atualizarDocumento, criarDocumento, obterDocumento } from "./db";

const COLECAO = "configuracoes";

const CONFIG_PADRAO: ConfiguracaoEstabelecimento = {
  nome: "",
  endereco: "",
  telefone: "",
  whatsapp: "",
  horarioFuncionamento: "Seg-Sex: 18h-23h | Sab-Dom: 12h-23h",
  margemIdeal: 60,
  cmvAlvo: 28,
  diasAlertaValidade: 3,
  notificarEstoqueBaixo: true,
  notificarVencimento: true,
  notificarWhatsApp: false,
  numeroWhatsAppNotificacao: "",
};

export async function getConfiguracao(uid: string): Promise<ConfiguracaoEstabelecimento> {
  try {
    const config = await obterDocumento<ConfiguracaoEstabelecimento & { id?: string }>(COLECAO, uid);
    return config || { ...CONFIG_PADRAO };
  } catch (error) {
    console.error("Erro ao buscar configuracao", error);
    return { ...CONFIG_PADRAO };
  }
}

export const buscarConfiguracaoEstabelecimento = () => getConfiguracao("estabelecimento");

export async function salvarConfiguracao(uid: string, dados: Partial<ConfiguracaoEstabelecimento>): Promise<string | void> {
  try {
    const existente = await obterDocumento(COLECAO, uid);
    if (existente) {
      return atualizarDocumento(COLECAO, uid, dados);
    }
    return criarDocumento(COLECAO, { ...CONFIG_PADRAO, ...dados }, uid);
  } catch (error) {
    console.error("Erro ao salvar configuracao", error);
    throw error;
  }
}

export const salvarConfiguracaoEstabelecimento = (dados: ConfiguracaoEstabelecimento) => salvarConfiguracao("estabelecimento", dados);

export async function atualizarConfiguracao(uid: string, dados: Partial<ConfiguracaoEstabelecimento>): Promise<void> {
  try {
    return atualizarDocumento<ConfiguracaoEstabelecimento>(COLECAO, uid, dados);
  } catch (error) {
    console.error("Erro ao atualizar configuracao", error);
    throw error;
  }
}

export const atualizarConfiguracaoEstabelecimento = (dados: Partial<ConfiguracaoEstabelecimento>) =>
  atualizarConfiguracao("estabelecimento", dados);
