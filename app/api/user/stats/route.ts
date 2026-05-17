import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/api'

/** Место и очки — из нового Elo; игры/победы — из hall_of_fame, если есть. */
function mergePlayerRankingStats(
    hall: Record<string, unknown> | null,
    elo: Record<string, unknown> | null
): Record<string, unknown> | null {
    if (!hall && !elo) return null
    const eloRating =
        elo?.rating != null && elo.rating !== '' ? Number(elo.rating) : null
    const hallPoints =
        hall?.points != null && hall.points !== ''
            ? Number(hall.points)
            : hall?.total_points != null && hall.total_points !== ''
              ? Number(hall.total_points)
              : null
    return {
        ...(hall || {}),
        ...(elo || {}),
        place: elo?.place ?? hall?.place,
        points: eloRating ?? hallPoints,
        rating: eloRating ?? (hall?.rating != null ? Number(hall.rating) : null),
        nickname: (elo?.nickname as string | undefined) ?? (hall?.nickname as string | undefined),
        games_played: hall?.games_played ?? elo?.games_played,
        games: hall?.games ?? elo?.games,
        total_games: hall?.total_games ?? elo?.total_games,
        wins: hall?.wins ?? elo?.wins,
        total_wins: hall?.total_wins ?? elo?.total_wins,
        win_rate: hall?.win_rate ?? elo?.win_rate,
        winrate: hall?.winrate ?? elo?.winrate,
        win_percent: hall?.win_percent ?? elo?.win_percent,
    }
}

/**
 * API endpoint для получения статистики пользователя
 * Принимает telegram_id, user_id (id в clubtac_users) или nickname
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const telegramId = searchParams.get('telegram_id')
        const userIdParam = searchParams.get('user_id')
        const nickname = searchParams.get('nickname')

        if (!telegramId && !nickname && !userIdParam) {
            return NextResponse.json(
                { error: 'telegram_id, user_id или nickname обязательны' },
                { status: 400 }
            )
        }

        const supabase = createClient()

        let user: any = null
        /** Ник в games_summary должен совпадать с этой строкой (как в hall_of_fame / профиле) */
        let userNickname: string | null = null

        if (telegramId) {
            const { data: userData, error: userError } = await supabase
                .from('clubtac_users')
                .select('*')
                .eq('telegram_id', parseInt(telegramId))
                .single()
            if (userError || !userData) {
                return NextResponse.json(
                    { error: 'Пользователь не найден' },
                    { status: 404 }
                )
            }
            user = userData
        } else if (userIdParam) {
            const uid = Number.parseInt(userIdParam, 10)
            if (!Number.isFinite(uid) || uid <= 0) {
                return NextResponse.json({ error: 'Некорректный user_id' }, { status: 400 })
            }
            const { data: userData, error: userError } = await supabase
                .from('clubtac_users')
                .select('*')
                .eq('id', uid)
                .single()
            if (userError || !userData) {
                return NextResponse.json(
                    { error: 'Пользователь не найден' },
                    { status: 404 }
                )
            }
            user = userData
        } else if (nickname) {
            const nick = nickname.trim()
            let rankRow: { user_id: number; nickname?: string | null } | null = null
            const { data: eloRow } = await supabase
                .from('clubtac_elo_leaderboard')
                .select('user_id, nickname')
                .eq('nickname', nick)
                .maybeSingle()
            if (eloRow) rankRow = eloRow as { user_id: number; nickname?: string | null }
            if (!rankRow) {
                const { data: hallRow } = await supabase
                    .from('clubtac_players_hall_of_fame_v3')
                    .select('user_id, nickname')
                    .eq('nickname', nick)
                    .maybeSingle()
                if (hallRow) rankRow = hallRow as { user_id: number; nickname?: string | null }
            }
            if (!rankRow) {
                return NextResponse.json(
                    { error: 'Пользователь не найден' },
                    { status: 404 }
                )
            }
            userNickname = rankRow.nickname?.trim() || nick
            const { data: userData, error: userError } = await supabase
                .from('clubtac_users')
                .select('*')
                .eq('id', rankRow.user_id)
                .single()
            if (userError || !userData) {
                return NextResponse.json(
                    { error: 'Пользователь не найден' },
                    { status: 404 }
                )
            }
            user = userData
        }

        const [{ data: hallStats }, { data: eloStats }] = await Promise.all([
            supabase
                .from('clubtac_players_hall_of_fame_v3')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle(),
            supabase
                .from('clubtac_elo_leaderboard')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle(),
        ])

        const stats = mergePlayerRankingStats(
            (hallStats as Record<string, unknown> | null) ?? null,
            (eloStats as Record<string, unknown> | null) ?? null
        )

        if (!userNickname) {
            const fromElo = (eloStats as { nickname?: string | null } | null)?.nickname?.trim()
            const fromHall = (hallStats as { nickname?: string | null } | null)?.nickname?.trim()
            const fromUser = user?.nickname?.trim()
            userNickname = fromElo || fromHall || fromUser || null
        }

        const cellNick = (v: string | null | undefined) => (v ?? '').trim()
        const rowHasPlayer = (game: Record<string, unknown>) =>
            !!userNickname &&
            (cellNick(game.player_1_1 as string) === userNickname ||
                cellNick(game.player_1_2 as string) === userNickname ||
                cellNick(game.player_2_1 as string) === userNickname ||
                cellNick(game.player_2_2 as string) === userNickname)

        const rawGamesLimit = searchParams.get('recent_games_limit')
        let recentGamesLimit = 3
        if (rawGamesLimit != null) {
            const n = Number.parseInt(rawGamesLimit, 10)
            if (Number.isFinite(n)) {
                recentGamesLimit = Math.min(100, Math.max(1, n))
            }
        }

        // Берём запас строк: игрок может редко попадать в последние N матчей общего списка
        const summaryFetchLimit = Math.min(1000, Math.max(200, recentGamesLimit * 8))

        const { data: allGames, error: gamesError } = await supabase
            .from('games_summary')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(summaryFetchLimit)

        let recentGames: any[] = []
        let recentGamesHasMore = false
        if (!gamesError && allGames && userNickname) {
            const filtered = allGames.filter(rowHasPlayer)
            recentGames = filtered.slice(0, recentGamesLimit)
            recentGamesHasMore = filtered.length > recentGamesLimit
        }

        let bestPartners: any[] = []
        if (!gamesError && allGames && userNickname && stats != null) {
            const partnerStats: Record<string, { games: number; wins: number }> = {}

            allGames.forEach((game) => {
                let isPlayer1 = false
                let partner = null

                if (cellNick(game.player_1_1) === userNickname) {
                    isPlayer1 = true
                    partner = cellNick(game.player_1_2)
                } else if (cellNick(game.player_1_2) === userNickname) {
                    isPlayer1 = true
                    partner = cellNick(game.player_1_1)
                } else if (cellNick(game.player_2_1) === userNickname) {
                    isPlayer1 = false
                    partner = cellNick(game.player_2_2)
                } else if (cellNick(game.player_2_2) === userNickname) {
                    isPlayer1 = false
                    partner = cellNick(game.player_2_1)
                }

                if (partner) {
                    if (!partnerStats[partner]) {
                        partnerStats[partner] = { games: 0, wins: 0 }
                    }
                    partnerStats[partner].games++

                    // Проверяем победу
                    const userTeamWon = isPlayer1 ? game.score_1 > game.score_2 : game.score_2 > game.score_1
                    if (userTeamWon) {
                        partnerStats[partner].wins++
                    }
                }
            })

            // Преобразуем в массив и сортируем по проценту побед
            bestPartners = Object.entries(partnerStats)
                .map(([partnerName, s]) => ({
                    name: partnerName,
                    games: s.games,
                    wins: s.wins,
                    winRate: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0,
                }))
                .filter((p) => p.games >= 3) // Минимум 3 игры вместе
                .sort((a, b) => b.winRate - a.winRate)
                .slice(0, 3) // Топ 3
        }

        if (bestPartners.length > 0) {
            const names = [...new Set(bestPartners.map((p: { name: string }) => p.name.trim()))].filter(Boolean)
            if (names.length > 0) {
                const { data: hallRows } = await supabase
                    .from('clubtac_players_hall_of_fame_v3')
                    .select('user_id, nickname')
                    .in('nickname', names)
                const nickToUserId: Record<string, number> = {}
                if (hallRows) {
                    for (const row of hallRows as { user_id: number; nickname?: string | null }[]) {
                        const nk = (row.nickname ?? '').trim()
                        if (nk) nickToUserId[nk] = Number(row.user_id)
                    }
                }
                bestPartners = bestPartners.map((p: { name: string; games: number; wins: number; winRate: number }) => ({
                    ...p,
                    user_id: nickToUserId[p.name.trim()] ?? null,
                }))
            }
        }

        const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, '') || ''
        const code = user.referral_code as string | null | undefined
        const referralLink =
            botUsername && code ? `https://t.me/${botUsername}?startapp=${encodeURIComponent(code)}` : null

        const { count: invitedCountRaw } = await supabase
            .from('clubtac_users')
            .select('id', { count: 'exact', head: true })
            .eq('referred_by_user_id', user.id)
        const invitedCount = invitedCountRaw ?? 0

        let inviter: {
            id: number
            first_name: string
            last_name?: string | null
            nickname?: string | null
            username?: string | null
            telegram_id: number
        } | null = null
        if (user.referred_by_user_id) {
            const { data: inviterRow } = await supabase
                .from('clubtac_users')
                .select('id, first_name, last_name, nickname, username, telegram_id')
                .eq('id', user.referred_by_user_id)
                .maybeSingle()
            if (inviterRow) {
                inviter = inviterRow as {
                    id: number
                    first_name: string
                    last_name?: string | null
                    nickname?: string | null
                    username?: string | null
                    telegram_id: number
                }
            }
        }

        const body = {
            user,
            stats: stats || null,
            recentGames,
            recentGamesHasMore,
            bestPartners,
            referralLink,
            invitedCount,
            inviter,
        }
        return NextResponse.json(body)
    } catch (error) {
        console.error('API /user/stats: Ошибка:', error)
        return NextResponse.json(
            { error: 'Внутренняя ошибка сервера', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

