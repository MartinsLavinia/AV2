import "@fastify/jwt";
import type { PapelUsuario } from "../generated/prisma/enums.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string; papel: PapelUsuario };
    user: { sub: string; email: string; papel: PapelUsuario };
  }
}
