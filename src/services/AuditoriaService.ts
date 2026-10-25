import { AuditoriaRepository, type FiltroHistorico } from "../repositories/AuditoriaRepository.js";

export class AuditoriaService {
  constructor(private readonly auditoria = new AuditoriaRepository()) {}

  async rastrearEquipamento(identificador: string) {
    if (typeof identificador !== "string" || !identificador.trim()) {
      throw new ErroValidacaoAuditoria("Informe o ID ou código de barras do equipamento.");
    }
    const equipamento = await this.auditoria.rastrearEquipamento(identificador.trim());
    if (!equipamento) throw new EquipamentoRastreadoNaoEncontradoError();
    return equipamento;
  }

  listarHistorico(query: Record<string, unknown>) {
    const pagina = this.inteiroPositivo(query.pagina, 1, "Página");
    const limite = this.inteiroPositivo(query.limite, 50, "Limite");
    if (limite > 100) throw new ErroValidacaoAuditoria("O limite máximo por página é 100.");

    const equipamentoId = query.equipamentoId;
    if (equipamentoId !== undefined && (typeof equipamentoId !== "string" || !UUID.test(equipamentoId))) {
      throw new ErroValidacaoAuditoria("equipamentoId deve ser um UUID válido.");
    }
    const dataInicio = this.dataValida(query.dataInicio, "dataInicio");
    const dataFim = this.dataValida(query.dataFim, "dataFim");
    if (dataInicio && dataFim && dataInicio > dataFim) {
      throw new ErroValidacaoAuditoria("dataInicio deve ser anterior ou igual a dataFim.");
    }

    const filtro: FiltroHistorico = {
      ...(equipamentoId ? { equipamentoId: equipamentoId as string } : {}),
      ...(dataInicio ? { dataInicio } : {}),
      ...(dataFim ? { dataFim } : {}),
      pular: (pagina - 1) * limite,
      limite,
    };
    return this.auditoria.listarHistorico(filtro).then(({ itens, total }) => ({
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
      movimentacoes: itens,
    }));
  }

  gerarRelatorio() {
    return this.auditoria.gerarRelatorio();
  }

  private inteiroPositivo(valor: unknown, padrao: number, nome: string): number {
    if (valor === undefined) return padrao;
    const convertido = typeof valor === "string" && /^\d+$/.test(valor) ? Number(valor) : valor;
    if (!Number.isInteger(convertido) || (convertido as number) < 1) {
      throw new ErroValidacaoAuditoria(`${nome} deve ser um inteiro positivo.`);
    }
    return convertido as number;
  }

  private dataValida(valor: unknown, nome: string): Date | undefined {
    if (valor === undefined) return undefined;
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(valor)) {
      throw new ErroValidacaoAuditoria(`${nome} deve estar no formato AAAA-MM-DD ou data/hora ISO UTC.`);
    }
    const data = new Date(valor);
    if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor.slice(0, 10)) {
      throw new ErroValidacaoAuditoria(`${nome} não contém uma data válida.`);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      if (nome === "dataFim") data.setUTCHours(23, 59, 59, 999);
      else data.setUTCHours(0, 0, 0, 0);
    }
    return data;
  }
}

export class ErroValidacaoAuditoria extends Error {}
export class EquipamentoRastreadoNaoEncontradoError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
