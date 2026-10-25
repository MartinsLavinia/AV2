
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infrastructure/prisma.js";

export class OrganizacaoRepository {
  async listarTodas() {
    return prisma.organizacao.findMany({
      orderBy: {
        dataCadastro: "desc",
      },
    });
  }

  async buscarPorCnpj(cnpj: string) {
    return prisma.organizacao.findUnique({
      where: {
        cnpj,
      },
    });
  }

  buscarPorId(id: string) {
    return prisma.organizacao.findUnique({ where: { id } });
  }

  async criar(data: {
    razaoSocial: string;
    cnpj: string;
    inscricaoEstadual: string;
    enderecoCompleto: string;
    telefone: string;
    email: string;
  }) {
    return prisma.organizacao.create({
      data,
    });
  }

  async editar(id: string, versao: number, dados: {
    razaoSocial?: string; cnpj?: string; inscricaoEstadual?: string;
    enderecoCompleto?: string; telefone?: string; email?: string; ativo?: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      const resultado = await tx.organizacao.updateMany({ where: { id, versao }, data: { ...dados, versao: { increment: 1 } } });
      if (resultado.count !== 1) {
        const existe = await tx.organizacao.findUnique({ where: { id }, select: { id: true } });
        if (!existe) throw new OrganizacaoNaoEncontradaRepositoryError();
        throw new VersaoOrganizacaoConflitanteRepositoryError();
      }
      return tx.organizacao.findUniqueOrThrow({ where: { id } });
    });
  }

  async excluir(id: string, versao: number) {
    try {
      return await prisma.$transaction(async (tx) => {
      const atual = await tx.organizacao.findUnique({ where: { id }, include: { contrato: { select: { id: true } }, _count: { select: { lotes: true } } } });
      if (!atual) throw new OrganizacaoNaoEncontradaRepositoryError();
      if (atual.versao !== versao) throw new VersaoOrganizacaoConflitanteRepositoryError();
      const contratos = atual.contrato ? 1 : 0;
      if (atual._count.lotes > 0 || contratos > 0) {
        throw new OrganizacaoComVinculosRepositoryError(atual._count.lotes, contratos);
      }
      const resultado = await tx.organizacao.deleteMany({ where: { id, versao } });
      if (resultado.count !== 1) throw new VersaoOrganizacaoConflitanteRepositoryError();
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2003") {
        const [lotes, contrato] = await Promise.all([
          prisma.lote.count({ where: { organizacaoId: id } }),
          prisma.contrato.findUnique({ where: { organizacaoId: id }, select: { id: true } }),
        ]);
        throw new OrganizacaoComVinculosRepositoryError(lotes, contrato ? 1 : 0);
      }
      throw erro;
    }
  }
}

export class OrganizacaoNaoEncontradaRepositoryError extends Error {}
export class VersaoOrganizacaoConflitanteRepositoryError extends Error {}
export class OrganizacaoComVinculosRepositoryError extends Error {
  constructor(public readonly lotes: number, public readonly contratos: number) { super(); }
}
