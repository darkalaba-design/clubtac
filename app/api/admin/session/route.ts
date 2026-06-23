import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { actorMayUseAppAdminContent } from '@/lib/admin/appAdminSurface'
import { getBroadcastsForAdminsEnabled } from '@/lib/admin/appSettings'
import { canManageBroadcasts } from '@/lib/admin/appRole'

/**
 * Текущий пользователь и роль (по подписанному initData).
 * `app_admin_ui` — можно ли пользоваться новой админкой в приложении (роль + этаповый allowlist).
 */
export async function GET(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const { actor } = gate
    const broadcastsForAdminsEnabled = await getBroadcastsForAdminsEnabled(gate.supabase)
    return NextResponse.json({
        app_role: actor.app_role,
        club_id: actor.club_id,
        admin_club_id: actor.admin_club_id,
        user: {
            id: actor.id,
            telegram_id: actor.telegram_id,
            first_name: actor.first_name,
            username: actor.username,
        },
        app_admin_ui: actorMayUseAppAdminContent(actor),
        broadcasts_for_admins_enabled: broadcastsForAdminsEnabled,
        can_manage_broadcasts: canManageBroadcasts(actor.app_role, broadcastsForAdminsEnabled),
    })
}
