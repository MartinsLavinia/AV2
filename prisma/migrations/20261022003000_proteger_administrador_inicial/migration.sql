ALTER TABLE "Usuario"
ADD COLUMN "administradorInicial" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Usuario"
SET "administradorInicial" = true
WHERE "id" = (
    SELECT "id"
    FROM "Usuario"
    WHERE "papel" = 'ADMINISTRADOR'
    ORDER BY "dataCadastro" ASC, "id" ASC
    LIMIT 1
);
