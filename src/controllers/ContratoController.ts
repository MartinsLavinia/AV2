import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ContratoDaOrganizacaoJaExisteError,
  ContratoNaoEncontradoError,
  ContratoService,
  ErroValidacaoContrato,
  OrganizacaoDoContratoNaoEncontradaError,
  OrganizacaoDoContratoInativaError,
  VersaoContratoConflitanteError,
  type DadosEdicaoContrato,
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

  obter = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.code(200).send(await this.contratos.obter(id));
    } catch (erro) {
      if (erro instanceof ErroValidacaoContrato) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof ContratoNaoEncontradoError) return reply.code(404).send({ mensagem: "Contrato não encontrado." });
      console.error("Erro ao consultar contrato:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível consultar o contrato." });
    }
  };

  criar = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.code(201).send(await this.contratos.criar(request.body as DadosNovoContrato));
    } catch (erro) {
      if (erro instanceof ErroValidacaoContrato) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof OrganizacaoDoContratoNaoEncontradaError) return reply.code(404).send({ mensagem: "Organização não encontrada." });
      if (erro instanceof OrganizacaoDoContratoInativaError) return reply.code(409).send({ mensagem: "Não é possível cadastrar contrato para uma organização inativa." });
      if (erro instanceof ContratoDaOrganizacaoJaExisteError) return reply.code(409).send({ mensagem: "Essa organização já possui um contrato." });
      console.error("Erro ao criar contrato:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível cadastrar o contrato." });
    }
  };

  editar = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.code(200).send(await this.contratos.editar(id, request.body as DadosEdicaoContrato));
    } catch (erro) {
      if (erro instanceof ErroValidacaoContrato) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof ContratoNaoEncontradoError) return reply.code(404).send({ mensagem: "Contrato não encontrado." });
      if (erro instanceof VersaoContratoConflitanteError) return reply.code(409).send({ mensagem: "O contrato foi alterado. Consulte os dados e tente novamente com a versão atual." });
      console.error("Erro ao editar contrato:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível editar o contrato." });
    }
  };

  excluir = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { versao } = request.query as { versao: number };
      await this.contratos.excluir(id, versao);
      return reply.code(204).send();
    } catch (erro) {
      if (erro instanceof ErroValidacaoContrato) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof ContratoNaoEncontradoError) return reply.code(404).send({ mensagem: "Contrato não encontrado." });
      if (erro instanceof VersaoContratoConflitanteError) return reply.code(409).send({ mensagem: "O contrato foi alterado. Consulte a versão atual antes de excluir." });
      console.error("Erro ao excluir contrato:", erro);
      return reply.code(500).send({ mensagem: "Não foi possível excluir o contrato." });
    }
  };
}
