import bcrypt from "bcryptjs";
import { PapelUsuario } from "../generated/prisma/enums.js";
import {
  AdministradorInicialProtegidoError,
  AutoExclusaoUsuarioError,
  SetupInicialJaConcluidoError,
  UltimoAdministradorError,
  UsuarioNaoEncontradoError,
  UsuarioRepository,
} from "../repositories/UsuarioRepository.js";

const CUSTO_BCRYPT = 12;
const TAMANHO_MINIMO_SENHA = 8;

export type DadosCadastroUsuario = {
  nomeCompleto: string;
  email: string;
  senha: string;
  papel: PapelUsuario;
};

export class UsuarioService {
  constructor(private readonly usuarios = new UsuarioRepository()) {}

  async statusConfiguracao() {
    return { configuracaoInicialNecessaria: (await this.usuarios.contar()) === 0 };
  }

  async configurarAdministradorInicial(dados: Omit<DadosCadastroUsuario, "papel">) {
    const normalizados = this.validarDados(dados);
    const senhaHash = await bcrypt.hash(normalizados.senha, CUSTO_BCRYPT);

    return this.usuarios.criarPrimeiroAdministrador({
      nomeCompleto: normalizados.nomeCompleto,
      email: normalizados.email,
      senhaHash,
      papel: PapelUsuario.ADMINISTRADOR,
    });
  }

  async criarUsuario(dados: DadosCadastroUsuario) {
    const normalizados = this.validarDados(dados);
    if (!Object.values(PapelUsuario).includes(dados.papel)) {
      throw new ErroValidacaoUsuario("Papel de usuário inválido.");
    }

    const existente = await this.usuarios.buscarPorEmail(normalizados.email);
    if (existente) throw new EmailUsuarioJaCadastradoError();

    const senhaHash = await bcrypt.hash(normalizados.senha, CUSTO_BCRYPT);
    try {
      return await this.usuarios.criar({
        nomeCompleto: normalizados.nomeCompleto,
        email: normalizados.email,
        senhaHash,
        papel: dados.papel,
      });
    } catch (erro) {
      if (
        erro instanceof Error &&
        "code" in erro &&
        erro.code === "P2002"
      ) {
        throw new EmailUsuarioJaCadastradoError();
      }
      throw erro;
    }
  }

  async listarUsuarios() {
    return this.usuarios.listar();
  }

  async editarUsuario(
    id: string,
    dados: {
      nomeCompleto?: string;
      email?: string;
      senha?: string;
      papel?: PapelUsuario;
      ativo?: boolean;
    },
  ) {
    if (dados.papel && !Object.values(PapelUsuario).includes(dados.papel)) {
      throw new ErroValidacaoUsuario("Papel de usuário inválido.");
    }

    const atual = await this.usuarios.buscarPorId(id);
    if (!atual) throw new UsuarioNaoEncontradoError();

    const alteracoes: {
      nomeCompleto?: string;
      email?: string;
      senhaHash?: string;
      papel?: PapelUsuario;
      ativo?: boolean;
    } = {};

    if (dados.nomeCompleto !== undefined) {
      const nomeCompleto = dados.nomeCompleto.trim();
      if (!nomeCompleto) throw new ErroValidacaoUsuario("Nome completo não pode ficar vazio.");
      alteracoes.nomeCompleto = nomeCompleto;
    }
    if (dados.email !== undefined) {
      const email = dados.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ErroValidacaoUsuario("Informe um e-mail válido.");
      }
      const existente = await this.usuarios.buscarPorEmail(email);
      if (existente && existente.id !== id) throw new EmailUsuarioJaCadastradoError();
      alteracoes.email = email;
    }
    if (dados.senha !== undefined) {
      if (dados.senha.length < TAMANHO_MINIMO_SENHA) {
        throw new ErroValidacaoUsuario(`A senha deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
      }
      alteracoes.senhaHash = await bcrypt.hash(dados.senha, CUSTO_BCRYPT);
    }
    if (dados.papel !== undefined) alteracoes.papel = dados.papel;
    if (dados.ativo !== undefined) alteracoes.ativo = dados.ativo;

    try {
      return await this.usuarios.editar(id, alteracoes);
    } catch (erro) {
      if (
        erro instanceof Error &&
        "code" in erro &&
        erro.code === "P2002"
      ) {
        throw new EmailUsuarioJaCadastradoError();
      }
      throw erro;
    }
  }

  async excluirUsuario(id: string, solicitanteId: string) {
    return this.usuarios.excluir(id, solicitanteId);
  }

  async autenticar(emailInformado: string, senha: string) {
    const email = emailInformado.trim().toLowerCase();
    const usuario = await this.usuarios.buscarPorEmail(email);
    if (!usuario || !usuario.ativo || !(await bcrypt.compare(senha, usuario.senhaHash))) {
      return null;
    }
    return usuario;
  }

  private validarDados(dados: {
    nomeCompleto: string;
    email: string;
    senha: string;
  }) {
    const nomeCompleto = dados.nomeCompleto?.trim();
    const email = dados.email?.trim().toLowerCase();

    if (!nomeCompleto) throw new ErroValidacaoUsuario("Nome completo é obrigatório.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ErroValidacaoUsuario("Informe um e-mail válido.");
    }
    if (typeof dados.senha !== "string" || dados.senha.length < TAMANHO_MINIMO_SENHA) {
      throw new ErroValidacaoUsuario(`A senha deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
    }

    return { nomeCompleto, email, senha: dados.senha };
  }
}

export class ErroValidacaoUsuario extends Error {}
export class EmailUsuarioJaCadastradoError extends Error {}
export { SetupInicialJaConcluidoError };
export {
  AdministradorInicialProtegidoError,
  AutoExclusaoUsuarioError,
  UltimoAdministradorError,
  UsuarioNaoEncontradoError,
};
