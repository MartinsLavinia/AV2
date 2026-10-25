import { Prisma } from "../generated/prisma/client.js";
import {
  LoteComEquipamentosRepositoryError,
  LoteNaoEncontradoRepositoryError,
  LoteRepository,
  VersaoLoteConflitanteRepositoryError,
} from "../repositories/LoteRepository.js";

export type DadosNovoLote = {
  organizacaoId: string;
  notaFiscal: string;
  transportadora: string;
  dataEntrada?: string;
  observacoes?: string;
};
export type DadosEdicaoLote = { notaFiscal?: string; transportadora?: string; dataEntrada?: string; observacoes?: string; versao: number };

export class LoteService {
  constructor(private readonly lotes = new LoteRepository()) {}

  listar() { return this.lotes.listar(); }

  async obter(id: string) {
    if (!UUID.test(id)) throw new ErroValidacaoLote("Identificador do lote inválido.");
    const lote = await this.lotes.buscarPorId(id);
    if (!lote) throw new LoteNaoEncontradoError();
    return lote;
  }

  async criar(dados: DadosNovoLote) {
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new ErroValidacaoLote("O corpo da requisição deve ser um objeto JSON.");
    }
    const organizacaoId = this.textoObrigatorio(dados.organizacaoId, "Organização");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizacaoId)) {
      throw new ErroValidacaoLote("Identificador da organização inválido.");
    }
    const notaFiscal = this.textoObrigatorio(dados.notaFiscal, "Nota fiscal");
    const transportadora = this.textoObrigatorio(dados.transportadora, "Transportadora");
    const observacoes = dados.observacoes === undefined ? "" : dados.observacoes;
    if (typeof observacoes !== "string") throw new ErroValidacaoLote("Observações devem ser um texto.");
    const organizacao = await this.lotes.organizacaoExiste(organizacaoId);
    if (!organizacao) throw new OrganizacaoDoLoteNaoEncontradaError();
    if (!organizacao.ativo) throw new OrganizacaoDoLoteInativaError();

    const dataEntrada = dados.dataEntrada === undefined ? undefined : this.validarDataEntrada(dados.dataEntrada);

    try {
      return await this.lotes.criar({ organizacaoId, notaFiscal, transportadora, dataEntrada, observacoes: observacoes.trim() });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2003") {
        throw new OrganizacaoDoLoteNaoEncontradaError();
      }
      throw erro;
    }
  }

  async editar(id: string, dados: DadosEdicaoLote) {
    if (!UUID.test(id)) throw new ErroValidacaoLote("Identificador do lote inválido.");
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new ErroValidacaoLote("O corpo da requisição deve ser um objeto JSON.");
    this.validarVersao(dados.versao);
    const { versao, ...campos } = dados;
    if (Object.keys(campos).length === 0) throw new ErroValidacaoLote("Informe ao menos um campo para alterar.");
    const alteracoes: { notaFiscal?: string; transportadora?: string; dataEntrada?: Date; observacoes?: string } = {};
    if (campos.notaFiscal !== undefined) alteracoes.notaFiscal = this.textoObrigatorio(campos.notaFiscal, "Nota fiscal");
    if (campos.transportadora !== undefined) alteracoes.transportadora = this.textoObrigatorio(campos.transportadora, "Transportadora");
    if (campos.dataEntrada !== undefined) alteracoes.dataEntrada = this.validarDataEntrada(campos.dataEntrada);
    if (campos.observacoes !== undefined) {
      if (typeof campos.observacoes !== "string") throw new ErroValidacaoLote("Observações devem ser um texto.");
      alteracoes.observacoes = campos.observacoes.trim();
    }
    try { return await this.lotes.editar(id, versao, alteracoes); }
    catch (erro) {
      if (erro instanceof LoteNaoEncontradoRepositoryError) throw new LoteNaoEncontradoError();
      if (erro instanceof VersaoLoteConflitanteRepositoryError) throw new VersaoLoteConflitanteError();
      throw erro;
    }
  }

  async excluir(id: string, versaoInformada: unknown) {
    if (!UUID.test(id)) throw new ErroValidacaoLote("Identificador do lote inválido.");
    const versao = this.validarVersao(versaoInformada);
    try { await this.lotes.excluir(id, versao); }
    catch (erro) {
      if (erro instanceof LoteNaoEncontradoRepositoryError) throw new LoteNaoEncontradoError();
      if (erro instanceof VersaoLoteConflitanteRepositoryError) throw new VersaoLoteConflitanteError();
      if (erro instanceof LoteComEquipamentosRepositoryError) throw new LoteComEquipamentosError(erro.quantidade);
      throw erro;
    }
  }

  private validarDataEntrada(valor: unknown): Date {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(valor)) throw new ErroValidacaoLote("Data de entrada inválida. Use uma data ISO, por exemplo 2026-10-20.");
    const dataCalendario = valor.slice(0, 10);
    const [ano, mes, dia] = dataCalendario.split("-").map(Number);
    if (new Date(Date.UTC(ano!, mes! - 1, dia!)).toISOString().slice(0, 10) !== dataCalendario) throw new ErroValidacaoLote("Data de entrada inválida.");
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) throw new ErroValidacaoLote("Data de entrada inválida.");
    const agora = new Date();
    const limite = new Date(agora);
    limite.setDate(limite.getDate() - 90);
    if (data > agora || data < limite) throw new ErroValidacaoLote("A data de entrada deve estar entre hoje e os últimos 90 dias.");
    return data;
  }

  private validarVersao(valor: unknown): number {
    if (!Number.isInteger(valor) || (valor as number) < 1) throw new ErroValidacaoLote("Informe a versão atual do lote como inteiro positivo.");
    return valor as number;
  }

  private textoObrigatorio(valor: unknown, campo: string): string {
    if (typeof valor !== "string" || !valor.trim()) throw new ErroValidacaoLote(`${campo} é obrigatório.`);
    return valor.trim();
  }
}

export class ErroValidacaoLote extends Error {}
export class OrganizacaoDoLoteNaoEncontradaError extends Error {}
export class OrganizacaoDoLoteInativaError extends Error {}
export class LoteNaoEncontradoError extends Error {}
export class VersaoLoteConflitanteError extends Error {}
export class LoteComEquipamentosError extends Error {
  constructor(public readonly quantidade: number) { super(); }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
