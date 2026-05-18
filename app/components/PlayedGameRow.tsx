'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useSoloLeaderMedalPrefix } from '../contexts/SoloLeaderRanksContext'

export type PlayedGameRowData = {
    game_id: number
    player_1_1: string
    player_1_2: string
    player_2_1: string
    player_2_2: string
    score_1: number
    score_2: number
}

type PlayerSlot = 'player_1_1' | 'player_1_2' | 'player_2_1' | 'player_2_2'

type Props = {
    game: PlayedGameRowData
    /** Отображаемое имя → user_id (как в публичном разделе) */
    playerIdMap?: Record<string, number>
    /** Явные user_id по слотам (админка) */
    playerUserIds?: Partial<Record<PlayerSlot, number>>
    showDividerTop?: boolean
    getMedalPrefix?: (userId: number | null | undefined) => string
}

function PlayerLine({
    name,
    userId,
    align,
    getMedalPrefix,
}: {
    name: string
    userId?: number
    align: 'left' | 'right'
    getMedalPrefix: (userId: number | null | undefined) => string
}) {
    const textAlign = align === 'right' ? 'right' : 'left'
    const content = userId ? (
        <Link
            href={`/player/${userId}`}
            className="link-player"
            style={{
                color: '#1D1D1B',
                textDecoration: 'none',
                fontWeight: '500',
                fontSize: '14px',
                verticalAlign: 'top',
                lineHeight: '14px',
            }}
        >
            {getMedalPrefix(userId)}
            {name}
        </Link>
    ) : (
        <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{name}</span>
    )

    return <div style={{ marginBottom: '4px', lineHeight: '14px', textAlign }}>{content}</div>
}

/** Строка сыгранной партии (как в «Прошедшие игры»). */
export function PlayedGameRow({
    game,
    playerIdMap = {},
    playerUserIds,
    showDividerTop = false,
    getMedalPrefix: getMedalPrefixProp,
}: Props) {
    const defaultMedal = useSoloLeaderMedalPrefix()
    const medal = getMedalPrefixProp ?? defaultMedal

    const userIdFor = (slot: PlayerSlot, name: string): number | undefined => {
        if (playerUserIds?.[slot]) return playerUserIds[slot]
        return playerIdMap[name]
    }

    const isTie = game.score_1 === game.score_2
    const team1Won = !isTie && game.score_1 > game.score_2
    const team2Won = !isTie && game.score_2 > game.score_1

    const scoreStyle = (won: boolean): CSSProperties => ({
        color: won ? '#1B5E20' : '#6B6B69',
        backgroundColor: won ? '#E8F5E9' : '#FFFEF7',
        padding: '4px 8px',
        borderRadius: '6px',
        minWidth: '32px',
    })

    return (
        <div>
            {showDividerTop ? <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} /> : null}
            <div
                style={{
                    padding: '10px 12px',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    gap: '12px',
                }}
            >
                <div style={{ textAlign: 'right' }}>
                    <PlayerLine
                        name={game.player_1_1}
                        userId={userIdFor('player_1_1', game.player_1_1)}
                        align="right"
                        getMedalPrefix={medal}
                    />
                    <PlayerLine
                        name={game.player_1_2}
                        userId={userIdFor('player_1_2', game.player_1_2)}
                        align="right"
                        getMedalPrefix={medal}
                    />
                </div>

                <div
                    style={{
                        textAlign: 'center',
                        fontSize: '32px',
                        fontWeight: 'bold',
                        lineHeight: '1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                    }}
                >
                    <span style={scoreStyle(team1Won)}>{game.score_1}</span>
                    <span style={{ color: '#6B6B69', fontSize: '24px' }}>:</span>
                    <span style={scoreStyle(team2Won)}>{game.score_2}</span>
                </div>

                <div style={{ textAlign: 'left' }}>
                    <PlayerLine
                        name={game.player_2_1}
                        userId={userIdFor('player_2_1', game.player_2_1)}
                        align="left"
                        getMedalPrefix={medal}
                    />
                    <PlayerLine
                        name={game.player_2_2}
                        userId={userIdFor('player_2_2', game.player_2_2)}
                        align="left"
                        getMedalPrefix={medal}
                    />
                </div>
            </div>
        </div>
    )
}
