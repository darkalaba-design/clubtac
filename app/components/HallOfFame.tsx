'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { displayPublicNickname } from '@/lib/takoff'
import { useUser } from '../contexts/UserContext'
import { useSoloLeaderMedalPrefix } from '../contexts/SoloLeaderRanksContext'
import BrandStarIcon from './BrandStarIcon'

type RankingSubTab = 'legacy' | 'elo'

export default function HallOfFame() {
    const [players, setPlayers] = useState<any[]>([])
    const [eloPlayers, setEloPlayers] = useState<any[]>([])
    const [loadingLegacy, setLoadingLegacy] = useState(true)
    const [loadingElo, setLoadingElo] = useState(true)
    const [errorLegacy, setErrorLegacy] = useState<string | null>(null)
    const [errorElo, setErrorElo] = useState<string | null>(null)
    const [activeSubTab, setActiveSubTab] = useState<RankingSubTab>('elo')

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
                    setErrorLegacy(queryError.message)
                    setLoadingLegacy(false)
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
                setErrorLegacy(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoadingLegacy(false)
            }
        }

        load()
    }, [])

    useEffect(() => {
        const loadElo = async () => {
            try {
                const supabase = createClient()
                const { data, error: queryError } = await supabase
                    .from('clubtac_elo_leaderboard')
                    .select('*')
                    .order('place')

                if (queryError) {
                    console.error('Supabase elo leaderboard error:', queryError)
                    setErrorElo(queryError.message)
                    setLoadingElo(false)
                    return
                }

                const rows = data || []

                const ids = [
                    ...new Set(
                        rows
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

                setEloPlayers(
                    rows.map((p: any) => {
                        const uid = Number(p.user_id)
                        return {
                            ...p,
                            takoff: !!takoffByUserId[uid],
                        }
                    })
                )
            } catch (err) {
                console.error('Error loading Elo leaderboard:', err)
                setErrorElo(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoadingElo(false)
            }
        }

        loadElo()
    }, [])

    const renderPlayerRow = (
        player: any,
        resolvePoints: (p: any) => number | null,
        indexInSection: number,
        rowDividerColor = '#EBE8E0',
        rowZone: 'podium' | 'tail' = 'tail',
        showMedals = true
    ) => {
        const points = resolvePoints(player)

        const isCurrentUser = user && typeof user.id !== 'undefined' && player.user_id === user.id
        const placeNum = Number(player.place)
        const isMidTopTenRow =
            rowZone === 'tail' && Number.isFinite(placeNum) && placeNum >= 4 && placeNum <= 10
        const defaultRowBg = isCurrentUser ? '#FFF4C2' : isMidTopTenRow ? '#FFFCEE' : 'transparent'

        return (
            <div key={`${player.user_id}-${player.place}`}>
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
                            backgroundColor: defaultRowBg,
                            padding: '4px 12px',
                            transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isCurrentUser ? '#FFECA0' : '#FFFEF7'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = defaultRowBg
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
                                        {showMedals ? getMedalPrefix(player.user_id) : null}
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
                                        <BrandStarIcon size={14} />{' '}
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

    const renderRankingBoard = (
        list: any[],
        resolvePoints: (p: any) => number | null,
        showMedals = true
    ) => {
        const topTen = list.slice(0, 10)
        const topPodium = topTen.slice(0, 3)
        const topTail = topTen.slice(3)
        const rest = list.slice(10)

        return (
            <div>
                <div
                    style={{
                        margin: '0 12px',
                        border: '1px solid #FFE950',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 2px 12px rgba(29, 29, 27, 0.06)',
                    }}
                >
                    <div
                        style={{
                            backgroundColor: '#FFF9E6',
                            paddingTop: '8px',
                            paddingBottom: topTail.length > 0 ? 0 : '8px',
                        }}
                    >
                        {topPodium.map((player, index) =>
                            renderPlayerRow(player, resolvePoints, index, '#FFE950', 'podium', showMedals)
                        )}
                    </div>
                    {topTail.length > 0 && (
                        <>
                            <div style={{ height: '1px', backgroundColor: 'rgba(255, 233, 80, 0.5)' }} />
                            <div
                                style={{
                                    backgroundColor: '#FFFCEF',
                                    paddingBottom: '8px',
                                }}
                            >
                                {topTail.map((player, index) =>
                                    renderPlayerRow(player, resolvePoints, index, '#EBE8E0', 'tail', showMedals)
                                )}
                            </div>
                        </>
                    )}
                </div>
                {rest.length > 0 && (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column' }}>
                        {rest.map((player, index) =>
                            renderPlayerRow(player, resolvePoints, index, '#EBE8E0', 'tail', showMedals)
                        )}
                    </div>
                )}
            </div>
        )
    }

    const resolveLegacyPoints = (player: any) => {
        const v = player.points ?? player.total_points ?? player.rating
        return v != null && v !== '' ? Number(v) : null
    }

    const resolveEloPoints = (player: any) => {
        const v = player.rating
        return v != null && v !== '' ? Number(v) : null
    }

    const subTabBar = (
        <div
            style={{
                display: 'flex',
                borderBottom: '2px solid #EBE8E0',
                margin: '0 12px',
                marginBottom: '16px',
            }}
        >
            <button
                type="button"
                onClick={() => setActiveSubTab('elo')}
                style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeSubTab === 'elo' ? 'bold' : 'normal',
                    color: activeSubTab === 'elo' ? '#1D1D1B' : '#6B6B69',
                    borderBottom: activeSubTab === 'elo' ? '2px solid #FFDF00' : '2px solid transparent',
                    marginBottom: '-2px',
                }}
            >
                Новый рейтинг
            </button>
            <button
                type="button"
                onClick={() => setActiveSubTab('legacy')}
                style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeSubTab === 'legacy' ? 'bold' : 'normal',
                    color: activeSubTab === 'legacy' ? '#1D1D1B' : '#6B6B69',
                    borderBottom:
                        activeSubTab === 'legacy' ? '2px solid #FFDF00' : '2px solid transparent',
                    marginBottom: '-2px',
                }}
            >
                Старый рейтинг
            </button>
        </div>
    )

    const loading = activeSubTab === 'legacy' ? loadingLegacy : loadingElo
    const error = activeSubTab === 'legacy' ? errorLegacy : errorElo
    const list = activeSubTab === 'legacy' ? players : eloPlayers

    if (loading) {
        return (
            <div>
                {subTabBar}
                <div style={{ padding: '12px', textAlign: 'center' }}>
                    <p>Загрузка...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div>
                {subTabBar}
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
            </div>
        )
    }

    if (list.length === 0) {
        return (
            <div>
                {subTabBar}
                <div style={{ padding: '12px', textAlign: 'center' }}>
                    <p>Нет данных</p>
                </div>
            </div>
        )
    }

    return (
        <div>
            {subTabBar}
            {activeSubTab === 'elo' && renderRankingBoard(eloPlayers, resolveEloPoints, true)}
            {activeSubTab === 'legacy' && renderRankingBoard(players, resolveLegacyPoints, false)}
        </div>
    )
}
