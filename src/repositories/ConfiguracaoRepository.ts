import { prisma } from "../infrastructure/prisma.js";

const ID_CONFIGURACAO_GLOBAL = 1;

export class ConfiguracaoRepository {
  obter() {
    return prisma.configuracaoSistema.upsert({
      where: { id: ID_CONFIGURACAO_GLOBAL },
      create: { id: ID_CONFIGURACAO_GLOBAL },
      update: {},
    });
  }

  atualizar(dados: { aliquotaImposto?: number; coeficienteDepreciacaoAnual?: number }) {
    return prisma.configuracaoSistema.upsert({
      where: { id: ID_CONFIGURACAO_GLOBAL },
      create: { id: ID_CONFIGURACAO_GLOBAL, ...dados },
      update: dados,
    });
  }
}
