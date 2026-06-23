import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { requireEventInManagedClub } from '@/lib/admin/clubScope'
import { notifyMakeEventImageWebhook } from '@/lib/admin/notifyMakeEventImageWebhook'

type RouteParams = { params: Promise<{ id: string }> }

/** Повторная отправка данных события в Make для генерации/обновления обложки. */
export async function POST(request: NextRequest, ctx: RouteParams) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const { id: eventId } = await ctx.params
    if (!eventId || typeof eventId !== 'string') {
        return NextResponse.json({ error: 'Некорректный id события' }, { status: 400 })
    }

    const { supabase } = gate

    const eventAccess = await requireEventInManagedClub(gate.actor, supabase, eventId)
    if (!eventAccess.ok) return eventAccess.response

    const { data: ev, error } = await supabase
        .from('clubtac_events')
        .select('id, title, description, type')
        .eq('id', eventId)
        .maybeSingle()

    if (error) {
        console.error('POST notify-cover:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!ev) {
        return NextResponse.json({ error: 'Событие не найдено' }, { status: 404 })
    }

    notifyMakeEventImageWebhook({
        id: ev.id as string,
        title: ev.title as string,
        description: (ev.description as string | null) ?? null,
        type: ev.type as string,
        imageVersion: 'board',
    })

    return NextResponse.json({ ok: true })
}
