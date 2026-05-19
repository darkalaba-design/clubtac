'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
    EMPTY_EVENT_GAME_DRAFT,
    type EventGameDraft,
    type EventGamePlayerOption,
} from '@/lib/admin/eventGames'
import { AdminPlayerSearchField, type AdminPlayerOption } from './AdminPlayerSearchField'

export type { EventGameDraft } from '@/lib/admin/eventGames'

type ScoreOutcome = 'neutral' | 'win' | 'lose' | 'tie'

type Props = {
    mode: 'add' | 'edit'
    gameId?: number
    initialDraft?: EventGameDraft
    players: AdminPlayerOption[]
    onCancel: () => void
    onSubmit: (draft: EventGameDraft) => void | Promise<void>
    /** Вызов после подтверждения удаления (логика API — позже). */
    onDeleteConfirm?: () => void
}

function scoreOutcomeForTeam(myScore: number | null, otherScore: number | null): ScoreOutcome {
    if (myScore == null || otherScore == null) return 'neutral'
    if (myScore === otherScore) return 'tie'
    if (myScore > otherScore) return 'win'
    return 'lose'
}

function scorePickerStyles(
    outcome: ScoreOutcome,
    digitActive: boolean,
    hasSelection: boolean
): { bar: CSSProperties; digit: CSSProperties; divider: string } {
    if (outcome === 'win') {
        if (!hasSelection) {
            return {
                bar: { border: '1px solid #81C784', backgroundColor: '#F1F8E9' },
                divider: '#C8E6C9',
                digit: { backgroundColor: '#F1F8E9', color: '#1D1D1B', fontWeight: 500 },
            }
        }
        return {
            bar: { border: '1px solid #81C784', backgroundColor: '#E8F5E9' },
            divider: '#C8E6C9',
            digit: digitActive
                ? { backgroundColor: '#81C784', color: '#FFFFFF', fontWeight: 700 }
                : { backgroundColor: '#E8F5E9', color: '#A5D6A7', fontWeight: 500 },
        }
    }
    if (outcome === 'lose') {
        if (!hasSelection) {
            return {
                bar: { border: '1px solid #E57373', backgroundColor: '#FFF5F5' },
                divider: '#FFCDD2',
                digit: { backgroundColor: '#FFF5F5', color: '#1D1D1B', fontWeight: 500 },
            }
        }
        return {
            bar: { border: '1px solid #E57373', backgroundColor: '#FFEBEE' },
            divider: '#FFCDD2',
            digit: digitActive
                ? { backgroundColor: '#E57373', color: '#FFFFFF', fontWeight: 700 }
                : { backgroundColor: '#FFEBEE', color: '#EF9A9A', fontWeight: 500 },
        }
    }
    if (outcome === 'tie') {
        if (!hasSelection) {
            return {
                bar: { border: '1px solid #D0D0CE', backgroundColor: '#F0F0EE' },
                divider: '#E0E0DE',
                digit: { backgroundColor: '#F0F0EE', color: '#1D1D1B', fontWeight: 500 },
            }
        }
        return {
            bar: { border: '1px solid #D0D0CE', backgroundColor: '#F5F5F3' },
            divider: '#E8E8E6',
            digit: digitActive
                ? { backgroundColor: '#BDBDBD', color: '#FFFFFF', fontWeight: 700 }
                : { backgroundColor: '#F5F5F3', color: '#B0B0AE', fontWeight: 500 },
        }
    }
    if (!hasSelection) {
        return {
            bar: { border: '1px solid #EBE8E0', backgroundColor: '#FFFFFF' },
            divider: '#EBE8E0',
            digit: { backgroundColor: '#FFFFFF', color: '#1D1D1B', fontWeight: 500 },
        }
    }
    return {
        bar: { border: '1px solid #EBE8E0', backgroundColor: '#FAFAFA' },
        divider: '#F0F0EE',
        digit: digitActive
            ? { backgroundColor: '#E0E0DE', color: '#1D1D1B', fontWeight: 700 }
            : { backgroundColor: '#FAFAFA', color: '#B0B0AE', fontWeight: 500 },
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
    const hasSelection = value != null
    const { bar, divider } = scorePickerStyles(outcome, false, hasSelection)

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
            {([0, 1, 2, 3, 4, 5, 6, 7, 8] as const).map((n, index) => {
                const active = value === n
                const { digit } = scorePickerStyles(outcome, active, hasSelection)
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
                            borderLeft: index > 0 ? `1px solid ${divider}` : undefined,
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
    player1: EventGamePlayerOption | null
    player2: EventGamePlayerOption | null
    score: number | null
    scoreOutcome: ScoreOutcome
    excludeForPlayer1: number[]
    excludeForPlayer2: number[]
    onPlayer1Change: (p: EventGamePlayerOption | null) => void
    onPlayer2Change: (p: EventGamePlayerOption | null) => void
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

export function EventGameForm({
    mode,
    gameId,
    initialDraft,
    players,
    onCancel,
    onSubmit,
    onDeleteConfirm,
}: Props) {
    const [draft, setDraft] = useState<EventGameDraft>(initialDraft ?? EMPTY_EVENT_GAME_DRAFT)
    const [validationErr, setValidationErr] = useState<string | null>(null)
    const [showDeletePrompt, setShowDeletePrompt] = useState(false)

    useEffect(() => {
        setDraft(initialDraft ?? EMPTY_EVENT_GAME_DRAFT)
        setValidationErr(null)
        setShowDeletePrompt(false)
    }, [initialDraft, gameId, mode])

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

    const isEdit = mode === 'edit'
    const formKey = isEdit ? `edit-${gameId ?? 0}` : 'add'

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
        void Promise.resolve(onSubmit(draft))
    }

    return (
        <form key={formKey} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6B6B69' }}>
                {isEdit ? 'Редактирование партии' : 'Добавление партии'}
            </p>

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
                    {isEdit ? 'Сохранить' : 'Добавить'}
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

            {isEdit ? (
                <div style={{ marginTop: '20px' }}>
                    {showDeletePrompt ? (
                        <div
                            style={{
                                padding: '14px',
                                borderRadius: '8px',
                                border: '1px solid #FFCDD2',
                                backgroundColor: '#FFEBEE',
                            }}
                        >
                            <p
                                style={{
                                    margin: '0 0 12px',
                                    fontWeight: 600,
                                    color: '#1D1D1B',
                                    lineHeight: 1.45,
                                }}
                            >
                                Удалить партию безвозвратно?
                                <br />
                                <span style={{ fontWeight: 500, fontSize: '13px', color: '#6B6B69' }}>
                                    Рейтинг Elo по этой партии будет откатан у всех четырёх игроков.
                                </span>
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowDeletePrompt(false)
                                        onDeleteConfirm?.()
                                    }}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: '#B71C1C',
                                        color: '#fff',
                                        fontWeight: 600,
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Удалить партию
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowDeletePrompt(false)}
                                    style={{
                                        padding: '8px',
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#6B6B69',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowDeletePrompt(true)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #B71C1C',
                                backgroundColor: '#fff',
                                color: '#B71C1C',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: 'pointer',
                            }}
                        >
                            Удалить партию
                        </button>
                    )}
                </div>
            ) : null}
        </form>
    )
}

