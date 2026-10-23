/** Valida CNPJs numéricos e alfanuméricos conforme o cálculo oficial do DV. */
export class ValidadorCNPJ {
  normalizar(valor: string): string | null {
    const entrada = valor.trim().toUpperCase();
    const semMascara = /^[A-Z0-9]{12}\d{2}$/;
    const comMascara = /^[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-\d{2}$/;

    if (!semMascara.test(entrada) && !comMascara.test(entrada)) return null;
    return entrada.replace(/[.\/-]/g, "");
  }

  validar(valor: string): boolean {
    const cnpj = this.normalizar(valor);
    if (!cnpj) return false;

    const base = cnpj.slice(0, 12);
    if (/^(.)\1{11}$/.test(base)) return false;

    const primeiro = this.calcularDigito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    if (primeiro !== Number(cnpj[12])) return false;

    const segundo = this.calcularDigito(
      `${base}${primeiro}`,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    );
    return segundo === Number(cnpj[13]);
  }

  private calcularDigito(base: string, pesos: number[]): number {
    const soma = [...base].reduce(
      (total, caractere, indice) =>
        total + (caractere.charCodeAt(0) - 48) * pesos[indice]!,
      0,
    );
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }
}
