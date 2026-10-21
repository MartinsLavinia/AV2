
import { OrganizacaoRepository } from "../repositories/OrganizacaoRepository.js";

type DadosNovaOrganizacao = {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  enderecoCompleto: string;
  telefone: string;
  email: string;
};

export class OrganizacaoService {
  constructor(
    private readonly organizacaoRepository: OrganizacaoRepository =
      new OrganizacaoRepository()
  ) {}

  async listarTodas() {
    return this.organizacaoRepository.listarTodas();
  }

  async buscarPorCnpj(cnpj: string) {
    const organizacao =
      await this.organizacaoRepository.buscarPorCnpj(cnpj);

    if (!organizacao) {
      throw new Error("Organização não encontrada.");
    }

    return organizacao;
  }

  async criar(dados: DadosNovaOrganizacao) {
    const cnpj = dados.cnpj.replace(/\D/g, "");

    if (cnpj.length !== 14) {
      throw new Error("O CNPJ deve conter 14 dígitos.");
    }

    const existente =
      await this.organizacaoRepository.buscarPorCnpj(cnpj);

    if (existente) {
      throw new Error("Já existe uma organização com esse CNPJ.");
    }

    return this.organizacaoRepository.criar({
      ...dados,
      cnpj,
    });
  }
}
