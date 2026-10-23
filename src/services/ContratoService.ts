import { Prisma } from "../generated/prisma/client.js";
import { ContratoRepository } from "../repositories/ContratoRepository.js";

export type DadosNovoContrato = {
  organizacaoId: string;
  dataVencimento: string;
  valorMensal: number;
  renovacaoAutomatica?: boolean;
  clausulas?: string[];
};

export class ContratoService {
  constructor(private readonly contratos = new ContratoRepository()) {}

  listar() {
    return this.contratos.listar();
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
    if (!(await this.contratos.organizacaoExiste(dados.organizacaoId))) {
      throw new OrganizacaoDoContratoNaoEncontradaError();
    }
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
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ErroValidacaoContrato extends Error {}
export class OrganizacaoDoContratoNaoEncontradaError extends Error {}
export class ContratoDaOrganizacaoJaExisteError extends Error {}
