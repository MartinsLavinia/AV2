# Decisões técnicas e regras de negócio

Este documento registra por que o GreenCode AV2 foi estruturado dessa forma, quais alternativas foram consideradas e quais limites permanecem. O enunciado da AV2 apresenta recomendações e princípios; quando oferece alternativas, as escolhas abaixo são decisões deste projeto, não exigências literais do professor.

## Evolução da AV1 para a AV2

Na AV1, o GreenCode era operado por comandos no terminal e persistia dados em arquivos. Na AV2, as responsabilidades de negócio foram preservadas e expostas por HTTP: o cliente envia uma requisição JSON, a API valida a entrada, executa regras e persiste o resultado em PostgreSQL. A interface gráfica não faz parte do escopo desta API; ela poderá ser construída como cliente em etapa posterior.

As regras preservadas incluem papéis de usuário, validação de CNPJ, ciclo de vida de lotes/equipamentos, triagem, rastreamento, movimentações, histórico e relatório. A migração substitui o mecanismo de persistência, não o propósito do sistema.

## Arquitetura em camadas

O enunciado sugere Controller-Service-Repository. O projeto aplica essa separação:

- **Routes** declaram caminho, método HTTP, validação estrutural de entrada e papel permitido.
- **Controllers** traduzem parâmetros HTTP para chamadas de serviço e formatam a resposta.
- **Services** concentram validações e regras de negócio, sem depender do formato de apresentação do CLI.
- **Repositories** encapsulam consultas e gravações Prisma.
- **Domain** mantém validações que pertencem ao domínio, como CNPJ.
- **Infrastructure** instancia e configura a conexão Prisma/PostgreSQL.

Manter as regras nos serviços evita duplicá-las em cada rota e deixa a persistência substituível sem reescrever a política de negócio. O sistema continua sendo um monólito: as camadas são módulos no mesmo processo, com implantação simples e limites internos claros.

## Tecnologias e alternativas

| Escolha | Motivo | Alternativa citada/possível |
|---|---|---|
| Node.js + TypeScript | Alinha runtime e linguagem, com tipagem estática para os contratos internos. | JavaScript sem tipos ou outro runtime de servidor. |
| Fastify | Recomendado no enunciado; oferece plugins, hooks, validação com JSON Schema e respostas HTTP estruturadas. | Express também é aceito pelo enunciado. |
| Prisma ORM | Schema declarativo, cliente tipado, migrações e transações; reduz SQL repetitivo. | SQL explícito ou outro ORM. |
| PostgreSQL | Banco relacional indicado, com transações ACID, constraints e suporte a UUID/JSON. | O enunciado também permite MySQL. |
| `@fastify/jwt` | Integra assinatura/verificação JWT diretamente ao Fastify. | Outro mecanismo de token compatível com os requisitos. |
| `bcryptjs` | Implementa hash adaptativo de senha em JavaScript, sem armazenar senha em texto puro. | Biblioteca bcrypt equivalente, conforme orientação do enunciado. |

## Persistência e integridade

Os modelos relacionais incluem organização, contrato, lote, equipamento, movimentação, usuário e configuração global. As relações usam chaves estrangeiras e políticas restritivas onde apagar um registro pai apagaria ou deixaria sem contexto dados operacionais relevantes. Exemplos: organização com lote/contrato, lote com equipamentos e equipamento com movimentações não pode ser removido até que seus vínculos sejam resolvidos.

Constraints do banco complementam as validações do serviço: CNPJ, e-mail e código de barras são únicos; contrato tem organização única; equipamento tem posição única dentro do lote. Isso protege a integridade também contra requisições concorrentes que passem simultaneamente pela validação da aplicação.

Migrações versionadas descrevem a evolução do schema. Em ambiente novo, `prisma migrate deploy` aplica as migrações existentes; `prisma generate` gera o cliente tipado usado pelo código.

## Autenticação e autorização

O primeiro administrador é criado por configuração inicial de uso único (`POST /auth/setup`), e não por seed automático. Isso evita instalar uma conta privilegiada padrão em qualquer ambiente. Depois, o login verifica o hash com bcrypt e emite JWT com identificador e papel, conforme o fluxo sugerido na AV2. O token tem duração fixa de 30 minutos.

As rotas protegidas verificam o JWT e consultam no banco se o usuário ainda existe e está ativo; a aplicação usa o papel atual persistido para autorizar a operação. Assim, desativar uma conta ou alterar seu papel passa a valer nas próximas requisições mesmo que o token anterior ainda não tenha expirado.

Os papéis refletem a divisão funcional herdada da AV1: administrador administra contas e parâmetros globais; operador mantém organizações e contratos; gestor mantém lotes e equipamentos; auditor só consulta rastreamento, histórico e relatório. A autorização é aplicada nas rotas, além das regras de negócio nos serviços quando necessário.

### Limite da sessão

O token expira após 30 minutos desde o login, independentemente de atividade. A API não renova token por requisição nem mantém um registro de última atividade no banco. Essa decisão mantém autenticação stateless e evita gravação persistente a cada chamada; portanto, não implementa expiração por 30 minutos de inatividade deslizante.

## Concorrência otimista

Organização, contrato, lote e equipamento possuem `versao`. Para editar, o cliente informa a versão lida; o repositório só grava se a versão ainda for a mesma e incrementa o valor. Se outro cliente alterou o registro primeiro, a operação não sobrescreve silenciosamente a mudança e retorna conflito. A exclusão desses recursos também recebe versão.

Usuários possuem um campo `versao`, mas a edição de usuário ainda não usa controle otimista. Configurações globais também não possuem versão. O escopo acordado priorizou evitar atualizações perdidas nas entidades operacionais e deixou esses dois pontos fora do mecanismo.

## Transações e processamento de lotes

O enunciado pede identificar operações que precisam ser atômicas. A mudança de status de equipamento e a criação da movimentação correspondente são feitas em transação; o sistema não deve registrar uma mudança sem o evento que a explica. A atualização derivada do status do lote ocorre no mesmo fluxo transacional de criação, remoção ou mudança operacional de equipamento para manter os dados coerentes.

O status agregado do lote segue estas regras adotadas pelo projeto:

1. Lote vazio ou com todos os itens em `AGUARDANDO_TRIAGEM`: `RECEBIDO`.
2. Pelo menos um item ainda em `AGUARDANDO_TRIAGEM` ou `EM_TRIAGEM`: `EM_TRIAGEM`.
3. Após concluir triagem de todos, o lote assume a etapa mais frequente entre `TRIAGEM_CONCLUIDA` e `ENCAMINHADO`; em empate, escolhe a menos avançada (`TRIAGEM_CONCLUIDA`).
4. `FINALIZADO` somente quando todos os equipamentos estão em `BAIXA_DEFINITIVA`.

Essa política mostra o estágio predominante sem declarar o lote finalizado enquanto houver item pendente. A enumeração de estágios do lote é uma agregação do projeto; o equipamento mantém o status detalhado de rastreamento.

## Validações e ciclo de vida

- CNPJ é normalizado para dígitos e validado com seus dígitos verificadores; também precisa ser único.
- Enums limitam tipo de equipamento, estado físico, papel e status aos valores definidos no schema.
- A data de entrada de lote aceita somente hoje ou os 90 dias anteriores.
- Uma organização inativa não recebe novo contrato ou lote.
- Uma organização pode ter no máximo um contrato.
- Triagem só começa de `AGUARDANDO_TRIAGEM` e só conclui de `EM_TRIAGEM`.
- Avanço do rastreamento respeita transições declaradas no serviço; não se pode voltar de baixa definitiva.
- Alterar estado físico não cria movimentação, pois não representa deslocamento. Uma justificativa é exigida para saltos grandes na escala adotada.
- Exclusões respeitam vínculos e versões; quando a exclusão comprometer histórico ou dados dependentes, a API bloqueia e informa o conflito.

## Relatório e interpretação dos cálculos

O relatório reúne indicadores de operação e valores mensais estimados a partir dos contratos ativos ligados a organizações ativas. Aplica a alíquota configurada para estimar imposto e valor líquido; são projeções informativas, não apuração fiscal, faturamento reconhecido ou valor recebido.

O campo `pesoEquivalenteDepreciadoKg` representa um equivalente de peso calculado pelo coeficiente anual e pelo tempo de fabricação. É uma estimativa física para comparação de impacto/condição do inventário, não depreciação contábil em reais. A alíquota de imposto não altera o peso.

## Auditoria: escopo do histórico

O histórico consultável pelo auditor é o histórico de movimentações dos equipamentos. Não é um log geral de toda edição/exclusão de usuário, organização, contrato, configuração ou lote. Essa delimitação evita misturar eventos operacionais de rastreamento com auditoria administrativa; um log transversal pode ser adicionado se virar requisito do produto.

## Seed e dados de demonstração

`prisma/seed.ts` contém massa representativa para testar operador, gestor e auditor e só executa se `SEED_DEMO_DATA=true`. O seed é uma ferramenta de desenvolvimento, não o fluxo de criação de contas de produção. Ele não cria administrador e deve ser executado apenas em banco não produtivo, pois reexecutá-lo redefine as senhas e papéis das contas demo.

## Verificação automatizada

`npm run test:journey` exercita a API de ponta a ponta em schema temporário, aplicando migrações e removendo o schema ao terminar. O roteiro cobre configuração inicial, login, papéis, CRUD, validações, concorrência otimista, triagem, movimentações, status agregado de lote, relatório e comportamento do seed. A conexão é limitada a PostgreSQL local para reduzir o risco de atingir um banco remoto.

## Graceful shutdown

Ao receber `SIGINT` ou `SIGTERM`, o servidor fecha o Fastify, interrompe a aceitação de novas conexões e aguarda as requisições em andamento. Só então encerra a conexão do Prisma. Essa sequência reduz falhas e operações interrompidas durante desligamento ou reinicialização.

## Compatibilidade

O enunciado da AV2 pede compatibilidade com Windows 10 ou superior e Ubuntu 24.04.03 ou superior (e derivados). A aplicação usa Node.js, TypeScript e PostgreSQL, mas a compatibilidade completa também depende de instalar versões compatíveis dessas ferramentas e configurar o banco no sistema operacional de destino.
