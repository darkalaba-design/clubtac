'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { AppRole } from '@/lib/admin/appRole'
import { TELEGRAM_INIT_DATA_HEADER } from '@/lib/admin/constants'

type SessionRes = {
    app_role: AppRole
    app_admin_ui: boolean
    user: { id: number; telegram_id: number; first_name: string | null; username: string | null }
}

type AdminUserRow = {
    id: number
    telegram_id: number
    first_name: string | null
    last_name?: string | null
    username: string | null
    app_role: AppRole
    created_at?: string | null
}

type EventRow = {
    id: string
    title: string
    starts_at: string
    club_id: string
    price: number | null
    address: string
    status: string
    type: string
    duration_minutes: number | null
    template_id: string | null
    description?: string | null
    cover?: string | null
}

type GameRow = {
    game_id: number
    created_at: string
    player_1_1: string
    player_1_2: string
    player_2_1: string
    player_2_2: string
    score_1: number
    score_2: number
}

function getInitDataHeader(): string {
    if (typeof window === 'undefined') return ''
    return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData?.trim() || ''
}

function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const h = new Headers(init.headers)
    const id = getInitDataHeader()
    if (id) h.set(TELEGRAM_INIT_DATA_HEADER, id)
    return fetch(input, { ...init, headers: h })
}

export default function AdminPageClient() {
    const [phase, setPhase] = useState<'loading' | 'no_telegram' | 'forbidden' | 'ready'>('loading')
    const [session, setSession] = useState<SessionRes | null>(null)
    const [err, setErr] = useState<string | null>(null)

    const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([])
    const [events, setEvents] = useState<EventRow[]>([])
    const [games, setGames] = useState<GameRow[]>([])

    const [newEvent, setNewEvent] = useState({
        title: '',
        starts_at: '',
        club_id: '',
        address: '',
        type: 'game',
        status: 'scheduled',
        price: '' as string,
        description: '',
    })

    const [editEventId, setEditEventId] = useState<string | null>(null)
    const [editEvent, setEditEvent] = useState<Partial<EventRow>>({})

    const loadLists = useCallback(async (role: AppRole) => {
        setErr(null)
        try {
            if (role === 'root') {
                const ur = await adminFetch('/api/admin/users?limit=120')
                const uj = await ur.json().catch(() => ({}))
                if (!ur.ok) throw new Error(uj.error || ur.statusText)
                setAdminUsers(uj.users || [])
            } else {
                setAdminUsers([])
            }

            if (role === 'admin' || role === 'root') {
                const er = await adminFetch('/api/admin/events')
                const ej = await er.json().catch(() => ({}))
                if (!er.ok) throw new Error(ej.error || er.statusText)
                setEvents(ej.events || [])

                const gr = await adminFetch('/api/admin/games?limit=100')
                const gj = await gr.json().catch(() => ({}))
                if (!gr.ok) throw new Error(gj.error || gr.statusText)
                setGames(gj.games || [])
            }
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Ошибка загрузки')
        }
    }, [])

    useEffect(() => {
        const run = async () => {
            setPhase('loading')
            setErr(null)
            const initData = getInitDataHeader()
            if (!initData) {
                setPhase('no_telegram')
                return
            }
            const res = await adminFetch('/api/admin/session')
            const j = await res.json().catch(() => ({}))
            if (!res.ok) {
                setErr(j.error || res.statusText)
                setPhase('forbidden')
                return
            }
            const s = j as SessionRes
            setSession(s)
            if (s.app_role === 'user') {
                setPhase('forbidden')
                return
            }
            if (!s.app_admin_ui) {
                setErr(
                    'Новая админка в приложении на этапе запуска доступна только аккаунтам из списка сервера (WeWeb-админка не затронута).'
                )
                setPhase('forbidden')
                return
            }
            setPhase('ready')
            await loadLists(s.app_role)
        }
        void run()
    }, [loadLists])

    const setRole = async (targetId: number, app_role: 'admin' | 'user') => {
        setErr(null)
        const res = await adminFetch(`/api/admin/users/${targetId}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_role }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) {
            setErr(j.error || res.statusText)
            return
        }
        await loadLists('root')
    }

    const submitNewEvent = async (e: React.FormEvent) => {
        e.preventDefault()
        setErr(null)
        const body: Record<string, unknown> = {
            title: newEvent.title.trim(),
            starts_at: newEvent.starts_at.trim(),
            club_id: newEvent.club_id.trim(),
            address: newEvent.address.trim(),
            type: newEvent.type,
            status: newEvent.status,
            description: newEvent.description.trim() || null,
        }
        if (newEvent.price.trim() !== '') {
            const p = Number.parseFloat(newEvent.price.replace(',', '.'))
            if (!Number.isFinite(p)) {
                setErr('Некорректная цена')
                return
            }
            body.price = p
        } else body.price = null

        const res = await adminFetch('/api/admin/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) {
            setErr(j.error || res.statusText)
            return
        }
        setNewEvent({
            title: '',
            starts_at: '',
            club_id: '',
            address: '',
            type: 'game',
            status: 'scheduled',
            price: '',
            description: '',
        })
        if (session?.app_role) await loadLists(session.app_role)
    }

    const saveEditEvent = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editEventId) return
        setErr(null)
        const res = await adminFetch(`/api/admin/events/${encodeURIComponent(editEventId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editEvent),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) {
            setErr(j.error || res.statusText)
            return
        }
        setEditEventId(null)
        setEditEvent({})
        if (session?.app_role) await loadLists(session.app_role)
    }

    const card: React.CSSProperties = {
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '14px',
        marginBottom: '14px',
        boxShadow: '0 2px 12px rgba(29,29,27,0.06)',
    }

    if (phase === 'loading') {
        return (
            <div style={{ padding: '16px', maxWidth: '720px', margin: '0 auto' }}>
                <p style={{ margin: 0 }}>Загрузка…</p>
            </div>
        )
    }

    if (phase === 'no_telegram') {
        return (
            <div style={{ padding: '16px', maxWidth: '720px', margin: '0 auto' }}>
                <Link href="/" style={{ color: '#1B5E20', fontWeight: 600 }}>
                    ← На главную
                </Link>
                <p style={{ marginTop: '16px' }}>Откройте админку из Telegram Mini App — нужна подписанная строка initData.</p>
            </div>
        )
    }

    if (phase === 'forbidden') {
        return (
            <div style={{ padding: '16px', maxWidth: '720px', margin: '0 auto' }}>
                <Link href="/" style={{ color: '#1B5E20', fontWeight: 600 }}>
                    ← На главную
                </Link>
                <p style={{ marginTop: '16px' }}>Нет прав администратора.</p>
                {err && <p style={{ color: '#B71C1C', marginTop: '8px' }}>{err}</p>}
                <p style={{ fontSize: '13px', color: '#6B6B69', marginTop: '12px' }}>
                    Роль root выставляется в SQL в Supabase; админов назначает root в этом разделе после входа.
                </p>
            </div>
        )
    }

    const role = session?.app_role
    const isRoot = role === 'root'

    return (
        <div style={{ padding: '16px 12px 96px', maxWidth: '720px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <Link href="/" style={{ color: '#1B5E20', fontWeight: 600 }}>
                    ← На главную
                </Link>
                <span style={{ fontSize: '12px', color: '#6B6B69' }}>
                    {role === 'root' ? 'root' : 'admin'}
                </span>
            </div>

            {err && (
                <div
                    style={{
                        ...card,
                        backgroundColor: '#FFEBEE',
                        color: '#B71C1C',
                        border: '1px solid #FFCDD2',
                    }}
                >
                    {err}
                </div>
            )}

            {isRoot && (
                <section style={card}>
                    <h2 style={{ margin: '0 0 12px', fontSize: '17px' }}>Администраторы</h2>
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6B6B69' }}>
                        Только root может выдавать и снимать роль admin (не root через API).
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {adminUsers.map((u) => (
                            <div
                                key={u.id}
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: '8px',
                                    justifyContent: 'space-between',
                                    borderBottom: '1px solid #EBE8E0',
                                    paddingBottom: '8px',
                                }}
                            >
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600 }}>
                                        {u.first_name || '—'} {u.last_name || ''}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6B6B69' }}>
                                        id {u.id} · tg {u.telegram_id} · @{u.username || '—'} ·{' '}
                                        <strong>{u.app_role}</strong>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {u.app_role !== 'admin' && u.app_role !== 'root' && (
                                        <button
                                            type="button"
                                            onClick={() => setRole(u.id, 'admin')}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                backgroundColor: '#FFDF00',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Сделать admin
                                        </button>
                                    )}
                                    {u.app_role === 'admin' && (
                                        <button
                                            type="button"
                                            onClick={() => setRole(u.id, 'user')}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #B71C1C',
                                                backgroundColor: '#fff',
                                                color: '#B71C1C',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Снять admin
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section style={card}>
                <h2 style={{ margin: '0 0 12px', fontSize: '17px' }}>События</h2>
                <form onSubmit={submitNewEvent} style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>Новое событие</div>
                    <input
                        placeholder="Название"
                        value={newEvent.title}
                        onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))}
                        required
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #EBE8E0' }}
                    />
                    <input
                        placeholder="starts_at ISO, напр. 2026-06-01T18:00:00+03:00"
                        value={newEvent.starts_at}
                        onChange={(e) => setNewEvent((p) => ({ ...p, starts_at: e.target.value }))}
                        required
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #EBE8E0' }}
                    />
                    <input
                        placeholder="club_id (uuid)"
                        value={newEvent.club_id}
                        onChange={(e) => setNewEvent((p) => ({ ...p, club_id: e.target.value }))}
                        required
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #EBE8E0' }}
                    />
                    <input
                        placeholder="Адрес"
                        value={newEvent.address}
                        onChange={(e) => setNewEvent((p) => ({ ...p, address: e.target.value }))}
                        required
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #EBE8E0' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <select
                            value={newEvent.type}
                            onChange={(e) => setNewEvent((p) => ({ ...p, type: e.target.value }))}
                            style={{ padding: '8px', borderRadius: '8px' }}
                        >
                            <option value="game">game</option>
                            <option value="workshop">workshop</option>
                            <option value="party">party</option>
                        </select>
                        <select
                            value={newEvent.status}
                            onChange={(e) => setNewEvent((p) => ({ ...p, status: e.target.value }))}
                            style={{ padding: '8px', borderRadius: '8px' }}
                        >
                            <option value="scheduled">scheduled</option>
                            <option value="finished">finished</option>
                            <option value="cancelled">cancelled</option>
                            <option value="canceled">canceled</option>
                        </select>
                        <input
                            placeholder="Цена (пусто = null)"
                            value={newEvent.price}
                            onChange={(e) => setNewEvent((p) => ({ ...p, price: e.target.value }))}
                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #EBE8E0', flex: 1, minWidth: '120px' }}
                        />
                    </div>
                    <textarea
                        placeholder="Описание (необязательно)"
                        value={newEvent.description}
                        onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
                        rows={2}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #EBE8E0' }}
                    />
                    <button
                        type="submit"
                        style={{
                            padding: '10px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#1B5E20',
                            color: '#fff',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Создать событие
                    </button>
                </form>

                <div style={{ fontWeight: 600, marginBottom: '8px' }}>Список</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {events.map((ev) => (
                        <div
                            key={ev.id}
                            style={{
                                border: '1px solid #EBE8E0',
                                borderRadius: '10px',
                                padding: '10px',
                                fontSize: '13px',
                            }}
                        >
                            <div style={{ fontWeight: 700 }}>{ev.title}</div>
                            <div style={{ color: '#6B6B69' }}>
                                {ev.starts_at} · {ev.status} · {ev.type}
                            </div>
                            {editEventId === ev.id ? (
                                <form onSubmit={saveEditEvent} style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <input
                                        value={editEvent.title ?? ''}
                                        onChange={(e) => setEditEvent((p) => ({ ...p, title: e.target.value }))}
                                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                                    />
                                    <input
                                        value={editEvent.starts_at ?? ''}
                                        onChange={(e) => setEditEvent((p) => ({ ...p, starts_at: e.target.value }))}
                                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                                    />
                                    <input
                                        value={editEvent.address ?? ''}
                                        onChange={(e) => setEditEvent((p) => ({ ...p, address: e.target.value }))}
                                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                                    />
                                    <select
                                        value={editEvent.status ?? ev.status}
                                        onChange={(e) => setEditEvent((p) => ({ ...p, status: e.target.value }))}
                                        style={{ padding: '8px' }}
                                    >
                                        <option value="scheduled">scheduled</option>
                                        <option value="finished">finished</option>
                                        <option value="cancelled">cancelled</option>
                                        <option value="canceled">canceled</option>
                                    </select>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button type="submit" style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#FFDF00', fontWeight: 600, cursor: 'pointer' }}>
                                            Сохранить
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditEventId(null)
                                                setEditEvent({})
                                            }}
                                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer' }}
                                        >
                                            Отмена
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditEventId(ev.id)
                                        setEditEvent({
                                            title: ev.title,
                                            starts_at: ev.starts_at,
                                            address: ev.address,
                                            status: ev.status,
                                        })
                                    }}
                                    style={{
                                        marginTop: '8px',
                                        padding: '6px 10px',
                                        borderRadius: '8px',
                                        border: '1px solid #1D1D1B',
                                        background: '#fff',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                    }}
                                >
                                    Изменить
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            <section style={card}>
                <h2 style={{ margin: '0 0 8px', fontSize: '17px' }}>Сыгранные партии</h2>
                <div
                    style={{
                        marginBottom: '12px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#FFF9E6',
                        border: '1px solid #FFE082',
                        fontSize: '12px',
                        color: '#5D4037',
                        lineHeight: 1.45,
                    }}
                >
                    Сейчас только <strong>просмотр</strong> последних строк из <code>games_summary</code>. Добавление и удаление
                    партий подключим к <code>clubtac_games</code> и <code>clubtac_players</code> (через отдельную логику), чтобы не
                    ломать вашу схему и view.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {games.map((g) => (
                        <div
                            key={g.game_id}
                            style={{
                                fontSize: '12px',
                                borderBottom: '1px solid #eee',
                                paddingBottom: '6px',
                            }}
                        >
                            #{g.game_id} {g.player_1_1}+{g.player_1_2} vs {g.player_2_1}+{g.player_2_2} — {g.score_1}:{g.score_2}{' '}
                            <span style={{ color: '#6B6B69' }}>({new Date(g.created_at).toLocaleString('ru-RU')})</span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
