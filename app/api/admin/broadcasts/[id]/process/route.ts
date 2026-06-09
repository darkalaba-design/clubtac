import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageBroadcasts } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { getBroadcastDeliveryMode, type BroadcastRow } from '@/lib/admin/broadcasts'
import { processBroadcastBatch } from '@/lib/admin/processBroadcastBatch'

type RouteParams = { params: Promise<{ id: string }> }

/** Следующая порция отправки (режим app, без webhook рассылки в Make). */
export async function POST(request: NextRequest, ctx: RouteParams) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageBroadcasts(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Только root может управлять рассылками' }, { status: 403 })
    }

    if (getBroadcastDeliveryMode() === 'make') {
        return NextResponse.json(
            { error: 'Отправка идёт через Make.com — этот endpoint не используется' },
            { status: 409 }
        )
    }

    const { id } = await ctx.params
    if (!id?.trim()) {
        return NextResponse.json({ error: 'Некорректный id рассылки' }, { status: 400 })
    }

    let limit = 8
    const limitRaw = request.nextUrl.searchParams.get('limit')
    if (limitRaw) {
        const n = Number.parseInt(limitRaw, 10)
        if (Number.isFinite(n)) limit = Math.min(20, Math.max(1, n))
    }

    try {
        const result = await processBroadcastBatch(gate.supabase, id, limit)
        const { data: broadcast } = await gate.supabase
            .from('clubtac_broadcasts')
            .select('*')
            .eq('id', id)
            .maybeSingle()

        const row = broadcast as BroadcastRow | null
        const total = row?.total_recipients ?? 0
        const done = (row?.sent_count ?? 0) + (row?.error_count ?? 0)
        const progress_percent = total > 0 ? Math.round((done / total) * 100) : 0

        return NextResponse.json({
            ...result,
            broadcast: row,
            progress_percent,
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Не удалось отправить порцию'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
