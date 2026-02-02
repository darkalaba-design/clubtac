'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function PlayerPageClient({ playerId }: { playerId: string }) {
    const [player, setPlayer] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()
                const { data, error: queryError } = await supabase
                    .from('clubtac_players_hall_of_fame_ranked_v2')
                    .select('*')
                    .eq('user_id', playerId)
                    .single()

                if (queryError) {
                    console.error('Supabase error:', queryError)
                    setError(queryError.message)
                    setLoading(false)
                    return
                }

                setPlayer(data)
            } catch (err) {
                console.error('Error loading player:', err)
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        if (playerId) {
            load()
        }
    }, [playerId])

    if (loading) {
        return (
            <div style={{ padding: '12px', textAlign: 'center' }}>
                <p>Загрузка...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div style={{ padding: '12px' }}>
                <div
                    style={{
                        backgroundColor: '#FFF9E6',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #FFE950',
                    }}
                >
                    <p style={{ margin: 0, color: '#1D1D1B' }}>Ошибка: {error}</p>
                </div>
            </div>
        )
    }

    if (!player) {
        return (
            <div style={{ padding: '12px' }}>
                <div
                    style={{
                        backgroundColor: '#FFF9E6',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #FFE950',
                    }}
                >
                    <p style={{ margin: 0, color: '#1D1D1B' }}>Игрок не найден</p>
                </div>
            </div>
        )
    }

    return (
        <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Кнопка назад */}
            <Link
                href="/"
                style={{
                    display: 'inline-block',
                    marginBottom: '16px',
                    color: '#1D1D1B',
                    textDecoration: 'none',
                    fontSize: '14px',
                }}
            >
                ← Назад к рейтингу
            </Link>

            {/* Компактный блок с информацией об игроке */}
            <div
                style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px',
                    boxShadow: '0 2px 16px rgba(29,29,27,0.06)',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                }}
            >
                {/* Аватар с местом */}
                <div
                    style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        backgroundColor: '#FFE950',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                        fontWeight: 'bold',
                        fontSize: '24px',
                    }}
                >
                    #{player.place}
                </div>

                {/* Информация */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: 0, marginBottom: '4px', fontSize: '18px', fontWeight: 'bold' }}>
                        {player.username}
                    </h2>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6B6B69', marginTop: '4px' }}>
                        <span>ID: {player.user_id}</span>
                        {player.points != null && (
                            <span>Очки: {Math.round(player.points)}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Статистика */}
            <div
                style={{
                    backgroundColor: '#FFFEF7',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px',
                }}
            >
                <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                    📊 Статистика
                </h3>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '12px',
                    }}
                >
                    <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Место в рейтинге</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>#{player.place}</div>
                    </div>
                    <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Игр сыграно</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>{player.games_played}</div>
                    </div>
                    <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Победы</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>{player.wins}</div>
                    </div>
                    <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>% побед</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>{player.win_rate}%</div>
                    </div>
                </div>
            </div>

            <div
                style={{
                    backgroundColor: '#FFFEF7',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '14px',
                    color: '#6B6B69',
                }}
            >
                <p style={{ margin: 0 }}>
                    💡 Детальная статистика будет добавлена позже
                </p>
            </div>
        </div>
    )
}
