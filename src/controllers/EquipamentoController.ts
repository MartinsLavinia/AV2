import type { FastifyReply, FastifyRequest } from "fastify";
import {
  DesmonteAntesDaTriagemCompletaError,
  EquipamentoNaoEncontradoError,
  ConflitoCadastroEquipamentoError,
  EquipamentoService,
  ErroValidacaoEquipamento,
  JustificativaEstadoFisicoObrigatoriaError,
  LoteDoEquipamentoNaoEncontradoError,
  TransicaoTriagemInvalidaError,
  TransicaoStatusRastreamentoInvalidaError,
  VersaoEquipamentoConflitanteError,
  type DadosAcaoTriagem,
  type DadosAlteracaoEstadoFisico,
  type DadosMovimentacaoEquipamento,
  type DadosNovoEquipamento,
} from "../services/EquipamentoService.js";

export class EquipamentoController {
  constructor(private readonly equipamentos = new EquipamentoService()) {}

  listar = async (_request: FastifyRequest, reply: FastifyReply) => {
    try { return reply.code(200).send(await this.equipamentos.listar()); }
    catch (erro) { console.error("Erro ao listar equipamentos:", erro); return reply.code(500).send({ mensagem: "Não foi possível listar os equipamentos." }); }
  };

  criar = async (request: FastifyRequest, reply: FastifyReply) => {
    try { return reply.code(201).send(await this.equipamentos.criar(request.body as DadosNovoEquipamento)); }
    catch (erro) {
      if (erro instanceof ErroValidacaoEquipamento) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof LoteDoEquipamentoNaoEncontradoError) return reply.code(404).send({ mensagem: "Lote não encontrado." });
      if (erro instanceof ConflitoCadastroEquipamentoError) return reply.code(409).send({ mensagem: "Conflito ao gerar código ou posição do equipamento. Tente novamente." });
      console.error("Erro ao criar equipamento:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível cadastrar o equipamento." });
    }
  };

  iniciarTriagem = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { identificador } = request.params as { identificador: string };
      const equipamento = await this.equipamentos.iniciarTriagem(
        identificador,
        request.body as DadosAcaoTriagem,
      );
      return reply.code(200).send({ mensagem: "Triagem iniciada.", equipamento });
    } catch (erro) {
      return responderErroOperacao(reply, erro, "iniciar a triagem");
    }
  };

  concluirTriagem = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { identificador } = request.params as { identificador: string };
      const equipamento = await this.equipamentos.concluirTriagem(
        identificador,
        request.body as DadosAcaoTriagem,
      );
      return reply.code(200).send({ mensagem: "Triagem concluída.", equipamento });
    } catch (erro) {
      return responderErroOperacao(reply, erro, "concluir a triagem");
    }
  };

  movimentar = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { identificador } = request.params as { identificador: string };
      const resultado = await this.equipamentos.movimentar(
        identificador,
        request.body as DadosMovimentacaoEquipamento,
        request.user.email,
      );
      return reply.code(201).send({ mensagem: "Movimentação registrada.", ...resultado });
    } catch (erro) {
      return responderErroOperacao(reply, erro, "registrar a movimentação");
    }
  };

  alterarEstadoFisico = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { identificador } = request.params as { identificador: string };
      const equipamento = await this.equipamentos.alterarEstadoFisico(
        identificador,
        request.body as DadosAlteracaoEstadoFisico,
      );
      return reply.code(200).send({ mensagem: "Estado físico atualizado.", equipamento });
    } catch (erro) {
      return responderErroOperacao(reply, erro, "alterar o estado físico");
    }
  };
}

function responderErroOperacao(reply: FastifyReply, erro: unknown, operacao: string) {
  if (erro instanceof ErroValidacaoEquipamento) return reply.code(400).send({ mensagem: erro.message });
  if (erro instanceof JustificativaEstadoFisicoObrigatoriaError) {
    return reply.code(400).send({ mensagem: "Informe uma justificativa ao piorar o estado físico em duas ou mais categorias." });
  }
  if (erro instanceof EquipamentoNaoEncontradoError) return reply.code(404).send({ mensagem: "Equipamento não encontrado." });
  if (erro instanceof VersaoEquipamentoConflitanteError) {
    return reply.code(409).send({ mensagem: "O equipamento foi alterado por outra operação. Consulte-o novamente e tente com a versão atual." });
  }
  if (erro instanceof TransicaoTriagemInvalidaError) return reply.code(409).send({ mensagem: erro.message });
  if (erro instanceof TransicaoStatusRastreamentoInvalidaError) return reply.code(409).send({ mensagem: erro.message });
  if (erro instanceof DesmonteAntesDaTriagemCompletaError) {
    return reply.code(409).send({ mensagem: "O equipamento só pode ir para desmonte após a triagem completa." });
  }
  console.error(`Erro ao ${operacao}:`, erro);
  return reply.code(500).send({ mensagem: `Não foi possível ${operacao}.` });
}
