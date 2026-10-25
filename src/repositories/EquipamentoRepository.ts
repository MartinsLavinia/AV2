import { Prisma } from "../generated/prisma/client.js";
import { EstadoFisico, StatusLote, StatusRastreamento, TipoEquipamento } from "../generated/prisma/enums.js";
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
      await incrementarVersaoLote(tx, data.loteId);
      const posicaoNoLote = await tx.equipamento.count({ where: { loteId: data.loteId } }) + 1;
      const equipamento = await tx.equipamento.create({
        data: { ...data, posicaoNoLote },
        include: { lote: { select: { id: true, notaFiscal: true } } },
      });
      await sincronizarStatusLote(tx, data.loteId);
      return equipamento;
    });
  }

  buscarPorIdentificador(identificador: string) {
    return UUID.test(identificador)
      ? prisma.equipamento.findUnique({ where: { id: identificador } })
      : prisma.equipamento.findUnique({ where: { codigoBarrasInterno: identificador } });
  }

  async editar(id: string, versao: number, dados: { tipo?: TipoEquipamento; marca?: string; modelo?: string; anoFabricacao?: number; pesoQuilogramas?: number }) {
    return prisma.$transaction(async (tx) => {
      const resultado = await tx.equipamento.updateMany({ where: { id, versao }, data: { ...dados, versao: { increment: 1 } } });
      if (resultado.count !== 1) {
        const existe = await tx.equipamento.findUnique({ where: { id }, select: { id: true } });
        if (!existe) throw new EquipamentoNaoEncontradoError();
        throw new VersaoEquipamentoConflitanteError();
      }
      return tx.equipamento.findUniqueOrThrow({ where: { id }, include: { lote: { select: { id: true, notaFiscal: true } } } });
    });
  }

  async excluir(id: string, versao: number) {
    try {
      return await prisma.$transaction(async (tx) => {
      const atual = await tx.equipamento.findUnique({ where: { id }, select: { id: true, loteId: true } });
      if (!atual) throw new EquipamentoNaoEncontradoError();
      await incrementarVersaoLote(tx, atual.loteId);
      const equipamentoAtual = await tx.equipamento.findUnique({
        where: { id },
        select: { id: true, versao: true, _count: { select: { movimentacoes: true } } },
      });
      if (!equipamentoAtual) throw new EquipamentoNaoEncontradoError();
      if (equipamentoAtual.versao !== versao) throw new VersaoEquipamentoConflitanteError();
      if (equipamentoAtual._count.movimentacoes > 0) throw new EquipamentoComMovimentacoesError(equipamentoAtual._count.movimentacoes);
      const resultado = await tx.equipamento.deleteMany({ where: { id, versao } });
      if (resultado.count !== 1) throw new VersaoEquipamentoConflitanteError();
      await sincronizarStatusLote(tx, atual.loteId);
      });
    } catch (erro) {
      if (ehConflitoEstrangeiro(erro)) {
        const quantidade = await prisma.movimentacao.count({ where: { equipamentoId: id } });
        throw new EquipamentoComMovimentacoesError(quantidade || 1);
      }
      throw erro;
    }
  }

  async atualizarStatus(
    id: string,
    versao: number,
    statusAnterior: StatusRastreamento,
    novoStatus: StatusRastreamento,
  ) {
    return prisma.$transaction(async (tx) => {
      const equipamento = await tx.equipamento.findUnique({ where: { id }, select: { loteId: true } });
      if (!equipamento) throw new EquipamentoNaoEncontradoError();
      await incrementarVersaoLote(tx, equipamento.loteId);
      const resultado = await tx.equipamento.updateMany({
        where: { id, versao, statusRastreamento: statusAnterior },
        data: { statusRastreamento: novoStatus, versao: { increment: 1 } },
      });
      if (resultado.count !== 1) await this.lancarConflitoOuNaoEncontrado(tx, id);
      await sincronizarStatusLote(tx, equipamento.loteId);
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
      const equipamentoAtual = await tx.equipamento.findUnique({ where: { id }, select: { loteId: true } });
      if (!equipamentoAtual) throw new EquipamentoNaoEncontradoError();
      await incrementarVersaoLote(tx, equipamentoAtual.loteId);
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
      await sincronizarStatusLote(tx, equipamentoAtual.loteId);
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

function ehConflitoEstrangeiro(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2003";
}

export class EquipamentoNaoEncontradoError extends Error {}
export class VersaoEquipamentoConflitanteError extends Error {}
export class EquipamentoComMovimentacoesError extends Error {
  constructor(public readonly quantidade: number) { super(); }
}

async function incrementarVersaoLote(
  tx: Prisma.TransactionClient,
  loteId: string,
) {
  // Serializa mudanças simultâneas nos equipamentos que pertencem ao mesmo lote.
  await tx.lote.update({
    where: { id: loteId },
    data: { versao: { increment: 1 } },
  });
}

async function sincronizarStatusLote(
  tx: Prisma.TransactionClient,
  loteId: string,
) {
  const equipamentos = await tx.equipamento.findMany({
    where: { loteId },
    select: { statusRastreamento: true },
  });
  const novoStatus = calcularStatusLote(
    equipamentos.map(({ statusRastreamento }) => statusRastreamento),
  );
  const lote = await tx.lote.findUnique({
    where: { id: loteId },
    select: { statusProcessamento: true },
  });

  if (lote && lote.statusProcessamento !== novoStatus) {
    await tx.lote.update({
      where: { id: loteId },
      data: { statusProcessamento: novoStatus },
    });
  }
}

function calcularStatusLote(statuses: StatusRastreamento[]): StatusLote {
  if (
    statuses.length === 0 ||
    statuses.every((status) => status === StatusRastreamento.AGUARDANDO_TRIAGEM)
  ) {
    return StatusLote.RECEBIDO;
  }

  if (statuses.every((status) => status === StatusRastreamento.BAIXA_DEFINITIVA)) {
    return StatusLote.FINALIZADO;
  }

  // O lote não ultrapassa a triagem enquanto algum equipamento ainda não a concluiu.
  if (
    statuses.some(
      (status) =>
        status === StatusRastreamento.AGUARDANDO_TRIAGEM ||
        status === StatusRastreamento.EM_TRIAGEM,
    )
  ) {
    return StatusLote.EM_TRIAGEM;
  }

  let triagemConcluida = 0;
  let encaminhado = 0;
  for (const status of statuses) {
    if (
      status === StatusRastreamento.AGUARDANDO_DESMONTE ||
      status === StatusRastreamento.EM_DESMONTE
    ) {
      triagemConcluida += 1;
    } else {
      // BAIXA_DEFINITIVA conta como encaminhado, exceto quando todos finalizaram.
      encaminhado += 1;
    }
  }

  // Maior frequência vence; em empate, mantém a etapa menos avançada.
  return encaminhado > triagemConcluida
    ? StatusLote.ENCAMINHADO
    : StatusLote.TRIAGEM_CONCLUIDA;
}
