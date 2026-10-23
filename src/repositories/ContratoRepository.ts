import { prisma } from "../infrastructure/prisma.js";

export class ContratoRepository {
  listar() {
    return prisma.contrato.findMany({
      include: { organizacao: { select: { id: true, razaoSocial: true, cnpj: true } } },
      orderBy: { dataAssinatura: "desc" },
    });
  }

  organizacaoExiste(id: string) {
    return prisma.organizacao.findUnique({ where: { id }, select: { id: true } });
  }

  buscarDaOrganizacao(organizacaoId: string) {
    return prisma.contrato.findUnique({ where: { organizacaoId } });
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
}
