import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      departmentId: true,
      title: true,
      phone: true,
      avatarUrl: true,
      isActive: true,
      kvkkConsent: true,
      kvkkConsentDate: true,
      createdAt: true,
      updatedAt: true,
      departmentRel: { select: { name: true } },
      organization: { select: { name: true, sessionTimeout: true } },
    },
  })

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    user: {
      ...dbUser,
      department: dbUser.departmentRel?.name ?? null,
      organizationName: dbUser.organization?.name ?? null,
      sessionTimeout: dbUser.organization?.sessionTimeout ?? 30,
    },
  })
}
