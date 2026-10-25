import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  EstadoFisico,
  PapelUsuario,
  StatusRastreamento,
  TipoEquipamento,
} from "../src/generated/prisma/enums.js";
import { prisma } from "../src/infrastructure/prisma.js";

const senhaDemonstracao = "GreenCode@2026";
const dataAtual = new Date();
const dataEntrada = new Date(dataAtual);
dataEntrada.setDate(dataEntrada.getDate() - 7);

async function popularBanco() {
  if (process.env.SEED_DEMO_DATA !== "true") {
    throw new Error(
      "Seed bloqueado. Defina SEED_DEMO_DATA=true no .env somente para um banco de desenvolvimento.",
    );
  }

  const senhaHash = await bcrypt.hash(senhaDemonstracao, 12);

  // Mantém o seed repetível e não cria um administrador paralelo ao setup inicial.
  const usuariosDemo = [
    {
      nomeCompleto: "Operador de Demonstração",
      email: "operador.demo@greencode.local",
      papel: PapelUsuario.OPERADOR_CADASTRO,
    },
    {
      nomeCompleto: "Gestor de Demonstração",
      email: "gestor.demo@greencode.local",
      papel: PapelUsuario.GESTOR_ALMOXARIFADO,
    },
    {
      nomeCompleto: "Auditor de Demonstração",
      email: "auditor.demo@greencode.local",
      papel: PapelUsuario.AUDITOR,
    },
  ];

  for (const usuario of usuariosDemo) {
    await prisma.usuario.upsert({
      where: { email: usuario.email },
      create: { ...usuario, senhaHash },
      // Em banco de demonstração, repetir o seed também repõe credenciais e papel.
      update: { ...usuario, senhaHash, ativo: true },
    });
  }

  const organizacao = await prisma.organizacao.upsert({
    where: { cnpj: "11222333000181" },
    create: {
      razaoSocial: "Organização de Demonstração GreenCode",
      cnpj: "11222333000181",
      inscricaoEstadual: "ISENTO",
      enderecoCompleto: "Rua de Demonstração, 100 - São Paulo/SP",
      telefone: "11999990000",
      email: "contato.demo@greencode.local",
    },
    update: {
      razaoSocial: "Organização de Demonstração GreenCode",
      inscricaoEstadual: "ISENTO",
      enderecoCompleto: "Rua de Demonstração, 100 - São Paulo/SP",
      telefone: "11999990000",
      email: "contato.demo@greencode.local",
      ativo: true,
    },
  });

  const dataVencimento = new Date(dataAtual);
  dataVencimento.setFullYear(dataVencimento.getFullYear() + 1);
  await prisma.contrato.upsert({
    where: { organizacaoId: organizacao.id },
    create: {
      organizacaoId: organizacao.id,
      dataAssinatura: dataAtual,
      dataVencimento,
      clausulas: ["Contrato criado pelo seed de demonstração"],
      valorMensal: "1250.00",
      renovacaoAutomatica: true,
    },
    update: {
      dataAssinatura: dataAtual,
      dataVencimento,
      clausulas: ["Contrato criado pelo seed de demonstração"],
      valorMensal: "1250.00",
      renovacaoAutomatica: true,
    },
  });

  const lote = await prisma.lote.upsert({
    where: { id: "a1000000-0000-4000-8000-000000000001" },
    create: {
      id: "a1000000-0000-4000-8000-000000000001",
      organizacaoId: organizacao.id,
      dataEntrada,
      notaFiscal: "NF-DEMO-001",
      transportadora: "Transportadora de Demonstração",
      observacoes: "Lote de exemplo criado pelo seed.",
    },
    update: {
      organizacaoId: organizacao.id,
      dataEntrada,
      notaFiscal: "NF-DEMO-001",
      transportadora: "Transportadora de Demonstração",
      observacoes: "Lote de exemplo criado pelo seed.",
    },
  });

  const computador = await prisma.equipamento.upsert({
    where: { codigoBarrasInterno: "GC-DEMO-0001" },
    create: {
      codigoBarrasInterno: "GC-DEMO-0001",
      tipo: TipoEquipamento.NOTEBOOK,
      marca: "Dell",
      modelo: "Latitude Demo",
      anoFabricacao: 2022,
      estadoFisico: EstadoFisico.USADO_LEVE,
      pesoQuilogramas: 1.8,
      loteId: lote.id,
      posicaoNoLote: 1,
      statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM,
    },
    update: {
      tipo: TipoEquipamento.NOTEBOOK,
      marca: "Dell",
      modelo: "Latitude Demo",
      anoFabricacao: 2022,
      estadoFisico: EstadoFisico.USADO_LEVE,
      pesoQuilogramas: 1.8,
      loteId: lote.id,
      posicaoNoLote: 1,
      statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM,
    },
  });

  const monitor = await prisma.equipamento.upsert({
    where: { codigoBarrasInterno: "GC-DEMO-0002" },
    create: {
      codigoBarrasInterno: "GC-DEMO-0002",
      tipo: TipoEquipamento.MONITOR,
      marca: "Samsung",
      modelo: "Monitor Demo",
      anoFabricacao: 2020,
      estadoFisico: EstadoFisico.USADO_MODERADO,
      pesoQuilogramas: 3.2,
      loteId: lote.id,
      posicaoNoLote: 2,
      statusRastreamento: StatusRastreamento.EM_TRIAGEM,
    },
    update: {
      tipo: TipoEquipamento.MONITOR,
      marca: "Samsung",
      modelo: "Monitor Demo",
      anoFabricacao: 2020,
      estadoFisico: EstadoFisico.USADO_MODERADO,
      pesoQuilogramas: 3.2,
      loteId: lote.id,
      posicaoNoLote: 2,
      statusRastreamento: StatusRastreamento.EM_TRIAGEM,
    },
  });

  await prisma.movimentacao.upsert({
    where: { id: "a2000000-0000-4000-8000-000000000001" },
    create: {
      id: "a2000000-0000-4000-8000-000000000001",
      equipamentoId: monitor.id,
      dataHora: dataEntrada,
      origem: "RECEBIMENTO",
      destino: "BANCADA DE TRIAGEM",
      responsavel: "Gestor de Demonstração",
      observacao: "Movimentação inicial criada pelo seed.",
    },
    update: {
      equipamentoId: monitor.id,
      dataHora: dataEntrada,
      origem: "RECEBIMENTO",
      destino: "BANCADA DE TRIAGEM",
      responsavel: "Gestor de Demonstração",
      observacao: "Movimentação inicial criada pelo seed.",
    },
  });

  await prisma.configuracaoSistema.upsert({
    where: { id: 1 },
    create: { id: 1, aliquotaImposto: 0.18, coeficienteDepreciacaoAnual: 0.1 },
    // Não sobrescreve parâmetros que um administrador já configurou.
    update: {},
  });

  console.log("Seed de demonstração concluído.");
  console.log(`Organização: ${organizacao.razaoSocial} (${organizacao.cnpj})`);
  console.log(`Lote: ${lote.notaFiscal}; equipamentos: ${computador.codigoBarrasInterno}, ${monitor.codigoBarrasInterno}`);
  console.log("Contas de demonstração (senha das três: GreenCode@2026):");
  for (const usuario of usuariosDemo) console.log(`- ${usuario.papel}: ${usuario.email}`);
}

popularBanco()
  .catch((erro: unknown) => {
    console.error("Falha ao executar o seed:", erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
