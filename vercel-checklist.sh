#!/bin/bash

# Checklist de Deploy para Vercel
# Este script ajuda a verificar se tudo está pronto para o deploy

echo "🔍 Verificando preparação do projeto para Vercel..."
echo ""

# 1. Verificar se arquivos essenciais existem
echo "1. Verificando arquivos de configuração..."
FILES=(
  "vercel.json"
  ".vercelignore"
  "package.json"
  "vite.config.ts"
  "tsconfig.json"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file (FALTANDO)"
  fi
done

echo ""

# 2. Verificar package.json scripts
echo "2. Verificando scripts do package.json..."
if grep -q '"build": "vite build"' package.json; then
  echo "   ✅ Script 'build' configurado"
else
  echo "   ⚠️  Script 'build' não encontrado"
fi

echo ""

# 3. Verificar node_modules
echo "3. Verificando dependências..."
if [ -d "node_modules" ]; then
  echo "   ✅ node_modules encontrado"
else
  echo "   ⚠️  node_modules não encontrado. Execute: npm install"
fi

echo ""

# 4. Verificar .env.example
echo "4. Verificando variáveis de ambiente..."
if [ -f ".env.example" ]; then
  echo "   ✅ .env.example encontrado"
  echo "      Variáveis configuradas:"
  grep "VITE_" .env.example | sed 's/^/      - /'
else
  echo "   ❌ .env.example (FALTANDO)"
fi

echo ""

# 5. Verificar git
echo "5. Verificando repositório Git..."
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "   ✅ Repositório Git inicializado"
  echo "      Branch atual: $(git rev-parse --abbrev-ref HEAD)"
  UNCOMMITTED=$(git status --porcelain | wc -l)
  if [ $UNCOMMITTED -eq 0 ]; then
    echo "   ✅ Todos os arquivos commitados"
  else
    echo "   ⚠️  $UNCOMMITTED arquivo(s) não commitado(s)"
  fi
else
  echo "   ❌ Repositório Git não inicializado"
fi

echo ""
echo "📋 Checklist completo!"
echo ""
echo "⏭️  Próximos passos:"
echo "   1. Certifique-se de que todas as variáveis estão ✅"
echo "   2. Acesse https://vercel.com e faça login"
echo "   3. Importe este repositório"
echo "   4. Configure as variáveis de ambiente no Vercel"
echo "   5. Clique em Deploy"
echo ""
