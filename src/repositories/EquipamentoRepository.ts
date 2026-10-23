import { Prisma } from "../generated/prisma/client.js";
import type { EstadoFisico, StatusRastreamento, TipoEquipamento } from "../generated/prisma/enums.js";
import { prisma } from "../infrastructure/prisma.js";

export class EquipamentoRepository {
  listar() {
    return prisma.equipamento.findMany({
      include: { lote: { select: { id: true, notaFiscal: true, organizacaoId: true } } },
      orderBy: [{ loteId: "asc" }, { posicaoNoLote: "asc" }],
    });
  }

  async loteExiste(id: string) {
    return Boolean(await prisma.lote.findUnique({ where: { id }, select: { id: true } }));
  }

  criar(data: {
    codigoBarrasInterno: string;
    tipo: TipoEquipamento;
    marca: string;
    modelo: string;
    anoFabricacao: number;
    estadoFisico: EstadoFisico;
    pesoQuilogramas: number;
    loteId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const posicaoNoLote = await tx.equipamento.count({ where: { loteId: data.loteId } }) + 1;
      return tx.equipamento.create({
        data: { ...data, posicaoNoLote },
        include: { lote: { select: { id: true, notaFiscal: true } } },
      });
    });
  }

  buscarPorIdentificador(identificador: string) {
    return UUID.test(identificador)
      ? prisma.equipamento.findUnique({ where: { id: identificador } })
      : prisma.equipamento.findUnique({ where: { codigoBarrasInterno: identificador } });
  }

  async atualizarStatus(
    id: string,
    versao: number,
    statusAnterior: StatusRastreamento,
    novoStatus: StatusRastreamento,
  ) {
    return prisma.$transaction(async (tx) => {
      const resultado = await tx.equipamento.updateMany({
        where: { id, versao, statusRastreamento: statusAnterior },
        data: { statusRastreamento: novoStatus, versao: { increment: 1 } },
      });
      if (resultado.count !== 1) await this.lancarConflitoOuNaoEncontrado(tx, id);
      return tx.equipamento.findUniqueOrThrow({ where: { id } });
    });
  }

  async movimentar(
    id: string,
    versao: number,
    statusAnterior: StatusRastreamento,
    novoStatus: StatusRastreamento | null,
    responsavel: string,
    observacao: string,
    destino: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const resultado = await tx.equipamento.updateMany({
        where: { id, versao, statusRastreamento: statusAnterior },
        data: { statusRastreamento: novoStatus ?? statusAnterior, versao: { increment: 1 } },
      });
      if (resultado.count !== 1) await this.lancarConflitoOuNaoEncontrado(tx, id);

      const ultimaMovimentacao = await tx.movimentacao.findFirst({
        where: { equipamentoId: id },
        orderBy: [{ dataHora: "desc" }, { id: "desc" }],
        select: { destino: true },
      });
      const movimentacao = await tx.movimentacao.create({
        data: {
          equipamentoId: id,
          origem: ultimaMovimentacao?.destino ?? "RECEBIMENTO",
          destino,
          responsavel,
          observacao,
        },
      });
      const equipamento = await tx.equipamento.findUniqueOrThrow({ where: { id } });
      return { equipamento, movimentacao };
    });
  }

  async atualizarEstadoFisico(
    id: string,
    versao: number,
    estadoAnterior: EstadoFisico,
    novoEstado: EstadoFisico,
  ) {
    return prisma.$transaction(async (tx) => {
      const resultado = await tx.equipamento.updateMany({
        where: { id, versao, estadoFisico: estadoAnterior },
        data: { estadoFisico: novoEstado, versao: { increment: 1 } },
      });
      if (resultado.count !== 1) await this.lancarConflitoOuNaoEncontrado(tx, id);
      return tx.equipamento.findUniqueOrThrow({ where: { id } });
    });
  }

  private async lancarConflitoOuNaoEncontrado(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<never> {
    const atual = await tx.equipamento.findUnique({ where: { id }, select: { id: true } });
    if (!atual) throw new EquipamentoNaoEncontradoError();
    throw new VersaoEquipamentoConflitanteError();
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ehConflitoUnico(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

export class EquipamentoNaoEncontradoError extends Error {}
export class VersaoEquipamentoConflitanteError extends Error {}
