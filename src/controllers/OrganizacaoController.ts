import type { FastifyReply, FastifyRequest } from "fastify";
import {
  CnpjOrganizacaoDuplicadoError,
  OrganizacaoComVinculosError,
  OrganizacaoNaoEncontradaError,
  ErroValidacaoOrganizacao,
  OrganizacaoService,
  VersaoOrganizacaoConflitanteError,
  type DadosNovaOrganizacao,
  type DadosEdicaoOrganizacao,
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

  obter = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.code(200).send(await this.organizacaoService.obter(id));
    } catch (erro) {
      if (erro instanceof ErroValidacaoOrganizacao) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof OrganizacaoNaoEncontradaError) return reply.code(404).send({ mensagem: "Organização não encontrada." });
      requestLog(erro);
      return reply.code(500).send({ mensagem: "Não foi possível consultar a organização." });
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

  editar = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.code(200).send(await this.organizacaoService.editar(id, request.body as DadosEdicaoOrganizacao));
    } catch (erro) {
      if (erro instanceof ErroValidacaoOrganizacao) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof CnpjOrganizacaoDuplicadoError) return reply.code(409).send({ mensagem: "Já existe uma organização cadastrada com esse CNPJ." });
      if (erro instanceof OrganizacaoNaoEncontradaError) return reply.code(404).send({ mensagem: "Organização não encontrada." });
      if (erro instanceof VersaoOrganizacaoConflitanteError) return reply.code(409).send({ mensagem: "A organização foi alterada. Consulte os dados e tente novamente com a versão atual." });
      requestLog(erro);
      return reply.code(500).send({ mensagem: "Não foi possível editar a organização." });
    }
  };

  excluir = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { versao } = request.query as { versao: number };
      await this.organizacaoService.excluir(id, versao);
      return reply.code(204).send();
    } catch (erro) {
      if (erro instanceof ErroValidacaoOrganizacao) return reply.code(400).send({ mensagem: erro.message });
      if (erro instanceof OrganizacaoNaoEncontradaError) return reply.code(404).send({ mensagem: "Organização não encontrada." });
      if (erro instanceof VersaoOrganizacaoConflitanteError) return reply.code(409).send({ mensagem: "A organização foi alterada. Consulte a versão atual antes de excluir." });
      if (erro instanceof OrganizacaoComVinculosError) return reply.code(409).send({ mensagem: `Não é possível excluir: a organização possui ${erro.lotes} lote(s) e ${erro.contratos} contrato(s) vinculado(s).` });
      requestLog(erro);
      return reply.code(500).send({ mensagem: "Não foi possível excluir a organização." });
    }
  };
}

function requestLog(erro: unknown): void {
  console.error("Erro no OrganizacaoController:", erro);
}
