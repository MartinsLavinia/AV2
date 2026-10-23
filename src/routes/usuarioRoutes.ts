import type { FastifyInstance } from "fastify";
import { PapelUsuario } from "../generated/prisma/enums.js";
import { UsuarioController } from "../controllers/UsuarioController.js";
import { permitirPapeis } from "../plugins/jwt.js";

const somenteAdministrador = permitirPapeis(PapelUsuario.ADMINISTRADOR);

const schemaCredenciais = {
  type: "object",
  additionalProperties: false,
  required: ["email", "senha"],
  properties: {
    email: { type: "string", minLength: 3, maxLength: 254 },
    senha: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;

const schemaAdministradorInicial = {
  type: "object",
  additionalProperties: false,
  required: ["nomeCompleto", "email", "senha"],
  properties: {
    nomeCompleto: { type: "string", minLength: 1, maxLength: 160 },
    email: { type: "string", minLength: 3, maxLength: 254 },
    senha: { type: "string", minLength: 8, maxLength: 128 },
  },
} as const;

const schemaNovoUsuario = {
  type: "object",
  additionalProperties: false,
  required: ["nomeCompleto", "email", "senha", "papel"],
  properties: {
    ...schemaAdministradorInicial.properties,
    papel: {
      type: "string",
      enum: ["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"],
    },
  },
} as const;

const schemaEdicaoUsuario = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    nomeCompleto: { type: "string", minLength: 1, maxLength: 160 },
    email: { type: "string", minLength: 3, maxLength: 254 },
    senha: { type: "string", minLength: 8, maxLength: 128 },
    papel: {
      type: "string",
      enum: ["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"],
    },
    ativo: { type: "boolean" },
  },
} as const;

export async function usuarioRoutes(app: FastifyInstance) {
  const controller = new UsuarioController();

  app.get("/auth/status", controller.status);
  app.post("/auth/setup", { schema: { body: schemaAdministradorInicial } }, controller.configurar);
  app.post("/auth/login", { schema: { body: schemaCredenciais } }, controller.login);
  app.post("/usuarios", { schema: { body: schemaNovoUsuario }, preHandler: somenteAdministrador }, controller.criar);
  app.get("/usuarios", { preHandler: somenteAdministrador }, controller.listar);
  app.patch("/usuarios/:id", { schema: { body: schemaEdicaoUsuario }, preHandler: somenteAdministrador }, controller.editar);
  app.delete("/usuarios/:id", { preHandler: somenteAdministrador }, controller.excluir);
}
