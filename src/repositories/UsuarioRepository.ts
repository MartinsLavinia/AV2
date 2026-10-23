import { Prisma } from "../generated/prisma/client.js";
import type { PapelUsuario } from "../generated/prisma/enums.js";
import { prisma } from "../infrastructure/prisma.js";

export type DadosUsuarioPersistido = {
  nomeCompleto: string;
  email: string;
  senhaHash: string;
  papel: PapelUsuario;
};

export type EdicaoUsuarioPersistida = {
  nomeCompleto?: string;
  email?: string;
  senhaHash?: string;
  papel?: PapelUsuario;
  ativo?: boolean;
};

export class UsuarioRepository {
  contar(): Promise<number> {
    return prisma.usuario.count();
  }

  buscarPorEmail(email: string) {
    return prisma.usuario.findUnique({ where: { email } });
  }

  buscarPorId(id: string) {
    return prisma.usuario.findUnique({ where: { id } });
  }

  listar() {
    return prisma.usuario.findMany({
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        papel: true,
        ativo: true,
        administradorInicial: true,
        dataCadastro: true,
      },
      orderBy: { dataCadastro: "asc" },
    });
  }

  criar(dados: DadosUsuarioPersistido) {
    return prisma.usuario.create({ data: dados });
  }

  async criarPrimeiroAdministrador(dados: DadosUsuarioPersistido) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          if ((await tx.usuario.count()) > 0) {
            throw new SetupInicialJaConcluidoError();
          }

          return tx.usuario.create({ data: { ...dados, administradorInicial: true } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (erro) {
      if (erro instanceof SetupInicialJaConcluidoError) throw erro;
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === "P2034"
      ) {
        throw new SetupInicialJaConcluidoError();
      }
      throw erro;
    }
  }

  async editar(id: string, dados: EdicaoUsuarioPersistida) {
    return prisma.$transaction(
      async (tx) => {
        const atual = await tx.usuario.findUnique({ where: { id } });
        if (!atual) throw new UsuarioNaoEncontradoError();

        const novoPapel = dados.papel ?? atual.papel;
        const novoEstadoAtivo = dados.ativo ?? atual.ativo;
        const estaRemovendoAdminAtivo =
          atual.papel === "ADMINISTRADOR" && atual.ativo &&
          (novoPapel !== "ADMINISTRADOR" || !novoEstadoAtivo);

        if (estaRemovendoAdminAtivo) {
          const outrosAdministradores = await tx.usuario.count({
            where: { id: { not: id }, papel: "ADMINISTRADOR", ativo: true },
          });
          if (outrosAdministradores === 0) throw new UltimoAdministradorError();
        }

        return tx.usuario.update({ where: { id }, data: dados });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async excluir(id: string, solicitanteId: string) {
    return prisma.$transaction(
      async (tx) => {
        if (id === solicitanteId) throw new AutoExclusaoUsuarioError();

        const alvo = await tx.usuario.findUnique({ where: { id } });
        if (!alvo) throw new UsuarioNaoEncontradoError();
        if (alvo.administradorInicial) throw new AdministradorInicialProtegidoError();

        if (alvo.papel === "ADMINISTRADOR" && alvo.ativo) {
          const outrosAdministradores = await tx.usuario.count({
            where: { id: { not: id }, papel: "ADMINISTRADOR", ativo: true },
          });
          if (outrosAdministradores === 0) throw new UltimoAdministradorError();
        }

        await tx.usuario.delete({ where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

export class SetupInicialJaConcluidoError extends Error {
  constructor() {
    super("A configuração inicial já foi concluída.");
    this.name = "SetupInicialJaConcluidoError";
  }
}

export class UsuarioNaoEncontradoError extends Error {}
export class UltimoAdministradorError extends Error {}
export class AdministradorInicialProtegidoError extends Error {}
export class AutoExclusaoUsuarioError extends Error {}
