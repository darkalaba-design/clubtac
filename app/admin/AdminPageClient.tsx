'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CSSProperties } from 'react'
import type { AppRole } from '@/lib/admin/appRole'
import { TELEGRAM_INIT_DATA_HEADER } from '@/lib/admin/constants'
import { ADMIN_EVENT_ADDRESS_PRESETS, ADMIN_EVENT_PRICE_PRESETS } from '@/lib/admin/eventFormPresets'
import {
    formatEventCardDayMonthAndTime,
    formatEventModalDateTime,
    getEventTypeNameRu,
    eventStatusLabelRu,
} from '@/lib/admin/eventDisplay'
import { EventParticipantAdminCard } from './EventParticipantAdminCard'
import { EventAddParticipantPicker } from './EventAddParticipantPicker'
import { EventGameForm, type EventGameDraft } from './EventGameForm'
import type { AdminGamesByEventGroup } from '@/lib/admin/adminGamesByEvent'
import { eventGameSummaryToDraft, type EventGameSummaryRow } from '@/lib/admin/eventGames'
import { AdminEventGameRow } from './AdminEventGameRow'
import { participantRefundAmount } from '@/lib/admin/eventParticipantWallet'
import GeoIcon from '../components/GeoIcon'
import GamesTabIcon from '../components/GamesTabIcon'
import EventsTabIcon from '../components/EventsTabIcon'
import AccessTabIcon from '../components/AccessTabIcon'
import PlayersTabIcon from '../components/PlayersTabIcon'
import { displayPublicNickname } from '@/lib/takoff'
import { adminFetch } from '@/lib/admin/adminFetch'
import { AdminPlayerModal } from './AdminPlayerModal'
import { AdminPlayerStatusChips } from './AdminPlayerStatusChips'

function AdminAddressLine({ address, style }: { address: string; style?: CSSProperties }) {
    return (
        <div
            style={{
                fontSize: '14px',
                color: '#6B6B69',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                ...style,
            }}
        >
            <GeoIcon size={16} style={{ marginTop: '2px' }} />
            <span>{address}</span>
        </div>
    )
}

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
    nickname?: string | null
    app_role: AppRole
    created_at?: string | null
}

function adminUserMatchesSearch(u: AdminUserRow, rawQuery: string): boolean {
    const q = rawQuery.trim().toLowerCase()
    if (!q) return true
    const uname = (u.username ?? '').trim().toLowerCase()
    const nick = (u.nickname ?? '').trim().toLowerCase()
    const first = (u.first_name ?? '').trim().toLowerCase()
    const last = (u.last_name ?? '').trim().toLowerCase()
    const full = `${first} ${last}`.trim()
    const chunks = [
        first,
        last,
        full,
        uname,
        uname ? `@${uname}` : '',
        nick,
        String(u.telegram_id),
        String(u.id),
    ]
    return chunks.some((c) => c && c.includes(q))
}

function adminPlayerDisplayName(p: AdminPlayerRow): string {
    if (p.takoff) return displayPublicNickname(null, true)
    if (p.nickname?.trim()) return p.nickname.trim()
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
    return name || `Игрок #${p.user_id}`
}

function adminPlayerMatchesSearch(p: AdminPlayerRow, rawQuery: string): boolean {
    const q = rawQuery.trim().toLowerCase()
    if (!q) return true
    const nick = (p.nickname ?? '').trim().toLowerCase()
    const uname = (p.username ?? '').trim().toLowerCase()
    const first = (p.first_name ?? '').trim().toLowerCase()
    const last = (p.last_name ?? '').trim().toLowerCase()
    const full = `${first} ${last}`.trim()
    const chunks = [
        nick,
        first,
        last,
        full,
        uname,
        uname ? `@${uname}` : '',
        String(p.user_id),
        p.telegram_id != null ? String(p.telegram_id) : '',
        p.place != null ? String(p.place) : '',
    ]
    return chunks.some((c) => c.length > 0 && c.includes(q))
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
    created_at?: string | null
    description?: string | null
    cover?: string | null
    players_limit?: number | null
    /** Заполнены в GET /api/admin/events при агрегации участников */
    participants_registered?: number
    participants_paid?: number
}

type AdminClubOption = { id: string; name: string }

type EventParticipantRow = {
    id: string | number
    order_id?: string | null
    event_id: string
    user_id: number
    payment_status: string
    price_paid: number | null
    paylink: string | null
    created_at: string | null
    first_name: string | null
    last_name: string | null
    username: string | null
    nickname: string | null
    userpic: string | null
    takoff: boolean
}

type EventModalDraft = {
    title: string
    startsAtLocal: string
    address: string
    priceDigits: string
    maxParticipantsDigits: string
    description: string
    status: string
    type: string
    durationMinutesDigits: string
    clubId: string
}

function getInitDataHeader(): string {
    if (typeof window === 'undefined') return ''
    return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData?.trim() || ''
}

function onlyDigits(s: string): string {
    return s.replace(/\D/g, '')
}

/** Значение `datetime-local` → ISO для Supabase */
function startsAtLocalToIso(localValue: string): string | null {
    const t = localValue.trim()
    if (!t) return null
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
}

function isoToDatetimeLocalValue(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function eventToModalDraft(ev: EventRow): EventModalDraft {
    return {
        title: ev.title,
        startsAtLocal: isoToDatetimeLocalValue(ev.starts_at),
        address: ev.address,
        priceDigits: ev.price != null ? String(ev.price) : '',
        maxParticipantsDigits: ev.players_limit != null ? String(ev.players_limit) : '',
        description: ev.description ?? '',
        status: ev.status === 'canceled' ? 'cancelled' : ev.status,
        type: ev.type,
        durationMinutesDigits: ev.duration_minutes != null ? String(ev.duration_minutes) : '',
        clubId: ev.club_id,
    }
}

type AdminNavTab = 'events' | 'games' | 'players' | 'admins'
type EventModalTab = 'participants' | 'games' | 'details'

type AdminPlayerRow = {
    user_id: number
    telegram_id?: number
    first_name?: string | null
    last_name?: string | null
    nickname?: string | null
    rating?: number | null
    games_played?: number | null
    place?: number | null
    username?: string | null
    takoff?: boolean
    userpic?: string | null
    app_role?: string
    status?: string | null
}

const ADMIN_SCROLL_PT = 'calc(52px + env(safe-area-inset-top, 0px))'
const ADMIN_SCROLL_PB = 'calc(72px + env(safe-area-inset-bottom, 0px))'

export default function AdminPageClient() {
    const [phase, setPhase] = useState<'loading' | 'no_telegram' | 'forbidden' | 'ready'>('loading')
    const [session, setSession] = useState<SessionRes | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [navTab, setNavTab] = useState<AdminNavTab>('events')

    const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([])
    const [adminUsersSearch, setAdminUsersSearch] = useState('')
    const [adminClubs, setAdminClubs] = useState<AdminClubOption[]>([])
    const [events, setEvents] = useState<EventRow[]>([])
    const [gamesByEvent, setGamesByEvent] = useState<AdminGamesByEventGroup[]>([])
    const [adminPlayers, setAdminPlayers] = useState<AdminPlayerRow[]>([])
    const [adminPlayersSearch, setAdminPlayersSearch] = useState('')
    const [playerModalUserId, setPlayerModalUserId] = useState<number | null>(null)
    const [playerModalPreviewName, setPlayerModalPreviewName] = useState<string>('')

    const [newEvent, setNewEvent] = useState({
        clubId: '',
        title: '',
        startsAtLocal: '',
        address: '',
        priceDigits: '',
        maxParticipantsDigits: '',
        description: '',
    })

    const [eventModalId, setEventModalId] = useState<string | null>(null)
    const [eventModalLoading, setEventModalLoading] = useState(false)
    const [eventModalErr, setEventModalErr] = useState<string | null>(null)
    const [eventModalEvent, setEventModalEvent] = useState<EventRow | null>(null)
    const [eventModalParticipants, setEventModalParticipants] = useState<EventParticipantRow[]>([])
    const [eventModalEditing, setEventModalEditing] = useState(false)
    const [eventModalAddingGame, setEventModalAddingGame] = useState(false)
    const [eventModalEditingGameId, setEventModalEditingGameId] = useState<number | null>(null)
    const [eventModalGames, setEventModalGames] = useState<EventGameSummaryRow[]>([])
    const [eventModalGamesLoading, setEventModalGamesLoading] = useState(false)
    const [eventModalDraft, setEventModalDraft] = useState<EventModalDraft | null>(null)
    const [eventModalCoverBusy, setEventModalCoverBusy] = useState(false)
    const [eventModalCoverMessage, setEventModalCoverMessage] = useState<string | null>(null)
    const [eventModalTab, setEventModalTab] = useState<EventModalTab>('participants')
    const [admitPromptParticipantId, setAdmitPromptParticipantId] = useState<string | number | null>(null)
    const [excludePromptParticipantId, setExcludePromptParticipantId] = useState<string | number | null>(null)
    const [participantBusy, setParticipantBusy] = useState(false)

    const creatingEventRef = useRef(false)
    const [creatingEvent, setCreatingEvent] = useState(false)
    const [newEventSuccess, setNewEventSuccess] = useState<string | null>(null)
    const [showNewEventForm, setShowNewEventForm] = useState(false)

    const loadLists = useCallback(async (role: AppRole) => {
        setErr(null)
        try {
            if (role === 'root') {
                const ur = await adminFetch('/api/admin/users?limit=200')
                const uj = await ur.json().catch(() => ({}))
                if (!ur.ok) throw new Error(uj.error || ur.statusText)
                setAdminUsers(uj.users || [])
            } else {
                setAdminUsers([])
            }

            if (role === 'admin' || role === 'root') {
                const [er, cr, gr, pr] = await Promise.all([
                    adminFetch('/api/admin/events'),
                    adminFetch('/api/admin/clubs'),
                    adminFetch('/api/admin/games?limit=500'),
                    adminFetch('/api/admin/players?limit=500'),
                ])
                const ej = await er.json().catch(() => ({}))
                const cj = await cr.json().catch(() => ({}))
                const gj = await gr.json().catch(() => ({}))
                const pj = await pr.json().catch(() => ({}))
                if (!er.ok) throw new Error(typeof ej.error === 'string' ? ej.error : er.statusText)
                setEvents(ej.events || [])
                if (cr.ok) setAdminClubs((cj.clubs as AdminClubOption[]) || [])
                else setAdminClubs([])
                if (!gr.ok) throw new Error(typeof gj.error === 'string' ? gj.error : gr.statusText)
                setGamesByEvent((gj.groups as AdminGamesByEventGroup[]) || [])
                if (!pr.ok) throw new Error(typeof pj.error === 'string' ? pj.error : pr.statusText)
                setAdminPlayers((pj.players as AdminPlayerRow[]) || [])
            } else {
                setEvents([])
                setGamesByEvent([])
                setAdminClubs([])
                setAdminPlayers([])
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

    useEffect(() => {
        if (phase !== 'ready' || !session) return
        if (session.app_role !== 'root' && navTab === 'admins') setNavTab('events')
    }, [phase, session, navTab])

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
        setNewEventSuccess(null)
        const starts_at = startsAtLocalToIso(newEvent.startsAtLocal)
        if (!starts_at) {
            setErr('Укажите дату и время')
            return
        }
        if (!newEvent.clubId.trim()) {
            setErr('Выберите клуб')
            return
        }
        const priceDigits = onlyDigits(newEvent.priceDigits)
        const maxDigits = onlyDigits(newEvent.maxParticipantsDigits)
        const body: Record<string, unknown> = {
            club_id: newEvent.clubId.trim(),
            title: newEvent.title.trim(),
            starts_at,
            address: newEvent.address.trim(),
            type: 'game',
            status: 'scheduled',
            description: newEvent.description.trim() || null,
        }
        if (priceDigits !== '') {
            const p = Number.parseInt(priceDigits, 10)
            if (!Number.isFinite(p) || p < 0) {
                setErr('Некорректная стоимость')
                return
            }
            body.price = p
        } else {
            body.price = null
        }
        if (maxDigits !== '') {
            const m = Number.parseInt(maxDigits, 10)
            if (!Number.isFinite(m) || m < 1) {
                setErr('Максимум участников — целое число от 1 или оставьте поле пустым')
                return
            }
            body.players_limit = m
        } else {
            body.players_limit = null
        }

        if (creatingEventRef.current) return
        creatingEventRef.current = true
        setCreatingEvent(true)
        try {
            const res = await adminFetch('/api/admin/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok) {
                setErr(typeof j.error === 'string' ? j.error : res.statusText)
                return
            }
            setNewEvent({
                clubId: '',
                title: '',
                startsAtLocal: '',
                address: '',
                priceDigits: '',
                maxParticipantsDigits: '',
                description: '',
            })
            if (session?.app_role) await loadLists(session.app_role)
            const createdTitle = (j as { event?: { title?: string } }).event?.title?.trim() ?? ''
            setNewEventSuccess(createdTitle ? `Событие «${createdTitle}» создано.` : 'Событие создано.')
            setShowNewEventForm(false)
        } finally {
            creatingEventRef.current = false
            setCreatingEvent(false)
        }
    }

    const refetchAdminGamesByEvent = useCallback(async () => {
        try {
            const r = await adminFetch('/api/admin/games?limit=500')
            const j = await r.json().catch(() => ({}))
            if (!r.ok) return
            setGamesByEvent((j.groups as AdminGamesByEventGroup[]) || [])
        } catch {
            /* список партий обновится при следующей загрузке */
        }
    }, [])

    const refetchEventGames = useCallback(async (id: string) => {
        setEventModalGamesLoading(true)
        try {
            const r = await adminFetch(`/api/admin/events/${encodeURIComponent(id)}/games`)
            const j = await r.json().catch(() => ({}))
            if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : r.statusText)
            setEventModalGames((j.games as EventGameSummaryRow[]) || [])
        } catch {
            setEventModalGames([])
        } finally {
            setEventModalGamesLoading(false)
        }
    }, [])

    const refetchEventModal = useCallback(async (id: string) => {
        setEventModalLoading(true)
        setEventModalErr(null)
        try {
            const [evRes, gamesRes] = await Promise.all([
                adminFetch(`/api/admin/events/${encodeURIComponent(id)}`),
                adminFetch(`/api/admin/events/${encodeURIComponent(id)}/games`),
            ])
            const ej = await evRes.json().catch(() => ({}))
            const gj = await gamesRes.json().catch(() => ({}))
            if (!evRes.ok) throw new Error(typeof ej.error === 'string' ? ej.error : evRes.statusText)
            setEventModalEvent(ej.event as EventRow)
            setEventModalParticipants((ej.participants as EventParticipantRow[]) || [])
            if (gamesRes.ok) {
                setEventModalGames((gj.games as EventGameSummaryRow[]) || [])
            } else {
                setEventModalGames([])
            }
        } catch (e) {
            setEventModalErr(e instanceof Error ? e.message : 'Ошибка загрузки')
            setEventModalEvent(null)
            setEventModalParticipants([])
            setEventModalGames([])
        } finally {
            setEventModalLoading(false)
            setEventModalGamesLoading(false)
        }
    }, [])

    const requestEventCoverWebhook = async () => {
        if (!eventModalId) return
        setEventModalCoverBusy(true)
        setEventModalCoverMessage(null)
        try {
            const res = await adminFetch(`/api/admin/events/${encodeURIComponent(eventModalId)}/notify-cover`, {
                method: 'POST',
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok) {
                setEventModalCoverMessage(
                    typeof j.error === 'string' ? j.error : 'Не удалось отправить запрос на генерацию обложки'
                )
                return
            }
            setEventModalCoverMessage(
                'Запрос на генерацию обложки отправлен. Обычно изображение появляется в течение минуты — можно открыть событие снова позже.'
            )
            window.setTimeout(() => {
                void refetchEventModal(eventModalId)
            }, 4000)
        } finally {
            setEventModalCoverBusy(false)
        }
    }

    const openEventModal = (
        id: string,
        options?: { tab?: EventModalTab; editGameId?: number }
    ) => {
        setEventModalId(id)
        setEventModalTab(options?.tab ?? 'participants')
        setAdmitPromptParticipantId(null)
        setExcludePromptParticipantId(null)
        setParticipantBusy(false)
        setEventModalEditing(false)
        setEventModalAddingGame(false)
        setEventModalEditingGameId(options?.editGameId ?? null)
        setEventModalDraft(null)
        setEventModalCoverMessage(null)
        setEventModalCoverBusy(false)
        void refetchEventModal(id)
    }

    const closeEventModal = () => {
        setEventModalId(null)
        setEventModalTab('participants')
        setEventModalLoading(false)
        setEventModalErr(null)
        setEventModalEvent(null)
        setEventModalParticipants([])
        setEventModalGames([])
        setEventModalGamesLoading(false)
        setEventModalEditing(false)
        setEventModalAddingGame(false)
        setEventModalEditingGameId(null)
        setEventModalDraft(null)
        setEventModalCoverBusy(false)
        setEventModalCoverMessage(null)
        setAdmitPromptParticipantId(null)
        setExcludePromptParticipantId(null)
        setParticipantBusy(false)
    }

    const cancelEventGameForm = () => {
        setEventModalAddingGame(false)
        setEventModalEditingGameId(null)
        setEventModalErr(null)
    }

    const openEditEventGame = (gameId: number) => {
        setEventModalEditing(false)
        setEventModalDraft(null)
        setEventModalAddingGame(false)
        setEventModalEditingGameId(gameId)
        setEventModalErr(null)
    }

    const submitAddEventGame = async (draft: EventGameDraft) => {
        if (!eventModalId || participantBusy) return
        if (
            !draft.team1Player1 ||
            !draft.team1Player2 ||
            !draft.team2Player1 ||
            !draft.team2Player2 ||
            draft.team1Score == null ||
            draft.team2Score == null
        ) {
            return
        }
        setParticipantBusy(true)
        setEventModalErr(null)
        try {
            const res = await adminFetch(`/api/admin/events/${encodeURIComponent(eventModalId)}/games`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    team1_player1_id: draft.team1Player1.user_id,
                    team1_player2_id: draft.team1Player2.user_id,
                    team1_score: draft.team1Score,
                    team2_player1_id: draft.team2Player1.user_id,
                    team2_player2_id: draft.team2Player2.user_id,
                    team2_score: draft.team2Score,
                }),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            }
            setEventModalAddingGame(false)
            await refetchEventGames(eventModalId)
            void refetchAdminGamesByEvent()
        } catch (e) {
            setEventModalErr(e instanceof Error ? e.message : 'Не удалось добавить партию')
            throw e
        } finally {
            setParticipantBusy(false)
        }
    }

    const submitEditEventGame = async (draft: EventGameDraft) => {
        if (!eventModalId || participantBusy || eventModalEditingGameId == null) return
        if (
            !draft.team1Player1 ||
            !draft.team1Player2 ||
            !draft.team2Player1 ||
            !draft.team2Player2 ||
            draft.team1Score == null ||
            draft.team2Score == null
        ) {
            return
        }
        setParticipantBusy(true)
        setEventModalErr(null)
        try {
            const res = await adminFetch(
                `/api/admin/events/${encodeURIComponent(eventModalId)}/games/${eventModalEditingGameId}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        team1_player1_id: draft.team1Player1.user_id,
                        team1_player2_id: draft.team1Player2.user_id,
                        team1_score: draft.team1Score,
                        team2_player1_id: draft.team2Player1.user_id,
                        team2_player2_id: draft.team2Player2.user_id,
                        team2_score: draft.team2Score,
                    }),
                }
            )
            const j = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            }
            setEventModalEditingGameId(null)
            await refetchEventGames(eventModalId)
            void refetchAdminGamesByEvent()
        } catch (e) {
            setEventModalErr(e instanceof Error ? e.message : 'Не удалось сохранить партию')
            throw e
        } finally {
            setParticipantBusy(false)
        }
    }

    const requestDeleteEventGame = async () => {
        if (!eventModalId || participantBusy || eventModalEditingGameId == null) return
        setParticipantBusy(true)
        setEventModalErr(null)
        try {
            const res = await adminFetch(
                `/api/admin/events/${encodeURIComponent(eventModalId)}/games/${eventModalEditingGameId}`,
                { method: 'DELETE' }
            )
            const j = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            }
            setEventModalEditingGameId(null)
            await refetchEventGames(eventModalId)
            void refetchAdminGamesByEvent()
        } catch (e) {
            setEventModalErr(e instanceof Error ? e.message : 'Не удалось удалить партию')
        } finally {
            setParticipantBusy(false)
        }
    }

    const admitParticipant = async (participantId: string | number, method: 'cash' | 'free') => {
        if (!eventModalId || participantBusy) return
        setParticipantBusy(true)
        setEventModalErr(null)
        try {
            const res = await adminFetch(
                `/api/admin/events/${encodeURIComponent(eventModalId)}/participants/${encodeURIComponent(String(participantId))}/admit`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ method }),
                }
            )
            const j = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            }
            setAdmitPromptParticipantId(null)
            await refetchEventModal(eventModalId)
        } catch (e) {
            setEventModalErr(e instanceof Error ? e.message : 'Не удалось допустить участника')
        } finally {
            setParticipantBusy(false)
        }
    }

    const excludeParticipant = async (participantId: string | number) => {
        if (!eventModalId || participantBusy) return
        setParticipantBusy(true)
        setEventModalErr(null)
        try {
            const res = await adminFetch(
                `/api/admin/events/${encodeURIComponent(eventModalId)}/participants/${encodeURIComponent(String(participantId))}/exclude`,
                { method: 'POST' }
            )
            const j = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            }
            setExcludePromptParticipantId(null)
            await refetchEventModal(eventModalId)
        } catch (e) {
            setEventModalErr(e instanceof Error ? e.message : 'Не удалось исключить участника')
        } finally {
            setParticipantBusy(false)
        }
    }

    const addEventParticipant = async (userId: number, method: 'cash' | 'free') => {
        if (!eventModalId || participantBusy) return
        setParticipantBusy(true)
        setEventModalErr(null)
        try {
            const res = await adminFetch(
                `/api/admin/events/${encodeURIComponent(eventModalId)}/participants`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, method }),
                }
            )
            const j = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            }
            await refetchEventModal(eventModalId)
            if (session?.app_role) await loadLists(session.app_role)
        } catch (e) {
            setEventModalErr(e instanceof Error ? e.message : 'Не удалось добавить участника')
            throw e
        } finally {
            setParticipantBusy(false)
        }
    }

    const saveEventModal = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!eventModalId || !eventModalDraft) return
        setEventModalErr(null)
        setErr(null)
        const starts_at = startsAtLocalToIso(eventModalDraft.startsAtLocal)
        if (!starts_at) {
            setEventModalErr('Укажите дату и время')
            return
        }
        const priceDigits = onlyDigits(eventModalDraft.priceDigits)
        const maxDigits = onlyDigits(eventModalDraft.maxParticipantsDigits)
        const durDigits = onlyDigits(eventModalDraft.durationMinutesDigits)
        const body: Record<string, unknown> = {
            title: eventModalDraft.title.trim(),
            starts_at,
            address: eventModalDraft.address.trim(),
            status: eventModalDraft.status,
            type: eventModalDraft.type,
            description: eventModalDraft.description.trim() || null,
            club_id: eventModalDraft.clubId.trim(),
        }
        if (priceDigits !== '') {
            const p = Number.parseInt(priceDigits, 10)
            if (!Number.isFinite(p) || p < 0) {
                setEventModalErr('Некорректная стоимость')
                return
            }
            body.price = p
        } else {
            body.price = null
        }
        if (maxDigits !== '') {
            const m = Number.parseInt(maxDigits, 10)
            if (!Number.isFinite(m) || m < 1) {
                setEventModalErr('Максимум участников — целое от 1 или пусто')
                return
            }
            body.players_limit = m
        } else {
            body.players_limit = null
        }
        if (durDigits !== '') {
            const dm = Number.parseInt(durDigits, 10)
            if (!Number.isFinite(dm) || dm < 0) {
                setEventModalErr('Длительность — неотрицательное целое или пусто')
                return
            }
            body.duration_minutes = dm
        } else {
            body.duration_minutes = null
        }

        const res = await adminFetch(`/api/admin/events/${encodeURIComponent(eventModalId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) {
            setEventModalErr(typeof j.error === 'string' ? j.error : res.statusText)
            return
        }
        setEventModalEditing(false)
        setEventModalDraft(null)
        if (j.event) setEventModalEvent(j.event as EventRow)
        await refetchEventModal(eventModalId)
        if (session?.app_role) await loadLists(session.app_role)
    }

    const filteredAdminUsers = useMemo(
        () => adminUsers.filter((u) => adminUserMatchesSearch(u, adminUsersSearch)),
        [adminUsers, adminUsersSearch]
    )

    const filteredAdminPlayers = useMemo(
        () => adminPlayers.filter((p) => adminPlayerMatchesSearch(p, adminPlayersSearch)),
        [adminPlayers, adminPlayersSearch]
    )

    const eventModalActiveParticipantUserIds = useMemo(
        () => eventModalParticipants.map((p) => p.user_id),
        [eventModalParticipants]
    )

    const pageSection: React.CSSProperties = {
        padding: '0 12px 16px',
    }

    const errorBanner: React.CSSProperties = {
        margin: '0 12px 14px',
        padding: '12px 14px',
        backgroundColor: '#FFEBEE',
        color: '#B71C1C',
        border: '1px solid #FFCDD2',
        borderRadius: '8px',
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

    const fieldLabel: CSSProperties = { fontSize: '13px', fontWeight: 600, color: '#1D1D1B', marginBottom: '4px' }
    const chipStyle = (active: boolean): CSSProperties => ({
        padding: '6px 11px',
        fontSize: '12px',
        borderRadius: '999px',
        border: active ? '2px solid #1B5E20' : '1px solid #EBE8E0',
        backgroundColor: active ? '#E8F5E9' : '#FFFFFF',
        color: '#1D1D1B',
        cursor: 'pointer',
        fontWeight: active ? 600 : 500,
    })

    const navBtn = (tab: AdminNavTab, icon: ReactNode, label: string) => (
        <button
            key={tab}
            type="button"
            onClick={() => {
                setNavTab(tab)
                if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                }
            }}
            style={{
                flex: 1,
                fontWeight: navTab === tab ? 'bold' : 'normal',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px',
                border: 'none',
                borderBottom: navTab === tab ? '3px solid #FFDF00' : '3px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                color: navTab === tab ? '#1D1D1B' : '#6B6B69',
            }}
        >
            <div style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
            </div>
            <span style={{ fontSize: '10px' }}>{label}</span>
        </button>
    )

    const eventModalTabBtn = (tab: EventModalTab, label: string) => (
        <button
            key={tab}
            type="button"
            onClick={() => setEventModalTab(tab)}
            style={{
                flex: 1,
                padding: '10px 8px',
                border: 'none',
                borderBottom: eventModalTab === tab ? '3px solid #FFDF00' : '3px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                fontWeight: eventModalTab === tab ? 700 : 500,
                fontSize: '14px',
                color: eventModalTab === tab ? '#1D1D1B' : '#6B6B69',
            }}
        >
            {label}
        </button>
    )

    const eventModalHeaderTitle =
        eventModalEditing && eventModalDraft
            ? eventModalDraft.title.trim() || 'Событие'
            : eventModalEvent?.title?.trim() || 'Событие'
    const eventModalHeaderDateTime =
        eventModalEditing && eventModalDraft
            ? eventModalDraft.startsAtLocal
                ? formatEventModalDateTime(startsAtLocalToIso(eventModalDraft.startsAtLocal) ?? '')
                : null
            : eventModalEvent
              ? formatEventModalDateTime(eventModalEvent.starts_at)
              : null

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#FFFFFF' }}>
            <header
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1001,
                    backgroundColor: '#FFFFFF',
                    borderBottom: '1px solid #EBE8E0',
                    boxShadow: '0 2px 12px rgba(29,29,27,0.06)',
                }}
            >
                <div
                    style={{
                        maxWidth: 'var(--app-max-width, 850px)',
                        width: '100%',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        padding: 'calc(10px + env(safe-area-inset-top, 0px)) 12px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        minHeight: '44px',
                    }}
                >
                    <Link
                        href="/"
                        style={{
                            color: '#1B5E20',
                            fontWeight: 600,
                            fontSize: '15px',
                            textDecoration: 'none',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        ← На главную
                    </Link>
                    <div
                        style={{
                            flex: 1,
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: '17px',
                            color: '#1D1D1B',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Админка
                    </div>
                    <span
                        style={{
                            fontSize: '11px',
                            color: '#6B6B69',
                            fontWeight: 600,
                            flexShrink: 0,
                            textTransform: 'uppercase',
                        }}
                    >
                        {role === 'root' ? 'root' : 'admin'}
                    </span>
                </div>
            </header>

            <main
                id="admin-main-scroll"
                style={{
                    paddingTop: ADMIN_SCROLL_PT,
                    paddingBottom: ADMIN_SCROLL_PB,
                    width: '100%',
                    maxWidth: 'var(--app-max-width, 850px)',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                }}
            >
            {err && <div style={errorBanner}>{err}</div>}

            {navTab === 'admins' && isRoot && (
                <section style={pageSection}>
                    <h2 style={{ margin: '0 0 12px', fontSize: '17px' }}>Администраторы</h2>
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6B6B69' }}>
                        Только root может выдавать и снимать роль admin (не root через API).
                    </p>
                    <div style={{ marginBottom: '14px' }}>
                        <div style={fieldLabel}>Поиск</div>
                        <input
                            type="search"
                            value={adminUsersSearch}
                            onChange={(e) => setAdminUsersSearch(e.target.value)}
                            placeholder="Имя, фамилия, @username, ник в клубе, id или Telegram id…"
                            autoComplete="off"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #EBE8E0',
                                boxSizing: 'border-box',
                                fontSize: '15px',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {filteredAdminUsers.length === 0 ? (
                            <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>
                                {adminUsers.length === 0
                                    ? 'Список пользователей пуст.'
                                    : 'Никого не найдено — попробуйте другой запрос.'}
                            </p>
                        ) : (
                            filteredAdminUsers.map((u) => (
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
                                        id {u.id} · tg {u.telegram_id} · @{u.username || '—'}
                                        {u.nickname?.trim() ? ` · ник: ${u.nickname}` : ''} · <strong>{u.app_role}</strong>
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
                            ))
                        )}
                    </div>
                </section>
            )}

            {navTab === 'events' && (
            <section style={pageSection}>
                <h2 style={{ margin: '0 0 12px', fontSize: '17px' }}>События</h2>
                <button
                    type="button"
                    onClick={() => {
                        setShowNewEventForm((prev) => {
                            const next = !prev
                            if (next) setNewEventSuccess(null)
                            return next
                        })
                    }}
                    style={{
                        width: '100%',
                        marginBottom: newEventSuccess && !showNewEventForm ? '10px' : showNewEventForm ? '14px' : '16px',
                        padding: '12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#FFDF00',
                        color: '#1D1D1B',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '15px',
                    }}
                >
                    {showNewEventForm ? 'Скрыть форму' : 'Добавить событие'}
                </button>
                {newEventSuccess && !showNewEventForm ? (
                    <div
                        role="status"
                        style={{
                            margin: '0 0 16px',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            backgroundColor: '#E8F5E9',
                            border: '1px solid #A5D6A7',
                            color: '#1B5E20',
                            fontWeight: 600,
                            fontSize: '14px',
                        }}
                    >
                        {newEventSuccess}
                    </div>
                ) : null}
                {showNewEventForm ? (
                <form onSubmit={submitNewEvent} style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '16px' }}>Новое событие</div>

                    <div>
                        <div style={fieldLabel}>Клуб</div>
                        <select
                            value={newEvent.clubId}
                            onChange={(e) => setNewEvent((p) => ({ ...p, clubId: e.target.value }))}
                            required
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #EBE8E0',
                                boxSizing: 'border-box',
                                fontSize: '15px',
                            }}
                        >
                            <option value="">Выберите клуб…</option>
                            {adminClubs.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                        {adminClubs.length === 0 ? (
                            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#B71C1C' }}>
                                Список клубов не загрузился. Обновите страницу или проверьте таблицу <code>clubtac_clubs</code>.
                            </p>
                        ) : null}
                    </div>

                    <div>
                        <div style={fieldLabel}>Название</div>
                        <input
                            value={newEvent.title}
                            onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))}
                            required
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #EBE8E0',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div>
                        <div style={fieldLabel}>Дата и время</div>
                        <input
                            type="datetime-local"
                            value={newEvent.startsAtLocal}
                            onChange={(e) => setNewEvent((p) => ({ ...p, startsAtLocal: e.target.value }))}
                            required
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #EBE8E0',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div>
                        <div style={fieldLabel}>Адрес</div>
                        <input
                            value={newEvent.address}
                            onChange={(e) => setNewEvent((p) => ({ ...p, address: e.target.value }))}
                            required
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #EBE8E0',
                                boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                            {ADMIN_EVENT_ADDRESS_PRESETS.map((preset) => (
                                <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => setNewEvent((p) => ({ ...p, address: preset.value }))}
                                    style={chipStyle(newEvent.address === preset.value)}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={fieldLabel}>Стоимость участия, ₽</div>
                        <input
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="Например 1500"
                            value={newEvent.priceDigits}
                            onChange={(e) => setNewEvent((p) => ({ ...p, priceDigits: onlyDigits(e.target.value) }))}
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #EBE8E0',
                                boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                            {ADMIN_EVENT_PRICE_PRESETS.map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setNewEvent((p) => ({ ...p, priceDigits: String(n) }))}
                                    style={chipStyle(newEvent.priceDigits === String(n))}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={fieldLabel}>Максимальное количество участников</div>
                        <input
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="Необязательно"
                            value={newEvent.maxParticipantsDigits}
                            onChange={(e) =>
                                setNewEvent((p) => ({ ...p, maxParticipantsDigits: onlyDigits(e.target.value) }))
                            }
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #EBE8E0',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div>
                        <div style={fieldLabel}>Описание</div>
                        <textarea
                            value={newEvent.description}
                            onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
                            rows={4}
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #EBE8E0',
                                boxSizing: 'border-box',
                                minHeight: '88px',
                                resize: 'vertical',
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={creatingEvent}
                        style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: creatingEvent ? '#A5D6A7' : '#1B5E20',
                            color: '#fff',
                            fontWeight: 600,
                            cursor: creatingEvent ? 'not-allowed' : 'pointer',
                            fontSize: '15px',
                        }}
                    >
                        {creatingEvent ? 'Создание…' : 'Создать событие'}
                    </button>
                </form>
                ) : null}

                <div style={{ fontWeight: 600, marginBottom: '10px' }}>Список</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {events.map((ev) => (
                        <button
                            key={ev.id}
                            type="button"
                            onClick={() => openEventModal(ev.id)}
                            style={{
                                textAlign: 'left',
                                padding: 0,
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                width: '100%',
                            }}
                        >
                            <div
                                style={{
                                    overflow: 'hidden',
                                    borderRadius: '8px',
                                    backgroundColor: '#FFFFFF',
                                    boxShadow: '0px 3px 4.5px rgba(0, 0, 0, 0.12)',
                                    borderTop:
                                        ev.status === 'cancelled' || ev.status === 'canceled'
                                            ? '2px solid #B71C1C'
                                            : ev.status === 'hidden'
                                              ? '2px dashed #9E9E9E'
                                              : 'none',
                                }}
                            >
                                {ev.cover?.trim() ? (
                                    <div
                                        style={{
                                            width: '100%',
                                            aspectRatio: '2 / 1',
                                            maxHeight: 220,
                                            backgroundColor: '#EBE8E0',
                                        }}
                                    >
                                        <img
                                            src={ev.cover.trim()}
                                            alt={ev.title ? `Обложка: ${ev.title}` : 'Обложка'}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                display: 'block',
                                            }}
                                        />
                                    </div>
                                ) : null}
                                <div style={{ padding: '12px' }}>
                                    <div
                                        style={{
                                            fontSize: '16px',
                                            fontWeight: 700,
                                            color: '#1D1D1B',
                                            marginBottom: '8px',
                                            lineHeight: 1.3,
                                        }}
                                    >
                                        {ev.title}
                                    </div>
                                    <AdminAddressLine address={ev.address} style={{ marginBottom: '6px' }} />
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1D1D1B', marginBottom: '4px' }}>
                                        {formatEventCardDayMonthAndTime(ev.starts_at)}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#6B6B69', lineHeight: 1.4 }}>
                                        Записались: {ev.participants_registered ?? 0} · Оплатили: {ev.participants_paid ?? 0}
                                    </div>
                                    {(ev.status === 'cancelled' || ev.status === 'canceled') && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#B71C1C', fontWeight: 600 }}>
                                            Отменено
                                        </div>
                                    )}
                                    {ev.status === 'hidden' && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#616161', fontWeight: 600 }}>
                                            Скрыто (не в общем списке приложения)
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </section>
            )}

            {navTab === 'players' && (
                <section style={pageSection}>
                    <h2 style={{ margin: '0 0 12px', fontSize: '17px' }}>Игроки</h2>
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6B6B69' }}>
                        Все зарегистрированные пользователи с активным аккаунтом. Рейтинг и число игр — если есть в
                        таблице Elo.
                    </p>
                    <div style={{ marginBottom: '14px' }}>
                        <div style={fieldLabel}>Поиск</div>
                        <input
                            type="search"
                            value={adminPlayersSearch}
                            onChange={(e) => setAdminPlayersSearch(e.target.value)}
                            placeholder="Ник, имя, @username, id или tg id…"
                            autoComplete="off"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #EBE8E0',
                                boxSizing: 'border-box',
                                fontSize: '15px',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredAdminPlayers.length === 0 ? (
                            <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>
                                {adminPlayers.length === 0
                                    ? 'Список игроков пуст.'
                                    : 'Никого не найдено — попробуйте другой запрос.'}
                            </p>
                        ) : (
                            filteredAdminPlayers.map((p) => {
                                const rating =
                                    p.rating != null && Number.isFinite(Number(p.rating))
                                        ? Math.round(Number(p.rating))
                                        : null
                                const games =
                                    p.games_played ?? (p as { games?: number }).games ?? null
                                const displayName = adminPlayerDisplayName(p)
                                const avatarUrl =
                                    !p.takoff && p.userpic?.trim() ? p.userpic.trim() : null
                                const statusUser: Record<string, unknown> = {
                                    app_role: p.app_role,
                                    status: p.status,
                                }
                                return (
                                    <button
                                        key={p.user_id}
                                        type="button"
                                        onClick={() => {
                                            setPlayerModalPreviewName(displayName)
                                            setPlayerModalUserId(p.user_id)
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            width: '100%',
                                            border: 'none',
                                            borderBottom: '1px solid #EBE8E0',
                                            padding: '8px 4px',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            borderRadius: '8px',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#FFFEF7'
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent'
                                        }}
                                    >
                                            <div
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '50%',
                                                    overflow: 'hidden',
                                                    backgroundColor: '#FFDF00',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 700,
                                                    fontSize: '14px',
                                                    color: '#1D1D1B',
                                                }}
                                            >
                                                {avatarUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={avatarUrl}
                                                        alt=""
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover',
                                                            display: 'block',
                                                        }}
                                                    />
                                                ) : (
                                                    displayName.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    flexWrap: 'wrap',
                                                    marginBottom: '4px',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontWeight: 600,
                                                        color: '#1D1D1B',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        minWidth: 0,
                                                        flex: '1 1 auto',
                                                    }}
                                                >
                                                    {displayName}
                                                </div>
                                                <AdminPlayerStatusChips
                                                    user={statusUser}
                                                    hideStandardClubStatus
                                                    compact
                                                />
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#6B6B69' }}>
                                                id {p.user_id}
                                                {p.username && !p.takoff ? ` · @${p.username}` : ''}
                                                {rating != null ? ` · ⭐ ${rating}` : ''}
                                                {games != null && Number(games) > 0
                                                    ? ` · ${games} игр`
                                                    : ''}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>
                </section>
            )}

            {navTab === 'games' && (
            <section style={pageSection}>
                <h2 style={{ margin: '0 0 6px', fontSize: '17px' }}>Партии</h2>
                <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6B6B69', lineHeight: 1.45 }}>
                    Добавление и редактирование партий — на странице события, вкладка «Партии».
                </p>
                {gamesByEvent.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>Партий пока нет.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {gamesByEvent.map((group) => (
                            <div key={group.event_id}>
                                <button
                                    type="button"
                                    onClick={() => openEventModal(group.event_id, { tab: 'games' })}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        margin: '0 0 8px',
                                        padding: 0,
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: '15px',
                                            fontWeight: 700,
                                            color: '#1D1D1B',
                                            lineHeight: 1.35,
                                        }}
                                    >
                                        {group.event_title?.trim() || `Событие ${group.event_id}`}
                                    </div>
                                    {group.starts_at ? (
                                        <div style={{ fontSize: '12px', color: '#6B6B69', marginTop: '2px' }}>
                                            {formatEventCardDayMonthAndTime(group.starts_at)}
                                        </div>
                                    ) : null}
                                </button>
                                <div
                                    style={{
                                        border: '1px solid #EBE8E0',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        backgroundColor: '#FFFFFF',
                                    }}
                                >
                                    {group.games.map((game, index) => (
                                        <AdminEventGameRow
                                            key={game.game_id}
                                            game={game}
                                            showDividerTop={index > 0}
                                            onClick={() =>
                                                openEventModal(group.event_id, {
                                                    tab: 'games',
                                                    editGameId: game.game_id,
                                                })
                                            }
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
            )}
            </main>
            <nav
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: '#FFFFFF',
                    borderTop: '1px solid #EBE8E0',
                    boxShadow: '0 -2px 12px rgba(29,29,27,0.06)',
                    zIndex: 1000,
                    paddingTop: '8px',
                }}
            >
                <div
                    style={{
                        maxWidth: 'var(--app-max-width, 850px)',
                        width: '100%',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        display: 'flex',
                        gap: 0,
                        minWidth: 0,
                        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
                    }}
                >
                    {navBtn('events', <EventsTabIcon active={navTab === 'events'} size={24} />, 'События')}
                    {navBtn('games', <GamesTabIcon active={navTab === 'games'} size={24} />, 'Партии')}
                    {navBtn('players', <PlayersTabIcon active={navTab === 'players'} size={24} />, 'Игроки')}
                    {isRoot ? navBtn('admins', <AccessTabIcon active={navTab === 'admins'} size={24} />, 'Доступ') : null}
                </div>
            </nav>

            {eventModalId && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Карточка события"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1200,
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: '#FFFFFF',
                        paddingTop: 'env(safe-area-inset-top, 0px)',
                        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: 0,
                            width: '100%',
                            maxWidth: 'var(--app-max-width, 850px)',
                            marginLeft: 'auto',
                            marginRight: 'auto',
                            backgroundColor: '#FFFFFF',
                        }}
                    >
                        <div
                            style={{
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: '10px',
                                padding: '12px 14px',
                                borderBottom: '1px solid #EBE8E0',
                                backgroundColor: '#FFFFFF',
                            }}
                        >
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontWeight: 700,
                                        fontSize: '17px',
                                        color: '#1D1D1B',
                                        lineHeight: 1.25,
                                        marginBottom: eventModalHeaderDateTime ? '4px' : 0,
                                    }}
                                >
                                    {eventModalHeaderTitle}
                                </div>
                                {eventModalHeaderDateTime ? (
                                    <div style={{ fontSize: '14px', color: '#6B6B69', fontWeight: 500 }}>
                                        {eventModalHeaderDateTime}
                                    </div>
                                ) : eventModalLoading ? (
                                    <div style={{ fontSize: '14px', color: '#6B6B69' }}>Загрузка…</div>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                onClick={closeEventModal}
                                style={{
                                    border: 'none',
                                    background: '#F5F5F5',
                                    borderRadius: '8px',
                                    width: '36px',
                                    height: '36px',
                                    cursor: 'pointer',
                                    fontSize: '20px',
                                    lineHeight: 1,
                                    flexShrink: 0,
                                }}
                                aria-label="Закрыть"
                            >
                                ×
                            </button>
                        </div>

                        {eventModalEvent && !eventModalEditing && !eventModalAddingGame && eventModalEditingGameId == null ? (
                            <div
                                style={{
                                    flexShrink: 0,
                                    display: 'flex',
                                    borderBottom: '1px solid #EBE8E0',
                                    backgroundColor: '#FFFFFF',
                                }}
                            >
                                {eventModalTabBtn(
                                    'participants',
                                    `Участники (${eventModalParticipants.length})`
                                )}
                                {eventModalTabBtn('games', 'Партии')}
                                {eventModalTabBtn('details', 'Детали')}
                            </div>
                        ) : null}

                        <div
                            style={{
                                flex: 1,
                                minHeight: 0,
                                overflowY: 'auto',
                                WebkitOverflowScrolling: 'touch',
                            }}
                        >
                        <div style={{ padding: '14px 16px 20px' }}>
                            {eventModalLoading && !eventModalEvent ? (
                                <p style={{ margin: 0 }}>Загрузка…</p>
                            ) : eventModalErr && !eventModalEvent ? (
                                <div>
                                    <p style={{ margin: '0 0 12px', color: '#B71C1C' }}>{eventModalErr}</p>
                                    <button
                                        type="button"
                                        onClick={() => void refetchEventModal(eventModalId)}
                                        style={{
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            border: '1px solid #1D1D1B',
                                            background: '#fff',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                        }}
                                    >
                                        Повторить
                                    </button>
                                </div>
                            ) : eventModalEvent ? (
                                <>
                                    {eventModalErr ? (
                                        <p style={{ margin: '0 0 12px', color: '#B71C1C', fontSize: '13px' }}>{eventModalErr}</p>
                                    ) : null}

                                    {eventModalAddingGame ? (
                                        <EventGameForm
                                            mode="add"
                                            players={adminPlayers}
                                            onCancel={cancelEventGameForm}
                                            onSubmit={submitAddEventGame}
                                        />
                                    ) : eventModalEditingGameId != null ? (
                                        (() => {
                                            const editingGame = eventModalGames.find(
                                                (g) => g.game_id === eventModalEditingGameId
                                            )
                                            if (!editingGame) {
                                                return (
                                                    <p style={{ margin: 0, color: '#B71C1C', fontSize: '14px' }}>
                                                        Партия не найдена.
                                                    </p>
                                                )
                                            }
                                            return (
                                                <EventGameForm
                                                    mode="edit"
                                                    gameId={editingGame.game_id}
                                                    initialDraft={eventGameSummaryToDraft(
                                                        editingGame,
                                                        adminPlayers
                                                    )}
                                                    players={adminPlayers}
                                                    onCancel={cancelEventGameForm}
                                                    onSubmit={submitEditEventGame}
                                                    onDeleteConfirm={requestDeleteEventGame}
                                                />
                                            )
                                        })()
                                    ) : eventModalEditing && eventModalDraft ? (
                                        <form onSubmit={saveEventModal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#6B6B69' }}>
                                                Редактирование события
                                            </p>
                                            <div>
                                                <div style={fieldLabel}>Название</div>
                                                <input
                                                    value={eventModalDraft.title}
                                                    onChange={(e) => setEventModalDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #EBE8E0',
                                                        boxSizing: 'border-box',
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <div style={fieldLabel}>Дата и время</div>
                                                <input
                                                    type="datetime-local"
                                                    value={eventModalDraft.startsAtLocal}
                                                    onChange={(e) =>
                                                        setEventModalDraft((d) => (d ? { ...d, startsAtLocal: e.target.value } : d))
                                                    }
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #EBE8E0',
                                                        boxSizing: 'border-box',
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <div style={fieldLabel}>Адрес</div>
                                                <input
                                                    value={eventModalDraft.address}
                                                    onChange={(e) =>
                                                        setEventModalDraft((d) => (d ? { ...d, address: e.target.value } : d))
                                                    }
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #EBE8E0',
                                                        boxSizing: 'border-box',
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <div style={fieldLabel}>Стоимость, ₽ (пусто = бесплатно)</div>
                                                <input
                                                    inputMode="numeric"
                                                    value={eventModalDraft.priceDigits}
                                                    onChange={(e) =>
                                                        setEventModalDraft((d) =>
                                                            d ? { ...d, priceDigits: onlyDigits(e.target.value) } : d
                                                        )
                                                    }
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #EBE8E0',
                                                        boxSizing: 'border-box',
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <div style={fieldLabel}>Макс. участников (пусто = без лимита)</div>
                                                <input
                                                    inputMode="numeric"
                                                    value={eventModalDraft.maxParticipantsDigits}
                                                    onChange={(e) =>
                                                        setEventModalDraft((d) =>
                                                            d ? { ...d, maxParticipantsDigits: onlyDigits(e.target.value) } : d
                                                        )
                                                    }
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #EBE8E0',
                                                        boxSizing: 'border-box',
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <div style={fieldLabel}>Тип</div>
                                                <select
                                                    value={eventModalDraft.type}
                                                    onChange={(e) =>
                                                        setEventModalDraft((d) => (d ? { ...d, type: e.target.value } : d))
                                                    }
                                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #EBE8E0' }}
                                                >
                                                    <option value="game">Игра</option>
                                                    <option value="workshop">Мастер-класс</option>
                                                    <option value="party">Вечеринка</option>
                                                </select>
                                            </div>
                                            <div>
                                                <div style={fieldLabel}>Статус</div>
                                                <select
                                                    value={eventModalDraft.status}
                                                    onChange={(e) =>
                                                        setEventModalDraft((d) => (d ? { ...d, status: e.target.value } : d))
                                                    }
                                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #EBE8E0' }}
                                                >
                                                    <option value="scheduled">Запланировано (scheduled)</option>
                                                    <option value="finished">Завершено (finished)</option>
                                                    <option value="cancelled">Отменено (cancelled)</option>
                                                    <option value="hidden">Скрыто — только в админке (hidden)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <div style={fieldLabel}>Длительность, мин. (пусто = не задано)</div>
                                                <input
                                                    inputMode="numeric"
                                                    value={eventModalDraft.durationMinutesDigits}
                                                    onChange={(e) =>
                                                        setEventModalDraft((d) =>
                                                            d ? { ...d, durationMinutesDigits: onlyDigits(e.target.value) } : d
                                                        )
                                                    }
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #EBE8E0',
                                                        boxSizing: 'border-box',
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <div style={fieldLabel}>Клуб</div>
                                                <select
                                                    value={eventModalDraft.clubId}
                                                    onChange={(e) =>
                                                        setEventModalDraft((d) => (d ? { ...d, clubId: e.target.value } : d))
                                                    }
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #EBE8E0',
                                                        boxSizing: 'border-box',
                                                    }}
                                                >
                                                    {!adminClubs.some((c) => c.id === eventModalDraft.clubId) &&
                                                    eventModalDraft.clubId ? (
                                                        <option value={eventModalDraft.clubId}>
                                                            {eventModalDraft.clubId} (не в списке)
                                                        </option>
                                                    ) : null}
                                                    {adminClubs.map((c) => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <div style={fieldLabel}>Обложка</div>
                                                {eventModalEvent.cover?.trim() ? (
                                                    <div
                                                        style={{
                                                            width: '100%',
                                                            maxWidth: '100%',
                                                            aspectRatio: '2 / 1',
                                                            maxHeight: 200,
                                                            borderRadius: '8px',
                                                            overflow: 'hidden',
                                                            backgroundColor: '#EBE8E0',
                                                            marginBottom: '10px',
                                                        }}
                                                    >
                                                        <img
                                                            src={eventModalEvent.cover.trim()}
                                                            alt=""
                                                            style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: 'cover',
                                                                display: 'block',
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <p
                                                        style={{
                                                            margin: '0 0 10px',
                                                            fontSize: '13px',
                                                            color: '#6B6B69',
                                                            lineHeight: 1.45,
                                                        }}
                                                    >
                                                        Обложки пока нет. Нажмите «Изменить обложку», чтобы снова отправить данные
                                                        события в генератор (Make).
                                                    </p>
                                                )}
                                                <button
                                                    type="button"
                                                    disabled={eventModalCoverBusy}
                                                    onClick={() => void requestEventCoverWebhook()}
                                                    style={{
                                                        padding: '10px 14px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #1B5E20',
                                                        backgroundColor: '#fff',
                                                        color: '#1B5E20',
                                                        fontWeight: 600,
                                                        cursor: eventModalCoverBusy ? 'not-allowed' : 'pointer',
                                                        fontSize: '14px',
                                                    }}
                                                >
                                                    {eventModalCoverBusy ? 'Отправка…' : 'Изменить обложку'}
                                                </button>
                                                {eventModalCoverMessage ? (
                                                    <p
                                                        style={{
                                                            margin: '10px 0 0',
                                                            fontSize: '13px',
                                                            color: eventModalCoverMessage.includes('отправлен')
                                                                ? '#2E7D32'
                                                                : '#B71C1C',
                                                            lineHeight: 1.45,
                                                        }}
                                                    >
                                                        {eventModalCoverMessage}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div>
                                                <div style={fieldLabel}>Описание</div>
                                                <textarea
                                                    value={eventModalDraft.description}
                                                    onChange={(e) =>
                                                        setEventModalDraft((d) => (d ? { ...d, description: e.target.value } : d))
                                                    }
                                                    rows={5}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #EBE8E0',
                                                        boxSizing: 'border-box',
                                                        minHeight: '100px',
                                                        resize: 'vertical',
                                                    }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
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
                                                    Сохранить
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEventModalEditing(false)
                                                        setEventModalDraft(null)
                                                        setEventModalErr(null)
                                                        setEventModalCoverMessage(null)
                                                    }}
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
                                    ) : (
                                        <>
                                            {eventModalTab === 'participants' ? (
                                                <>
                                                    <EventAddParticipantPicker
                                                        key={eventModalId ?? 'event'}
                                                        players={adminPlayers}
                                                        activeParticipantUserIds={eventModalActiveParticipantUserIds}
                                                        eventPrice={eventModalEvent?.price ?? null}
                                                        busy={participantBusy}
                                                        onAdd={addEventParticipant}
                                                    />
                                                    {eventModalParticipants.length === 0 ? (
                                                        <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>
                                                            Пока никто не записан.
                                                        </p>
                                                    ) : (
                                                        <ul
                                                            style={{
                                                                margin: 0,
                                                                padding: 0,
                                                                listStyle: 'none',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '8px',
                                                            }}
                                                        >
                                                            {eventModalParticipants.map((p) => (
                                                                <EventParticipantAdminCard
                                                                    key={p.id}
                                                                    participant={{
                                                                        ...p,
                                                                        userpic: p.userpic ?? null,
                                                                        takoff: p.takoff ?? false,
                                                                    }}
                                                                    participantBusy={participantBusy}
                                                                    isPending={p.payment_status === 'pending'}
                                                                    showAdmitPrompt={admitPromptParticipantId === p.id}
                                                                    showExcludePrompt={excludePromptParticipantId === p.id}
                                                                    refundAmount={participantRefundAmount(p.price_paid)}
                                                                    onExcludeClick={() => {
                                                                        setAdmitPromptParticipantId(null)
                                                                        setExcludePromptParticipantId(p.id)
                                                                    }}
                                                                    onAdmitClick={() => {
                                                                        setExcludePromptParticipantId(null)
                                                                        setAdmitPromptParticipantId(p.id)
                                                                    }}
                                                                    onCancelAdmit={() => setAdmitPromptParticipantId(null)}
                                                                    onCancelExclude={() => setExcludePromptParticipantId(null)}
                                                                    onConfirmExclude={() => void excludeParticipant(p.id)}
                                                                    onAdmitCash={() => void admitParticipant(p.id, 'cash')}
                                                                    onAdmitFree={() => void admitParticipant(p.id, 'free')}
                                                                />
                                                            ))}
                                                        </ul>
                                                    )}
                                                </>
                                            ) : null}

                                            {eventModalTab === 'games' ? (
                                                <>
                                                    <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#6B6B69', lineHeight: 1.45 }}>
                                                        Партии, сыгранные участниками на этом событии.
                                                    </p>
                                                    {eventModalGamesLoading ? (
                                                        <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#6B6B69' }}>
                                                            Загрузка партий…
                                                        </p>
                                                    ) : null}
                                                    {!eventModalGamesLoading && eventModalGames.length > 0 ? (
                                                        <div
                                                            style={{
                                                                marginBottom: '14px',
                                                                border: '1px solid #EBE8E0',
                                                                borderRadius: '8px',
                                                                overflow: 'hidden',
                                                                backgroundColor: '#FFFFFF',
                                                            }}
                                                        >
                                                            {eventModalGames.map((game, index) => (
                                                                <AdminEventGameRow
                                                                    key={game.game_id}
                                                                    game={game}
                                                                    showDividerTop={index > 0}
                                                                    onClick={() => openEditEventGame(game.game_id)}
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                    {!eventModalGamesLoading && eventModalGames.length === 0 ? (
                                                        <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#6B6B69' }}>
                                                            Партий пока нет.
                                                        </p>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEventModalEditing(false)
                                                            setEventModalDraft(null)
                                                            setEventModalEditingGameId(null)
                                                            setEventModalAddingGame(true)
                                                            setEventModalErr(null)
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            backgroundColor: '#FFDF00',
                                                            color: '#1D1D1B',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            fontSize: '15px',
                                                        }}
                                                    >
                                                        Добавить партию
                                                    </button>
                                                </>
                                            ) : null}

                                            {eventModalTab === 'details' ? (
                                                <>
                                            {eventModalEvent.cover?.trim() ? (
                                                <div
                                                    style={{
                                                        width: '100%',
                                                        aspectRatio: '2 / 1',
                                                        maxHeight: 220,
                                                        borderRadius: '8px',
                                                        overflow: 'hidden',
                                                        backgroundColor: '#EBE8E0',
                                                        marginBottom: '14px',
                                                    }}
                                                >
                                                    <img
                                                        src={eventModalEvent.cover.trim()}
                                                        alt=""
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    style={{
                                                        marginBottom: '14px',
                                                        padding: '14px 16px',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#F5F5F5',
                                                        border: '1px dashed #C4C4C2',
                                                        fontSize: '14px',
                                                        color: '#6B6B69',
                                                        lineHeight: 1.45,
                                                    }}
                                                >
                                                    Обложки пока нет (например, Make ещё не успел сгенерировать). В режиме
                                                    «Редактировать» можно отправить запрос на генерацию ещё раз.
                                                </div>
                                            )}

                                            <AdminAddressLine address={eventModalEvent.address} style={{ marginBottom: '8px' }} />
                                            {eventModalEvent.duration_minutes != null ? (
                                                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6B6B69', lineHeight: 1.45 }}>
                                                    ⏱ {eventModalEvent.duration_minutes} мин
                                                </p>
                                            ) : null}
                                            <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#6B6B69', lineHeight: 1.45 }}>
                                                {eventModalEvent.price != null && eventModalEvent.price > 0
                                                    ? `💰 ${eventModalEvent.price} ₽`
                                                    : '💰 Бесплатно'}
                                            </p>

                                            <div style={{ margin: '0 0 20px' }}>
                                                <div style={{ fontSize: '12px', color: '#6B6B69', marginBottom: '4px' }}>Описание</div>
                                                <div
                                                    style={{
                                                        fontSize: '14px',
                                                        lineHeight: 1.5,
                                                        whiteSpace: 'pre-wrap',
                                                        color: '#1D1D1B',
                                                    }}
                                                >
                                                    {eventModalEvent.description?.trim() ? eventModalEvent.description : '—'}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#6B6B69', marginBottom: '2px' }}>Тип</div>
                                                    <div style={{ fontSize: '13px' }}>
                                                        {getEventTypeNameRu(eventModalEvent.type)} ({eventModalEvent.type})
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#6B6B69', marginBottom: '2px' }}>Статус</div>
                                                    <div style={{ fontSize: '13px' }}>
                                                        {eventStatusLabelRu(eventModalEvent.status)}{' '}
                                                        <span style={{ color: '#6B6B69' }}>({eventModalEvent.status})</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#6B6B69', marginBottom: '2px' }}>
                                                        Макс. участников
                                                    </div>
                                                    <div style={{ fontSize: '13px' }}>
                                                        {eventModalEvent.players_limit != null
                                                            ? String(eventModalEvent.players_limit)
                                                            : '—'}
                                                    </div>
                                                </div>
                                            </div>

                                            <p
                                                style={{
                                                    margin: '0 0 14px',
                                                    fontSize: '14px',
                                                    color: '#6B6B69',
                                                    lineHeight: 1.45,
                                                }}
                                            >
                                                🏢 {adminClubs.find((c) => c.id === eventModalEvent.club_id)?.name ?? '—'}
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEventModalTab('details')
                                                    setEventModalAddingGame(false)
                                                    setEventModalEditingGameId(null)
                                                    setEventModalEditing(true)
                                                    setEventModalDraft(eventToModalDraft(eventModalEvent))
                                                    setEventModalErr(null)
                                                    setEventModalCoverMessage(null)
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    backgroundColor: '#FFDF00',
                                                    color: '#1D1D1B',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    fontSize: '15px',
                                                }}
                                            >
                                                Редактировать
                                            </button>
                                                </>
                                            ) : null}
                                        </>
                                    )}
                                </>
                            ) : null}
                        </div>
                        </div>
                    </div>
                </div>
            )}

            <AdminPlayerModal
                userId={playerModalUserId}
                previewName={playerModalPreviewName}
                onPlayerStatusChange={(id, status) => {
                    setAdminPlayers((prev) =>
                        prev.map((p) => (p.user_id === id ? { ...p, status } : p))
                    )
                }}
                onClose={() => {
                    setPlayerModalUserId(null)
                    setPlayerModalPreviewName('')
                }}
            />
        </div>
    )
}
