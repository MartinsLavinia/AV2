
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
}
