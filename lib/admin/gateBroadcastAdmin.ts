import { NextRequest, NextResponse } from 'next/server'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { getBroadcastsForAdminsEnabled } from '@/lib/admin/appSettings'
import { canManageBroadcasts } from '@/lib/admin/appRole'
import { requireActor } from '@/lib/admin/requireActor'

export async function requireBroadcastAdmin(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return { ok: false as const, response: gate.response }

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return { ok: false as const, response: blocked }

    const broadcastsForAdminsEnabled = await getBroadcastsForAdminsEnabled(gate.supabase)
    if (!canManageBroadcasts(gate.actor.app_role, broadcastsForAdminsEnabled)) {
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Нет доступа к рассылкам' }, { status: 403 }),
        }
    }

    return { ok: true as const, gate, broadcastsForAdminsEnabled }
}
