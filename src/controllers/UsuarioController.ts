import type { FastifyReply, FastifyRequest } from "fastify";
import { PapelUsuario } from "../generated/prisma/enums.js";
import {
  AdministradorInicialProtegidoError,
  AutoExclusaoUsuarioError,
  EmailUsuarioJaCadastradoError,
  ErroValidacaoUsuario,
  SetupInicialJaConcluidoError,
  UltimoAdministradorError,
  UsuarioNaoEncontradoError,
  UsuarioService,
} from "../services/UsuarioService.js";

type DadosSetup = { nomeCompleto: string; email: string; senha: string };
type DadosLogin = { email: string; senha: string };
type DadosNovoUsuario = DadosSetup & { papel: PapelUsuario };

export class UsuarioController {
  constructor(private readonly usuarios = new UsuarioService()) {}

  status = async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.code(200).send(await this.usuarios.statusConfiguracao());

  configurar = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const usuario = await this.usuarios.configurarAdministradorInicial(
        request.body as DadosSetup,
      );
      return reply.code(201).send({
        mensagem: "Administrador inicial criado. Faça login para continuar.",
        usuario: usuarioPublico(usuario),
      });
    } catch (erro) {
      return responderErro(reply, erro);
    }
  };

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, senha } = request.body as DadosLogin;
    if (typeof email !== "string" || typeof senha !== "string") {
      return reply.code(400).send({ mensagem: "E-mail e senha são obrigatórios." });
    }

    const usuario = await this.usuarios.autenticar(email, senha);
    if (!usuario) {
      return reply.code(401).send({ mensagem: "E-mail ou senha inválidos." });
    }

    const token = await reply.jwtSign(
      { sub: usuario.id, email: usuario.email, papel: usuario.papel },
      { expiresIn: "30m" },
    );
    return reply.code(200).send({ token, usuario: usuarioPublico(usuario) });
  };

  criar = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const usuario = await this.usuarios.criarUsuario(
        request.body as DadosNovoUsuario,
      );
      return reply.code(201).send({ usuario: usuarioPublico(usuario) });
    } catch (erro) {
      return responderErro(reply, erro);
    }
  };

  listar = async (_request: FastifyRequest, reply: FastifyReply) => {
    const usuarios = await this.usuarios.listarUsuarios();
    return reply.code(200).send({ usuarios: usuarios.map(usuarioPublico) });
  };

  editar = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const usuario = await this.usuarios.editarUsuario(
        id,
        request.body as {
          nomeCompleto?: string;
          email?: string;
          senha?: string;
          papel?: PapelUsuario;
          ativo?: boolean;
        },
      );
      return reply.code(200).send({ usuario: usuarioPublico(usuario) });
    } catch (erro) {
      return responderErro(reply, erro);
    }
  };

  excluir = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await this.usuarios.excluirUsuario(id, request.user.sub);
      return reply.code(204).send();
    } catch (erro) {
      return responderErro(reply, erro);
    }
  };
}

function usuarioPublico(usuario: {
  id: string;
  nomeCompleto: string;
  email: string;
  papel: PapelUsuario;
  ativo: boolean;
  dataCadastro: Date;
}) {
  return {
    id: usuario.id,
    nomeCompleto: usuario.nomeCompleto,
    email: usuario.email,
    papel: usuario.papel,
    ativo: usuario.ativo,
    dataCadastro: usuario.dataCadastro,
  };
}

function responderErro(reply: FastifyReply, erro: unknown) {
  if (erro instanceof SetupInicialJaConcluidoError) {
    return reply.code(409).send({ mensagem: erro.message });
  }
  if (erro instanceof EmailUsuarioJaCadastradoError) {
    return reply.code(409).send({ mensagem: "Já existe usuário com esse e-mail." });
  }
  if (erro instanceof ErroValidacaoUsuario) {
    return reply.code(400).send({ mensagem: erro.message });
  }
  if (erro instanceof UsuarioNaoEncontradoError) {
    return reply.code(404).send({ mensagem: "Usuário não encontrado." });
  }
  if (erro instanceof AutoExclusaoUsuarioError) {
    return reply.code(403).send({ mensagem: "Não é permitido excluir a própria conta." });
  }
  if (erro instanceof UltimoAdministradorError) {
    return reply.code(409).send({ mensagem: "O sistema precisa manter pelo menos um administrador ativo." });
  }
  if (erro instanceof AdministradorInicialProtegidoError) {
    return reply.code(409).send({ mensagem: "O administrador inicial não pode ser excluído." });
  }
  return reply.code(500).send({ mensagem: "Não foi possível concluir a operação." });
}
