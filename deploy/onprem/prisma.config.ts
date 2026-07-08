// On-prem runner için minimal Prisma config (entrypoint'teki `prisma migrate deploy`).
// dotenv YOK — env değişkenleri konteyner tarafından zaten sağlanır. datasource url
// DIRECT_URL (yoksa DATABASE_URL) — compose'da ikisi de aynı postgres'e bakar.
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
})
