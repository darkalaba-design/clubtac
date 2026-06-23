'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatGamesRu } from '@/lib/ruCountPhrases'
import { useUser } from '../contexts/UserContext'
import { useSoloLeaderMedalPrefix } from '../contexts/SoloLeaderRanksContext'
import GeoIcon from './GeoIcon'
import ClubIcon from './ClubIcon'
import ExpandChevronIcon from './ExpandChevronIcon'

function EventAddressLine({ address }: { address: string }) {
    return (
        <div
            style={{
                fontSize: '14px',
                color: '#6B6B69',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
            }}
        >
            <GeoIcon size={16} style={{ marginTop: '2px' }} />
            <span>{address}</span>
        </div>
    )
}

function EventClubLine({
    clubId,
    clubNames,
    style,
}: {
    clubId: string
    clubNames: Record<string, string>
    style?: React.CSSProperties
}) {
    const label = clubNames[clubId] ? `Клуб: ${clubNames[clubId]}` : `Клуб ID: ${clubId}`
    return (
        <div
            style={{
                fontSize: '14px',
                color: '#6B6B69',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                ...style,
            }}
        >
            <ClubIcon size={16} style={{ marginTop: '2px' }} />
            <span>{label}</span>
        </div>
    )
}

interface Game {
    game_id: number
    created_at: string
    player_1_1: string
    player_1_2: string
    player_2_1: string
    player_2_2: string
    score_1: number
    score_2: number
}

interface Event {
    id: string
    club_id: string
    template_id: string | null
    type: 'game' | 'workshop' | 'party'
    title: string
    duration_minutes: number | null
    address: string
    starts_at: string
    price: number | null
    /** Максимум участников (поле players_limit в БД) */
    players_limit?: number | null
    status: 'scheduled' | 'finished' | 'cancelled' | 'canceled' | 'hidden'
    created_at: string
    description?: string | null
    /** URL горизонтальной обложки; пусто — не показываем */
    cover?: string | null
}

import { clubDisplayName } from '@/lib/clubs'

type GamesTab = 'my' | 'all'

const COMPLETED_PAGE_SIZE = 10

export default function GamesList() {
    const { user } = useUser()
    const getMedalPrefix = useSoloLeaderMedalPrefix()
    const searchParams = useSearchParams()
    const gamesTabFromUrl = searchParams.get('eventsScope') ?? searchParams.get('gamesTab')
    const [activeTab, setActiveTab] = useState<GamesTab>(() => {
        if (gamesTabFromUrl === 'all' || gamesTabFromUrl === 'past') return 'all'
        return 'my'
    })
    const [games, setGames] = useState<Game[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [pastEvents, setPastEvents] = useState<Event[]>([])
    const [playerIdMap, setPlayerIdMap] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [eventsLoading, setEventsLoading] = useState(true)
    const [pastEventsLoading, setPastEventsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [eventsError, setEventsError] = useState<string | null>(null)
    const [eventRegistrationStatus, setEventRegistrationStatus] = useState<Record<string, {
        loading: boolean
        success: boolean
        error: string | null
        response: any
    }>>({})
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
    const [expandedDescriptionIds, setExpandedDescriptionIds] = useState<Set<string>>(new Set())
    const [expandedParticipantListIds, setExpandedParticipantListIds] = useState<Set<string>>(new Set())
    const [eventParticipantsList, setEventParticipantsList] = useState<Record<string, { user_id: number; first_name?: string | null; last_name?: string | null; username?: string | null; nickname?: string | null }[]>>({})
    const [eventParticipantsListLoading, setEventParticipantsListLoading] = useState<Record<string, boolean>>({})
    const [eventParticipants, setEventParticipants] = useState<Record<string, { payment_status: string; paylink?: string | null; created_at?: string | null }>>({})
    const [eventParticipantsCount, setEventParticipantsCount] = useState<Record<string, number>>({})
    const [clubNames, setClubNames] = useState<Record<string, string>>({})
    const [showCompleted, setShowCompleted] = useState(false)
    const [completedVisibleCount, setCompletedVisibleCount] = useState(COMPLETED_PAGE_SIZE)
    const [crossClubConfirm, setCrossClubConfirm] = useState<{
        eventId: string
        eventClubId: string
        userClubId: string
    } | null>(null)
    const [myClubLabel, setMyClubLabel] = useState('Мой город')
    /** @deprecated Состояние для зелёных Realtime-попапов; показ отключён (false && в рендере), можно вычистить */
    const [realtimeNotification, setRealtimeNotification] = useState<{
        show: boolean
        message: string
        data?: any
    } | null>(null)

    useEffect(() => {
        if (gamesTabFromUrl === 'all' || gamesTabFromUrl === 'past') {
            setActiveTab('all')
        } else if (gamesTabFromUrl === 'my' || gamesTabFromUrl === 'announcements') {
            setActiveTab('my')
        }
    }, [gamesTabFromUrl])

    useEffect(() => {
        if (!user?.club_id) return
        const name = clubNames[user.club_id]
        if (name) setMyClubLabel(name)
    }, [user?.club_id, clubNames])

    // Загружаем прошедшие игры
    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()

                // Загружаем игры
                const { data: gamesData, error: gamesError } = await supabase
                    .from('games_summary')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (gamesError) {
                    console.error('Supabase error:', gamesError)
                    setError(gamesError.message)
                    setLoading(false)
                    return
                }

                // Загружаем маппинг nickname → user_id
                const { data: playersData, error: playersError } = await supabase
                    .from('clubtac_players_hall_of_fame_v3')
                    .select('user_id, nickname')

                if (!playersError && playersData) {
                    const idMap: Record<string, number> = {}
                    playersData.forEach((player: any) => {
                        if (player.nickname?.trim()) {
                            idMap[player.nickname.trim()] = player.user_id
                        }
                    })
                    setPlayerIdMap(idMap)
                }

                console.log('Loaded games:', gamesData)
                setGames(gamesData || [])
            } catch (err) {
                console.error('Error loading games:', err)
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [])

    // Загружаем анонсы
    useEffect(() => {
        const loadEvents = async () => {
            try {
                const supabase = createClient()
                const now = new Date().toISOString()

                console.log('Loading events from clubtac_events, current time:', now)

                // События, которые ещё не начались: starts_at > сейчас (включая сегодняшние с будущим временем)
                const { data: allEvents, error: allEventsError } = await supabase
                    .from('clubtac_events')
                    .select('id, title, starts_at, club_id, price, address, status, type, duration_minutes, template_id, created_at, description, cover, players_limit')
                    .gt('starts_at', now)
                    .neq('status', 'hidden')
                    .order('starts_at', { ascending: true })

                console.log('Events (not started yet):', allEvents)
                console.log('All events error:', allEventsError)

                if (allEventsError) {
                    console.error('Supabase events error:', allEventsError)
                    setEventsError(allEventsError.message)
                    setEventsLoading(false)
                    return
                }

                const filteredEvents = (allEvents || []).filter((e) => e.status !== 'hidden')
                setEvents(filteredEvents)

                // Загружаем статусы регистрации пользователя на события и количество участников
                const eventIds = filteredEvents.map(e => e.id)
                if (eventIds.length > 0) {
                    // Загружаем количество участников с оплатой (payment_status = paid) для каждого события
                    const { data: participantsCount, error: countError } = await supabase
                        .from('clubtac_event_participants')
                        .select('event_id, payment_status')
                        .in('event_id', eventIds)
                        .eq('payment_status', 'paid')

                    if (!countError && participantsCount) {
                        const countMap: Record<string, number> = {}
                        participantsCount.forEach((p: any) => {
                            countMap[p.event_id] = (countMap[p.event_id] || 0) + 1
                        })
                        setEventParticipantsCount(countMap)
                        console.log('Loaded event participants count (paid only):', countMap)
                    }

                    // Загружаем статусы регистрации текущего пользователя (включая paylink и created_at)
                    if (user?.id) {
                        const { data: participants, error: participantsError } = await supabase
                            .from('clubtac_event_participants')
                            .select('event_id, payment_status, paylink, created_at')
                            .eq('user_id', user.id)
                            .in('event_id', eventIds)

                        if (!participantsError && participants) {
                            const participantsMap: Record<string, { payment_status: string; paylink?: string | null; created_at?: string | null }> = {}
                            participants.forEach((p: any) => {
                                participantsMap[p.event_id] = {
                                    payment_status: p.payment_status,
                                    paylink: p.paylink ?? null,
                                    created_at: p.created_at ?? null,
                                }
                            })
                            setEventParticipants(participantsMap)
                            console.log('Loaded event participants:', participantsMap)
                        }
                    }
                }

                // Загружаем названия клубов
                const uniqueClubIds = [...new Set(filteredEvents.map(e => e.club_id).filter(Boolean))]
                if (uniqueClubIds.length > 0) {
                    const { data: clubs, error: clubsError } = await supabase
                        .from('clubtac_clubs_public')
                        .select('id, name, city')
                        .in('id', uniqueClubIds)

                    if (!clubsError && clubs) {
                        const clubsMap: Record<string, string> = {}
                        clubs.forEach((club: { id: string; name?: string; city?: string | null }) => {
                            clubsMap[club.id] = club.city?.trim() || club.name?.trim() || club.id
                        })
                        setClubNames(clubsMap)
                        console.log('Loaded club names:', clubsMap)
                    }
                }
            } catch (err) {
                console.error('Error loading events:', err)
                setEventsError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setEventsLoading(false)
            }
        }

        loadEvents()
    }, [user])

    // Функция для обновления количества участников
    const refreshParticipantCounts = useCallback(async () => {
        if (events.length === 0) return

        try {
            const supabase = createClient()
            const eventIds = events.map(e => e.id)

            const { data: participantsCount, error: countError } = await supabase
                .from('clubtac_event_participants')
                .select('event_id, payment_status')
                .in('event_id', eventIds)
                .eq('payment_status', 'paid')

            if (!countError && participantsCount) {
                const countMap: Record<string, number> = {}
                participantsCount.forEach((p: any) => {
                    countMap[p.event_id] = (countMap[p.event_id] || 0) + 1
                })
                setEventParticipantsCount(countMap)
            }
        } catch (err) {
            console.error('Error refreshing participant counts:', err)
        }
    }, [events])

    // Функция для обновления статусов участников
    const refreshParticipantStatuses = useCallback(async () => {
        if (!user?.id || events.length === 0) return

        try {
            const supabase = createClient()
            const eventIds = events.map(e => e.id)

            const { data: participants, error: participantsError } = await supabase
                .from('clubtac_event_participants')
                .select('event_id, payment_status, paylink, created_at')
                .eq('user_id', user.id)
                .in('event_id', eventIds)

            if (!participantsError && participants) {
                setEventParticipants(prev => {
                    const updated = { ...prev }
                    participants.forEach((p: any) => {
                        updated[p.event_id] = {
                            payment_status: p.payment_status,
                            paylink: p.paylink ?? null,
                            created_at: p.created_at ?? null,
                        }
                    })
                    return updated
                })
            }

            // Также обновляем количество участников
            refreshParticipantCounts()
        } catch (err) {
            console.error('Error refreshing participant statuses:', err)
        }
    }, [user?.id, events, refreshParticipantCounts])

    // Загрузить список участников события (оплативших) при раскрытии
    const loadEventParticipantsList = useCallback(async (eventId: string) => {
        if (eventParticipantsList[eventId]) return
        setEventParticipantsListLoading(prev => ({ ...prev, [eventId]: true }))
        try {
            const supabase = createClient()
            const { data: participants, error: partError } = await supabase
                .from('clubtac_event_participants')
                .select('user_id')
                .eq('event_id', eventId)
                .eq('payment_status', 'paid')

            if (partError || !participants?.length) {
                setEventParticipantsList(prev => ({ ...prev, [eventId]: [] }))
                setEventParticipantsListLoading(prev => ({ ...prev, [eventId]: false }))
                return
            }

            const userIds = participants.map((p: any) => p.user_id).filter(Boolean)
            if (userIds.length === 0) {
                setEventParticipantsList(prev => ({ ...prev, [eventId]: [] }))
                setEventParticipantsListLoading(prev => ({ ...prev, [eventId]: false }))
                return
            }

            const { data: users } = await supabase
                .from('clubtac_users')
                .select('id, first_name, last_name, username, nickname')
                .in('id', userIds)

            const userMap: Record<number, { first_name?: string | null; last_name?: string | null; username?: string | null; nickname?: string | null }> = {}
            users?.forEach((u: any) => {
                userMap[u.id] = {
                    first_name: u.first_name ?? null,
                    last_name: u.last_name ?? null,
                    username: u.username ?? null,
                    nickname: u.nickname ?? null,
                }
            })

            const list = userIds.map((uid: number) => ({
                user_id: uid,
                ...userMap[uid],
            }))
            setEventParticipantsList(prev => ({ ...prev, [eventId]: list }))
        } catch (err) {
            console.error('Error loading event participants list:', err)
            setEventParticipantsList(prev => ({ ...prev, [eventId]: [] }))
        } finally {
            setEventParticipantsListLoading(prev => ({ ...prev, [eventId]: false }))
        }
    }, [eventParticipantsList])

    // Формат: только nickname; если нет — имя/фамилия или «Участник #id»
    const formatParticipantDisplay = (p: { user_id: number; first_name?: string | null; last_name?: string | null; username?: string | null; nickname?: string | null }) => {
        if (p.nickname?.trim()) {
            return p.nickname.trim()
        }
        const namePart = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
        if (namePart) return namePart
        return `Участник #${p.user_id}`
    }

    // Подписка на изменения статусов участников через Supabase Realtime
    useEffect(() => {
        if (!user?.id || events.length === 0) return

        const supabase = createClient()

        // Создаем уникальное имя канала для каждого пользователя
        const channelName = `event_participants_changes_${user.id}_${Date.now()}`

        console.log('Setting up Realtime subscription for user:', user.id)

        // Подписываемся на изменения в таблице clubtac_event_participants
        // Пробуем два варианта: с фильтром и без (с фильтрацией на клиенте)
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'clubtac_event_participants',
                },
                (payload) => {
                    console.log('Participant status changed via Realtime (all updates):', payload)

                    /* Deprecated: Realtime popup disabled
                    setRealtimeNotification({
                        show: true,
                        message: `Realtime получил обновление!`,
                        data: payload
                    })
                    setTimeout(() => setRealtimeNotification(null), 5000)
                    */

                    // Фильтруем на клиенте - проверяем, что это изменение для текущего пользователя
                    const changedUserId = payload.new.user_id
                    if (changedUserId !== user.id) {
                        console.log('Update is for different user, ignoring')
                        return
                    }

                    const eventId = payload.new.event_id as string
                    const paymentStatus = payload.new.payment_status as string
                    const paylink = (payload.new as any).paylink
                    const created_at = (payload.new as any).created_at

                    console.log('Updating participant status:', { eventId, paymentStatus })

                    // Обновляем статус участника (Realtime может присылать paylink/created_at при обновлении)
                    setEventParticipants(prev => ({
                        ...prev,
                        [eventId]: {
                            ...prev[eventId],
                            payment_status: paymentStatus,
                            paylink: paylink !== undefined ? paylink : prev[eventId]?.paylink,
                            created_at: created_at !== undefined ? created_at : prev[eventId]?.created_at,
                        }
                    }))

                    // Обновляем количество участников (перезагружаем для актуальности)
                    refreshParticipantCounts()
                }
            )
            .subscribe((status) => {
                console.log('Realtime subscription status:', status)
                if (status === 'SUBSCRIBED') {
                    console.log('Successfully subscribed to Realtime changes for clubtac_event_participants')
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('Realtime channel error - check Supabase Realtime settings')
                    /* Deprecated: Realtime popup disabled
                    setRealtimeNotification({ show: true, message: `Ошибка Realtime: ${status}`, data: { status } })
                    setTimeout(() => setRealtimeNotification(null), 5000)
                    */
                } else if (status === 'TIMED_OUT') {
                    console.error('Realtime subscription timed out')
                    /* Deprecated: Realtime popup disabled
                    setRealtimeNotification({ show: true, message: `Realtime таймаут: ${status}`, data: { status } })
                    setTimeout(() => setRealtimeNotification(null), 5000)
                    */
                } else if (status === 'CLOSED') {
                    console.log('Realtime channel closed')
                    /* Deprecated: Realtime popup disabled
                    setRealtimeNotification({ show: true, message: `Realtime канал закрыт: ${status}`, data: { status } })
                    setTimeout(() => setRealtimeNotification(null), 3000)
                    */
                }
            })

        // Периодическая проверка статусов (каждые 10 секунд) как fallback
        const intervalId = setInterval(() => {
            refreshParticipantStatuses()
        }, 10000)

        // Проверка при возврате на страницу
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshParticipantStatuses()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        // Очистка при размонтировании
        return () => {
            console.log('Cleaning up Realtime subscription')
            supabase.removeChannel(channel)
            clearInterval(intervalId)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [user?.id, events, refreshParticipantStatuses, refreshParticipantCounts])

    // Загружаем прошедшие события (по дате; status finished часто не выставляется в БД)
    useEffect(() => {
        const loadPastEvents = async () => {
            try {
                const supabase = createClient()
                const now = new Date().toISOString()

                const { data: rawPast, error: eventsError } = await supabase
                    .from('clubtac_events')
                    .select('id, title, starts_at, club_id, price, address, status, type, duration_minutes, template_id, created_at, cover, players_limit')
                    .lt('starts_at', now)
                    .neq('status', 'hidden')
                    .order('starts_at', { ascending: false })
                    .limit(200)

                if (eventsError) {
                    console.error('Supabase past events error:', eventsError)
                    setPastEventsLoading(false)
                    return
                }

                const finishedEvents = (rawPast || []).filter(
                    (e) => e.status !== 'cancelled' && e.status !== 'canceled'
                )

                console.log('Loaded past events:', finishedEvents)
                setPastEvents(finishedEvents)

                const uniqueClubIds = [...new Set(finishedEvents.map((e) => e.club_id).filter(Boolean))]
                if (uniqueClubIds.length > 0) {
                    const { data: clubs, error: clubsError } = await supabase
                        .from('clubtac_clubs_public')
                        .select('id, name, city')
                        .in('id', uniqueClubIds)

                    const clubRows =
                        !clubsError && clubs
                            ? clubs
                            : (
                                  await supabase
                                      .from('clubtac_clubs')
                                      .select('id, name, clubtac_cities(name)')
                                      .in('id', uniqueClubIds)
                              ).data

                    if (clubRows?.length) {
                        setClubNames((prev) => {
                            const next = { ...prev }
                            clubRows.forEach(
                                (club: {
                                    id: string
                                    name?: string
                                    city?: string | null
                                    clubtac_cities?: { name?: string | null } | { name?: string | null }[] | null
                                }) => {
                                    const cityRef = club.clubtac_cities
                                    const cityName = Array.isArray(cityRef) ? cityRef[0]?.name : cityRef?.name
                                    next[club.id] =
                                        club.city?.trim() || cityName?.trim() || club.name?.trim() || club.id
                                }
                            )
                            return next
                        })
                    }
                }
            } catch (err) {
                console.error('Error loading past events:', err)
            } finally {
                setPastEventsLoading(false)
            }
        }

        loadPastEvents()
    }, [])

    // Форматирование даты для прошедших игр
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            })
        } catch {
            return dateString
        }
    }

    // Форматирование даты для анонсов (27 января, ВТ. 16:00) — day+month вместе, чтобы месяц был в род. падеже
    const formatEventDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            const dayMonth = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
            const weekdayRaw = date.toLocaleDateString('ru-RU', { weekday: 'short' })
            const weekday = weekdayRaw.replace(/\.$/, '').toUpperCase()
            const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false })
            return `${dayMonth}, ${weekday}. ${time}`
        } catch {
            return dateString
        }
    }

    // Получить название типа события
    const getEventTypeName = (type: string) => {
        switch (type) {
            case 'game':
                return 'Игра'
            case 'workshop':
                return 'Мастер-класс'
            case 'party':
                return 'Вечеринка'
            default:
                return type
        }
    }

    // Сравнение дат по календарному дню (локальное время)
    const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const isEventDateToday = (startsAt: string) => {
        const eventDate = new Date(startsAt)
        const today = new Date()
        return toDateOnly(eventDate) === toDateOnly(today)
    }
    const isEventDateTomorrowOrLater = (startsAt: string) => {
        const eventDate = new Date(startsAt)
        const today = new Date()
        return toDateOnly(eventDate) > toDateOnly(today)
    }
    const isCreatedAtToday = (createdAt: string | null | undefined) => {
        if (!createdAt) return false
        const created = new Date(createdAt)
        const today = new Date()
        return toDateOnly(created) === toDateOnly(today)
    }
    // Событие сегодня и время начала ещё не наступило (starts_at в будущем)
    const isEventTodayAndNotStarted = (startsAt: string) => {
        const eventDate = new Date(startsAt)
        const now = new Date()
        return toDateOnly(eventDate) === toDateOnly(now) && eventDate.getTime() > now.getTime()
    }

    // Функция для поиска события по дате игры
    const findEventByGameDate = (gameDate: string): Event | null => {
        const gameDateObj = new Date(gameDate)
        const gameDateOnly = new Date(gameDateObj.getFullYear(), gameDateObj.getMonth(), gameDateObj.getDate())

        return pastEvents.find(event => {
            const eventDateObj = new Date(event.starts_at)
            const eventDateOnly = new Date(eventDateObj.getFullYear(), eventDateObj.getMonth(), eventDateObj.getDate())
            return eventDateOnly.getTime() === gameDateOnly.getTime()
        }) || null
    }

    // Группировка игр по датам с информацией о событиях
    const gamesByDate = games.reduce((acc, game) => {
        const date = formatDate(game.created_at)
        if (!acc[date]) {
            acc[date] = {
                games: [],
                event: null
            }
        }
        acc[date].games.push(game)
        // Находим событие для этой даты (берем первое найденное)
        if (!acc[date].event) {
            acc[date].event = findEventByGameDate(game.created_at)
        }
        return acc
    }, {} as Record<string, { games: Game[], event: Event | null }>)

    // Функция для записи на событие
    const handleRegisterForEvent = async (eventId: string, confirmCrossClub = false) => {
        if (!user) {
            alert('Необходимо войти в систему')
            return
        }

        const ev = events.find((e) => e.id === eventId)
        if (ev && (ev.status === 'cancelled' || ev.status === 'canceled')) return

        if (
            !confirmCrossClub &&
            user.club_id &&
            ev?.club_id &&
            ev.club_id !== user.club_id
        ) {
            setCrossClubConfirm({
                eventId,
                eventClubId: ev.club_id,
                userClubId: user.club_id,
            })
            return
        }

        setCrossClubConfirm(null)
        // Устанавливаем состояние загрузки
        setEventRegistrationStatus(prev => ({
            ...prev,
            [eventId]: {
                loading: true,
                success: false,
                error: null,
                response: null
            }
        }))

        try {
            // Создаем AbortController для таймаута
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 секунд таймаут

            try {
                const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: user.id || null,
                        telegram_id: user.telegram_id || null,
                        confirm_cross_club: confirmCrossClub || undefined,
                    }),
                    signal: controller.signal,
                })

                clearTimeout(timeoutId)

                if (!response.ok) {
                    let errText = `HTTP error! status: ${response.status}`
                    try {
                        const errJson = await response.json()
                        if (typeof errJson.error === 'string') errText = errJson.error
                        if (errJson.requires_confirmation && ev?.club_id && user.club_id) {
                            setCrossClubConfirm({
                                eventId,
                                eventClubId: ev.club_id,
                                userClubId: user.club_id,
                            })
                            setEventRegistrationStatus((prev) => ({
                                ...prev,
                                [eventId]: {
                                    loading: false,
                                    success: false,
                                    error: null,
                                    response: null,
                                },
                            }))
                            return
                        }
                    } catch {
                        /* ignore */
                    }
                    throw new Error(errText)
                }

                // Пытаемся распарсить ответ как JSON
                let responseData
                try {
                    responseData = await response.json()
                } catch (jsonError) {
                    console.warn('Failed to parse registration response:', jsonError)
                    responseData = { message: 'Запрос принят' }
                }

                // Обновляем статус участника в локальном состоянии
                // Если есть paylink, значит регистрация прошла, но оплата pending
                if (responseData.paylink) {
                    setEventParticipants(prev => ({
                        ...prev,
                        [eventId]: { payment_status: 'pending' }
                    }))

                    // Устанавливаем успешное состояние с ответом
                    setEventRegistrationStatus(prev => ({
                        ...prev,
                        [eventId]: {
                            loading: false,
                            success: true,
                            error: null,
                            response: responseData
                        }
                    }))
                } else {
                    // Если нет paylink, проверяем статус участника в базе данных
                    if (user?.id) {
                        const supabase = createClient()
                        const { data: participant, error: participantError } = await supabase
                            .from('clubtac_event_participants')
                            .select('payment_status')
                            .eq('event_id', eventId)
                            .eq('user_id', user.id)
                            .single()

                        if (participant) {
                            setEventParticipants(prev => ({
                                ...prev,
                                [eventId]: { payment_status: participant.payment_status }
                            }))

                            // Устанавливаем успешное состояние с ответом
                            setEventRegistrationStatus(prev => ({
                                ...prev,
                                [eventId]: {
                                    loading: false,
                                    success: true,
                                    error: null,
                                    response: responseData
                                }
                            }))
                        } else {
                            // Если участник не найден, это может быть ошибка - webhook сработал, но ссылка не сгенерировалась
                            // Проверяем, является ли ответ просто "Accepted" или подобным текстом
                            const isSimpleAccept = responseData?.message === 'Accepted' ||
                                responseData?.message === 'Запрос принят' ||
                                (typeof responseData === 'object' && Object.keys(responseData).length === 1 && 'message' in responseData)

                            if (isSimpleAccept) {
                                // Это ошибка - webhook сработал, но регистрация не завершена
                                // Устанавливаем состояние ошибки
                                setEventRegistrationStatus(prev => ({
                                    ...prev,
                                    [eventId]: {
                                        loading: false,
                                        success: false,
                                        error: 'Что-то пошло не так. попробуйте еще раз',
                                        response: null
                                    }
                                }))
                                return // Выходим из функции, не обновляя статус участника
                            } else {
                                // Если это не простой "Accepted", устанавливаем статус 'pending'
                                setEventParticipants(prev => ({
                                    ...prev,
                                    [eventId]: { payment_status: 'pending' }
                                }))

                                // Устанавливаем успешное состояние с ответом
                                setEventRegistrationStatus(prev => ({
                                    ...prev,
                                    [eventId]: {
                                        loading: false,
                                        success: true,
                                        error: null,
                                        response: responseData
                                    }
                                }))
                            }
                        }
                    } else {
                        // Если нет user.id, устанавливаем успешное состояние
                        setEventRegistrationStatus(prev => ({
                            ...prev,
                            [eventId]: {
                                loading: false,
                                success: true,
                                error: null,
                                response: responseData
                            }
                        }))
                    }
                }
            } catch (fetchError) {
                clearTimeout(timeoutId)
                throw fetchError
            }
        } catch (err) {
            console.error('Error registering for event:', err)

            // Устанавливаем состояние ошибки с универсальным сообщением
            setEventRegistrationStatus(prev => ({
                ...prev,
                [eventId]: {
                    loading: false,
                    success: false,
                    error: 'Что-то пошло не так. попробуйте еще раз',
                    response: null
                }
            }))
        }
    }

    // Рендер анонсов
    const upcomingVisibleEvents =
        activeTab === 'my' && user?.club_id
            ? events.filter((e) => e.club_id === user.club_id)
            : events

    const renderCompletedSection = () => {
        const pastVisibleEvents =
            activeTab === 'my' && user?.club_id
                ? pastEvents.filter((e) => e.club_id === user.club_id)
                : pastEvents
        const slice = pastVisibleEvents.slice(0, completedVisibleCount)
        const hasMore = pastVisibleEvents.length > completedVisibleCount

        return (
            <div style={{ marginTop: '20px', padding: '0 12px 12px' }}>
                <button
                    type="button"
                    onClick={() => {
                        setShowCompleted((v) => !v)
                        if (!showCompleted) setCompletedVisibleCount(COMPLETED_PAGE_SIZE)
                    }}
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1px solid #EBE8E0',
                        backgroundColor: '#FAFAF8',
                        color: '#1D1D1B',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: 'pointer',
                    }}
                >
                    {showCompleted ? 'Скрыть завершённые' : 'Показать завершённые'}
                    {!showCompleted && pastVisibleEvents.length > 0
                        ? ` (${pastVisibleEvents.length})`
                        : ''}
                </button>

                {showCompleted ? (
                    <div style={{ marginTop: '12px' }}>
                        {pastEventsLoading ? (
                            <p style={{ textAlign: 'center', color: '#6B6B69', fontSize: '14px' }}>Загрузка…</p>
                        ) : pastVisibleEvents.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#6B6B69', fontSize: '14px' }}>
                                {activeTab === 'my'
                                    ? 'Завершённых событий в вашем городе пока нет'
                                    : 'Завершённых событий пока нет'}
                            </p>
                        ) : (
                            <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {slice.map((event) => (
                                        <div
                                            key={event.id}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '8px',
                                                border: '1px solid #EBE8E0',
                                                backgroundColor: '#FFFFFF',
                                            }}
                                        >
                                            <div style={{ fontWeight: 600, fontSize: '14px', color: '#1D1D1B' }}>
                                                {event.title}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#6B6B69', marginTop: '4px' }}>
                                                {formatEventDate(event.starts_at)}
                                            </div>
                                            {event.club_id ? (
                                                <EventClubLine
                                                    clubId={event.club_id}
                                                    clubNames={clubNames}
                                                    style={{ marginTop: '6px' }}
                                                />
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                                {hasMore ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCompletedVisibleCount((n) => n + COMPLETED_PAGE_SIZE)
                                        }
                                        style={{
                                            width: '100%',
                                            marginTop: '10px',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid #EBE8E0',
                                            backgroundColor: '#FFFFFF',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '13px',
                                            color: '#1D1D1B',
                                        }}
                                    >
                                        Показать ещё
                                    </button>
                                ) : null}
                                <div style={{ marginTop: '16px' }}>{renderPastGames()}</div>
                            </>
                        )}
                    </div>
                ) : null}
            </div>
        )
    }

    const renderAnnouncements = () => {
        if (eventsLoading) {
            return (
                <div style={{ padding: '12px', textAlign: 'center' }}>
                    <p>Загрузка...</p>
                </div>
            )
        }

        if (eventsError) {
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
                        <p style={{ margin: 0, color: '#1D1D1B' }}>Ошибка: {eventsError}</p>
                    </div>
                </div>
            )
        }

        if (upcomingVisibleEvents.length === 0) {
            return (
                <div style={{ padding: '12px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                        <p>
                            {activeTab === 'my'
                                ? 'Нет предстоящих событий в вашем городе'
                                : 'Нет предстоящих событий'}
                        </p>
                    </div>
                    {renderCompletedSection()}
                </div>
            )
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {upcomingVisibleEvents.map((event) => (
                    <div
                        key={event.id}
                        style={{
                            backgroundColor: isEventTodayAndNotStarted(event.starts_at) ? '#F5FAF5' : '#FFFFFF',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            boxShadow: '0 2px 16px rgba(29,29,27,0.06)',
                            border:
                                event.status === 'cancelled' || event.status === 'canceled'
                                    ? '2px solid #B71C1C'
                                    : isEventTodayAndNotStarted(event.starts_at)
                                      ? '1px solid #C8E6C9'
                                      : undefined,
                        }}
                    >
                        {event.cover?.trim() ? (
                            <div
                                style={{
                                    width: '100%',
                                    aspectRatio: '2 / 1',
                                    maxHeight: 200,
                                    backgroundColor: '#EBE8E0',
                                }}
                            >
                                <img
                                    src={event.cover.trim()}
                                    alt={event.title ? `Обложка: ${event.title}` : 'Обложка мероприятия'}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        display: 'block',
                                    }}
                                />
                            </div>
                        ) : null}
                        <div style={{ padding: '16px' }}>
                        <div style={{ marginBottom: '12px' }}>
                            <div
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    marginBottom: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '8px',
                                    flexWrap: 'wrap',
                                    color: '#1D1D1B',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                                    {formatEventDate(event.starts_at)}
                                    {isEventTodayAndNotStarted(event.starts_at) && (
                                        <span
                                            style={{
                                                fontSize: '12px',
                                                color: '#1B5E20',
                                                fontWeight: '600',
                                                backgroundColor: '#C8E6C9',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                            }}
                                        >
                                            Сегодня
                                        </span>
                                    )}
                                    {(event.status === 'cancelled' || event.status === 'canceled') && (
                                        <span style={{ fontSize: '11px', color: '#B71C1C', fontWeight: '600' }}>Отменено</span>
                                    )}
                                </div>
                                {event.price !== null ? (
                                    <div
                                        style={{
                                            fontSize: '14px',
                                            flexShrink: 0,
                                            marginLeft: 'auto',
                                            color: '#6B6B69',
                                        }}
                                    >
                                        {event.price === 0 ? 'Бесплатно' : `${event.price} ₽`}
                                    </div>
                                ) : null}
                            </div>
                            {event.title && (
                                <div style={{ fontSize: '22px', fontWeight: '600', lineHeight: '1.25', marginBottom: '8px', color: '#1D1D1B' }}>
                                    {event.title}
                                </div>
                            )}
                            {event.address && <EventAddressLine address={event.address} />}
                            {event.club_id ? (
                                <EventClubLine
                                    clubId={event.club_id}
                                    clubNames={clubNames}
                                    style={{ marginBottom: '4px' }}
                                />
                            ) : null}
                            {event.duration_minutes && (
                                <div style={{ fontSize: '14px', color: '#6B6B69', marginBottom: '4px' }}>
                                    ⏱️ Длительность: {event.duration_minutes} мин.
                                </div>
                            )}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '12px',
                                    flexWrap: 'wrap',
                                    fontSize: '14px',
                                    marginBottom: '8px',
                                    color: '#6B6B69',
                                }}
                            >
                                {(eventParticipantsCount[event.id] || 0) > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                        <span aria-hidden>👥</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const isExpanding = !expandedParticipantListIds.has(event.id)
                                                setExpandedParticipantListIds(prev => {
                                                    const next = new Set(prev)
                                                    if (next.has(event.id)) next.delete(event.id)
                                                    else next.add(event.id)
                                                    return next
                                                })
                                                if (isExpanding) loadEventParticipantsList(event.id)
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                padding: 0,
                                                color: '#1B5E20',
                                                textDecoration: 'underline',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                            }}
                                        >
                                            {eventParticipantsCount[event.id] || 0}{' '}
                                            {eventParticipantsCount[event.id] === 1
                                                ? 'участник'
                                                : eventParticipantsCount[event.id] && eventParticipantsCount[event.id] < 5
                                                  ? 'участника'
                                                  : 'участников'}
                                        </button>
                                    </div>
                                )}
                                <span
                                    style={{
                                        fontSize: '12px',
                                        color: '#6B6B69',
                                        fontWeight: 'normal',
                                        flexShrink: 0,
                                        marginLeft: 'auto',
                                    }}
                                >
                                    {getEventTypeName(event.type)}
                                </span>
                            </div>
                            {expandedParticipantListIds.has(event.id) &&
                                (eventParticipantsListLoading[event.id] ||
                                    (eventParticipantsList[event.id]?.length ?? 0) > 0) && (
                                    <div
                                        style={{
                                            marginBottom: '8px',
                                            padding: '10px 12px',
                                            backgroundColor: '#FFFEF7',
                                            borderRadius: '6px',
                                            border: '1px solid #EBE8E0',
                                        }}
                                    >
                                        {eventParticipantsListLoading[event.id] ? (
                                            <div style={{ fontSize: '13px', color: '#6B6B69' }}>Загрузка списка...</div>
                                        ) : (
                                            <ul style={{ margin: 0, paddingLeft: '0px', fontSize: '14px', color: '#1D1D1B' }}>
                                                {eventParticipantsList[event.id]!.map((p) => (
                                                    <li key={p.user_id} style={{ marginBottom: '4px' }}>
                                                        <Link
                                                            href={`/player/${p.user_id}`}
                                                            className="link-player"
                                                            style={{ color: '#1B5E20', textDecoration: 'none', fontWeight: '500' }}
                                                        >
                                                            {getMedalPrefix(p.user_id)}
                                                            {formatParticipantDisplay(p)}
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            {(event.description?.trim() || event.club_id) && (
                                <div style={{ marginTop: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setExpandedDescriptionIds(prev => {
                                                const next = new Set(prev)
                                                if (next.has(event.id)) next.delete(event.id)
                                                else next.add(event.id)
                                                return next
                                            })
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            background: 'transparent',
                                            border: '1px solid #EBE8E0',
                                            borderRadius: '6px',
                                            color: '#1D1D1B',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                        }}
                                    >
                                        {expandedDescriptionIds.has(event.id) ? 'Свернуть' : 'Подробнее'}
                                    </button>
                                    {expandedDescriptionIds.has(event.id) && (
                                        <div
                                            style={{
                                                marginTop: '8px',
                                                padding: '12px 0',
                                                fontSize: '16px',
                                            }}
                                        >
                                            {event.description?.trim() ? (
                                                <div
                                                    style={{
                                                        whiteSpace: 'pre-wrap',
                                                        color: '#1D1D1B',
                                                    }}
                                                >
                                                    {event.description}
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {(() => {
                            const status = eventRegistrationStatus[event.id]
                            const isLoading = status?.loading
                            const isSuccess = status?.success
                            const hasError = status?.error

                            if (event.status === 'cancelled' || event.status === 'canceled') {
                                const participantCancelled = eventParticipants[event.id]
                                if (participantCancelled?.payment_status === 'paid') {
                                    return (
                                        <div
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#E8F5E9',
                                                color: '#1B5E20',
                                                border: '1px solid #C8E6C9',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                textAlign: 'center',
                                                fontWeight: '500',
                                            }}
                                        >
                                            Вы зарегистрированы
                                        </div>
                                    )
                                }
                                return (
                                    <div
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            backgroundColor: '#F5F5F5',
                                            color: '#6B6B69',
                                            border: '1px solid #EBE8E0',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            textAlign: 'center',
                                            fontWeight: '500',
                                        }}
                                    >
                                        Событие отменено — запись и оплата недоступны.
                                    </div>
                                )
                            }

                            if (isLoading) {
                                return (
                                    <div
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            backgroundColor: '#EBE8E0',
                                            color: '#6B6B69',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            textAlign: 'center',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                border: '2px solid #6B6B69',
                                                borderTop: '2px solid transparent',
                                                borderRadius: '50%',
                                                animation: 'spin 1s linear infinite',
                                            }}
                                        />
                                        Отправка...
                                    </div>
                                )
                            }

                            if (isSuccess) {
                                // Сначала проверяем статус участника в базе данных (приоритет над ответом webhook)
                                const participant = eventParticipants[event.id]
                                const paymentStatus = participant?.payment_status

                                // Если статус оплачен, показываем "Вы зарегистрированы" независимо от наличия paylink
                                if (paymentStatus === 'paid') {
                                    return (
                                        <div
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#d4edda',
                                                color: '#155724',
                                                border: '1px solid #C8E6C9',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                textAlign: 'center',
                                                fontWeight: '500',
                                            }}
                                        >
                                            Вы зарегистрированы
                                        </div>
                                    )
                                }

                                // Проверяем, есть ли в ответе ссылка на оплату
                                const paylink = status.response?.paylink ||
                                    (status.response && typeof status.response === 'object' && 'paylink' in status.response
                                        ? status.response.paylink
                                        : null)

                                // Если есть paylink и статус не paid, показываем кнопку "Оплатить"
                                if (paylink) {
                                    return (
                                        <a
                                            href={paylink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#1B5E20',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                textAlign: 'center',
                                                textDecoration: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Оплатить
                                        </a>
                                    )
                                }

                                // Если нет ссылки на оплату, но статус pending, показываем кнопку для генерации ссылки
                                if (paymentStatus === 'pending') {
                                    return (
                                        <button
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#FFDF00',
                                                color: '#1D1D1B',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => handleRegisterForEvent(event.id)}
                                        >
                                            Сгенерировать ссылку на оплату
                                        </button>
                                    )
                                }

                                // Если статуса участника нет, показываем успешное сообщение
                                return (
                                    <div
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            backgroundColor: '#E8F5E9',
                                            color: '#1B5E20',
                                            border: '1px solid #C8E6C9',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            textAlign: 'center',
                                        }}
                                    >
                                        Вы успешно записались на событие!
                                    </div>
                                )
                            }

                            if (hasError) {
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#f8d7da',
                                                color: '#721c24',
                                                border: '1px solid #FFCDD2',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                textAlign: 'center',
                                            }}
                                        >
                                            {status.error}
                                        </div>
                                        <button
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#FFDF00',
                                                color: '#1D1D1B',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => handleRegisterForEvent(event.id)}
                                        >
                                            Записаться
                                        </button>
                                    </div>
                                )
                            }

                            // Проверяем статус регистрации пользователя
                            const participant = eventParticipants[event.id]
                            const paymentStatus = participant?.payment_status

                            if (paymentStatus === 'paid') {
                                return (
                                    <div
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            backgroundColor: '#E8F5E9',
                                            color: '#1B5E20',
                                            border: '1px solid #C8E6C9',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            textAlign: 'center',
                                            fontWeight: '500',
                                        }}
                                    >
                                        Вы зарегистрированы
                                    </div>
                                )
                            }

                            if (paymentStatus === 'pending') {
                                // Событие завтра или позже — показываем ссылку из БД
                                if (isEventDateTomorrowOrLater(event.starts_at) && participant.paylink) {
                                    return (
                                        <a
                                            href={participant.paylink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#1B5E20',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                textAlign: 'center',
                                                textDecoration: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Оплатить
                                        </a>
                                    )
                                }
                                // Событие сегодня, запись создана сегодня — ссылка уже актуальна
                                if (isEventDateToday(event.starts_at) && isCreatedAtToday(participant.created_at) && participant.paylink) {
                                    return (
                                        <a
                                            href={participant.paylink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#1B5E20',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                textAlign: 'center',
                                                textDecoration: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Оплатить
                                        </a>
                                    )
                                }
                                // Событие сегодня, запись создана не сегодня — ссылка устарела (цена изменилась), показываем нотифайер и кнопку
                                if (isEventDateToday(event.starts_at) && !isCreatedAtToday(participant.created_at)) {
                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    backgroundColor: '#FFF3E0',
                                                    color: '#E65100',
                                                    border: '1px solid #FFE0B2',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    fontWeight: '500',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                Ссылка на оплату устарела
                                            </div>
                                            <button
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    backgroundColor: '#FFDF00',
                                                    color: '#1D1D1B',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer',
                                                }}
                                                onClick={() => handleRegisterForEvent(event.id)}
                                            >
                                                Сгенерировать ссылку на оплату
                                            </button>
                                        </div>
                                    )
                                }
                                // Нет ссылки — кнопка генерации (как раньше)
                                return (
                                    <button
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            backgroundColor: '#FFE950',
                                            color: '#1D1D1B',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => handleRegisterForEvent(event.id)}
                                    >
                                        Сгенерировать ссылку на оплату
                                    </button>
                                )
                            }

                            return (
                                <button
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        backgroundColor: '#FFDF00',
                                        color: '#1D1D1B',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => handleRegisterForEvent(event.id)}
                                >
                                    Записаться
                                </button>
                            )
                        })()}
                        </div>
                    </div>
                ))}
                {renderCompletedSection()}
            </div>
        )
    }
    const renderPastGames = () => {
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

        if (games.length === 0) {
            return (
                <div style={{ padding: '12px', textAlign: 'center' }}>
                    <p>Нет данных</p>
                </div>
            )
        }

        const toggleDate = (date: string) => {
            setExpandedDates(prev => {
                const newSet = new Set(prev)
                if (newSet.has(date)) {
                    newSet.delete(date)
                } else {
                    newSet.add(date)
                }
                return newSet
            })
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(gamesByDate).map(([date, dateData]) => {
                    const isExpanded = expandedDates.has(date)
                    const event = dateData.event
                    const dateGames = dateData.games
                    return (
                        <div
                            key={date}
                            style={{
                                backgroundColor: '#FFFFFF',
                                borderRadius: '8px',
                                boxShadow: '0 2px 16px rgba(29,29,27,0.06)',
                                overflow: 'hidden',
                            }}
                        >
                            {event?.cover?.trim() ? (
                                <div
                                    style={{
                                        width: '100%',
                                        aspectRatio: '2 / 1',
                                        maxHeight: 160,
                                        backgroundColor: '#EBE8E0',
                                    }}
                                >
                                    <img
                                        src={event.cover.trim()}
                                        alt={event.title ? `Обложка: ${event.title}` : 'Обложка мероприятия'}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            display: 'block',
                                            pointerEvents: 'none',
                                        }}
                                    />
                                </div>
                            ) : null}
                            {/* Заголовок карточки (кликабельный) */}
                            <div
                                onClick={() => toggleDate(date)}
                                style={{
                                    padding: '16px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    backgroundColor: isExpanded ? '#FFFEF7' : '#FFFFFF',
                                    transition: 'background-color 0.2s',
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    {event && event.starts_at ? (
                                        <div
                                            style={{
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                                color: '#1D1D1B',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '8px',
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            <span style={{ minWidth: 0 }}>{formatEventDate(event.starts_at)}</span>
                                            {event.type ? (
                                                <span
                                                    style={{
                                                        fontSize: '12px',
                                                        color: '#6B6B69',
                                                        fontWeight: 'normal',
                                                        flexShrink: 0,
                                                        marginLeft: 'auto',
                                                    }}
                                                >
                                                    {getEventTypeName(event.type)}
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1D1D1B' }}>
                                            {date}
                                        </div>
                                    )}
                                    {event && event.title && (
                                        <div style={{ fontSize: '22px', fontWeight: '600', lineHeight: '1.25', marginBottom: '8px', color: '#1D1D1B' }}>
                                            {event.title}
                                        </div>
                                    )}
                                    {event && event.address && <EventAddressLine address={event.address} />}
                                    {event && event.club_id && (
                                        <EventClubLine
                                            clubId={event.club_id}
                                            clubNames={clubNames}
                                            style={{ marginBottom: '4px' }}
                                        />
                                    )}
                                    <div style={{ fontSize: '12px', color: '#6B6B69', marginTop: '8px' }}>
                                        {formatGamesRu(dateGames.length)}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        marginLeft: '12px',
                                        flexShrink: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                    }}
                                >
                                    <ExpandChevronIcon open={isExpanded} size={24} />
                                </div>
                            </div>

                            {/* Раскрывающийся контент с играми */}
                            {isExpanded && (
                                <div style={{ borderTop: '1px solid #EBE8E0' }}>
                                    {dateGames.map((game, index) => {
                                        const team1Won = game.score_1 > game.score_2
                                        return (
                                            <div key={game.game_id}>
                                                {index > 0 && (
                                                    <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                                                )}
                                                <div
                                                    style={{
                                                        padding: '10px 12px',
                                                        display: 'grid',
                                                        gridTemplateColumns: '1fr auto 1fr',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                    }}
                                                >
                                                    {/* Левая команда */}
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ marginBottom: '4px', lineHeight: '14px' }}>
                                                            {playerIdMap[game.player_1_1] ? (
                                                                <Link
                                                                    href={`/player/${playerIdMap[game.player_1_1]}`}
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
                                                                    {getMedalPrefix(playerIdMap[game.player_1_1])}
                                                                    {game.player_1_1}
                                                                </Link>
                                                            ) : (
                                                                <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{game.player_1_1}</span>
                                                            )}
                                                        </div>
                                                        <div style={{ lineHeight: '14px', verticalAlign: 'bottom' }}>
                                                            {playerIdMap[game.player_1_2] ? (
                                                                <Link
                                                                    href={`/player/${playerIdMap[game.player_1_2]}`}
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
                                                                    {getMedalPrefix(playerIdMap[game.player_1_2])}
                                                                    {game.player_1_2}
                                                                </Link>
                                                            ) : (
                                                                <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{game.player_1_2}</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Счет по центру */}
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
                                                        <span
                                                            style={{
                                                                color: team1Won ? '#1B5E20' : '#6B6B69',
                                                                backgroundColor: team1Won ? '#E8F5E9' : '#FFFEF7',
                                                                padding: '4px 8px',
                                                                borderRadius: '6px',
                                                                minWidth: '32px',
                                                            }}
                                                        >
                                                            {game.score_1}
                                                        </span>
                                                        <span style={{ color: '#6B6B69', fontSize: '24px' }}>:</span>
                                                        <span
                                                            style={{
                                                                color: !team1Won ? '#1B5E20' : '#6B6B69',
                                                                backgroundColor: !team1Won ? '#E8F5E9' : '#FFFEF7',
                                                                padding: '4px 8px',
                                                                borderRadius: '6px',
                                                                minWidth: '32px',
                                                            }}
                                                        >
                                                            {game.score_2}
                                                        </span>
                                                    </div>

                                                    {/* Правая команда */}
                                                    <div style={{ textAlign: 'left' }}>
                                                        <div style={{ marginBottom: '4px', lineHeight: '14px' }}>
                                                            {playerIdMap[game.player_2_1] ? (
                                                                <Link
                                                                    href={`/player/${playerIdMap[game.player_2_1]}`}
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
                                                                    {getMedalPrefix(playerIdMap[game.player_2_1])}
                                                                    {game.player_2_1}
                                                                </Link>
                                                            ) : (
                                                                <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{game.player_2_1}</span>
                                                            )}
                                                        </div>
                                                        <div style={{ lineHeight: '14px', verticalAlign: 'bottom' }}>
                                                            {playerIdMap[game.player_2_2] ? (
                                                                <Link
                                                                    href={`/player/${playerIdMap[game.player_2_2]}`}
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
                                                                    {getMedalPrefix(playerIdMap[game.player_2_2])}
                                                                    {game.player_2_2}
                                                                </Link>
                                                            ) : (
                                                                <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{game.player_2_2}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div>
            {/* Deprecated: Realtime popup disabled. Было: зелёные уведомления "Realtime получил обновление", "Ошибка Realtime" и т.п. Включить: убрать false && */}
            {false && realtimeNotification?.show && (
                <div
                    style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        backgroundColor: '#1B5E20',
                        color: '#ffffff',
                        padding: '16px 20px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 10000,
                        maxWidth: '400px',
                        animation: 'slideIn 0.3s ease-out',
                    }}
                >
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '16px' }}>
                        🔔 {realtimeNotification?.message}
                    </div>
                    {realtimeNotification?.data && (
                        <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '8px', wordBreak: 'break-word' }}>
                            <details>
                                <summary style={{ cursor: 'pointer', marginBottom: '4px' }}>Данные</summary>
                                <pre style={{
                                    fontSize: '10px',
                                    backgroundColor: 'rgba(0,0,0,0.2)',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    overflow: 'auto',
                                    maxHeight: '200px'
                                }}>
                                    {JSON.stringify(realtimeNotification?.data, null, 2)}
                                </pre>
                            </details>
                        </div>
                    )}
                    <button
                        onClick={() => setRealtimeNotification(null)}
                        style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Табы */}
            <div
                style={{
                    display: 'flex',
                    borderBottom: '2px solid #EBE8E0',
                    margin: '0 12px',
                    marginBottom: '16px',
                }}
            >
                    <button
                        onClick={() => setActiveTab('my')}
                    style={{
                        flex: 1,
                        padding: '12px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: activeTab === 'my' ? 'bold' : 'normal',
                        color: activeTab === 'my' ? '#1D1D1B' : '#6B6B69',
                        borderBottom: activeTab === 'my' ? '2px solid #FFDF00' : '2px solid transparent',
                        marginBottom: '-2px',
                    }}
                >
                    {myClubLabel}
                </button>
                    <button
                    onClick={() => setActiveTab('all')}
                    style={{
                        flex: 1,
                        padding: '12px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: activeTab === 'all' ? 'bold' : 'normal',
                        color: activeTab === 'all' ? '#1D1D1B' : '#6B6B69',
                        borderBottom: activeTab === 'all' ? '2px solid #FFDF00' : '2px solid transparent',
                        marginBottom: '-2px',
                    }}
                >
                    Все клубы
                </button>
            </div>

            {renderAnnouncements()}

            {crossClubConfirm ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1500,
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
                            maxWidth: '380px',
                            backgroundColor: '#FFFFFF',
                            borderRadius: '16px',
                            padding: '20px',
                        }}
                    >
                        <h3 style={{ margin: '0 0 10px', fontSize: '17px', color: '#1D1D1B' }}>
                            Другой город
                        </h3>
                        <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#6B6B69', lineHeight: 1.45 }}>
                            Вы из {clubNames[crossClubConfirm.userClubId] || crossClubConfirm.userClubId}. Записаться
                            на игру в {clubNames[crossClubConfirm.eventClubId] || crossClubConfirm.eventClubId}?
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setCrossClubConfirm(null)}
                                style={{
                                    flex: 1,
                                    padding: '11px',
                                    borderRadius: '10px',
                                    border: '1px solid #EBE8E0',
                                    backgroundColor: '#FFFFFF',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                }}
                            >
                                Отмена
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    void handleRegisterForEvent(crossClubConfirm.eventId, true)
                                }
                                style={{
                                    flex: 1,
                                    padding: '11px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    backgroundColor: '#FFDF00',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    color: '#1D1D1B',
                                }}
                            >
                                Да, записаться
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
