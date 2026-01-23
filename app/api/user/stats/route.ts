import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/api'

/**
 * API endpoint для получения статистики пользователя
 * Принимает telegram_id или username
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const telegramId = searchParams.get('telegram_id')
        const username = searchParams.get('username')

        if (!telegramId && !username) {
            return NextResponse.json(
                { error: 'telegram_id или username обязательны' },
                { status: 400 }
            )
        }

        const supabase = createClient()

        // Получаем пользователя из clubtac_users
        let userQuery = supabase.from('clubtac_users').select('*')
        
        if (telegramId) {
            userQuery = userQuery.eq('telegram_id', parseInt(telegramId))
        } else if (username) {
            userQuery = userQuery.eq('username', username)
        }

        const { data: user, error: userError } = await userQuery.single()

        if (userError || !user) {
            return NextResponse.json(
                { error: 'Пользователь не найден' },
                { status: 404 }
            )
        }

        // Получаем статистику из players_hall_of_fame_ranked
        // Ищем по username или user_id
        let statsQuery = supabase
            .from('players_hall_of_fame_ranked')
            .select('*')

        if (user.username) {
            statsQuery = statsQuery.eq('username', user.username)
        } else if (user.id) {
            statsQuery = statsQuery.eq('user_id', user.id)
        } else {
            // Если нет ни username, ни id, возвращаем пустую статистику
            return NextResponse.json({
                user,
                stats: null,
                recentGames: [],
                bestPartners: [],
            })
        }

        const { data: stats, error: statsError } = await statsQuery.single()

        // Получаем последние игры пользователя (до 10)
        const { data: allGames, error: gamesError } = await supabase
            .from('games_summary')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100) // Берем больше, чтобы потом отфильтровать

        let recentGames: any[] = []
        if (!gamesError && allGames && user.username) {
            // Фильтруем игры, где пользователь участвовал
            recentGames = allGames
                .filter((game) => {
                    return (
                        game.player_1_1 === user.username ||
                        game.player_1_2 === user.username ||
                        game.player_2_1 === user.username ||
                        game.player_2_2 === user.username
                    )
                })
                .slice(0, 10) // Берем последние 10
        }

        // Получаем лучших напарников
        // Нужно посчитать статистику по парам
        let bestPartners: any[] = []
        if (!gamesError && allGames && user.username && stats) {
            const partnerStats: Record<string, { games: number; wins: number }> = {}

            allGames.forEach((game) => {
                let isPlayer1 = false
                let partner = null

                if (game.player_1_1 === user.username) {
                    isPlayer1 = true
                    partner = game.player_1_2
                } else if (game.player_1_2 === user.username) {
                    isPlayer1 = true
                    partner = game.player_1_1
                } else if (game.player_2_1 === user.username) {
                    isPlayer1 = false
                    partner = game.player_2_2
                } else if (game.player_2_2 === user.username) {
                    isPlayer1 = false
                    partner = game.player_2_1
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
                .map(([partnerName, stats]) => ({
                    name: partnerName,
                    games: stats.games,
                    wins: stats.wins,
                    winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0,
                }))
                .filter((p) => p.games >= 3) // Минимум 3 игры вместе
                .sort((a, b) => b.winRate - a.winRate)
                .slice(0, 3) // Топ 3
        }

        return NextResponse.json({
            user,
            stats: stats || null,
            recentGames,
            bestPartners,
        })
    } catch (error) {
        console.error('API /user/stats: Ошибка:', error)
        return NextResponse.json(
            { error: 'Внутренняя ошибка сервера', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

