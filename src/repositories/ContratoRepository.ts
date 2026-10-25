import { prisma } from "../infrastructure/prisma.js";

export class ContratoRepository {
  listar() {
    return prisma.contrato.findMany({
      include: { organizacao: { select: { id: true, razaoSocial: true, cnpj: true } } },
      orderBy: { dataAssinatura: "desc" },
    });
  }

  organizacaoExiste(id: string) {
    return prisma.organizacao.findUnique({ where: { id }, select: { id: true, ativo: true } });
  }

  buscarDaOrganizacao(organizacaoId: string) {
    return prisma.contrato.findUnique({ where: { organizacaoId } });
  }

  buscarPorId(id: string) {
    return prisma.contrato.findUnique({ where: { id } });
  }

  criar(data: {
    organizacaoId: string;
    dataVencimento: Date;
    clausulas: string[];
    valorMensal: number;
    renovacaoAutomatica: boolean;
  }) {
    return prisma.contrato.create({
      data: { ...data, dataAssinatura: new Date() },
      include: { organizacao: { select: { id: true, razaoSocial: true, cnpj: true } } },
    });
  }

  async editar(id: string, versao: number, dados: {
    dataVencimento?: Date; valorMensal?: number; renovacaoAutomatica?: boolean; clausulas?: string[];
  }) {
    return prisma.$transaction(async (tx) => {
      const resultado = await tx.contrato.updateMany({ where: { id, versao }, data: { ...dados, versao: { increment: 1 } } });
      if (resultado.count !== 1) {
        const existe = await tx.contrato.findUnique({ where: { id }, select: { id: true } });
        if (!existe) throw new ContratoNaoEncontradoRepositoryError();
        throw new VersaoContratoConflitanteRepositoryError();
      }
      return tx.contrato.findUniqueOrThrow({ where: { id }, include: { organizacao: { select: { id: true, razaoSocial: true, cnpj: true } } } });
    });
  }

  async excluir(id: string, versao: number) {
    const resultado = await prisma.contrato.deleteMany({ where: { id, versao } });
    if (resultado.count === 1) return;
    const existe = await prisma.contrato.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new ContratoNaoEncontradoRepositoryError();
    throw new VersaoContratoConflitanteRepositoryError();
  }
}

export class ContratoNaoEncontradoRepositoryError extends Error {}
export class VersaoContratoConflitanteRepositoryError extends Error {}
