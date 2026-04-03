import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'
import { PROMPT_TEMPLATES } from '@/app/admin/ai-content-studio/lib/prompt-templates'

// GET /api/admin/ai-content-studio/templates
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  return jsonResponse(PROMPT_TEMPLATES)
}
