import type { FastifyReply, FastifyRequest } from "fastify";
import {
  AuditoriaService,
  EquipamentoRastreadoNaoEncontradoError,
  ErroValidacaoAuditoria,
} from "../services/AuditoriaService.js";

export class AuditoriaController {
  constructor(private readonly auditoria = new AuditoriaService()) {}

  rastrearEquipamento = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { identificador } = request.params as { identificador: string };
      return reply.code(200).send(await this.auditoria.rastrearEquipamento(identificador));
    } catch (erro) {
      if (erro instanceof ErroValidacaoAuditoria) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof EquipamentoRastreadoNaoEncontradoError) return reply.code(404).send({ mensagem: "Equipamento não encontrado." });
      request.log.error(erro);
      return reply.code(500).send({ mensagem: "Não foi possível rastrear o equipamento." });
    }
  };

  listarHistorico = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.code(200).send(await this.auditoria.listarHistorico(request.query as Record<string, unknown>));
    } catch (erro) {
      if (erro instanceof ErroValidacaoAuditoria) return reply.code(400).send({ mensagem: erro.message });
      request.log.error(erro);
      return reply.code(500).send({ mensagem: "Não foi possível consultar o histórico de movimentações." });
    }
  };

  gerarRelatorio = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.code(200).send(await this.auditoria.gerarRelatorio());
    } catch (erro) {
      request.log.error(erro);
      return reply.code(500).send({ mensagem: "Não foi possível gerar o relatório." });
    }
  };
}
