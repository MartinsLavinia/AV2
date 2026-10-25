import { Prisma } from "../generated/prisma/client.js";
import {
  ContratoNaoEncontradoRepositoryError,
  ContratoRepository,
  VersaoContratoConflitanteRepositoryError,
} from "../repositories/ContratoRepository.js";

export type DadosNovoContrato = {
  organizacaoId: string;
  dataVencimento: string;
  valorMensal: number;
  renovacaoAutomatica?: boolean;
  clausulas?: string[];
};
export type DadosEdicaoContrato = {
  dataVencimento?: string; valorMensal?: number; renovacaoAutomatica?: boolean; clausulas?: string[]; versao: number;
};

export class ContratoService {
  constructor(private readonly contratos = new ContratoRepository()) {}

  listar() {
    return this.contratos.listar();
  }

  async obter(id: string) {
    if (!UUID.test(id)) throw new ErroValidacaoContrato("Identificador do contrato inválido.");
    const contrato = await this.contratos.buscarPorId(id);
    if (!contrato) throw new ContratoNaoEncontradoError();
    return contrato;
  }

  async criar(dados: DadosNovoContrato) {
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new ErroValidacaoContrato("O corpo da requisição deve ser um objeto JSON.");
    }
    if (typeof dados.organizacaoId !== "string" || !UUID.test(dados.organizacaoId)) {
      throw new ErroValidacaoContrato("Identificador da organização inválido.");
    }
    if (typeof dados.dataVencimento !== "string" || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(dados.dataVencimento)) {
      throw new ErroValidacaoContrato("Data de vencimento inválida. Informe uma data ISO, por exemplo 2027-10-22.");
    }
    const dataVencimento = new Date(dados.dataVencimento);
    if (Number.isNaN(dataVencimento.getTime())) {
      throw new ErroValidacaoContrato("Data de vencimento inválida.");
    }
    const dataCalendario = dados.dataVencimento.slice(0, 10);
    const [ano, mes, dia] = dataCalendario.split("-").map(Number);
    if (new Date(Date.UTC(ano!, mes! - 1, dia!)).toISOString().slice(0, 10) !== dataCalendario) {
      throw new ErroValidacaoContrato("Data de vencimento inválida.");
    }
    if (dataVencimento <= new Date()) {
      throw new ErroValidacaoContrato("A data de vencimento deve ser futura.");
    }
    if (typeof dados.valorMensal !== "number" || !Number.isFinite(dados.valorMensal) || dados.valorMensal < 0) {
      throw new ErroValidacaoContrato("O valor mensal deve ser um número maior ou igual a zero.");
    }
    const renovacaoAutomatica = dados.renovacaoAutomatica ?? false;
    if (typeof renovacaoAutomatica !== "boolean") {
      throw new ErroValidacaoContrato("Renovação automática deve ser true ou false.");
    }
    const clausulas = dados.clausulas ?? [];
    if (!Array.isArray(clausulas) || clausulas.some((clausula) => typeof clausula !== "string" || !clausula.trim())) {
      throw new ErroValidacaoContrato("Cláusulas devem ser uma lista de textos não vazios.");
    }
    const organizacao = await this.contratos.organizacaoExiste(dados.organizacaoId);
    if (!organizacao) {
      throw new OrganizacaoDoContratoNaoEncontradaError();
    }
    if (!organizacao.ativo) throw new OrganizacaoDoContratoInativaError();
    if (await this.contratos.buscarDaOrganizacao(dados.organizacaoId)) {
      throw new ContratoDaOrganizacaoJaExisteError();
    }

    try {
      return await this.contratos.criar({
        organizacaoId: dados.organizacaoId,
        dataVencimento,
        valorMensal: dados.valorMensal,
        renovacaoAutomatica,
        clausulas: clausulas.map((clausula) => clausula.trim()),
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw new ContratoDaOrganizacaoJaExisteError();
      }
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2003") {
        throw new OrganizacaoDoContratoNaoEncontradaError();
      }
      throw erro;
    }
  }

  async editar(id: string, dados: DadosEdicaoContrato) {
    if (!UUID.test(id)) throw new ErroValidacaoContrato("Identificador do contrato inválido.");
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new ErroValidacaoContrato("O corpo da requisição deve ser um objeto JSON.");
    this.validarVersao(dados.versao);
    const { versao, ...campos } = dados;
    if (Object.keys(campos).length === 0) throw new ErroValidacaoContrato("Informe ao menos um campo para alterar.");
    const alteracoes: { dataVencimento?: Date; valorMensal?: number; renovacaoAutomatica?: boolean; clausulas?: string[] } = {};
    if (campos.dataVencimento !== undefined) alteracoes.dataVencimento = this.validarDataVencimento(campos.dataVencimento);
    if (campos.valorMensal !== undefined) {
      if (typeof campos.valorMensal !== "number" || !Number.isFinite(campos.valorMensal) || campos.valorMensal < 0) throw new ErroValidacaoContrato("O valor mensal deve ser um número maior ou igual a zero.");
      alteracoes.valorMensal = campos.valorMensal;
    }
    if (campos.renovacaoAutomatica !== undefined) {
      if (typeof campos.renovacaoAutomatica !== "boolean") throw new ErroValidacaoContrato("Renovação automática deve ser true ou false.");
      alteracoes.renovacaoAutomatica = campos.renovacaoAutomatica;
    }
    if (campos.clausulas !== undefined) {
      if (!Array.isArray(campos.clausulas) || campos.clausulas.some((clausula) => typeof clausula !== "string" || !clausula.trim())) throw new ErroValidacaoContrato("Cláusulas devem ser uma lista de textos não vazios.");
      alteracoes.clausulas = campos.clausulas.map((clausula) => clausula.trim());
    }
    try {
      return await this.contratos.editar(id, versao, alteracoes);
    } catch (erro) {
      if (erro instanceof ContratoNaoEncontradoRepositoryError) throw new ContratoNaoEncontradoError();
      if (erro instanceof VersaoContratoConflitanteRepositoryError) throw new VersaoContratoConflitanteError();
      throw erro;
    }
  }

  async excluir(id: string, versaoInformada: unknown) {
    if (!UUID.test(id)) throw new ErroValidacaoContrato("Identificador do contrato inválido.");
    const versao = this.validarVersao(versaoInformada);
    try { await this.contratos.excluir(id, versao); }
    catch (erro) {
      if (erro instanceof ContratoNaoEncontradoRepositoryError) throw new ContratoNaoEncontradoError();
      if (erro instanceof VersaoContratoConflitanteRepositoryError) throw new VersaoContratoConflitanteError();
      throw erro;
    }
  }

  private validarVersao(valor: unknown): number {
    if (!Number.isInteger(valor) || (valor as number) < 1) throw new ErroValidacaoContrato("Informe a versão atual do contrato como inteiro positivo.");
    return valor as number;
  }

  private validarDataVencimento(valor: unknown): Date {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(valor)) throw new ErroValidacaoContrato("Data de vencimento inválida. Informe uma data ISO.");
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) throw new ErroValidacaoContrato("Data de vencimento inválida.");
    const dia = valor.slice(0, 10);
    const [ano, mes, diaMes] = dia.split("-").map(Number);
    if (new Date(Date.UTC(ano!, mes! - 1, diaMes!)).toISOString().slice(0, 10) !== dia) throw new ErroValidacaoContrato("Data de vencimento inválida.");
    if (data <= new Date()) throw new ErroValidacaoContrato("A data de vencimento deve ser futura.");
    return data;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ErroValidacaoContrato extends Error {}
export class OrganizacaoDoContratoNaoEncontradaError extends Error {}
export class OrganizacaoDoContratoInativaError extends Error {}
export class ContratoDaOrganizacaoJaExisteError extends Error {}
export class ContratoNaoEncontradoError extends Error {}
export class VersaoContratoConflitanteError extends Error {}
