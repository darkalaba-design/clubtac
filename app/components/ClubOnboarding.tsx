'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@/app/contexts/UserContext'
import type { ClubRow } from '@/lib/clubs'
import type { User } from '@/types/user'

function getInitData(): string {
    if (typeof window === 'undefined') return ''
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
    return tg?.initData?.trim() || ''
}

export function ClubOnboarding() {
    const { user, loading, setUser } = useUser()
    const [clubs, setClubs] = useState<ClubRow[]>([])
    const [selected, setSelected] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const needsClub = !loading && user && !user.club_id

    useEffect(() => {
        if (!needsClub) return
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch('/api/clubs')
                const j = await res.json().catch(() => ({}))
                if (!cancelled && res.ok) {
                    const list = (j.clubs as ClubRow[]) ?? []
                    setClubs(list)
                    if (list.length === 1) setSelected(list[0].id)
                }
            } catch {
                /* ignore */
            }
        })()
        return () => {
            cancelled = true
        }
    }, [needsClub])

    const submit = useCallback(async () => {
        if (!selected) {
            setError('Выберите клуб')
            return
        }
        const initData = getInitData()
        if (!initData) {
            setError('Откройте приложение через Telegram')
            return
        }
        setSaving(true)
        setError(null)
        try {
            const res = await fetch('/api/user/club', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData, club_id: selected }),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            setUser(j.user as User)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось сохранить клуб')
        } finally {
            setSaving(false)
        }
    }, [selected, setUser])

    if (!needsClub) return null

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-onboarding-title"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 2000,
                backgroundColor: 'rgba(29,29,27,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '400px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: '0 8px 32px rgba(29,29,27,0.12)',
                }}
            >
                <h2 id="club-onboarding-title" style={{ margin: '0 0 8px', fontSize: '18px', color: '#1D1D1B' }}>
                    Выберите ваш клуб
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#6B6B69', lineHeight: 1.45 }}>
                    Укажите город, к клубу которого вы относитесь. Позже можно сменить в настройках профиля.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {clubs.map((c) => {
                        const active = selected === c.id
                        return (
                            <button
                                key={c.id}
                                type="button"
                                disabled={saving}
                                onClick={() => setSelected(c.id)}
                                style={{
                                    textAlign: 'left',
                                    padding: '12px 14px',
                                    borderRadius: '10px',
                                    border: active ? '2px solid #1B5E20' : '1px solid #EBE8E0',
                                    backgroundColor: active ? '#E8F5E9' : '#FAFAF8',
                                    cursor: saving ? 'wait' : 'pointer',
                                    fontSize: '15px',
                                    fontWeight: active ? 600 : 500,
                                    color: '#1D1D1B',
                                }}
                            >
                                {c.city || c.name}
                            </button>
                        )
                    })}
                </div>

                {error ? (
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#B71C1C' }}>{error}</p>
                ) : null}

                <button
                    type="button"
                    disabled={saving || !selected}
                    onClick={() => void submit()}
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: saving || !selected ? '#EBE8E0' : '#FFDF00',
                        color: '#1D1D1B',
                        fontWeight: 700,
                        fontSize: '15px',
                        cursor: saving || !selected ? 'not-allowed' : 'pointer',
                    }}
                >
                    {saving ? 'Сохранение…' : 'Продолжить'}
                </button>
            </div>
        </div>
    )
}
