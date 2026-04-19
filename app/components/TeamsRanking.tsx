'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatGamesWinsLine } from '@/lib/ruCountPhrases'
import { displayPublicNickname } from '@/lib/takoff'

export default function TeamsRanking() {
    const [teams, setTeams] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()
                const { data, error: queryError } = await supabase
                    .from('teams_ranked')
                    .select('*')
                    .order('rank')

                if (queryError) {
                    console.error('Supabase error:', queryError)
                    setError(queryError.message)
                    setLoading(false)
                    return
                }

                const rows = data || []
                const idSet = new Set<number>()
                rows.forEach((t: any) => {
                    const a = Number(t.player_1_id)
                    const b = Number(t.player_2_id)
                    if (!Number.isNaN(a) && a > 0) idSet.add(a)
                    if (!Number.isNaN(b) && b > 0) idSet.add(b)
                })
                const ids = [...idSet]
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
                setTeams(
                    rows.map((t: any) => ({
                        ...t,
                        player_1_takoff: !!takoffByUserId[Number(t.player_1_id)],
                        player_2_takoff: !!takoffByUserId[Number(t.player_2_id)],
                    }))
                )
            } catch (err) {
                console.error('Error loading teams:', err)
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

    if (teams.length === 0) {
        return (
            <div style={{ padding: '12px', textAlign: 'center' }}>
                <p>Нет данных</p>
            </div>
        )
    }

    const topTen = teams.slice(0, 10)
    const rest = teams.slice(10)

    const renderTeamRow = (team: any, indexInSection: number, rowDividerColor = '#EBE8E0') => {
        const rankNum = Number(team.rank)
        const rankMedal =
            rankNum === 1 ? '🥇 ' : rankNum === 2 ? '🥈 ' : rankNum === 3 ? '🥉 ' : null

        return (
            <div key={`${team.player_1_id}-${team.player_2_id}`}>
                {indexInSection > 0 && <div style={{ height: '1px', backgroundColor: rowDividerColor }} />}
                <div
                    style={{
                        backgroundColor: 'transparent',
                        padding: '8px 12px',
                        transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#FFFEF7'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '8px',
                                backgroundColor: '#FFE950',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                flexShrink: 0,
                                color: '#1D1D1B',
                            }}
                        >
                            #{team.rank}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    marginBottom: '2px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {rankMedal}
                                <Link
                                    href={`/player/${team.player_1_id}`}
                                    className="link-player"
                                    style={{
                                        color: '#1D1D1B',
                                        textDecoration: 'none',
                                    }}
                                >
                                    {displayPublicNickname(team.player_1_nickname, team.player_1_takoff)}
                                </Link>
                                <span style={{ margin: '0 4px', color: '#6B6B69' }}>+</span>
                                <Link
                                    href={`/player/${team.player_2_id}`}
                                    className="link-player"
                                    style={{
                                        color: '#1D1D1B',
                                        textDecoration: 'none',
                                    }}
                                >
                                    {displayPublicNickname(team.player_2_nickname, team.player_2_takoff)}
                                </Link>
                            </div>
                            <div
                                style={{
                                    fontSize: '12px',
                                    color: '#A3A2A0',
                                    fontWeight: 400,
                                }}
                            >
                                {formatGamesWinsLine(Number(team.games_played) || 0, Number(team.wins) || 0)}
                            </div>
                        </div>
                    </div>
                </div>
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
                    {topTen.map((team, index) => renderTeamRow(team, index, '#FFE950'))}
                </div>
            </div>
            {rest.length > 0 && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column' }}>
                    {rest.map((team, index) => renderTeamRow(team, index))}
                </div>
            )}
        </div>
    )
}
