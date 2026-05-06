import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { hashInvitationToken, getInvitationClaimError } from '@/lib/invitations'
import { AcceptInvitationForm } from './_components/accept-form'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function DavetPage({ params }: PageProps) {
  const { token } = await params

  if (!token || token.length < 10) {
    return <InvalidInvitationCard reason="Geçersiz davet bağlantısı" />
  }

  const tokenHash = hashInvitationToken(token)
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      setAsOwner: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      attemptCount: true,
      organization: {
        select: { name: true, brandColor: true },
      },
    },
  })

  if (!invitation) {
    return <InvalidInvitationCard reason="Davet bulunamadı veya süresi dolmuş olabilir." />
  }

  const claimError = getInvitationClaimError(invitation)
  if (claimError) {
    return <InvalidInvitationCard reason={claimError} />
  }

  const roleLabel = invitation.setAsOwner
    ? 'Esas Yönetici'
    : invitation.role === 'admin'
    ? 'Yönetici'
    : 'Personel'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-emerald-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div
          className="px-8 py-6 text-white"
          style={{ background: `linear-gradient(135deg, ${invitation.organization.brandColor}, #0f4a35)` }}
        >
          <p className="text-sm opacity-90">{invitation.organization.name}</p>
          <h1 className="text-2xl font-bold mt-1">Hesabınızı Oluşturun</h1>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Merhaba,</p>
            <p className="text-base font-semibold text-slate-900">
              {invitation.firstName} {invitation.lastName}
            </p>
            <p className="text-sm text-slate-600">
              <strong>{invitation.organization.name}</strong> sistemine{' '}
              <strong>{roleLabel}</strong> olarak davet edildiniz.
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500 mb-0.5">E-posta</p>
            <p className="text-sm font-medium text-slate-900">{invitation.email}</p>
          </div>

          <AcceptInvitationForm
            token={token}
            email={invitation.email}
            organizationName={invitation.organization.name}
          />
        </div>
      </div>
    </div>
  )
}

function InvalidInvitationCard({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-rose-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 mx-auto flex items-center justify-center text-rose-600">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Davet Geçersiz</h1>
        <p className="text-sm text-slate-600">{reason}</p>
        <p className="text-xs text-slate-500 mt-4">
          Sizi davet eden kişiden yeni bir davet bağlantısı talep edebilirsiniz.
        </p>
        <a
          href="/auth/login"
          className="inline-block mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          Giriş sayfasına dön →
        </a>
      </div>
    </div>
  )
}
