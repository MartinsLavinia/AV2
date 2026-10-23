import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ContratoDaOrganizacaoJaExisteError,
  ContratoService,
  ErroValidacaoContrato,
  OrganizacaoDoContratoNaoEncontradaError,
  type DadosNovoContrato,
} from "../services/ContratoService.js";

export class ContratoController {
  constructor(private readonly contratos = new ContratoService()) {}

  listar = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.code(200).send(await this.contratos.listar());
    } catch (erro) {
      console.error("Erro ao listar contratos:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível listar os contratos." });
    }
  };

  criar = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.code(201).send(await this.contratos.criar(request.body as DadosNovoContrato));
    } catch (erro) {
      if (erro instanceof ErroValidacaoContrato) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof OrganizacaoDoContratoNaoEncontradaError) return reply.code(404).send({ mensagem: "Organização não encontrada." });
      if (erro instanceof ContratoDaOrganizacaoJaExisteError) return reply.code(409).send({ mensagem: "Essa organização já possui um contrato." });
      console.error("Erro ao criar contrato:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível cadastrar o contrato." });
    }
  };
}
