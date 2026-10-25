import { Prisma } from "../generated/prisma/client.js";
import { ValidadorCNPJ } from "../domain/validators/ValidadorCNPJ.js";
import {
  OrganizacaoRepository,
  OrganizacaoComVinculosRepositoryError,
  OrganizacaoNaoEncontradaRepositoryError,
  VersaoOrganizacaoConflitanteRepositoryError,
} from "../repositories/OrganizacaoRepository.js";

export type DadosNovaOrganizacao = {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  enderecoCompleto: string;
  telefone: string;
  email: string;
};

export type DadosEdicaoOrganizacao = Partial<DadosNovaOrganizacao> & { ativo?: boolean; versao: number };

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

  async obter(id: string) {
    if (!UUID.test(id)) throw new ErroValidacaoOrganizacao("Identificador da organização inválido.");
    const organizacao = await this.organizacaoRepository.buscarPorId(id);
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

  async editar(id: string, dados: DadosEdicaoOrganizacao) {
    if (!UUID.test(id)) throw new ErroValidacaoOrganizacao("Identificador da organização inválido.");
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new ErroValidacaoOrganizacao("O corpo da requisição deve ser um objeto JSON.");
    this.validarVersao(dados.versao);
    const { versao: _versao, ...campos } = dados;
    if (Object.keys(campos).length === 0) throw new ErroValidacaoOrganizacao("Informe ao menos um campo para alterar.");
    const atualizacoes: Partial<DadosNovaOrganizacao> & { ativo?: boolean } = {};

    if (campos.razaoSocial !== undefined) atualizacoes.razaoSocial = this.textoObrigatorio(campos.razaoSocial, "Razão social");
    if (campos.cnpj !== undefined) {
      const cnpj = this.normalizarCnpj(campos.cnpj);
      const existente = await this.organizacaoRepository.buscarPorCnpj(cnpj);
      if (existente && existente.id !== id) throw new CnpjOrganizacaoDuplicadoError();
      atualizacoes.cnpj = cnpj;
    }
    if (campos.inscricaoEstadual !== undefined) atualizacoes.inscricaoEstadual = this.textoObrigatorio(campos.inscricaoEstadual, "Inscrição estadual");
    if (campos.enderecoCompleto !== undefined) atualizacoes.enderecoCompleto = this.textoObrigatorio(campos.enderecoCompleto, "Endereço completo");
    if (campos.telefone !== undefined) atualizacoes.telefone = this.textoObrigatorio(campos.telefone, "Telefone");
    if (campos.email !== undefined) {
      const email = this.textoObrigatorio(campos.email, "E-mail").toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroValidacaoOrganizacao("Informe um e-mail válido.");
      atualizacoes.email = email;
    }
    if (campos.ativo !== undefined) {
      if (typeof campos.ativo !== "boolean") throw new ErroValidacaoOrganizacao("O campo ativo deve ser true ou false.");
      atualizacoes.ativo = campos.ativo;
    }

    try {
      return await this.organizacaoRepository.editar(id, dados.versao, atualizacoes);
    } catch (erro) {
      if (erro instanceof OrganizacaoNaoEncontradaRepositoryError) throw new OrganizacaoNaoEncontradaError();
      if (erro instanceof VersaoOrganizacaoConflitanteRepositoryError) throw new VersaoOrganizacaoConflitanteError();
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") throw new CnpjOrganizacaoDuplicadoError();
      throw erro;
    }
  }

  async excluir(id: string, versaoInformada: unknown) {
    if (!UUID.test(id)) throw new ErroValidacaoOrganizacao("Identificador da organização inválido.");
    const versao = this.validarVersao(versaoInformada);
    try {
      return await this.organizacaoRepository.excluir(id, versao);
    } catch (erro) {
      if (erro instanceof OrganizacaoNaoEncontradaRepositoryError) throw new OrganizacaoNaoEncontradaError();
      if (erro instanceof VersaoOrganizacaoConflitanteRepositoryError) throw new VersaoOrganizacaoConflitanteError();
      if (erro instanceof OrganizacaoComVinculosRepositoryError) throw new OrganizacaoComVinculosError(erro.lotes, erro.contratos);
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2003") throw new OrganizacaoComVinculosError(0, 1);
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

  private textoObrigatorio(valor: unknown, campo: string) {
    if (typeof valor !== "string" || !valor.trim()) throw new ErroValidacaoOrganizacao(`${campo} é obrigatório.`);
    return valor.trim();
  }

  private validarVersao(valor: unknown): number {
    if (!Number.isInteger(valor) || (valor as number) < 1) throw new ErroValidacaoOrganizacao("Informe a versão atual da organização como inteiro positivo.");
    return valor as number;
  }
}

export class ErroValidacaoOrganizacao extends Error {}
export class CnpjOrganizacaoDuplicadoError extends Error {}
export class OrganizacaoNaoEncontradaError extends Error {}
export class VersaoOrganizacaoConflitanteError extends Error {}
export class OrganizacaoComVinculosError extends Error {
  constructor(public readonly lotes: number, public readonly contratos: number) { super(); }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
