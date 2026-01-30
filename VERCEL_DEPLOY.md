# Guia de Deploy no Vercel

## Pré-requisitos

1. Conta no [Vercel](https://vercel.com)
2. Repositório Git (GitHub, GitLab ou Bitbucket)
3. Variáveis de ambiente do Supabase configuradas

## Passos para Deploy

### 1. Preparar o Repositório

```bash
# Verificar se o projeto está commitado
git status

# Se houver arquivos não commitados, fazer commit
git add .
git commit -m "Preparar para deploy no Vercel"

# Push para o repositório remoto
git push
```

### 2. Conectar ao Vercel

#### Opção A: Via Web Dashboard

1. Acesse [vercel.com](https://vercel.com)
2. Clique em "Add New" → "Project"
3. Importe seu repositório Git
4. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`: URL do seu projeto Supabase
   - `VITE_SUPABASE_ANON_KEY`: Chave anônima do Supabase

5. Clique em "Deploy"

#### Opção B: Via Vercel CLI

```bash
# Instalar Vercel CLI (se não tiver)
npm i -g vercel

# Fazer login
vercel login

# Deploy
vercel
```

### 3. Configurar Variáveis de Ambiente

No dashboard do Vercel:

1. Vá para **Settings** → **Environment Variables**
2. Adicione as variáveis:

```
VITE_SUPABASE_URL=https://sua-project.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

### 4. Configurar Domínio Customizado (Opcional)

1. Vá para **Settings** → **Domains**
2. Adicione seu domínio
3. Configure os registros DNS conforme orientado

## Arquivo vercel.json

O arquivo `vercel.json` foi criado com a seguinte configuração:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "vite",
  "installCommand": "npm ci",
  "framework": "vite",
  "nodeVersion": "18.x"
}
```

Isso garante que:
- O build use `npm run build`
- Instale dependências com `npm ci` (mais seguro)
- Use Node.js 18.x

## Arquivo .vercelignore

O arquivo `.vercelignore` foi criado para excluir arquivos desnecessários do build, reduzindo o tempo de deployment.

## Redirecionamentos e Rewrite (Se necessário)

Se precisar de redirecionamentos, adicione ao `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## Monitoramento

Após o deploy:

1. Verifique os logs em **Deployments** → **Logs**
2. Teste a aplicação em `https://seu-projeto.vercel.app`
3. Configure Analytics (opcional): **Settings** → **Analytics**

## Troubleshooting

### Build falha
- Verifique se todas as variáveis de ambiente estão configuradas
- Confira se `npm run build` funciona localmente
- Verifique os logs de build no Vercel

### Erro 404 em rotas
- O arquivo `vercel.json` deve ter o rewrite configurado para SPA
- Veja a seção "Redirecionamentos e Rewrite"

### Problema com Supabase
- Verifique se as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão corretas
- Confira se essas chaves estão com prefixo `VITE_` (para serem expostas ao client)

## Automação com GitHub

Para deploy automático a cada push:

1. Conecte seu repositório GitHub ao Vercel
2. Configure a branch padrão em **Settings** → **Git**
3. O deploy será automático a cada push

## Rollback

Se precisar voltar a uma versão anterior:

1. Vá para **Deployments**
2. Encontre a versão desejada
3. Clique em "Promote to Production"

---

**Dúvidas?** Verifique a [documentação do Vercel](https://vercel.com/docs) ou [documentação do Vite](https://vitejs.dev/guide/static-deploy.html#vercel)
