FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

FROM deps AS build
COPY backend/tsconfig.json ./
COPY backend/prisma ./prisma
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY src/osmParkingSnapshot.ts ../src/osmParkingSnapshot.ts
COPY src/officialPrishtinaParking.ts ../src/officialPrishtinaParking.ts
COPY src/verifiedGoogleParking.ts ../src/verifiedGoogleParking.ts
RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/scripts ./scripts
COPY --from=build /app/backend/package*.json ./
COPY --from=build /app/src ../src
RUN addgroup -S parko && adduser -S parko -G parko && chown -R parko:parko /app
USER parko
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/prepare-production.mjs"]
