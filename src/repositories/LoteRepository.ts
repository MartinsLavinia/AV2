import { prisma } from "../infrastructure/prisma.js";

export class LoteRepository {
  listar() {
    return prisma.lote.findMany({
      include: { equipamentos: true },
      orderBy: { dataEntrada: "desc" },
    });
  }

  buscarPorId(id: string) {
    return prisma.lote.findUnique({ where: { id } });
  }

  async organizacaoExiste(id: string) {
    return Boolean(await prisma.organizacao.findUnique({ where: { id }, select: { id: true } }));
  }

  criar(data: {
    organizacaoId: string;
    notaFiscal: string;
    transportadora: string;
    dataEntrada?: Date;
    observacoes: string;
  }) {
    return prisma.lote.create({ data, include: { equipamentos: true } });
  }
}
