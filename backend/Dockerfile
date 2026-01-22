FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# ✅ Prisma config needs DATABASE_URL at generate-time
ARG DATABASE_URL="postgresql://postgres:postgres@db:5432/jex_freight_db?schema=public"
ENV DATABASE_URL=$DATABASE_URL

RUN npx prisma generate --config=./prisma.config.ts
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3001

# ✅ runtime must also have DATABASE_URL via compose env
CMD ["sh", "-c", "npx prisma migrate deploy --config=./prisma.config.ts && node dist/index.js"]

