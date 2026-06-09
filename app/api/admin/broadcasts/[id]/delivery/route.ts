import { NextRequest, NextResponse } from 'next/server'
import { applyBroadcastDeliveryResult } from '@/lib/admin/applyBroadcastDeliveryResult'
import { isValidBroadcastDeliverySecret, getBroadcastDeliverySecret } from '@/lib/admin/broadcastDeliverySecret'
import { parseMakeBroadcastResponse } from '@/lib/admin/parseMakeBroadcastResponse'
import { createServiceRoleClient } from '@/lib/supabase/service'

type RouteParams = { params: Promise<{ id: string }> }

const DELIVERY_SECRET_HEADER = 'x-clubtac-broadcast-secret'

function parseDeliveryBody(body: unknown, rawText: string): { sentUserIds: number[] } | { error: string } {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
        const obj = body as Record<string, unknown>
        const rawIds = obj.sent_user_ids ?? obj.sentUserIds ?? obj.user_ids ?? obj.userIds
        if (Array.isArray(rawIds)) {
            const ids = [
                ...new Set(
                    rawIds
                        .map((v) => Number.parseInt(String(v), 10))
                        .filter((id) => Number.isFinite(id) && id > 0)
                ),
            ]
            return { sentUserIds: ids }
        }
        if (typeof rawIds === 'string' && rawIds.trim()) {
            return parseMakeBroadcastResponse(rawIds)
        }
    }

    if (rawText.trim()) {
        return parseMakeBroadcastResponse(rawText)
    }

    return { error: 'Нужен sent_user_ids или текстовый список id' }
}

/**
 * Callback от Make после завершения рассылки.
 * Заголовок: X-Clubtac-Broadcast-Secret = CLUBTAC_BROADCAST_DELIVERY_SECRET
 * Тело: { "sent_user_ids": [1, 2, 3] } или "1,2,3"
 */
export async function POST(request: NextRequest, ctx: RouteParams) {
    if (!getBroadcastDeliverySecret()) {
        return NextResponse.json(
            { error: 'Задайте CLUBTAC_BROADCAST_DELIVERY_SECRET на сервере' },
            { status: 503 }
        )
    }
    if (!isValidBroadcastDeliverySecret(request.headers.get(DELIVERY_SECRET_HEADER))) {
        return NextResponse.json({ error: 'Неверный или отсутствующий секрет доставки' }, { status: 401 })
    }

    const { id } = await ctx.params
    if (!id?.trim()) {
        return NextResponse.json({ error: 'Некорректный id рассылки' }, { status: 400 })
    }

    const rawText = await request.text()
    let body: unknown = null
    if (rawText.trim()) {
        try {
            body = JSON.parse(rawText)
        } catch {
            body = null
        }
    }

    const parsed = parseDeliveryBody(body, rawText)
    if ('error' in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: broadcast, error: loadErr } = await supabase
        .from('clubtac_broadcasts')
        .select('id, status')
        .eq('id', id)
        .maybeSingle()

    if (loadErr) {
        console.error('POST /api/admin/broadcasts/[id]/delivery load:', loadErr)
        return NextResponse.json({ error: loadErr.message }, { status: 500 })
    }
    if (!broadcast) {
        return NextResponse.json({ error: 'Рассылка не найдена' }, { status: 404 })
    }

    if ((broadcast as { status: string }).status === 'cancelled') {
        return NextResponse.json({ error: 'Рассылка отменена' }, { status: 409 })
    }

    try {
        await applyBroadcastDeliveryResult(supabase, id, parsed.sentUserIds)
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Не удалось сохранить результат'
        console.error('POST /api/admin/broadcasts/[id]/delivery apply:', e)
        return NextResponse.json({ error: msg }, { status: 500 })
    }

    const { data: updated } = await supabase.from('clubtac_broadcasts').select('*').eq('id', id).single()

    return NextResponse.json({
        ok: true,
        broadcast: updated,
        sent_count: parsed.sentUserIds.length,
    })
}
