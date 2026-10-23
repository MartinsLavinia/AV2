import type { FastifyReply, FastifyRequest } from "fastify";
import { ConfiguracaoService, ErroValidacaoConfiguracao, type AlteracoesConfiguracao } from "../services/ConfiguracaoService.js";

export class ConfiguracaoController {
  constructor(private readonly configuracoes = new ConfiguracaoService()) {}

  obter = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.code(200).send(await this.configuracoes.obter());
    } catch (erro) {
      console.error("Erro ao consultar configurações:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível consultar as configurações." });
    }
  };

  atualizar = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.code(200).send(await this.configuracoes.atualizar(request.body as AlteracoesConfiguracao));
    } catch (erro) {
      if (erro instanceof ErroValidacaoConfiguracao) return reply.code(400).send({ mensagem: erro.message });
      console.error("Erro ao atualizar configurações:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível atualizar as configurações." });
    }
  };
}
