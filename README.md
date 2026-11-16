# Monetra

API REST de finanças pessoais: receitas, despesas, orçamentos e relatórios.

## Stack
NestJS · TypeScript · Prisma · PostgreSQL · Docker

## Aplicação web
O frontend usa React + Vite e fica em `frontend/`, separado da API.

1. Suba o banco e inicie a API:
   ```cmd
   docker compose up -d
   npm run start:dev
   ```
2. Em outro terminal, instale as dependências e inicie o site:
   ```cmd
   cd frontend
   npm install
   npm run dev
   ```
3. Abra o endereço exibido pelo Vite (normalmente `http://localhost:5173`).

O proxy de desenvolvimento encaminha as chamadas do site para a API em `http://localhost:3000`. A interface inclui cadastro/login, resumo mensal, transações e categorias.

## Status
🚧 Em desenvolvimento