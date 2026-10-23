import type { FastifyInstance } from "fastify";
import { ConfiguracaoController } from "../controllers/ConfiguracaoController.js";
import { PapelUsuario } from "../generated/prisma/enums.js";
import { permitirPapeis } from "../plugins/jwt.js";

const schemaConfiguracoes = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    aliquotaImposto: { type: "number", minimum: 0, maximum: 100 },
    coeficienteDepreciacaoAnual: { type: "number", minimum: 0, maximum: 100 },
  },
} as const;

export async function configuracaoRoutes(app: FastifyInstance) {
  const controller = new ConfiguracaoController();
  const somenteAdministrador = permitirPapeis(PapelUsuario.ADMINISTRADOR);
  app.get("/configuracoes", { preHandler: somenteAdministrador }, controller.obter);
  app.patch("/configuracoes", { schema: { body: schemaConfiguracoes }, preHandler: somenteAdministrador }, controller.atualizar);
}
