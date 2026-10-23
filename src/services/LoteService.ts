import { Prisma } from "../generated/prisma/client.js";
import { LoteRepository } from "../repositories/LoteRepository.js";

export type DadosNovoLote = {
  organizacaoId: string;
  notaFiscal: string;
  transportadora: string;
  dataEntrada?: string;
  observacoes?: string;
};

export class LoteService {
  constructor(private readonly lotes = new LoteRepository()) {}

  listar() { return this.lotes.listar(); }

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
    if (!(await this.lotes.organizacaoExiste(organizacaoId))) throw new OrganizacaoDoLoteNaoEncontradaError();

    let dataEntrada: Date | undefined;
    if (dados.dataEntrada !== undefined) {
      if (typeof dados.dataEntrada !== "string" || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(dados.dataEntrada)) {
        throw new ErroValidacaoLote("Data de entrada inválida. Use uma data ISO, por exemplo 2026-10-20.");
      }
      const dataCalendario = dados.dataEntrada.slice(0, 10);
      const [ano, mes, dia] = dataCalendario.split("-").map(Number);
      const dataNormalizada = new Date(Date.UTC(ano!, mes! - 1, dia!)).toISOString().slice(0, 10);
      if (dataNormalizada !== dataCalendario) throw new ErroValidacaoLote("Data de entrada inválida.");
      dataEntrada = new Date(dados.dataEntrada);
      if (Number.isNaN(dataEntrada.getTime())) throw new ErroValidacaoLote("Data de entrada inválida.");
      const agora = new Date();
      const limite = new Date(agora);
      limite.setDate(limite.getDate() - 90);
      if (dataEntrada > agora || dataEntrada < limite) {
        throw new ErroValidacaoLote("A data de entrada deve estar entre hoje e os últimos 90 dias.");
      }
    }

    try {
      return await this.lotes.criar({ organizacaoId, notaFiscal, transportadora, dataEntrada, observacoes: observacoes.trim() });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2003") {
        throw new OrganizacaoDoLoteNaoEncontradaError();
      }
      throw erro;
    }
  }

  private textoObrigatorio(valor: unknown, campo: string): string {
    if (typeof valor !== "string" || !valor.trim()) throw new ErroValidacaoLote(`${campo} é obrigatório.`);
    return valor.trim();
  }
}

export class ErroValidacaoLote extends Error {}
export class OrganizacaoDoLoteNaoEncontradaError extends Error {}
