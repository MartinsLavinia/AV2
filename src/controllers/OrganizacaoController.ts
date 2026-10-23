import type { FastifyReply, FastifyRequest } from "fastify";
import {
  CnpjOrganizacaoDuplicadoError,
  ErroValidacaoOrganizacao,
  OrganizacaoService,
  type DadosNovaOrganizacao,
} from "../services/OrganizacaoService.js";

export class OrganizacaoController {
  constructor(
    private readonly organizacaoService: OrganizacaoService = new OrganizacaoService(),
  ) {}

  listarTodas = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.code(200).send(await this.organizacaoService.listarTodas());
    } catch (erro) {
      requestLog(erro);
      return reply.code(500).send({ mensagem: "Não foi possível listar as organizações." });
    }
  };

  criar = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const organizacao = await this.organizacaoService.criar(
        request.body as DadosNovaOrganizacao,
      );
      return reply.code(201).send(organizacao);
    } catch (erro) {
      if (erro instanceof ErroValidacaoOrganizacao) {
        return reply.code(400).send({ mensagem: erro.message });
      }
      if (erro instanceof CnpjOrganizacaoDuplicadoError) {
        return reply.code(409).send({ mensagem: "Já existe uma organização cadastrada com esse CNPJ." });
      }
      requestLog(erro);
      return reply.code(500).send({ mensagem: "Não foi possível cadastrar a organização." });
    }
  };
}

function requestLog(erro: unknown): void {
  console.error("Erro no OrganizacaoController:", erro);
}
