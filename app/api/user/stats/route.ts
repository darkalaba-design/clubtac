import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/api'

/**
 * API endpoint для получения статистики пользователя
 * Принимает telegram_id или nickname
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const telegramId = searchParams.get('telegram_id')
        const nickname = searchParams.get('nickname')

        if (!telegramId && !nickname) {
            return NextResponse.json(
                { error: 'telegram_id или nickname обязательны' },
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
        } else if (nickname) {
            const { data: rankRow, error: rankError } = await supabase
                .from('clubtac_players_hall_of_fame_v3')
                .select('user_id, nickname')
                .eq('nickname', nickname.trim())
                .single()
            if (rankError || !rankRow) {
                return NextResponse.json(
                    { error: 'Пользователь не найден' },
                    { status: 404 }
                )
            }
            userNickname = rankRow.nickname?.trim() || nickname.trim()
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

        // Получаем статистику из clubtac_players_hall_of_fame_v3 по user_id
        const { data: stats, error: statsError } = await supabase
            .from('clubtac_players_hall_of_fame_v3')
            .select('*')
            .eq('user_id', user.id)
            .single()

        if (!userNickname) {
            const fromHall = (stats as { nickname?: string | null } | null)?.nickname?.trim()
            const fromUser = user?.nickname?.trim()
            userNickname = fromHall || fromUser || null
        }

        const cellNick = (v: string | null | undefined) => (v ?? '').trim()
        const rowHasPlayer = (game: Record<string, unknown>) =>
            !!userNickname &&
            (cellNick(game.player_1_1 as string) === userNickname ||
                cellNick(game.player_1_2 as string) === userNickname ||
                cellNick(game.player_2_1 as string) === userNickname ||
                cellNick(game.player_2_2 as string) === userNickname)

        // Получаем последние игры пользователя (до 10)
        const { data: allGames, error: gamesError } = await supabase
            .from('games_summary')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100) // Берем больше, чтобы потом отфильтровать

        let recentGames: any[] = []
        if (!gamesError && allGames && userNickname) {
            recentGames = allGames.filter(rowHasPlayer).slice(0, 10)
        }

        let bestPartners: any[] = []
        if (!gamesError && allGames && userNickname && stats) {
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
                .slice(0, 3); // Топ 3
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

