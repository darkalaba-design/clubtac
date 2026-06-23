import { NextRequest, NextResponse } from 'next/server'
import { requireBroadcastAdmin } from '@/lib/admin/gateBroadcastAdmin'
import {
    countBroadcastAudience,
    getBroadcastDeliveryMode,
    insertBroadcastRecipients,
    parseBroadcastAudience,
    parseBroadcastUserIds,
    parseBroadcastUserIdsQuery,
    resolveBroadcastAudience,
    resolveBroadcastManualAudience,
    type BroadcastRow,
} from '@/lib/admin/broadcasts'
import { applyBroadcastDeliveryResult } from '@/lib/admin/applyBroadcastDeliveryResult'
import { sendBroadcastViaMake } from '@/lib/admin/sendBroadcastViaMake'
import { getActorManagedClubId } from '@/lib/admin/clubScope'

/** Список рассылок и режим доставки. */
export async function GET(request: NextRequest) {
    const access = await requireBroadcastAdmin(request)
    if (!access.ok) return access.response
    const { supabase } = access.gate
    const managedClubId = getActorManagedClubId(access.gate.actor)

    const audienceRaw = request.nextUrl.searchParams.get('audience')
    if (audienceRaw) {
        const audience = parseBroadcastAudience(audienceRaw)
        if (!audience) {
            return NextResponse.json(
                { error: 'audience: all | admins | vip | standard | manual' },
                { status: 400 }
            )
        }
        const userIds =
            audience === 'manual'
                ? parseBroadcastUserIdsQuery(request.nextUrl.searchParams.get('user_ids'))
                : null
        if (audience === 'manual' && !userIds) {
            return NextResponse.json({ error: 'user_ids обязателен для audience=manual' }, { status: 400 })
        }
        const count = await countBroadcastAudience(supabase, audience, userIds, managedClubId)
        return NextResponse.json({ audience, count, user_ids: userIds ?? undefined })
    }

    const { data, error } = await supabase
        .from('clubtac_broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

    if (error) {
        console.error('GET /api/admin/broadcasts:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        delivery_mode: getBroadcastDeliveryMode(),
        broadcasts: (data ?? []) as BroadcastRow[],
    })
}

/** Создать рассылку и запустить отправку (Make или пакетами из приложения). */
export async function POST(request: NextRequest) {
    const access = await requireBroadcastAdmin(request)
    if (!access.ok) return access.response
    const { gate } = access
    const { supabase, actor } = gate
    const managedClubId = getActorManagedClubId(actor)

    let body: { message?: unknown; audience?: unknown; user_ids?: unknown }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) {
        return NextResponse.json({ error: 'Пустое сообщение' }, { status: 400 })
    }

    const audience = parseBroadcastAudience(body.audience)
    if (!audience) {
        return NextResponse.json(
            { error: 'audience: "all", "admins", "vip", "standard" или "manual"' },
            { status: 400 }
        )
    }

    const userIds = audience === 'manual' ? parseBroadcastUserIds(body.user_ids) : null
    if (audience === 'manual' && !userIds) {
        return NextResponse.json({ error: 'user_ids: непустой массив id игроков' }, { status: 400 })
    }

    let users
    try {
        users =
            audience === 'manual'
                ? await resolveBroadcastManualAudience(supabase, userIds!, managedClubId)
                : await resolveBroadcastAudience(supabase, audience, managedClubId)
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Не удалось получить список получателей'
        return NextResponse.json({ error: msg }, { status: 500 })
    }

    if (users.length === 0) {
        return NextResponse.json(
            {
                error:
                    audience === 'manual'
                        ? 'Ни один из выбранных игроков не доступен для отправки (нет telegram_id или неактивен)'
                        : 'Нет получателей для выбранной аудитории',
            },
            { status: 400 }
        )
    }

    const { data: broadcast, error: insertErr } = await supabase
        .from('clubtac_broadcasts')
        .insert({
            created_by_user_id: actor.id,
            message,
            audience,
            status: 'pending',
            total_recipients: users.length,
            selected_user_ids: audience === 'manual' ? userIds : null,
        })
        .select('*')
        .single()

    if (insertErr || !broadcast) {
        console.error('POST /api/admin/broadcasts insert:', insertErr)
        return NextResponse.json({ error: insertErr?.message ?? 'Не удалось создать рассылку' }, { status: 500 })
    }

    const broadcastId = String((broadcast as BroadcastRow).id)

    try {
        await insertBroadcastRecipients(supabase, broadcastId, users)
    } catch (e) {
        await supabase.from('clubtac_broadcasts').delete().eq('id', broadcastId)
        const msg = e instanceof Error ? e.message : 'Не удалось сохранить получателей'
        return NextResponse.json({ error: msg }, { status: 500 })
    }

    const deliveryMode = getBroadcastDeliveryMode()
    if (deliveryMode === 'unset') {
        await supabase.from('clubtac_broadcasts').delete().eq('id', broadcastId)
        return NextResponse.json(
            { error: 'Задайте CLUBTAC_MAKE_BROADCAST_WEBHOOK_URL в окружении сервера' },
            { status: 503 }
        )
    }

    const makeResult = await sendBroadcastViaMake({ broadcast_id: broadcastId })
    if (!makeResult.ok) {
        await supabase
            .from('clubtac_broadcasts')
            .update({ status: 'error', completed_at: new Date().toISOString() })
            .eq('id', broadcastId)
        return NextResponse.json(
            { error: makeResult.error, broadcast_id: broadcastId },
            { status: makeResult.httpStatus && makeResult.httpStatus >= 500 ? 502 : 400 }
        )
    }

    const makeTriggeredAt = new Date().toISOString()

    if (makeResult.mode === 'completed') {
        try {
            await applyBroadcastDeliveryResult(supabase, broadcastId, makeResult.sentUserIds)
        } catch (e) {
            await supabase
                .from('clubtac_broadcasts')
                .update({ status: 'error', completed_at: new Date().toISOString() })
                .eq('id', broadcastId)
            const msg = e instanceof Error ? e.message : 'Не удалось сохранить результат рассылки'
            return NextResponse.json({ error: msg, broadcast_id: broadcastId }, { status: 500 })
        }
    } else {
        const { error: updateErr } = await supabase
            .from('clubtac_broadcasts')
            .update({
                status: 'sending',
                make_triggered_at: makeTriggeredAt,
            })
            .eq('id', broadcastId)

        if (updateErr) {
            console.error('POST /api/admin/broadcasts update sending:', updateErr)
            return NextResponse.json({ error: updateErr.message }, { status: 500 })
        }
    }

    const { data: updated, error: loadErr } = await supabase
        .from('clubtac_broadcasts')
        .select('*')
        .eq('id', broadcastId)
        .single()

    if (loadErr || !updated) {
        console.error('POST /api/admin/broadcasts reload:', loadErr)
        return NextResponse.json({ error: loadErr?.message ?? 'Не удалось загрузить рассылку' }, { status: 500 })
    }

    return NextResponse.json({
        broadcast: updated as BroadcastRow,
        delivery_mode: 'make' as const,
        make_mode: makeResult.mode,
    })
}
