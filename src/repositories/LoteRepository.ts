import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infrastructure/prisma.js";

export class LoteRepository {
  listar() {
    return prisma.lote.findMany({
      include: { equipamentos: true },
      orderBy: { dataEntrada: "desc" },
    });
  }

  buscarPorId(id: string) {
    return prisma.lote.findUnique({ where: { id }, include: { equipamentos: true } });
  }

  async organizacaoExiste(id: string) {
    return prisma.organizacao.findUnique({ where: { id }, select: { id: true, ativo: true } });
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

  async editar(id: string, versao: number, dados: { notaFiscal?: string; transportadora?: string; dataEntrada?: Date; observacoes?: string }) {
    return prisma.$transaction(async (tx) => {
      const resultado = await tx.lote.updateMany({ where: { id, versao }, data: { ...dados, versao: { increment: 1 } } });
      if (resultado.count !== 1) {
        const existe = await tx.lote.findUnique({ where: { id }, select: { id: true } });
        if (!existe) throw new LoteNaoEncontradoRepositoryError();
        throw new VersaoLoteConflitanteRepositoryError();
      }
      return tx.lote.findUniqueOrThrow({ where: { id }, include: { equipamentos: true } });
    });
  }

  async excluir(id: string, versao: number) {
    try {
      return await prisma.$transaction(async (tx) => {
      const atual = await tx.lote.findUnique({ where: { id }, select: { id: true, versao: true, _count: { select: { equipamentos: true } } } });
      if (!atual) throw new LoteNaoEncontradoRepositoryError();
      if (atual.versao !== versao) throw new VersaoLoteConflitanteRepositoryError();
      if (atual._count.equipamentos > 0) throw new LoteComEquipamentosRepositoryError(atual._count.equipamentos);
      const resultado = await tx.lote.deleteMany({ where: { id, versao } });
      if (resultado.count !== 1) throw new VersaoLoteConflitanteRepositoryError();
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2003") {
        const quantidade = await prisma.equipamento.count({ where: { loteId: id } });
        throw new LoteComEquipamentosRepositoryError(quantidade || 1);
      }
      throw erro;
    }
  }
}

export class LoteNaoEncontradoRepositoryError extends Error {}
export class VersaoLoteConflitanteRepositoryError extends Error {}
export class LoteComEquipamentosRepositoryError extends Error {
  constructor(public readonly quantidade: number) { super(); }
}
