FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY package.json ./package.json
RUN pnpm install

COPY . ./

EXPOSE 3001

CMD ["pnpm", "start"] 