FROM node:20-bookworm-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

ARG DATABASE_URL="postgresql://lotiva_user:lotiva_password@postgres:5432/lotiva?schema=public"
ENV DATABASE_URL=$DATABASE_URL

RUN npx prisma generate \
  && npx next build \
  && cp -r public .next/standalone/public \
  && mkdir -p .next/standalone/.next \
  && cp -r .next/static .next/standalone/.next/static

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && cd .next/standalone && node server.js"]
