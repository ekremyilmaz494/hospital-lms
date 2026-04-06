import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'

/**
 * GET /api/public/organization/[slug]
 * Herkese acik organizasyon branding bilgileri.
 * Auth gerektirmez — login sayfasinda hastane markasini gostermek icin kullanilir.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    if (!slug || slug.length > 50) {
      return errorResponse('Gecersiz organizasyon kodu.', 400)
    }

    const org = await prisma.organization.findUnique({
      where: { code: slug },
      select: {
        name: true,
        logoUrl: true,
        brandColor: true,
        secondaryColor: true,
        loginBannerUrl: true,
      },
    })

    if (!org) {
      return errorResponse('Organizasyon bulunamadi.', 404)
    }

    return jsonResponse({
      name: org.name,
      logoUrl: org.logoUrl,
      brandColor: org.brandColor,
      secondaryColor: org.secondaryColor,
      loginBannerUrl: org.loginBannerUrl,
    })
  } catch {
    return errorResponse('Sunucu hatasi. Lutfen tekrar deneyin.', 500)
  }
}
