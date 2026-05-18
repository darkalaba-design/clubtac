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

type Props = {
    players: AdminPlayerOption[]
    onCancel: () => void
    onSubmit: (draft: EventGameDraft) => void
}

function scoreChipStyle(active: boolean): CSSProperties {
    return {
        minWidth: '36px',
        height: '36px',
        padding: '0 10px',
        fontSize: '15px',
        fontWeight: active ? 700 : 500,
        borderRadius: '8px',
        border: active ? '2px solid #1B5E20' : '1px solid #EBE8E0',
        backgroundColor: active ? '#E8F5E9' : '#FFFFFF',
        color: '#1D1D1B',
        cursor: 'pointer',
    }
}

function ScorePicker({
    label,
    value,
    onChange,
}: {
    label: string
    value: number | null
    onChange: (score: number) => void
}) {
    return (
        <div style={{ marginBottom: '4px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1D1D1B', marginBottom: '8px' }}>{label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {SCORE_OPTIONS.map((n) => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onChange(n)}
                        style={scoreChipStyle(value === n)}
                        aria-pressed={value === n}
                    >
                        {n}
                    </button>
                ))}
            </div>
        </div>
    )
}

function TeamBlock({
    title,
    players,
    player1,
    player2,
    score,
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
                backgroundColor: '#FFFEF7',
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
            <ScorePicker label="Счёт" value={score} onChange={onScoreChange} />
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
