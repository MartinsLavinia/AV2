import type { FastifyReply, FastifyRequest } from "fastify";
import { ErroValidacaoLote, LoteComEquipamentosError, LoteNaoEncontradoError, LoteService, OrganizacaoDoLoteInativaError, OrganizacaoDoLoteNaoEncontradaError, VersaoLoteConflitanteError, type DadosEdicaoLote, type DadosNovoLote } from "../services/LoteService.js";

export class LoteController {
  constructor(private readonly lotes = new LoteService()) {}

  listar = async (_request: FastifyRequest, reply: FastifyReply) => {
    try { return reply.code(200).send(await this.lotes.listar()); }
    catch (erro) { console.error("Erro ao listar lotes:", erro); return reply.code(500).send({ mensagem: "Não foi possível listar os lotes." }); }
  };

  obter = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.code(200).send(await this.lotes.obter(id));
    } catch (erro) {
      if (erro instanceof ErroValidacaoLote) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof LoteNaoEncontradoError) return reply.code(404).send({ mensagem: "Lote não encontrado." });
      console.error("Erro ao consultar lote:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível consultar o lote." });
    }
  };

  criar = async (request: FastifyRequest, reply: FastifyReply) => {
    try { return reply.code(201).send(await this.lotes.criar(request.body as DadosNovoLote)); }
    catch (erro) {
      if (erro instanceof ErroValidacaoLote) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof OrganizacaoDoLoteNaoEncontradaError) return reply.code(404).send({ mensagem: "Organização não encontrada." });
      if (erro instanceof OrganizacaoDoLoteInativaError) return reply.code(409).send({ mensagem: "Não é possível cadastrar lote para uma organização inativa." });
      console.error("Erro ao criar lote:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível cadastrar o lote." });
    }
  };

  editar = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.code(200).send(await this.lotes.editar(id, request.body as DadosEdicaoLote));
    } catch (erro) {
      if (erro instanceof ErroValidacaoLote) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof LoteNaoEncontradoError) return reply.code(404).send({ mensagem: "Lote não encontrado." });
      if (erro instanceof VersaoLoteConflitanteError) return reply.code(409).send({ mensagem: "O lote foi alterado. Consulte os dados e tente novamente com a versão atual." });
      console.error("Erro ao editar lote:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível editar o lote." });
    }
  };

  excluir = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { versao } = request.query as { versao: number };
      await this.lotes.excluir(id, versao);
      return reply.code(204).send();
    } catch (erro) {
      if (erro instanceof ErroValidacaoLote) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof LoteNaoEncontradoError) return reply.code(404).send({ mensagem: "Lote não encontrado." });
      if (erro instanceof VersaoLoteConflitanteError) return reply.code(409).send({ mensagem: "O lote foi alterado. Consulte a versão atual antes de excluir." });
      if (erro instanceof LoteComEquipamentosError) return reply.code(409).send({ mensagem: `Não é possível excluir o lote porque ele possui ${erro.quantidade} equipamento(s) vinculado(s).` });
      console.error("Erro ao excluir lote:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível excluir o lote." });
    }
  };
}
