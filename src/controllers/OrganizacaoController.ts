
import type { FastifyReply, FastifyRequest } from "fastify";
import { OrganizacaoService } from "../services/OrganizacaoService.js";

export class OrganizacaoController {
  constructor(
    private readonly organizacaoService: OrganizacaoService =
      new OrganizacaoService()
  ) {}

  listarTodas = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const organizacoes =
        await this.organizacaoService.listarTodas();

      return reply.code(200).send(organizacoes);
    } catch (erro) {
      requestLog(erro);
      return reply.code(500).send({
        mensagem: "Erro ao listar organizações.",
      });
    }
  };
}

function requestLog(erro: unknown): void {
  console.error("Erro no OrganizacaoController:", erro);
}
