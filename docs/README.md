# GreenCode API — AV2

API RESTful para apoiar a logística reversa de equipamentos eletrônicos da GreenCode. Esta entrega evolui o sistema de linha de comando (CLI) desenvolvido na AV1 para um servidor HTTP com persistência relacional, autenticação por token e operações acessíveis a diferentes clientes.

## Objetivo e escopo

A API permite registrar organizações clientes e contratos de coleta, receber lotes, cadastrar e acompanhar equipamentos, registrar movimentações e consultar informações de auditoria. Ela preserva regras de negócio da AV1 e as adapta ao modelo de requisição/resposta HTTP. A AV2 concentra-se no backend; uma interface web pode consumir esta API em uma etapa posterior.

A arquitetura é um monólito modular: um processo Fastify organiza rotas, controllers, serviços e repositórios, e o Prisma persiste os dados em PostgreSQL. Essa divisão facilita entender, testar e evoluir o sistema sem introduzir a complexidade operacional de microsserviços.

## Funcionalidades

- Configuração inicial de um administrador e login com senha protegida por bcrypt e JWT.
- Autorização por papel para administradores, operadores de cadastro, gestores de almoxarifado e auditores.
- CRUD de usuários, organizações, contratos, lotes e equipamentos, respeitando as permissões e vínculos do domínio.
- Validação de CNPJ, campos obrigatórios, enums, datas e regras de negócio; unicidade também é protegida no banco.
- Triagem de equipamentos, transições de rastreamento, movimentações e alteração do estado físico.
- Atualização transacional do processamento do lote e controle otimista de versão em entidades operacionais.
- Consultas de rastreamento, histórico de movimentações e relatório geral para auditoria.
- Configurações globais de alíquota de imposto e coeficiente anual de depreciação.
- Seed de demonstração opt-in e teste automatizado de jornada ponta a ponta.

## Papéis e permissões

| Papel | Responsabilidades permitidas |
|---|---|
| `ADMINISTRADOR` | Criar, consultar, editar e excluir contas; consultar e alterar configurações globais. |
| `OPERADOR_CADASTRO` | Criar, consultar, editar e excluir organizações e contratos. |
| `GESTOR_ALMOXARIFADO` | Criar, consultar, editar e excluir lotes e equipamentos; executar triagem, movimentações e atualização do estado físico. |
| `AUDITOR` | Consultar rastreamento e histórico de movimentações e gerar relatório; não altera dados. |

O administrador é dedicado à gestão de contas e parâmetros. Cada rota de negócio exige o papel correspondente; ter um token válido, por si só, não concede acesso a todas as funções.

## Tecnologias

- Node.js e TypeScript
- Fastify 5 e `@fastify/jwt`
- Prisma ORM 7 com adaptador PostgreSQL
- PostgreSQL
- `bcryptjs` para hash de senhas

## Estrutura do projeto

```text
prisma/       schema, migrações e seed
src/
  controllers/  entrada HTTP e respostas
  domain/       validadores de domínio
  infrastructure/ conexão Prisma/PostgreSQL
  plugins/      autenticação e autorização
  repositories/ persistência e consultas
  routes/       métodos, caminhos e validação de entrada
  services/     regras de negócio
  testeJornada.ts
```

## Como executar localmente

Requisitos: Node.js, npm e PostgreSQL local. Crie um banco vazio e copie `.env.example` para `.env`, ajustando as credenciais:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/greencode?schema=public"
JWT_SECRET="uma-chave-aleatoria-com-pelo-menos-32-caracteres"
PORT=3000
```

`JWT_SECRET` deve ser uma chave aleatória mantida fora do controle de versão. Não reutilize a chave de exemplo em produção.

Gere uma chave aleatória no terminal, dentro da pasta do projeto:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie a chave gerada e cole no .env


Instale dependências, gere o cliente Prisma e aplique as migrações:

```bash
npm install
npm exec -- prisma generate
npm exec -- prisma migrate deploy
```

Inicie em desenvolvimento ou compile e inicie a versão de produção:

```bash
npm run dev
```

```bash
npm run build
npm start
```

Por padrão, a API escuta na porta `3000`; `PORT` permite configurar outra. `GET /` verifica a aplicação e `GET /teste-banco` verifica a conexão com o banco.

### Primeiro acesso

Consulte `GET /auth/status`. Se ainda não houver administrador, envie `POST /auth/setup` com `nomeCompleto`, `email` e `senha` (mínimo de 8 caracteres). Esse cadastro é de uso único. Depois, faça login em `POST /auth/login`; envie o JWT recebido como `Authorization: Bearer <token>` nas rotas protegidas. O token expira em 30 minutos.

## Teste de jornada

O comando `npm run test:journey` inicia uma jornada de integração contra um schema PostgreSQL temporário. Configure `JOURNEY_DATABASE_URL` no `.env` para apontar a uma instância local de desenvolvimento/teste; se não estiver definida, o script usa `DATABASE_URL`. O host é limitado a `localhost`, `127.0.0.1` ou `::1`. O usuário do banco precisa poder criar e remover schemas. O teste aplica migrações e remove apenas o schema aleatório criado por ele; não limpa o schema `public`.

## Seed demonstrativo

O seed é opcional e deve ser usado somente em banco de desenvolvimento. Habilite `SEED_DEMO_DATA=true` no `.env` e execute `npm run db:seed`. Ele cria dados de exemplo para operador, gestor e auditor, além de organização, contrato, lote, equipamentos e movimentação. Não cria administrador: use o endpoint de configuração inicial.

As contas `operador.demo@greencode.local`, `gestor.demo@greencode.local` e `auditor.demo@greencode.local` usam a senha `GreenCode@2026`. Reexecutar o seed redefine senha e papel dessas contas; troque as credenciais ou remova os registros antes de compartilhar o ambiente.

## Documentação complementar

- [Referência da API](API.md): rotas, permissões, corpos de requisição e respostas esperadas.
- [Decisões técnicas e regras de negócio](DECISOES_TECNICAS.md): justificativas, trade-offs e comportamentos adotados.

## Validação automatizada em Linux

O workflow [`testes-linux.yml`](../.github/workflows/testes-linux.yml) executa no GitHub Actions em `ubuntu-24.04`. Ele inicia um PostgreSQL temporário e roda `npm ci`, a geração do cliente Prisma, a compilação TypeScript e o teste de jornada (`npm run test:journey`). O teste de jornada cria e remove um schema temporário próprio.

A compatibilidade automatizada com Linux fica confirmada quando uma execução desse workflow termina com sucesso (check verde) na aba **Actions** do GitHub. O workflow está configurado, e a validação no runner Linux foi apresentada como concluída.
## Compatibilidade e encerramento

A AV2 solicita compatibilidade com Windows 10 ou superior e Ubuntu 24.04.03 ou superior (incluindo distribuições derivadas). O servidor trata `SIGINT` e `SIGTERM`: fecha o Fastify para novas conexões, aguarda requisições em andamento e então desconecta o Prisma.

## Autoria

Desenvolvido por **Lavínia Martins** como parte da atividade AV2 de Técnicas de Programação I.