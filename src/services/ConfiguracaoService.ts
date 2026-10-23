import { ConfiguracaoRepository } from "../repositories/ConfiguracaoRepository.js";

export type AlteracoesConfiguracao = {
  aliquotaImposto?: number;
  coeficienteDepreciacaoAnual?: number;
};

export class ConfiguracaoService {
  constructor(private readonly configuracoes = new ConfiguracaoRepository()) {}

  async obter() {
    const registro = await this.configuracoes.obter();
    return this.apresentarEmPercentual(registro);
  }

  async atualizar(dados: AlteracoesConfiguracao) {
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new ErroValidacaoConfiguracao("O corpo da requisição deve ser um objeto JSON.");
    }
    const campos = Object.keys(dados);
    const permitidos = ["aliquotaImposto", "coeficienteDepreciacaoAnual"];
    if (campos.length === 0) throw new ErroValidacaoConfiguracao("Informe ao menos uma configuração para alterar.");
    if (campos.some((campo) => !permitidos.includes(campo))) {
      throw new ErroValidacaoConfiguracao("Apenas aliquotaImposto e coeficienteDepreciacaoAnual podem ser alterados.");
    }

    const atualizacoes: { aliquotaImposto?: number; coeficienteDepreciacaoAnual?: number } = {};
    for (const campo of permitidos as Array<keyof AlteracoesConfiguracao>) {
      const valor = dados[campo];
      if (valor === undefined) continue;
      if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0 || valor > 100) {
        throw new ErroValidacaoConfiguracao(`${campo} deve ser um percentual numérico entre 0 e 100.`);
      }
      atualizacoes[campo] = valor / 100;
    }

    const registro = await this.configuracoes.atualizar(atualizacoes);
    return this.apresentarEmPercentual(registro);
  }

  private apresentarEmPercentual(registro: {
    aliquotaImposto: number;
    coeficienteDepreciacaoAnual: number;
    atualizadoEm: Date;
  }) {
    return {
      aliquotaImposto: registro.aliquotaImposto * 100,
      coeficienteDepreciacaoAnual: registro.coeficienteDepreciacaoAnual * 100,
      atualizadoEm: registro.atualizadoEm,
    };
  }
}

export class ErroValidacaoConfiguracao extends Error {}
