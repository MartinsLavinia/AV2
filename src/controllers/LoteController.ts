import type { FastifyReply, FastifyRequest } from "fastify";
import { ErroValidacaoLote, LoteService, OrganizacaoDoLoteNaoEncontradaError, type DadosNovoLote } from "../services/LoteService.js";

export class LoteController {
  constructor(private readonly lotes = new LoteService()) {}

  listar = async (_request: FastifyRequest, reply: FastifyReply) => {
    try { return reply.code(200).send(await this.lotes.listar()); }
    catch (erro) { console.error("Erro ao listar lotes:", erro); return reply.code(500).send({ mensagem: "Não foi possível listar os lotes." }); }
  };

  criar = async (request: FastifyRequest, reply: FastifyReply) => {
    try { return reply.code(201).send(await this.lotes.criar(request.body as DadosNovoLote)); }
    catch (erro) {
      if (erro instanceof ErroValidacaoLote) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof OrganizacaoDoLoteNaoEncontradaError) return reply.code(404).send({ mensagem: "Organização não encontrada." });
      console.error("Erro ao criar lote:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível cadastrar o lote." });
    }
  };
}
