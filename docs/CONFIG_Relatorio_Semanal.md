# Relatório Semanal por E-mail — Configuração

## Como funciona

O n8n bate na Edge Function **de hora em hora**. A função consulta a tabela `email_schedule_config` e decide se é hora de enviar.

Quem manda no horário é o **card no app** (Configurações → Relatório Semanal por E-mail), não o cron do n8n. Para mudar o dia ou a hora do envio, mude no card — nunca no Schedule Trigger.

---

# Caminho enxuto (é só isso)

Nenhum deploy, nenhuma migration, nenhuma credencial nova.

### 1. Importar o workflow

n8n → Workflows → **Import from File** → [nodesprontos/Weekly_OKR_Email_Report_ENXUTO.json](../nodesprontos/Weekly_OKR_Email_Report_ENXUTO.json)

Ele entra **desativado**. O nó **Send a message** vai pedir a credencial do Gmail — selecione a sua ("Gmail Conta"). É a única coisa a preencher.

### 2. Testar

No nó **HTTP Request**, troque o Body JSON de `{}` para:

```json
{ "user_id": "COLE-UM-UUID-AQUI" }
```

O UUID sai de Supabase → Authentication → Users (use o seu). Isso manda para **uma pessoa só** e **ignora o horário agendado**.

Clique em **Execute Workflow** e confira o e-mail.

> ⚠️ **Volte o Body para `{}` depois.** Se esquecer, o relatório vai só para essa pessoa, para sempre — foi exatamente o que aconteceu antes com o destinatário fixo.

### 3. Ativar

1. No app: Configurações → Relatório Semanal por E-mail → escolha dia e hora → **Salvar**
2. No n8n: ligue a chave **Active**

Fim.

---

## O que esse arquivo corrigiu

| Correção | Por quê |
|---|---|
| `Send a message` → `Split in Batches` | **A principal.** Sem essa linha o loop roda uma vez: só o primeiro da lista recebia. |
| To = `{{ $json.to_email }}` | Estava fixo em `weappnocode@gmail.com`. Era o resquício do teste antigo. |
| `Email Type: HTML` explícito | Garante que o template não chegue como texto cru. |
| Guard no `Explode Emails` | Antes, quando não havia e-mails, o nó estourava em `.map of undefined`. Agora sai limpo ou dá erro explicando. |
| Gmail com 3 tentativas | Uma falha de rede não perde o envio. |

---

## Lendo o resultado

O campo `skipped` na saída do HTTP Request diz por que uma empresa não recebeu:

| Mensagem | Significado |
|---|---|
| `(wrong time: day=1/1 hour=22/9)` | Normal. Não é a hora configurada. Formato: `atual/configurado`. |
| `(disabled)` | A chave no card do app está desligada. |
| `(default schedule not matched)` | A empresa não tem linha em `email_schedule_config`. Salve o card uma vez para criar. |

`count: 0` com `skipped` vazio = não há quarter ativo cobrindo a data de hoje.

**Alguém não recebeu e não aparece no `skipped`?** A pessoa tem `profile` mas não tem conta em `auth.users`, ou está com `is_active = false` / `exclude_from_okr = true`. A função pula esses casos em silêncio.

---
---

# Números do e-mail batendo com a tela

O e-mail mostrava "Progresso Quarter" diferente do que aparece na tela de Check-ins (ex.: 72% no e-mail, 50% na tela). O número não era calculado — vinha da tabela `quarter_results`, que estava congelada.

## Por que estava errado

`quarter_results` só era gravada quando alguém **abria ou salvava a tela de Check-ins** ([KRCheckins.tsx:1061](../src/pages/KRCheckins.tsx#L1061)). A função `process-quarter-results`, que deveria manter a tabela em dia, tinha três defeitos:

1. **Só processava quarter encerrado** (`.lte('end_date', today)`) — o quarter em andamento nunca entrava
2. **Lia a coluna errada** — usava `percentual_atingido`, que guarda o *Atingimento Visual* (Realizado / Meta), e não o progresso **com Piso** que a tela usa
3. **Exigia JWT de admin** — nenhum agendador conseguia chamar

## O que foi corrigido

Em [supabase/functions/process-quarter-results/index.ts](../supabase/functions/process-quarter-results/index.ts):

- Passa a processar todo quarter ativo que já começou, **incluindo o corrente**
- Calcula com `calculateKR` sobre as colunas cruas (`valor_realizado`, `minimo_orcamento`, `meta_checkin`) — cópia fiel de [src/lib/utils.ts](../src/lib/utils.ts)
- Exige os três campos preenchidos e **descarta** o KR quando o cálculo não é válido, sem cair em fallback — igual a tela
- Aceita chamada com `service_role` (agendador) **além** do admin logado, que continua funcionando

A regra de agregação já estava certa e não mudou: média **ponderada** dos KRs dentro de cada objetivo, depois média **simples** dos objetivos.

## Como colocar no ar

### 1. Deploy

```bash
supabase functions deploy process-quarter-results
```

### 2. Criar a credencial (uma vez só)

n8n → **Credentials** → **Create Credential** → **Header Auth**

- **Name**: `Authorization`
- **Value**: `Bearer <SUPABASE_SERVICE_ROLE_KEY>` (Supabase → Settings → API → service_role → Reveal)

Salve como `Supabase Service Role`.

> Essa mesma credencial serve para fechar o endpoint do relatório (seção A, mais abaixo). Criando uma vez, resolve os dois.

### 3. Importar o workflow

n8n → Import from File → [nodesprontos/Atualiza_Quarter_Results.json](../nodesprontos/Atualiza_Quarter_Results.json)

São 2 nós. No nó **Recalcular**, selecione a credencial do passo 2.

Roda no **minuto 30** de cada hora, de propósito: o relatório semanal roda no minuto 0, então `quarter_results` já está atualizado quando o e-mail é montado. Sem corrida entre os dois.

### 4. Testar

**Execute Workflow** e confira a resposta:

```json
{ "message": "Quarter results processed successfully", "processed": 25, "quarters": 1 }
```

Se `processed` vier `0`, nenhum quarter ativo começou ainda, ou nenhum usuário tem check-in com dados.

Depois abra o app: a tela de Check-ins e o Overview devem mostrar o mesmo número.

### 5. Ativar

Ligue a chave **Active** no workflow.

## Como conferir se ficou certo

Compare os três lugares para o mesmo usuário e quarter — devem bater:

| Onde | Valor |
|---|---|
| Check-ins → RESULTADO ATUAL | calculado ao vivo |
| Overview / Histórico de Performance | lê `quarter_results` |
| E-mail → PROGRESSO QUARTER | lê `quarter_results` |

Se divergirem, rode o workflow manualmente e recarregue.

---
---

# Opcional: proteções para depois

Nada aqui é necessário para o fluxo funcionar. São defesas contra problemas que ainda não aconteceram. Adote quando incomodar.

## A. Fechar o endpoint (o único que eu não deixaria pra sempre)

Hoje `get-weekly-report-data` responde **sem autenticação**. Quem descobrir a URL consegue puxar e-mail, nome, setor, OKRs e o ranking completo da empresa de qualquer usuário — a função usa `SERVICE_ROLE_KEY` internamente, então ignora todas as policies de RLS.

Para fechar, na ordem:

1. **n8n → Credentials → Create Credential → Header Auth**
   - Name: `Authorization`
   - Value: `Bearer <SUPABASE_SERVICE_ROLE_KEY>` (Settings → API → service_role → Reveal)
2. No nó **HTTP Request** → Authentication: `Generic Credential Type` → `Header Auth` → escolha a credencial
3. Descomente o bloco no final de [supabase/config.toml](../supabase/config.toml) e faça `supabase functions deploy get-weekly-report-data`

Essa ordem importa: se você ligar o `verify_jwt` antes de criar a credencial, o n8n leva 401 e o fluxo para.

Conferir que fechou (deve dar 401):
```bash
curl -i -X POST https://tasaalobestljwraqjov.supabase.co/functions/v1/get-weekly-report-data -d '{}'
```

A `service_role` ignora RLS: ela vive só dentro do n8n e do Supabase, nunca no frontend nem no git.

## B. Anti-duplicidade, catch-up e paginação

As mudanças já estão escritas em [supabase/functions/get-weekly-report-data/index.ts](../supabase/functions/get-weekly-report-data/index.ts) e na migration [20260728120000](../supabase/migrations/20260728120000_add_last_sent_at_to_email_schedule_config.sql), **sem deploy**. O que elas resolvem:

- **Duplicidade**: reexecutar o workflow na mesma semana reenviava tudo. Com `last_sent_at`, cai no `skipped`.
- **Semana perdida**: a condição era `hora == send_hour` exata. Se o n8n caísse às 9h da segunda, a semana era perdida. Vira "venceu e ainda não enviei", então às 10h envia.
- **Teto de 50 usuários**: `listUsers()` sem paginação devolve 50 registros **do projeto inteiro** (todas as empresas, contas de teste, trials). Do 51º em diante ninguém recebe, sem erro e sem log. Com 25 usuários não é problema hoje.
- **`dashboard_url`**: apontava para `wenkey.com.br`; o resto do projeto usa `wenkey.app`.

### ⚠️ Ou faz as duas, ou não faz nenhuma

O código novo faz `select` da coluna `last_sent_at`. **Sem a coluna, esse select falha** e todas as empresas caem no padrão "segunda 9h", ignorando o card do app.

#### ⛔ NÃO use `supabase db push` neste repositório

O histórico de migrations está fora de sincronia com o banco: **58 migrations locais nunca foram aplicadas no remoto** e 15 alterações remotas não têm arquivo aqui (foram feitas pelo dashboard). Um `db push` tentaria rodar as 58 de uma vez em produção.

Confira você mesmo antes de qualquer coisa:

```bash
npx supabase migration list
```

Crie a coluna manualmente, pelo **SQL Editor** do dashboard:

```sql
ALTER TABLE public.email_schedule_config
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;
```

É idempotente (`IF NOT EXISTS`), não afeta nada existente. O arquivo em `supabase/migrations/` fica como documentação do que foi feito.

Depois, o deploy:

```bash
npx supabase functions deploy get-weekly-report-data
```

Nessa ordem. A função que está no ar hoje funciona normalmente — não há nada meio-aplicado esperando.

## C. Limites do Gmail

Conta comum: 500 destinatários/dia. Workspace: 2000. Com volume alto, vale um nó **Wait** de 1s dentro do loop para não tomar 429.

## D. Dívidas de infraestrutura

- **`email_schedule_config` não tem migration de origem** — a tabela foi criada pelo dashboard e o schema existe só na nuvem. `supabase db pull` resolve.
- **`verify_jwt` também só existe na nuvem** — não está declarado no config.toml, então um redeploy pode mudar esse estado sem ninguém perceber.

## E. Limitação que continua de pé

Mesmo com o item B, o `last_sent_at` é gravado quando a função **entrega** os payloads ao n8n, não quando o Gmail confirma. Se o n8n cair no meio do loop, a semana fica marcada e quem estava na fila não recebe. Fechar isso exigiria o n8n chamar a função de volta ao final do loop.
