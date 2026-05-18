'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { AdminPlayerSearchField, type AdminPlayerOption } from './AdminPlayerSearchField'

export type EventGameDraft = {
    team1Player1: AdminPlayerOption | null
    team1Player2: AdminPlayerOption | null
    team1Score: number | null
    team2Player1: AdminPlayerOption | null
    team2Player2: AdminPlayerOption | null
    team2Score: number | null
}

const EMPTY_DRAFT: EventGameDraft = {
    team1Player1: null,
    team1Player2: null,
    team1Score: null,
    team2Player1: null,
    team2Player2: null,
    team2Score: null,
}

const SCORE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const

type ScoreOutcome = 'neutral' | 'win' | 'lose' | 'tie'

type Props = {
    players: AdminPlayerOption[]
    onCancel: () => void
    onSubmit: (draft: EventGameDraft) => void
}

function scoreOutcomeForTeam(
    myScore: number | null,
    otherScore: number | null
): ScoreOutcome {
    if (myScore == null || otherScore == null) return 'neutral'
    if (myScore === otherScore) return 'tie'
    if (myScore > otherScore) return 'win'
    return 'lose'
}

function scorePickerStyles(outcome: ScoreOutcome, digitActive: boolean): {
    bar: CSSProperties
    digit: CSSProperties
} {
    if (outcome === 'win') {
        return {
            bar: {
                border: '1px solid #81C784',
                backgroundColor: '#F1F8E9',
            },
            digit: {
                backgroundColor: digitActive ? '#C8E6C9' : '#F1F8E9',
                color: '#1B5E20',
                fontWeight: digitActive ? 700 : 500,
            },
        }
    }
    if (outcome === 'lose') {
        return {
            bar: {
                border: '1px solid #E57373',
                backgroundColor: '#FFF5F5',
            },
            digit: {
                backgroundColor: digitActive ? '#FFCDD2' : '#FFF5F5',
                color: '#B71C1C',
                fontWeight: digitActive ? 700 : 500,
            },
        }
    }
    if (outcome === 'tie') {
        return {
            bar: {
                border: '1px solid #D0D0CE',
                backgroundColor: '#F0F0EE',
            },
            digit: {
                backgroundColor: digitActive ? '#E0E0DE' : '#F0F0EE',
                color: '#6B6B69',
                fontWeight: digitActive ? 700 : 500,
            },
        }
    }
    return {
        bar: {
            border: '1px solid #EBE8E0',
            backgroundColor: '#FFFFFF',
        },
        digit: {
            backgroundColor: digitActive ? '#E8E8E6' : '#FFFFFF',
            color: '#1D1D1B',
            fontWeight: digitActive ? 700 : 500,
        },
    }
}

function ScorePicker({
    value,
    outcome,
    onChange,
}: {
    value: number | null
    outcome: ScoreOutcome
    onChange: (score: number) => void
}) {
    const { bar } = scorePickerStyles(outcome, false)

    return (
        <div
            style={{
                width: '100%',
                display: 'flex',
                borderRadius: '8px',
                overflow: 'hidden',
                marginBottom: '4px',
                ...bar,
            }}
            role="group"
            aria-label="Счёт команды"
        >
            {SCORE_OPTIONS.map((n, index) => {
                const active = value === n
                const { digit } = scorePickerStyles(outcome, active)
                return (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onChange(n)}
                        aria-pressed={active}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            height: '38px',
                            margin: 0,
                            padding: 0,
                            border: 'none',
                            borderLeft: index > 0 ? '1px solid rgba(0,0,0,0.08)' : undefined,
                            borderRadius: 0,
                            fontSize: '15px',
                            lineHeight: 1,
                            cursor: 'pointer',
                            ...digit,
                        }}
                    >
                        {n}
                    </button>
                )
            })}
        </div>
    )
}

function TeamBlock({
    title,
    players,
    player1,
    player2,
    score,
    scoreOutcome,
    excludeForPlayer1,
    excludeForPlayer2,
    onPlayer1Change,
    onPlayer2Change,
    onScoreChange,
}: {
    title: string
    players: AdminPlayerOption[]
    player1: AdminPlayerOption | null
    player2: AdminPlayerOption | null
    score: number | null
    scoreOutcome: ScoreOutcome
    excludeForPlayer1: number[]
    excludeForPlayer2: number[]
    onPlayer1Change: (p: AdminPlayerOption | null) => void
    onPlayer2Change: (p: AdminPlayerOption | null) => void
    onScoreChange: (n: number) => void
}) {
    return (
        <section
            style={{
                marginBottom: '20px',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid #EBE8E0',
                backgroundColor: '#F5F5F5',
            }}
        >
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#1D1D1B' }}>{title}</h3>
            <AdminPlayerSearchField
                label="Игрок 1"
                players={players}
                excludeUserIds={excludeForPlayer1}
                value={player1}
                onChange={onPlayer1Change}
            />
            <AdminPlayerSearchField
                label="Игрок 2"
                players={players}
                excludeUserIds={excludeForPlayer2}
                value={player2}
                onChange={onPlayer2Change}
            />
            <ScorePicker value={score} outcome={scoreOutcome} onChange={onScoreChange} />
        </section>
    )
}

export function EventAddGameForm({ players, onCancel, onSubmit }: Props) {
    const [draft, setDraft] = useState<EventGameDraft>(EMPTY_DRAFT)
    const [validationErr, setValidationErr] = useState<string | null>(null)

    const selectedIds = useMemo(() => {
        const ids: number[] = []
        if (draft.team1Player1) ids.push(draft.team1Player1.user_id)
        if (draft.team1Player2) ids.push(draft.team1Player2.user_id)
        if (draft.team2Player1) ids.push(draft.team2Player1.user_id)
        if (draft.team2Player2) ids.push(draft.team2Player2.user_id)
        return ids
    }, [draft])

    const team1ScoreOutcome = scoreOutcomeForTeam(draft.team1Score, draft.team2Score)
    const team2ScoreOutcome = scoreOutcomeForTeam(draft.team2Score, draft.team1Score)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setValidationErr(null)
        if (!draft.team1Player1 || !draft.team1Player2 || !draft.team2Player1 || !draft.team2Player2) {
            setValidationErr('Выберите всех четырёх игроков.')
            return
        }
        if (draft.team1Score == null || draft.team2Score == null) {
            setValidationErr('Укажите счёт обеих команд.')
            return
        }
        onSubmit(draft)
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6B6B69' }}>Добавление партии</p>

            <TeamBlock
                title="Команда 1"
                players={players}
                player1={draft.team1Player1}
                player2={draft.team1Player2}
                score={draft.team1Score}
                scoreOutcome={team1ScoreOutcome}
                excludeForPlayer1={selectedIds.filter((id) => id !== draft.team1Player1?.user_id)}
                excludeForPlayer2={selectedIds.filter((id) => id !== draft.team1Player2?.user_id)}
                onPlayer1Change={(p) => setDraft((d) => ({ ...d, team1Player1: p }))}
                onPlayer2Change={(p) => setDraft((d) => ({ ...d, team1Player2: p }))}
                onScoreChange={(n) => setDraft((d) => ({ ...d, team1Score: n }))}
            />

            <TeamBlock
                title="Команда 2"
                players={players}
                player1={draft.team2Player1}
                player2={draft.team2Player2}
                score={draft.team2Score}
                scoreOutcome={team2ScoreOutcome}
                excludeForPlayer1={selectedIds.filter((id) => id !== draft.team2Player1?.user_id)}
                excludeForPlayer2={selectedIds.filter((id) => id !== draft.team2Player2?.user_id)}
                onPlayer1Change={(p) => setDraft((d) => ({ ...d, team2Player1: p }))}
                onPlayer2Change={(p) => setDraft((d) => ({ ...d, team2Player2: p }))}
                onScoreChange={(n) => setDraft((d) => ({ ...d, team2Score: n }))}
            />

            {validationErr ? (
                <p style={{ margin: '0 0 8px', color: '#B71C1C', fontSize: '13px' }}>{validationErr}</p>
            ) : null}

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                    type="submit"
                    style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#1B5E20',
                        color: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Добавить
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #EBE8E0',
                        backgroundColor: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Отмена
                </button>
            </div>
        </form>
    )
}
