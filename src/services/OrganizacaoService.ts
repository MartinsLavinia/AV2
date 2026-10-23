import { Prisma } from "../generated/prisma/client.js";
import { ValidadorCNPJ } from "../domain/validators/ValidadorCNPJ.js";
import { OrganizacaoRepository } from "../repositories/OrganizacaoRepository.js";

export type DadosNovaOrganizacao = {
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
      new OrganizacaoRepository(),
    private readonly validadorCNPJ = new ValidadorCNPJ(),
  ) {}

  async listarTodas() {
    return this.organizacaoRepository.listarTodas();
  }

  async buscarPorCnpj(cnpjInformado: string) {
    const cnpj = this.normalizarCnpj(cnpjInformado);
    const organizacao = await this.organizacaoRepository.buscarPorCnpj(cnpj);
    if (!organizacao) throw new OrganizacaoNaoEncontradaError();
    return organizacao;
  }

  async criar(dados: DadosNovaOrganizacao) {
    this.validarCampos(dados);
    const cnpj = this.normalizarCnpj(dados.cnpj);
    const normalizados = {
      razaoSocial: dados.razaoSocial.trim(),
      cnpj,
      inscricaoEstadual: dados.inscricaoEstadual.trim(),
      enderecoCompleto: dados.enderecoCompleto.trim(),
      telefone: dados.telefone.trim(),
      email: dados.email.trim().toLowerCase(),
    };

    if (await this.organizacaoRepository.buscarPorCnpj(cnpj)) {
      throw new CnpjOrganizacaoDuplicadoError();
    }

    try {
      return await this.organizacaoRepository.criar(normalizados);
    } catch (erro) {
      // A constraint única também cobre duas criações concorrentes.
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === "P2002"
      ) {
        throw new CnpjOrganizacaoDuplicadoError();
      }
      throw erro;
    }
  }

  private normalizarCnpj(valor: unknown): string {
    if (typeof valor !== "string" || !this.validadorCNPJ.validar(valor)) {
      throw new ErroValidacaoOrganizacao(
        "CNPJ inválido. Informe um CNPJ de 14 posições com dígitos verificadores válidos.",
      );
    }
    return this.validadorCNPJ.normalizar(valor)!;
  }

  private validarCampos(dados: DadosNovaOrganizacao) {
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new ErroValidacaoOrganizacao("O corpo da requisição deve ser um objeto JSON.");
    }
    const campos: Array<[keyof DadosNovaOrganizacao, string]> = [
      ["razaoSocial", "Razão social"],
      ["inscricaoEstadual", "Inscrição estadual"],
      ["enderecoCompleto", "Endereço completo"],
      ["telefone", "Telefone"],
      ["email", "E-mail"],
    ];
    for (const [campo, rotulo] of campos) {
      const valor = dados[campo];
      if (typeof valor !== "string" || !valor.trim()) {
        throw new ErroValidacaoOrganizacao(`${rotulo} é obrigatório.`);
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) {
      throw new ErroValidacaoOrganizacao("Informe um e-mail válido.");
    }
  }
}

export class ErroValidacaoOrganizacao extends Error {}
export class CnpjOrganizacaoDuplicadoError extends Error {}
export class OrganizacaoNaoEncontradaError extends Error {}
