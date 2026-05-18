'use client'

import type { CSSProperties } from 'react'
import type { PlayedGameRowData } from '../components/PlayedGameRow'

type Props = {
    game: PlayedGameRowData
    showDividerTop?: boolean
    onClick: () => void
}

/** Строка партии в админке: без ссылок, вся карточка кликабельна. */
export function AdminEventGameRow({ game, showDividerTop = false, onClick }: Props) {
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

    const nameStyle: CSSProperties = {
        fontWeight: 500,
        fontSize: '14px',
        lineHeight: '14px',
        color: '#1D1D1B',
    }

    return (
        <div>
            {showDividerTop ? <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} /> : null}
            <button
                type="button"
                onClick={onClick}
                style={{
                    width: '100%',
                    margin: 0,
                    padding: '10px 12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    gap: '12px',
                    textAlign: 'inherit',
                    transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFEF7'
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                }}
            >
                <div style={{ textAlign: 'right' }}>
                    <div style={{ marginBottom: '4px', lineHeight: '14px' }}>
                        <span style={nameStyle}>{game.player_1_1}</span>
                    </div>
                    <div style={{ lineHeight: '14px' }}>
                        <span style={nameStyle}>{game.player_1_2}</span>
                    </div>
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
                    <div style={{ marginBottom: '4px', lineHeight: '14px' }}>
                        <span style={nameStyle}>{game.player_2_1}</span>
                    </div>
                    <div style={{ lineHeight: '14px' }}>
                        <span style={nameStyle}>{game.player_2_2}</span>
                    </div>
                </div>
            </button>
        </div>
    )
}
