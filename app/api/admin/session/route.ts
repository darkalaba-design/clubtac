import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { actorMayUseAppAdminContent } from '@/lib/admin/appAdminSurface'

/**
 * Текущий пользователь и роль (по подписанному initData).
 * `app_admin_ui` — можно ли пользоваться новой админкой в приложении (роль + этаповый allowlist).
 */
export async function GET(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const { actor } = gate
    return NextResponse.json({
        app_role: actor.app_role,
        user: {
            id: actor.id,
            telegram_id: actor.telegram_id,
            first_name: actor.first_name,
            username: actor.username,
        },
        app_admin_ui: actorMayUseAppAdminContent(actor),
    })
}
