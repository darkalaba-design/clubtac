import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageBroadcasts } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { refreshBroadcastStats, type BroadcastRow } from '@/lib/admin/broadcasts'

type RouteParams = { params: Promise<{ id: string }> }

async function gateBroadcast(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return { ok: false as const, response: gate.response }
    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return { ok: false as const, response: blocked }
    if (!canManageBroadcasts(gate.actor.app_role)) {
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Только root может управлять рассылками' }, { status: 403 }),
        }
    }
    return { ok: true as const, gate }
}

/** Детали рассылки и прогресс. */
export async function GET(request: NextRequest, ctx: RouteParams) {
    const access = await gateBroadcast(request)
    if (!access.ok) return access.response
    const { supabase } = access.gate

    const { id } = await ctx.params
    if (!id?.trim()) {
        return NextResponse.json({ error: 'Некорректный id рассылки' }, { status: 400 })
    }

    const { data: broadcast, error } = await supabase
        .from('clubtac_broadcasts')
        .select('*')
        .eq('id', id)
        .maybeSingle()

    if (error) {
        console.error('GET /api/admin/broadcasts/[id]:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!broadcast) {
        return NextResponse.json({ error: 'Рассылка не найдена' }, { status: 404 })
    }

    const rowBefore = broadcast as BroadcastRow
    if (rowBefore.status === 'sending' || rowBefore.status === 'pending') {
        try {
            await refreshBroadcastStats(supabase, id)
        } catch (e) {
            console.error('GET /api/admin/broadcasts/[id] refresh:', e)
        }
    }

    const { data: refreshed, error: reloadErr } = await supabase
        .from('clubtac_broadcasts')
        .select('*')
        .eq('id', id)
        .maybeSingle()

    if (reloadErr) {
        console.error('GET /api/admin/broadcasts/[id] reload:', reloadErr)
        return NextResponse.json({ error: reloadErr.message }, { status: 500 })
    }
    if (!refreshed) {
        return NextResponse.json({ error: 'Рассылка не найдена' }, { status: 404 })
    }

    const includeErrors = request.nextUrl.searchParams.get('errors') === '1'
    let recent_errors: { user_id: number; error_text: string | null }[] | undefined

    if (includeErrors) {
        const { data: errRows } = await supabase
            .from('clubtac_broadcast_recipients')
            .select('user_id, error_text')
            .eq('broadcast_id', id)
            .eq('status', 'error')
            .order('created_at', { ascending: false })
            .limit(20)
        recent_errors = (errRows ?? []) as { user_id: number; error_text: string | null }[]
    }

    const row = refreshed as BroadcastRow
    const total = row.total_recipients || 0
    const done = row.sent_count + row.error_count
    const progress_percent = total > 0 ? Math.round((done / total) * 100) : 0

    return NextResponse.json({
        broadcast: row,
        progress_percent,
        recent_errors,
    })
}
