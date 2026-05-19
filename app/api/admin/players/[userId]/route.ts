import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { formatParticipantDisplay } from '@/lib/admin/formatParticipantDisplay'
import {
    filterAdminPlayerWalletTransactionsForDisplay,
    splitUserFieldsForAdmin,
    type AdminPlayerDetailResponse,
    type AdminPlayerEventParticipation,
    type AdminPlayerInviterSummary,
    type AdminPlayerWalletTransaction,
} from '@/lib/admin/adminPlayerDetail'

type RouteParams = { params: Promise<{ userId: string }> }

function parseUserId(raw: string): number | null {
    const id = Number.parseInt(raw, 10)
    if (!Number.isFinite(id) || id < 1) return null
    return id
}

/** Полная карточка игрока для админки (вкладки Чат / Анкета / Финансы). */
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
        .select('*')
        .eq('id', userId)
        .maybeSingle()

    if (userErr) {
        console.error('GET /api/admin/players/[userId] user:', userErr)
        return NextResponse.json({ error: userErr.message }, { status: 500 })
    }
    if (!userRow) {
        return NextResponse.json({ error: 'Игрок не найден' }, { status: 404 })
    }

    const user = userRow as Record<string, unknown>
    const { profile_fields, chat_fields, extra_fields } = splitUserFieldsForAdmin(user)

    const [
        eloLbRes,
        eloRatingRes,
        hallRes,
        walletRes,
        partsRes,
        invitedRes,
    ] = await Promise.all([
        supabase.from('clubtac_elo_leaderboard').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('clubtac_elo_ratings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('clubtac_players_hall_of_fame_v3').select('*').eq('user_id', userId).maybeSingle(),
        supabase
            .from('clubtac_wallet_transactions')
            .select('id, amount, type, order_id, event_id, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100),
        supabase
            .from('clubtac_event_participants')
            .select('id, event_id, payment_status, price_paid, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100),
        supabase
            .from('clubtac_users')
            .select('id', { count: 'exact', head: true })
            .eq('referred_by_user_id', userId),
    ])

    if (eloLbRes.error) console.error('GET admin player elo_leaderboard:', eloLbRes.error)
    if (eloRatingRes.error) console.error('GET admin player elo_ratings:', eloRatingRes.error)
    if (hallRes.error) console.error('GET admin player hall:', hallRes.error)
    if (walletRes.error) console.error('GET admin player wallet:', walletRes.error)
    if (partsRes.error) console.error('GET admin player participants:', partsRes.error)

    const walletRows = (walletRes.data ?? []) as AdminPlayerWalletTransaction[]
    const wallet_balance = walletRows.reduce((sum, row) => {
        const n = Number(row.amount)
        return sum + (Number.isFinite(n) ? n : 0)
    }, 0)

    const partRows = (partsRes.data ?? []) as {
        id: string | number
        event_id: string
        payment_status: string
        price_paid: number | null
        created_at?: string | null
    }[]

    const eventIds = [...new Set(partRows.map((p) => p.event_id).filter(Boolean))]
    let eventById: Record<string, { title?: string | null; starts_at?: string | null }> = {}

    if (eventIds.length > 0) {
        const { data: events, error: evErr } = await supabase
            .from('clubtac_events')
            .select('id, title, starts_at')
            .in('id', eventIds)

        if (evErr) {
            console.error('GET admin player events:', evErr)
        } else {
            eventById = Object.fromEntries(
                (events ?? []).map((e: { id: string; title?: string | null; starts_at?: string | null }) => [
                    e.id,
                    { title: e.title, starts_at: e.starts_at },
                ])
            )
        }
    }

    const eventTitles = new Map<string, string | null>()
    for (const tx of walletRows) {
        if (tx.event_id && !eventTitles.has(tx.event_id)) {
            eventTitles.set(tx.event_id, null)
        }
    }
    const missingEventIds = [...eventTitles.keys()].filter((id) => !eventById[id])
    if (missingEventIds.length > 0) {
        const { data: extraEvents } = await supabase
            .from('clubtac_events')
            .select('id, title')
            .in('id', missingEventIds)
        for (const e of extraEvents ?? []) {
            const row = e as { id: string; title?: string | null }
            eventById[row.id] = { ...eventById[row.id], title: row.title }
        }
    }

    const wallet_transactions_mapped: AdminPlayerWalletTransaction[] = walletRows.map((tx) => ({
        ...tx,
        amount: Number(tx.amount),
        event_title: tx.event_id ? eventById[tx.event_id]?.title ?? null : null,
    }))

    const event_participations_mapped: AdminPlayerEventParticipation[] = partRows.map((p) => ({
        id: p.id,
        event_id: p.event_id,
        event_title: eventById[p.event_id]?.title ?? null,
        starts_at: eventById[p.event_id]?.starts_at ?? null,
        payment_status: p.payment_status,
        price_paid: p.price_paid,
        created_at: p.created_at ?? null,
    }))

    const wallet_transactions = filterAdminPlayerWalletTransactionsForDisplay(wallet_transactions_mapped)
    const event_participations = event_participations_mapped

    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, '') || ''
    const referralCode = typeof user.referral_code === 'string' ? user.referral_code : null
    const referral_link =
        botUsername && referralCode
            ? `https://t.me/${botUsername}?startapp=${encodeURIComponent(referralCode)}`
            : null

    let inviter: AdminPlayerInviterSummary | null = null
    const referredBy = user.referred_by_user_id
    if (referredBy != null && Number.isFinite(Number(referredBy))) {
        const { data: inviterRow } = await supabase
            .from('clubtac_users')
            .select('id, first_name, last_name, nickname, username, telegram_id, takoff')
            .eq('id', Number(referredBy))
            .maybeSingle()

        if (inviterRow) {
            const ir = inviterRow as {
                id: number
                first_name?: string | null
                last_name?: string | null
                nickname?: string | null
                username?: string | null
                telegram_id?: number | null
                takoff?: boolean | null
            }
            inviter = {
                id: ir.id,
                first_name: ir.first_name,
                last_name: ir.last_name,
                nickname: ir.nickname,
                username: ir.username,
                telegram_id: ir.telegram_id,
                display_name: formatParticipantDisplay({ ...ir, user_id: ir.id }),
            }
        }
    }

    const telegramId = Number(user.telegram_id)
    const username = typeof user.username === 'string' ? user.username.replace(/^@/, '') : ''
    const telegram_links = {
        username_url: username ? `https://t.me/${encodeURIComponent(username)}` : null,
        tg_user_url: Number.isFinite(telegramId) && telegramId > 0 ? `tg://user?id=${telegramId}` : null,
    }

    const body: AdminPlayerDetailResponse = {
        user,
        profile_fields,
        chat_fields,
        extra_fields,
        elo_leaderboard: (eloLbRes.data as Record<string, unknown> | null) ?? null,
        elo_rating: (eloRatingRes.data as Record<string, unknown> | null) ?? null,
        hall_of_fame: (hallRes.data as Record<string, unknown> | null) ?? null,
        wallet_balance,
        wallet_transactions,
        event_participations,
        referral_link,
        invited_count: invitedRes.count ?? 0,
        inviter,
        telegram_links,
    }

    return NextResponse.json(body)
}
