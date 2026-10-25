import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infrastructure/prisma.js";

export type FiltroHistorico = {
  equipamentoId?: string;
  dataInicio?: Date;
  dataFim?: Date;
  pular: number;
  limite: number;
};

export class AuditoriaRepository {
  rastrearEquipamento(identificador: string) {
    return prisma.equipamento.findFirst({
      where: {
        OR: [
          ...(UUID.test(identificador) ? [{ id: identificador }] : []),
          { codigoBarrasInterno: identificador },
        ],
      },
      include: {
        lote: { select: { id: true, notaFiscal: true, dataEntrada: true, organizacaoId: true } },
        movimentacoes: { orderBy: [{ dataHora: "asc" }, { id: "asc" }] },
      },
    });
  }

  async listarHistorico(filtro: FiltroHistorico) {
    const where = {
      ...(filtro.equipamentoId ? { equipamentoId: filtro.equipamentoId } : {}),
      ...(filtro.dataInicio || filtro.dataFim
        ? { dataHora: { ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}), ...(filtro.dataFim ? { lte: filtro.dataFim } : {}) } }
        : {}),
    };
    const [itens, total] = await prisma.$transaction([
      prisma.movimentacao.findMany({
        where,
        include: { equipamento: { select: { id: true, codigoBarrasInterno: true, tipo: true, marca: true, modelo: true } } },
        orderBy: [{ dataHora: "desc" }, { id: "desc" }],
        skip: filtro.pular,
        take: filtro.limite,
      }),
      prisma.movimentacao.count({ where }),
    ]);
    return { itens, total };
  }

  async gerarRelatorio() {
    const geradoEm = new Date();
    const [organizacoes, lotes, equipamentos, totalMovimentacoes, contratosVigentes, configuracao] = await prisma.$transaction([
      prisma.organizacao.count(),
      prisma.lote.count(),
      prisma.equipamento.findMany({
        select: { pesoQuilogramas: true, anoFabricacao: true, statusRastreamento: true, estadoFisico: true },
      }),
      prisma.movimentacao.count(),
      prisma.contrato.findMany({
        where: {
          dataVencimento: { gte: geradoEm },
          organizacao: { is: { ativo: true } },
        },
        select: { valorMensal: true },
      }),
      prisma.configuracaoSistema.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
        select: { aliquotaImposto: true, coeficienteDepreciacaoAnual: true, atualizadoEm: true },
      }),
    ]);

    const porStatus: Record<string, number> = {};
    const porEstadoFisico: Record<string, number> = {};
    let pesoTotalKg = 0;
    let pesoEquivalenteDepreciadoKg = 0;
    const receitaMensalContratada = contratosVigentes.reduce(
      (total, contrato) => total.plus(contrato.valorMensal),
      new Prisma.Decimal(0),
    );
    const aliquota = new Prisma.Decimal(configuracao.aliquotaImposto.toString());
    const impostoMensalEstimado = receitaMensalContratada
      .mul(aliquota)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const receitaMensalLiquidaEstimada = receitaMensalContratada.minus(impostoMensalEstimado);
    const anoAtual = new Date().getFullYear();
    for (const equipamento of equipamentos) {
      pesoTotalKg += equipamento.pesoQuilogramas;
      porStatus[equipamento.statusRastreamento] = (porStatus[equipamento.statusRastreamento] ?? 0) + 1;
      porEstadoFisico[equipamento.estadoFisico] = (porEstadoFisico[equipamento.estadoFisico] ?? 0) + 1;
      const idade = Math.max(0, anoAtual - equipamento.anoFabricacao);
      pesoEquivalenteDepreciadoKg += equipamento.pesoQuilogramas * Math.min(idade * configuracao.coeficienteDepreciacaoAnual, 0.9);
    }

    return {
      geradoEm,
      organizacoes,
      lotes,
      equipamentos: equipamentos.length,
      totalMovimentacoes,
      pesoTotalKg,
      pesoEquivalenteDepreciadoKg,
      descricaoPesoEquivalenteDepreciado: "Indicador estimado em kg, calculado pelo peso e idade dos equipamentos; não representa depreciação em dinheiro.",
      coeficienteDepreciacaoAnual: configuracao.coeficienteDepreciacaoAnual * 100,
      configuracaoAtualizadaEm: configuracao.atualizadoEm,
      financeiroContratos: {
        contratosConsiderados: contratosVigentes.length,
        criterio: "Contratos não vencidos vinculados a organizações ativas.",
        receitaMensalContratadaBruta: receitaMensalContratada.toFixed(2),
        aliquotaImpostoPercentual: configuracao.aliquotaImposto * 100,
        impostoMensalEstimado: impostoMensalEstimado.toFixed(2),
        receitaMensalLiquidaEstimada: receitaMensalLiquidaEstimada.toFixed(2),
        observacao: "Estimativa sobre valores mensais contratados; não representa apuração fiscal nem valores efetivamente recebidos.",
      },
      porStatus,
      porEstadoFisico,
    };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
