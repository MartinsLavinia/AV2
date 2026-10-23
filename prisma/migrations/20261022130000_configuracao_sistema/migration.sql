CREATE TABLE "ConfiguracaoSistema" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "aliquotaImposto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coeficienteDepreciacaoAnual" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoSistema_pkey" PRIMARY KEY ("id")
);
