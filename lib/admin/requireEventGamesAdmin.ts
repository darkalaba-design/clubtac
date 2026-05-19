import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { isUuid } from '@/lib/uuid'

export async function requireEventGamesAdmin(request: NextRequest, eventId: string) {
    const gate = await requireActor(request)
    if (!gate.ok) return { ok: false as const, response: gate.response }

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return { ok: false as const, response: blocked }

    if (!canManageEvents(gate.actor.app_role)) {
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 }),
        }
    }

    if (!eventId || typeof eventId !== 'string' || !isUuid(eventId)) {
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Некорректный id события (ожидается UUID)' }, { status: 400 }),
        }
    }

    return { ok: true as const, supabase: gate.supabase, actor: gate.actor }
}
