# Velas Luamme

Sistema web para a gestão e a venda de velas aromáticas: produtos e categorias, estoque com histórico completo, ponto de venda (PDV), histórico e cancelamento de vendas, recibo, clientes, dashboard, relatórios e configurações da loja. Funciona no celular (PWA instalável) e no computador.

**Stack:** Next.js 16 (App Router, Server Actions, Turbopack, React Compiler) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL (`pg`, SQL puro) · zod · recharts · sonner · vitest

## Funcionalidades

- **Dashboard:** saudação, indicadores do mês comparados ao mês anterior, faturamento diário (30 dias), top 5 velas, alertas de estoque com "Dar entrada", últimas vendas e atalhos.
- **Nova venda (PDV):** busca e leitor de código (SKU), filtro por categoria, carrinho limitado ao estoque (avisa quando a quantidade digitada passa do disponível), cliente opcional com cadastro rápido, forma de pagamento, canal, desconto em R$ ou %, troco, confirmação, rascunho salvo no navegador e atalhos de teclado (`/`, Ctrl+Enter).
- **Vendas:** histórico com filtros (período, cliente, pagamento, canal, situação), busca por nº, cliente, vela, aroma, SKU ou categoria, totais do filtro, CSV; detalhe com custo e margem (venda cancelada aparece riscada e fora das contas); cancelamento com motivo (devolve o estoque); recibo imprimível com o aroma de cada item em `/vendas/[id]/recibo` e `/recibo/[id]`, com envio pelo WhatsApp ou cópia do texto.
- **Estoque:** visão geral com valores a custo e a preço, entrada, saída (sem deixar tirar mais do que há em estoque: avisa e oferece "Tirar todas as N unidades"), contagem de inventário, entrada em lote, histórico de movimentações com filtros e CSV.
- **Produtos:** listagem com filtros e ordenações, formulário com margem ao vivo, sugestão de preço pela margem desejada (arredonda para cima, nunca abaixo da margem), detalhe com indicadores e linha do tempo, duplicar (abre o formulário já preenchido com "(cópia)", sem SKU e sem estoque; só grava ao cadastrar), desativar, categorias. Preço zero e SKU repetido são recusados com aviso no próprio campo.
- **Clientes:** lista com segmentos (recorrentes, sumidos, sem compras), ficha com histórico, aromas favoritos e WhatsApp.
- **Relatórios:** período livre com comparação, gráficos por dia, pagamento, canal, categoria, aroma e dia da semana, rankings, produtos parados e 10 exportações CSV.
- **Configurações:** dados da loja (usados no recibo), estoque mínimo padrão, troca de senha (hash scrypt no banco), instalação do app.
- **Shell:** sidebar recolhível no desktop, barra inferior no celular, paleta de comandos (Ctrl/⌘+K), toasts, skeletons por rota, páginas de erro e 404.
- **Segurança:** sessão em cookie assinado (HMAC), limite de 5 tentativas de login a cada 15 min por IP, cabeçalhos de segurança no `next.config.ts`.

## Estrutura

```
src/
├── app/
│   ├── (painel)/             Área autenticada (dashboard, vendas, estoque, produtos, clientes, relatórios, configurações)
│   ├── api/export/           CSVs (estoque, vendas, relatórios)
│   ├── recibo/[id]/          Recibo fora do layout do painel (impressão limpa)
│   ├── login/                Tela de acesso e action `entrar`
│   ├── actions.ts            Só a action `logout` (o resto da v1 foi para lib/dominio)
│   └── manifest.ts           Manifest do PWA
├── components/
│   ├── ui/                   Kit de componentes (botões, campos, tabelas, diálogos, filtros…)
│   ├── shell/                Navegação, esqueletos de carregamento
│   ├── command-palette/      Paleta de comandos
│   └── graficos/             Gráficos (recharts + barras em HTML)
├── lib/
│   ├── dominio/              Regras de negócio, enums, schemas zod e Server Actions de escrita
│   ├── consultas/            Consultas de leitura (server-only)
│   ├── db.ts · auth.ts · format.ts · periodo.ts · csv.ts · rate-limit.ts
└── proxy.ts                  Redireciona para /login?de=… sem sessão
db/migrations/NNN_nome.sql    Migrações versionadas (aplicadas em ordem)
db/schema.sql                 Esquema completo gerado (fallback)
scripts/migrate.mjs           Aplica migrações pendentes (`--status` lista)
scripts/seed.mjs              Dados de demonstração (APAGA dados; só em staging)
scripts/deploy.sh             Build + publicação na VPS
```

### Regras de negócio

- Venda é registrada numa transação: trava as linhas dos produtos, valida estoque, grava itens com nome, preço e custo do momento e dá baixa automática.
- Preços, custos, descontos e totais são sempre recalculados no servidor (`total = subtotal − desconto`).
- Toda alteração de estoque gera uma movimentação com motivo e saldo após a movimentação.
- Cancelar uma venda devolve o estoque (motivo `cancelamento_venda`); **vendas canceladas não entram em nenhum total, relatório ou dashboard**.
- "Estoque baixo" = quantidade ≤ mínimo do produto; o padrão de novos produtos vem das Configurações.
- Desativar produto ou cliente é exclusão lógica: o histórico é preservado.
- Datas e agrupamentos usam o fuso `America/Sao_Paulo`.
- A senha salva em Configurações (`admin_senha_hash`) tem prioridade sobre `ADMIN_PASSWORD`.
- Custo `0` num item vendido significa "custo não informado": esse item fica fora do lucro e da margem (dashboard, relatórios, histórico de vendas e detalhe do produto), e as telas avisam quanto do faturamento está sem custo. Ao informar o custo de um produto, as vendas antigas dele sem custo recebem esse valor como estimativa.
- Vendas têm chave de idempotência: reenviar a mesma venda depois de uma falha de rede não a duplica.
- O cookie de sessão carrega uma versão derivada da senha: trocar a senha ou usar "Sair de todos os aparelhos" (Configurações) desconecta os outros aparelhos.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha DATABASE_URL, SESSION_SECRET (≥ 32 caracteres), ADMIN_USER, ADMIN_PASSWORD
npm install
npm run migrate              # node --env-file=.env.local scripts/migrate.mjs
npm run seed                 # opcional: dados de demonstração (APAGA os dados do banco de staging)
npm run dev
```

Verificações:

```bash
npx tsc --noEmit
npx eslint src scripts
npm test                     # testes unitários
# Integração contra o STAGING. O teste de ações APAGA os dados e os de consulta precisam do seed,
# então rode nesta ordem (não todos juntos, que rodam em paralelo):
INTEGRACAO=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run acoes.integracao
npm run seed
INTEGRACAO=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run consultas/
```

## Produção

- URL: https://luamme.caiocinel.com
- VPS: `/opt/velas-luamme` (`current` → release ativa, `.env` com as variáveis)
- Processo PM2: `velas-luamme` em `127.0.0.1:3210`
- nginx: `/etc/nginx/sites-available/luamme` (certificado Let's Encrypt com renovação automática do certbot). O nginx PRECISA sobrescrever o cabeçalho com `proxy_set_header X-Real-IP $remote_addr;` (senão o cliente pode forjá-lo e escapar do limite de tentativas de login por IP). Alternativas pela variável `LOGIN_IP_HEADER`: `x-forwarded-for` (usa só o último salto, com `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`) ou `nenhum` (só o limite global: 30 falhas/hora para a conta, independente do IP).
- Compressão: o Next roda com `compress: false` (next.config.ts), então quem comprime é o nginx. No bloco `server` (ou em `nginx.conf`) mantenha: `gzip on; gzip_vary on; gzip_proxied any; gzip_comp_level 5; gzip_types text/plain text/css text/csv application/javascript application/json application/manifest+json image/svg+xml text/x-component;` (o padrão do nginx só comprime `text/html`).
- Banco: database `luamme` no PostgreSQL da VPS

Para publicar uma nova versão (build, pacote standalone com `db/migrations` e `scripts/migrate.mjs`, migrações e reload do PM2):

```bash
bash scripts/deploy.sh
```

As migrações rodam com a release anterior ainda no ar (antes do `pm2 startOrReload`) e o deploy guarda as 3 últimas releases para rollback. Por isso elas precisam ser compatíveis com o código anterior: a 002/003 deixam `vendas.subtotal` sem DEFAULT e um gatilho (`vendas_completar_subtotal`) preenche `subtotal = total + desconto` quando o INSERT não informa, que é o caso do código da v1. Rollback para a v1 = apontar `current` para a release antiga e recarregar o PM2. Não é preciso desfazer migrações, e esse gatilho não pode ser removido enquanto a v1 for uma opção de rollback.

Depois do primeiro deploy da v2, os cookies de sessão da v1 deixam de valer (o formato ganhou a versão da sessão): é preciso entrar de novo uma vez.
