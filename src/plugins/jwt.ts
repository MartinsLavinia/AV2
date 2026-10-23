import type { FastifyReply, FastifyRequest } from "fastify";
import { PapelUsuario } from "../generated/prisma/enums.js";
import { prisma } from "../infrastructure/prisma.js";

export function permitirPapeis(...papeisPermitidos: PapelUsuario[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ mensagem: "Token ausente, inválido ou expirado." });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: request.user.sub },
      select: { papel: true, ativo: true },
    });
    if (!usuario || !usuario.ativo) {
      return reply.code(401).send({ mensagem: "A conta não existe ou está inativa." });
    }
    request.user.papel = usuario.papel;

    if (!papeisPermitidos.includes(request.user.papel)) {
      return reply.code(403).send({ mensagem: "Seu papel não permite esta operação." });
    }
  };
}
