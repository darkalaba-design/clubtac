import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import {
    parseAdminPlayerMessageRow,
    sortAdminPlayerMessagesAsc,
    type AdminPlayerMessagesResponse,
} from '@/lib/admin/adminPlayerMessages'

type RouteParams = { params: Promise<{ userId: string }> }

function parseUserId(raw: string): number | null {
    const id = Number.parseInt(raw, 10)
    if (!Number.isFinite(id) || id < 1) return null
    return id
}

/** История переписки бота с игроком (clubtac_messages). */
export async function GET(request: NextRequest, ctx: RouteParams) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const { userId: userIdRaw } = await ctx.params
    const userId = parseUserId(userIdRaw)
    if (userId == null) {
        return NextResponse.json({ error: 'Некорректный id игрока' }, { status: 400 })
    }

    const { supabase } = gate

    const { data: userRow, error: userErr } = await supabase
        .from('clubtac_users')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

    if (userErr) {
        console.error('GET messages user:', userErr)
        return NextResponse.json({ error: userErr.message }, { status: 500 })
    }
    if (!userRow) {
        return NextResponse.json({ error: 'Игрок не найден' }, { status: 404 })
    }

    const { data: rows, error: msgErr } = await supabase
        .from('clubtac_messages')
        .select('id, user_id, message, created_at, sender')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(500)

    if (msgErr) {
        console.error('GET messages:', msgErr)
        return NextResponse.json({ error: msgErr.message }, { status: 500 })
    }

    const messages = sortAdminPlayerMessagesAsc(
        (rows ?? [])
            .map((row) => parseAdminPlayerMessageRow(row as Record<string, unknown>))
            .filter((m): m is NonNullable<typeof m> => m != null)
    )

    const body: AdminPlayerMessagesResponse = { messages }
    return NextResponse.json(body)
}
