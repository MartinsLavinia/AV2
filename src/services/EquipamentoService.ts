import { randomUUID } from "node:crypto";
import { EstadoFisico, StatusRastreamento, TipoEquipamento } from "../generated/prisma/enums.js";
import {
  EquipamentoNaoEncontradoError,
  EquipamentoComMovimentacoesError,
  EquipamentoRepository,
  ehConflitoUnico,
  VersaoEquipamentoConflitanteError,
} from "../repositories/EquipamentoRepository.js";

export type DadosNovoEquipamento = {
  loteId: string;
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  pesoQuilogramas: number;
};

export type DadosAcaoTriagem = { versao: number };
export type DadosMovimentacaoEquipamento = {
  destino: string;
  observacao?: string;
  versao: number;
};
export type DadosAlteracaoEstadoFisico = {
  estadoFisico: EstadoFisico;
  justificativa?: string;
  versao: number;
};
export type DadosEdicaoEquipamento = {
  tipo?: TipoEquipamento; marca?: string; modelo?: string; anoFabricacao?: number; pesoQuilogramas?: number; versao: number;
};

export class EquipamentoService {
  constructor(private readonly equipamentos = new EquipamentoRepository()) {}

  listar() { return this.equipamentos.listar(); }

  async obter(identificador: string) {
    if (typeof identificador !== "string" || !identificador.trim()) throw new ErroValidacaoEquipamento("ID ou código de barras é obrigatório.");
    const equipamento = await this.equipamentos.buscarPorIdentificador(identificador.trim());
    if (!equipamento) throw new EquipamentoNaoEncontradoError();
    return equipamento;
  }

  async editar(identificador: string, dados: DadosEdicaoEquipamento) {
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new ErroValidacaoEquipamento("O corpo da requisição deve ser um objeto JSON.");
    const atual = await this.obterParaAtualizar(identificador, dados.versao);
    const { versao, ...campos } = dados;
    if (Object.keys(campos).length === 0) throw new ErroValidacaoEquipamento("Informe ao menos um campo para alterar.");
    const alteracoes: { tipo?: TipoEquipamento; marca?: string; modelo?: string; anoFabricacao?: number; pesoQuilogramas?: number } = {};
    if (campos.tipo !== undefined) {
      if (!Object.values(TipoEquipamento).includes(campos.tipo)) throw new ErroValidacaoEquipamento("Tipo de equipamento inválido.");
      alteracoes.tipo = campos.tipo;
    }
    if (campos.marca !== undefined) alteracoes.marca = this.obrigatorio(campos.marca, "Marca");
    if (campos.modelo !== undefined) alteracoes.modelo = this.obrigatorio(campos.modelo, "Modelo");
    if (campos.anoFabricacao !== undefined) {
      const anoAtual = new Date().getFullYear();
      if (!Number.isInteger(campos.anoFabricacao) || campos.anoFabricacao < 1970 || campos.anoFabricacao > anoAtual) throw new ErroValidacaoEquipamento(`Ano de fabricação deve ser um número inteiro entre 1970 e ${anoAtual}.`);
      alteracoes.anoFabricacao = campos.anoFabricacao;
    }
    if (campos.pesoQuilogramas !== undefined) {
      if (typeof campos.pesoQuilogramas !== "number" || !Number.isFinite(campos.pesoQuilogramas) || campos.pesoQuilogramas <= 0) throw new ErroValidacaoEquipamento("Peso deve ser um número maior que zero.");
      alteracoes.pesoQuilogramas = campos.pesoQuilogramas;
    }
    return this.equipamentos.editar(atual.id, versao, alteracoes);
  }

  async excluir(identificador: string, versaoInformada: unknown) {
    if (typeof identificador !== "string" || !identificador.trim()) throw new ErroValidacaoEquipamento("ID ou código de barras é obrigatório.");
    const atual = await this.obterParaAtualizar(identificador, versaoInformada);
    try { await this.equipamentos.excluir(atual.id, atual.versao); }
    catch (erro) {
      if (erro instanceof EquipamentoComMovimentacoesError) throw new EquipamentoComMovimentacoesError(erro.quantidade);
      throw erro;
    }
  }

  async criar(dados: DadosNovoEquipamento) {
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new ErroValidacaoEquipamento("O corpo da requisição deve ser um objeto JSON.");
    }
    const loteId = this.obrigatorio(dados.loteId, "Lote");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(loteId)) {
      throw new ErroValidacaoEquipamento("Identificador do lote inválido.");
    }
    const marca = this.obrigatorio(dados.marca, "Marca");
    const modelo = this.obrigatorio(dados.modelo, "Modelo");
    if (!Object.values(TipoEquipamento).includes(dados.tipo)) {
      throw new ErroValidacaoEquipamento("Tipo de equipamento inválido.");
    }
    const anoAtual = new Date().getFullYear();
    if (!Number.isInteger(dados.anoFabricacao) || dados.anoFabricacao < 1970 || dados.anoFabricacao > anoAtual) {
      throw new ErroValidacaoEquipamento(`Ano de fabricação deve ser um número inteiro entre 1970 e ${anoAtual}.`);
    }
    if (typeof dados.pesoQuilogramas !== "number" || !Number.isFinite(dados.pesoQuilogramas) || dados.pesoQuilogramas <= 0) {
      throw new ErroValidacaoEquipamento("Peso deve ser um número maior que zero.");
    }
    if (!(await this.equipamentos.loteExiste(loteId))) throw new LoteDoEquipamentoNaoEncontradoError();

    try {
      return await this.equipamentos.criar({
        codigoBarrasInterno: `GC-${randomUUID().toUpperCase()}`,
        tipo: dados.tipo,
        marca,
        modelo,
        anoFabricacao: dados.anoFabricacao,
        estadoFisico: EstadoFisico.USADO_LEVE,
        pesoQuilogramas: dados.pesoQuilogramas,
        loteId,
      });
    } catch (erro) {
      if (ehConflitoUnico(erro)) throw new ConflitoCadastroEquipamentoError();
      throw erro;
    }
  }

  async iniciarTriagem(identificador: string, dados: DadosAcaoTriagem) {
    const atual = await this.obterParaAtualizar(identificador, dados?.versao);
    if (atual.statusRastreamento !== StatusRastreamento.AGUARDANDO_TRIAGEM) {
      throw new TransicaoTriagemInvalidaError("Só é possível iniciar a triagem de um equipamento que aguarda triagem.");
    }
    return this.equipamentos.atualizarStatus(
      atual.id,
      dados.versao,
      atual.statusRastreamento,
      StatusRastreamento.EM_TRIAGEM,
    );
  }

  async concluirTriagem(identificador: string, dados: DadosAcaoTriagem) {
    const atual = await this.obterParaAtualizar(identificador, dados?.versao);
    if (atual.statusRastreamento !== StatusRastreamento.EM_TRIAGEM) {
      throw new TransicaoTriagemInvalidaError("Só é possível concluir uma triagem que está em andamento.");
    }
    return this.equipamentos.atualizarStatus(
      atual.id,
      dados.versao,
      atual.statusRastreamento,
      StatusRastreamento.AGUARDANDO_DESMONTE,
    );
  }

  async movimentar(
    identificador: string,
    dados: DadosMovimentacaoEquipamento,
    responsavel: string,
  ) {
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new ErroValidacaoEquipamento("O corpo da requisição deve ser um objeto JSON.");
    }
    const versao = this.validarVersao(dados.versao);
    const destino = this.obrigatorio(dados.destino, "Destino");
    if (destino.length > 200) throw new ErroValidacaoEquipamento("Destino deve ter no máximo 200 caracteres.");
    const observacao = dados.observacao ?? "";
    if (typeof observacao !== "string") throw new ErroValidacaoEquipamento("Observação deve ser um texto.");
    if (observacao.length > 2000) throw new ErroValidacaoEquipamento("Observação deve ter no máximo 2000 caracteres.");
    if (typeof responsavel !== "string" || !responsavel.trim()) {
      throw new ErroValidacaoEquipamento("Não foi possível identificar o responsável pela movimentação.");
    }

    const atual = await this.obterParaAtualizar(identificador, versao);
    const statusDestino = Object.values(StatusRastreamento).includes(destino as StatusRastreamento)
      ? destino as StatusRastreamento
      : null;
    if (statusDestino) {
      this.validarTransicaoStatus(atual.statusRastreamento, statusDestino);
    }

    return this.equipamentos.movimentar(
      atual.id,
      versao,
      atual.statusRastreamento,
      statusDestino,
      responsavel.trim(),
      observacao.trim(),
      destino,
    );
  }

  async alterarEstadoFisico(
    identificador: string,
    dados: DadosAlteracaoEstadoFisico,
  ) {
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new ErroValidacaoEquipamento("O corpo da requisição deve ser um objeto JSON.");
    }
    const versao = this.validarVersao(dados.versao);
    if (!Object.values(EstadoFisico).includes(dados.estadoFisico)) {
      throw new ErroValidacaoEquipamento("Estado físico inválido.");
    }
    const justificativa = dados.justificativa ?? "";
    if (typeof justificativa !== "string") throw new ErroValidacaoEquipamento("Justificativa deve ser um texto.");

    const atual = await this.obterParaAtualizar(identificador, versao);
    const estados = Object.values(EstadoFisico);
    const anterior = estados.indexOf(atual.estadoFisico);
    const novo = estados.indexOf(dados.estadoFisico);
    if (novo - anterior >= 2 && !justificativa.trim()) {
      throw new JustificativaEstadoFisicoObrigatoriaError();
    }

    return this.equipamentos.atualizarEstadoFisico(
      atual.id,
      versao,
      atual.estadoFisico,
      dados.estadoFisico,
    );
  }

  private async obterParaAtualizar(identificador: string, versaoInformada: unknown) {
    if (typeof identificador !== "string" || !identificador.trim()) {
      throw new ErroValidacaoEquipamento("ID ou código de barras é obrigatório.");
    }
    const versao = this.validarVersao(versaoInformada);
    const equipamento = await this.equipamentos.buscarPorIdentificador(identificador.trim());
    if (!equipamento) throw new EquipamentoNaoEncontradoError();
    if (equipamento.versao !== versao) throw new VersaoEquipamentoConflitanteError();
    return equipamento;
  }

  private validarVersao(valor: unknown): number {
    if (!Number.isInteger(valor) || (valor as number) < 1) {
      throw new ErroValidacaoEquipamento("Informe a versão atual do equipamento como um inteiro positivo.");
    }
    return valor as number;
  }

  private validarTransicaoStatus(atual: StatusRastreamento, destino: StatusRastreamento) {
    if (destino === StatusRastreamento.EM_DESMONTE && atual !== StatusRastreamento.AGUARDANDO_DESMONTE) {
      throw new DesmonteAntesDaTriagemCompletaError();
    }
    if (!TRANSICOES_STATUS[atual].includes(destino)) {
      throw new TransicaoStatusRastreamentoInvalidaError(
        `Não é permitido mudar o status de ${atual} para ${destino}.`,
      );
    }
  }

  private obrigatorio(valor: unknown, campo: string): string {
    if (typeof valor !== "string" || !valor.trim()) throw new ErroValidacaoEquipamento(`${campo} é obrigatório.`);
    return valor.trim();
  }
}

export class ErroValidacaoEquipamento extends Error {}
export class LoteDoEquipamentoNaoEncontradoError extends Error {}
export class ConflitoCadastroEquipamentoError extends Error {}
export class TransicaoTriagemInvalidaError extends Error {}
export class DesmonteAntesDaTriagemCompletaError extends Error {}
export class TransicaoStatusRastreamentoInvalidaError extends Error {}
export class JustificativaEstadoFisicoObrigatoriaError extends Error {}
export { EquipamentoNaoEncontradoError, EquipamentoComMovimentacoesError, VersaoEquipamentoConflitanteError };

const TRANSICOES_STATUS: Record<StatusRastreamento, StatusRastreamento[]> = {
  [StatusRastreamento.AGUARDANDO_TRIAGEM]: [],
  [StatusRastreamento.EM_TRIAGEM]: [],
  [StatusRastreamento.AGUARDANDO_DESMONTE]: [StatusRastreamento.EM_DESMONTE],
  [StatusRastreamento.EM_DESMONTE]: [
    StatusRastreamento.PECAS_REAPROVEITADAS,
    StatusRastreamento.MATERIAL_RECICLAVEL,
    StatusRastreamento.DESCARTE_SEGURO,
    StatusRastreamento.BAIXA_DEFINITIVA,
  ],
  [StatusRastreamento.PECAS_REAPROVEITADAS]: [StatusRastreamento.BAIXA_DEFINITIVA],
  [StatusRastreamento.MATERIAL_RECICLAVEL]: [StatusRastreamento.BAIXA_DEFINITIVA],
  [StatusRastreamento.DESCARTE_SEGURO]: [StatusRastreamento.BAIXA_DEFINITIVA],
  [StatusRastreamento.BAIXA_DEFINITIVA]: [],
};
