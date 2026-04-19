'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { displayPublicNickname } from '@/lib/takoff'
import { useUser } from '../contexts/UserContext'
import { useSoloLeaderMedalPrefix } from '../contexts/SoloLeaderRanksContext'

export default function HallOfFame() {
    const [players, setPlayers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { user } = useUser()
    const getMedalPrefix = useSoloLeaderMedalPrefix()

    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()
                const { data, error: queryError } = await supabase
                    .from('clubtac_players_hall_of_fame_v3')
                    .select('*')
                    .order('place')

                if (queryError) {
                    console.error('Supabase error:', queryError)
                    setError(queryError.message)
                    setLoading(false)
                    return
                }

                const filtered = (data || []).filter((player: any) => {
                    const gamesPlayed =
                        player.games_played ??
                        (player as any).games ??
                        (player as any).total_games
                    return gamesPlayed && Number(gamesPlayed) > 0
                })

                const ids = [
                    ...new Set(
                        filtered
                            .map((p: any) => Number(p.user_id))
                            .filter((id: number) => !Number.isNaN(id) && id > 0)
                    ),
                ]
                let takoffByUserId: Record<number, boolean> = {}
                if (ids.length > 0) {
                    const { data: privRows } = await supabase
                        .from('clubtac_users')
                        .select('id, takoff')
                        .in('id', ids)
                    if (privRows) {
                        takoffByUserId = Object.fromEntries(
                            privRows.map((r: { id: number; takoff?: boolean | null }) => [r.id, !!r.takoff])
                        )
                    }
                }

                setPlayers(
                    filtered.map((p: any) => {
                        const uid = Number(p.user_id)
                        return {
                            ...p,
                            takoff: !!takoffByUserId[uid],
                        }
                    })
                )
            } catch (err) {
                console.error('Error loading players:', err)
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [])

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

    if (players.length === 0) {
        return (
            <div style={{ padding: '12px', textAlign: 'center' }}>
                <p>Нет данных</p>
            </div>
        )
    }

    const topTen = players.slice(0, 10)
    const rest = players.slice(10)

    const renderPlayerRow = (player: any, indexInSection: number, rowDividerColor = '#EBE8E0') => {
        const points =
            player.points ?? (player as any).total_points ?? (player as any).rating

        const isCurrentUser = user && typeof user.id !== 'undefined' && player.user_id === user.id

        return (
            <div key={player.user_id}>
                {indexInSection > 0 && <div style={{ height: '1px', backgroundColor: rowDividerColor }} />}
                <Link
                    href={`/player/${player.user_id}`}
                    className="link-player hall-rating-row"
                    style={{
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'block',
                    }}
                >
                    <div
                        style={{
                            backgroundColor: isCurrentUser ? '#FFF4C2' : 'transparent',
                            padding: '4px 12px',
                            transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isCurrentUser ? '#FFECA0' : '#FFFEF7'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = isCurrentUser ? '#FFF4C2' : 'transparent'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: '#FFE950',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '13px',
                                    flexShrink: 0,
                                    color: '#1D1D1B',
                                }}
                            >
                                {player.place}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '8px',
                                    }}
                                >
                                    <div
                                        className="hall-rating-row__title"
                                        style={{
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            color: isCurrentUser ? '#B05C00' : '#1D1D1B',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {getMedalPrefix(player.user_id)}
                                        {displayPublicNickname(player.nickname, player.takoff)}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: '11px',
                                            color: '#6B6B69',
                                            textAlign: 'right',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <span aria-hidden>⭐</span>{' '}
                                        <span style={{ color: '#1D1D1B', fontWeight: 700 }}>
                                            {points != null ? Math.round(Number(points)) : '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Link>
            </div>
        )
    }

    return (
        <div>
            <div
                style={{
                    margin: '0 12px',
                    backgroundColor: '#FFF9E6',
                    border: '1px solid #FFE950',
                    borderRadius: '12px',
                    padding: '8px 0',
                    boxShadow: '0 2px 12px rgba(29, 29, 27, 0.06)',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {topTen.map((player, index) => renderPlayerRow(player, index, '#FFE950'))}
                </div>
            </div>
            {rest.length > 0 && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column' }}>
                    {rest.map((player, index) => renderPlayerRow(player, index))}
                </div>
            )}
        </div>
    )
}
