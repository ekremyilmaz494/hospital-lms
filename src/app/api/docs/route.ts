import { NextResponse } from 'next/server'
import { openApiSpec } from './swagger'

/** OpenAPI 3.0.3 JSON endpoint — Swagger UI bu endpoint'i kullanir */
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return NextResponse.json(openApiSpec, {
    headers: { 'Access-Control-Allow-Origin': appUrl },
  })
}
