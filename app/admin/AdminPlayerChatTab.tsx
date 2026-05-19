'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminFetch } from '@/lib/admin/adminFetch'
import {
    ADMIN_CHAT_MESSAGES_INITIAL,
    ADMIN_CHAT_MESSAGES_OLDER_PAGE,
    adminMessageSenderLabel,
    dayKeyFromIso,
    formatAdminMessageDayLabel,
    formatAdminMessageTime,
    createOptimisticAdminMessageId,
    mergeAdminPlayerMessages,
    parseAdminPlayerMessageRow,
    type AdminMessageSender,
    type AdminPlayerMessage,
    type AdminPlayerMessageSendResponse,
    type AdminPlayerMessagesResponse,
} from '@/lib/admin/adminPlayerMessages'

const CHAT_BG = '#FAFAF8'
const CHAT_BG_RGB = '250, 250, 248'
const COMPOSER_FIELD_BG = '#FFFFFF'
/** Запас под оверлей капсулы, пока не измерили ResizeObserver */
const COMPOSER_OVERLAY_PAD_FALLBACK_PX = 72
/** Растворение ленты над капсулой */
const COMPOSER_LIST_FADE_PX = 44
const COMPOSER_SHELL_SHADOW = '0 2px 10px rgba(29, 29, 27, 0.07), 0 1px 2px rgba(29, 29, 27, 0.05)'
const COMPOSER_LINE_HEIGHT_PX = 20
const COMPOSER_PAD_X = 10
const COMPOSER_MAX_ROWS = 6
const SEND_BTN_SIZE = 40
const SEND_BTN_INSET = 6
/** Половина кнопки + отступ до края — скругление «капсулы» вокруг круглой кнопки */
const COMPOSER_SHELL_RADIUS = SEND_BTN_SIZE / 2 + SEND_BTN_INSET
/** Порог скролла от верха для подгрузки старых сообщений */
const LOAD_OLDER_SCROLL_TOP_PX = 120

type TelegramWebAppViewport = {
    viewportHeight?: number
    onEvent?: (event: string, handler: () => void) => void
    offEvent?: (event: string, handler: () => void) => void
}

/** Высота перекрытия снизу (клавиатура) — Telegram Mini App или Visual Viewport API */
function measureMobileKeyboardInset(): number {
    if (typeof window === 'undefined') return 0

    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebAppViewport } }).Telegram?.WebApp
    if (tg && typeof tg.viewportHeight === 'number' && tg.viewportHeight > 0) {
        return Math.max(0, Math.round(window.innerHeight - tg.viewportHeight))
    }

    const vv = window.visualViewport
    if (!vv) return 0
    return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
}

/** Расстояние от верха ленты сообщений до верха капсулы (по экрану, px) */
function measureGapListTopToComposerTop(
    listEl: HTMLDivElement,
    composerShellEl: HTMLDivElement
): number {
    const listTop = listEl.getBoundingClientRect().top
    const composerTop = composerShellEl.getBoundingClientRect().top
    return Math.round(composerTop - listTop)
}

type Props = {
    userId: number
    active: boolean
}

function ChatSendIcon({ fill }: { fill: string }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
                d="M17.5566 2.37158C18.8914 2.13417 20.0796 2.19138 20.9443 3.05615L21.0967 3.22217C21.8145 4.07009 21.8515 5.19257 21.6289 6.44385C21.3904 7.784 20.805 9.53374 20.0635 11.7583L18.3477 16.9077C17.747 18.7097 17.2816 20.1061 16.8535 21.1128C16.4682 22.0186 16.0465 22.7837 15.4346 23.2017L15.3096 23.2808C14.3 23.8676 13.0677 23.9045 12.0303 23.3911L11.8252 23.2808C11.1448 22.8852 10.6922 22.0788 10.2812 21.1128C9.85315 20.1062 9.38867 18.7095 8.78809 16.9077C8.58094 16.2863 8.51518 16.1099 8.42188 15.9702C8.31847 15.8157 8.18549 15.6819 8.03125 15.5786C7.89154 15.4852 7.71444 15.4196 7.09277 15.2124C5.29101 14.6118 3.89437 14.1473 2.8877 13.7192C1.92164 13.3084 1.11542 12.8555 0.719727 12.1753C0.0935791 11.0983 0.0937768 9.76801 0.719727 8.69092C1.11531 8.01046 1.9214 7.55796 2.8877 7.14697C3.8944 6.71883 5.29073 6.25351 7.09277 5.65283L12.2422 3.93701C14.4669 3.19544 16.2165 2.61003 17.5566 2.37158ZM17.3242 6.68408C17.033 6.38964 16.5582 6.38717 16.2637 6.67822L12.0527 10.8423C11.7583 11.1336 11.7557 11.6083 12.0469 11.9028C12.3381 12.197 12.813 12.1998 13.1074 11.9087L17.3184 7.74463C17.6125 7.45351 17.6149 6.97855 17.3242 6.68408Z"
                fill={fill}
            />
        </svg>
    )
}

function bubbleStyle(m: AdminPlayerMessage): {
    backgroundColor: string
    color: string
    border: string
    opacity?: number
} {
    if (m.status === 'error') {
        return {
            backgroundColor: '#FFEBEE',
            color: '#B71C1C',
            border: '1px solid #FFCDD2',
        }
    }
    if (m.status === 'sending') {
        return {
            backgroundColor: '#FFF9E6',
            color: '#1D1D1B',
            border: '1px solid #FFE082',
            opacity: 0.88,
        }
    }
    if (m.sender === 'customer') {
        return {
            backgroundColor: '#F5F5F3',
            color: '#1D1D1B',
            border: '1px solid #EBE8E0',
        }
    }
    if (m.sender === 'admin') {
        return {
            backgroundColor: '#FFF9E6',
            color: '#1D1D1B',
            border: '1px solid #FFE082',
        }
    }
    return {
        backgroundColor: '#E8F5E9',
        color: '#1B5E20',
        border: '1px solid #C8E6C9',
    }
}

function messageStatusHint(m: AdminPlayerMessage): string | null {
    if (m.status === 'sending') return 'Отправка…'
    if (m.status === 'error') return 'Не отправлено'
    return null
}

function isOutgoingSender(sender: AdminMessageSender): boolean {
    return sender === 'agent' || sender === 'admin'
}

export function AdminPlayerChatTab({ userId, active }: Props) {
    const [messages, setMessages] = useState<AdminPlayerMessage[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [loadErr, setLoadErr] = useState<string | null>(null)
    const [draft, setDraft] = useState('')
    const [composerTopFade, setComposerTopFade] = useState(false)
    const [composerExpanded, setComposerExpanded] = useState(false)
    const [sending, setSending] = useState(false)

    const listRef = useRef<HTMLDivElement>(null)
    const composerOverlayRef = useRef<HTMLDivElement>(null)
    const composerShellRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [listBottomPad, setListBottomPad] = useState(COMPOSER_OVERLAY_PAD_FALLBACK_PX)
    const [keyboardInset, setKeyboardInset] = useState(0)
    const stickToBottomRef = useRef(true)
    const prependScrollHeightRef = useRef<number | null>(null)
    const loadOlderInFlightRef = useRef(false)
    const keyboardInsetRef = useRef(0)
    /** scrollTop и зазор до капсулы в момент фокуса — сдвиг ленты = на сколько зазор уменьшился */
    const keyboardScrollPreserveRef = useRef<{
        scrollTop: number
        gapToComposer: number
        atBottom: boolean
    } | null>(null)
    const keyboardInsetPrevRef = useRef(0)
    const composerFocusedRef = useRef(false)

    const isListAtBottom = useCallback((el: HTMLDivElement, threshold = 8) => {
        return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
    }, [])

    const applyKeyboardScroll = useCallback(() => {
        const listEl = listRef.current
        const shellEl = composerShellRef.current
        if (!listEl || !shellEl) return

        const snap = keyboardScrollPreserveRef.current
        if (!snap && !composerFocusedRef.current && keyboardInsetRef.current === 0) return

        if (snap) {
            if (snap.atBottom) {
                listEl.scrollTop = listEl.scrollHeight - listEl.clientHeight
            } else {
                const gap = measureGapListTopToComposerTop(listEl, shellEl)
                const gapShrink = snap.gapToComposer - gap
                listEl.scrollTop = Math.max(0, snap.scrollTop + gapShrink)
            }
            return
        }

        if (isListAtBottom(listEl)) {
            listEl.scrollTop = listEl.scrollHeight - listEl.clientHeight
        }
    }, [isListAtBottom])

    const syncComposerScrollFade = useCallback(() => {
        const el = textareaRef.current
        if (!el) return
        setComposerTopFade(el.scrollTop > 2)
    }, [])

    const adjustComposerHeight = useCallback(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = '0px'
        const minH = COMPOSER_LINE_HEIGHT_PX
        const maxH = COMPOSER_LINE_HEIGHT_PX * COMPOSER_MAX_ROWS
        const scrollH = el.scrollHeight
        const next = Math.min(maxH, Math.max(minH, scrollH))
        el.style.height = `${next}px`
        el.style.overflowY = scrollH > maxH ? 'auto' : 'hidden'
        setComposerExpanded(next > minH + 1)
        if (scrollH > maxH) {
            el.scrollTop = el.scrollHeight
        }
        syncComposerScrollFade()
    }, [syncComposerScrollFade])

    useEffect(() => {
        adjustComposerHeight()
    }, [draft, adjustComposerHeight])

    useLayoutEffect(() => {
        const el = composerOverlayRef.current
        if (!el) return

        const syncPad = () => {
            setListBottomPad(el.offsetHeight)
        }

        syncPad()
        const ro = new ResizeObserver(syncPad)
        ro.observe(el)
        return () => ro.disconnect()
    }, [active, composerExpanded, draft])

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        const el = listRef.current
        if (!el) return
        el.scrollTo({ top: el.scrollHeight, behavior })
    }, [])

    const syncKeyboardLayout = useCallback(() => {
        const inset = measureMobileKeyboardInset()
        if (inset === keyboardInsetRef.current) return
        keyboardInsetRef.current = inset
        setKeyboardInset(inset)
    }, [])

    useLayoutEffect(() => {
        if (!active) return

        const inset = keyboardInsetRef.current
        const prevInset = keyboardInsetPrevRef.current

        if (composerFocusedRef.current || inset > 0 || prevInset > 0) {
            applyKeyboardScroll()
        }

        if (prevInset > 0 && inset === 0) {
            const restoreAfterKeyboardClose = () => applyKeyboardScroll()
            requestAnimationFrame(restoreAfterKeyboardClose)
            window.setTimeout(restoreAfterKeyboardClose, 80)
            window.setTimeout(restoreAfterKeyboardClose, 200)
            window.setTimeout(() => {
                keyboardScrollPreserveRef.current = null
            }, 280)
        }
        keyboardInsetPrevRef.current = inset
    }, [keyboardInset, listBottomPad, active, applyKeyboardScroll])

    const handleComposerFocus = useCallback(() => {
        composerFocusedRef.current = true
        const listEl = listRef.current
        const shellEl = composerShellRef.current
        if (listEl && shellEl) {
            const atBottom = isListAtBottom(listEl)
            keyboardScrollPreserveRef.current = {
                scrollTop: listEl.scrollTop,
                gapToComposer: measureGapListTopToComposerTop(listEl, shellEl),
                atBottom,
            }
            stickToBottomRef.current = atBottom
        }
        syncKeyboardLayout()
        requestAnimationFrame(() => {
            syncKeyboardLayout()
            applyKeyboardScroll()
        })
        window.setTimeout(() => {
            syncKeyboardLayout()
            applyKeyboardScroll()
        }, 60)
        window.setTimeout(() => {
            syncKeyboardLayout()
            applyKeyboardScroll()
        }, 180)
        window.setTimeout(() => {
            syncKeyboardLayout()
            applyKeyboardScroll()
        }, 320)
    }, [syncKeyboardLayout, isListAtBottom, applyKeyboardScroll])

    const handleComposerBlur = useCallback(() => {
        composerFocusedRef.current = false
        if (!keyboardScrollPreserveRef.current) return

        const restoreAfterBlur = () => {
            syncKeyboardLayout()
            applyKeyboardScroll()
        }
        requestAnimationFrame(restoreAfterBlur)
        window.setTimeout(restoreAfterBlur, 80)
        window.setTimeout(restoreAfterBlur, 200)
    }, [syncKeyboardLayout, applyKeyboardScroll])

    useEffect(() => {
        if (!active) {
            keyboardInsetRef.current = 0
            keyboardInsetPrevRef.current = 0
            keyboardScrollPreserveRef.current = null
            setKeyboardInset(0)
            return
        }

        const onViewportChange = () => {
            syncKeyboardLayout()
            requestAnimationFrame(() => {
                syncKeyboardLayout()
                applyKeyboardScroll()
            })
        }

        const vv = window.visualViewport
        vv?.addEventListener('resize', onViewportChange)
        vv?.addEventListener('scroll', onViewportChange)

        const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebAppViewport } }).Telegram
            ?.WebApp
        tg?.onEvent?.('viewportChanged', onViewportChange)

        onViewportChange()

        return () => {
            vv?.removeEventListener('resize', onViewportChange)
            vv?.removeEventListener('scroll', onViewportChange)
            tg?.offEvent?.('viewportChanged', onViewportChange)
            keyboardInsetRef.current = 0
            keyboardInsetPrevRef.current = 0
            keyboardScrollPreserveRef.current = null
            setKeyboardInset(0)
        }
    }, [active, syncKeyboardLayout, applyKeyboardScroll])

    const fetchMessagesPage = useCallback(
        async (params: URLSearchParams) => {
            const res = await adminFetch(`/api/admin/players/${userId}/messages?${params}`)
            const j = (await res.json().catch(() => ({}))) as AdminPlayerMessagesResponse & {
                error?: string
            }
            if (!res.ok) {
                throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            }
            return j
        },
        [userId]
    )

    const loadMessages = useCallback(async () => {
        setLoading(true)
        setLoadErr(null)
        setHasMore(false)
        prependScrollHeightRef.current = null
        try {
            const params = new URLSearchParams({
                limit: String(ADMIN_CHAT_MESSAGES_INITIAL),
            })
            const j = await fetchMessagesPage(params)
            setMessages((j.messages ?? []).filter((m) => m.status !== 'draft'))
            setHasMore(Boolean(j.has_more))
            stickToBottomRef.current = true
        } catch (e) {
            setLoadErr(e instanceof Error ? e.message : 'Не удалось загрузить сообщения')
        } finally {
            setLoading(false)
        }
    }, [fetchMessagesPage])

    const loadOlderMessages = useCallback(async () => {
        if (loadOlderInFlightRef.current || !hasMore || loading || loadingOlder) return

        const oldest = messages[0]
        if (!oldest) return

        const listEl = listRef.current
        if (listEl) {
            prependScrollHeightRef.current = listEl.scrollHeight
        }

        loadOlderInFlightRef.current = true
        setLoadingOlder(true)
        try {
            const params = new URLSearchParams({
                limit: String(ADMIN_CHAT_MESSAGES_OLDER_PAGE),
                before_created_at: oldest.created_at,
                before_id: oldest.id,
            })
            const j = await fetchMessagesPage(params)
            const incoming = j.messages ?? []
            if (incoming.length > 0) {
                setMessages((prev) => mergeAdminPlayerMessages(prev, incoming))
            }
            setHasMore(Boolean(j.has_more))
        } catch {
            // Тихо: пользователь может прокрутить снова
        } finally {
            setLoadingOlder(false)
            loadOlderInFlightRef.current = false
        }
    }, [fetchMessagesPage, hasMore, loading, loadingOlder, messages])

    useEffect(() => {
        if (!active) return
        setMessages([])
        setHasMore(false)
        void loadMessages()
    }, [active, userId, loadMessages])

    useLayoutEffect(() => {
        if (prependScrollHeightRef.current == null) return
        const el = listRef.current
        if (!el) {
            prependScrollHeightRef.current = null
            return
        }
        const delta = el.scrollHeight - prependScrollHeightRef.current
        if (delta > 0) {
            el.scrollTop += delta
        }
        prependScrollHeightRef.current = null
    }, [messages])

    useEffect(() => {
        if (!active || !stickToBottomRef.current) return
        if (prependScrollHeightRef.current != null) return
        scrollToBottom(messages.length <= 3 ? 'auto' : 'smooth')
    }, [messages, active, scrollToBottom])

    useEffect(() => {
        if (!active) return

        const supabase = createClient()
        const channelName = `admin_player_messages_${userId}_${Date.now()}`

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'clubtac_messages',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const parsed = parseAdminPlayerMessageRow(payload.new as Record<string, unknown>)
                    if (!parsed || parsed.status === 'draft') return
                    setMessages((prev) => mergeAdminPlayerMessages(prev, [parsed]))
                    stickToBottomRef.current = true
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'clubtac_messages',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const parsed = parseAdminPlayerMessageRow(payload.new as Record<string, unknown>)
                    if (!parsed) return
                    setMessages((prev) => mergeAdminPlayerMessages(prev, [parsed]))
                }
            )
            .subscribe()

        return () => {
            void supabase.removeChannel(channel)
        }
    }, [active, userId])

    const handleListScroll = () => {
        const el = listRef.current
        if (!el) return
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        stickToBottomRef.current = distanceFromBottom < 80

        if (
            el.scrollTop < LOAD_OLDER_SCROLL_TOP_PX &&
            hasMore &&
            !loading &&
            !loadingOlder &&
            messages.length > 0
        ) {
            void loadOlderMessages()
        }
    }

    const handleSend = () => {
        const text = draft.trim()
        if (!text || sending) return

        const optimisticId = createOptimisticAdminMessageId()
        const optimisticMsg: AdminPlayerMessage = {
            id: optimisticId,
            user_id: userId,
            message: text,
            created_at: new Date().toISOString(),
            sender: 'admin',
            status: 'sending',
        }

        setDraft('')
            setMessages((prev) => mergeAdminPlayerMessages(prev, [optimisticMsg]))
        stickToBottomRef.current = true
        requestAnimationFrame(() => scrollToBottom('auto'))
        setSending(true)

        void (async () => {
            try {
                const res = await adminFetch(`/api/admin/players/${userId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text }),
                })
                const j = (await res.json().catch(() => ({}))) as AdminPlayerMessageSendResponse & {
                    error?: string
                }
                if (!res.ok) {
                    setMessages((prev) => {
                        const rest = prev.filter((m) => m.id !== optimisticId)
                        const failed =
                            j.message ??
                            ({
                                ...optimisticMsg,
                                status: 'error' as const,
                            } satisfies AdminPlayerMessage)
                        return mergeAdminPlayerMessages(rest, [failed])
                    })
                    return
                }
                setMessages((prev) => {
                    const rest = prev.filter((m) => m.id !== optimisticId)
                    return j.message ? mergeAdminPlayerMessages(rest, [j.message]) : rest
                })
            } catch {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === optimisticId ? { ...m, status: 'error' as const } : m
                    )
                )
            } finally {
                setSending(false)
            }
        })()
    }

    const messageItems = useMemo(() => {
        let lastDayKey = ''
        return messages.map((m) => {
            const dayKey = dayKeyFromIso(m.created_at)
            const showDay = dayKey !== lastDayKey
            if (showDay) lastDayKey = dayKey

            const outgoing = isOutgoingSender(m.sender)
            const bubble = bubbleStyle(m)
            const statusHint = messageStatusHint(m)

            return (
                <div key={m.id}>
                    {showDay ? (
                        <div
                            style={{
                                textAlign: 'center',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#9E9E9C',
                                margin: '4px 0 10px',
                            }}
                        >
                            {formatAdminMessageDayLabel(m.created_at)}
                        </div>
                    ) : null}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: outgoing ? 'flex-end' : 'flex-start',
                            maxWidth: '88%',
                            marginLeft: outgoing ? 'auto' : 0,
                            marginRight: outgoing ? 0 : 'auto',
                        }}
                    >
                        <div
                            style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#9E9E9C',
                                marginBottom: '3px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                            }}
                        >
                            {adminMessageSenderLabel(m.sender)}
                        </div>
                        <div
                            style={{
                                padding: '9px 12px',
                                borderRadius: outgoing ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                fontSize: '14px',
                                lineHeight: 1.45,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                ...bubble,
                            }}
                        >
                            {m.message || '—'}
                        </div>
                        <div
                            style={{
                                fontSize: '10px',
                                color: m.status === 'error' ? '#C62828' : '#9E9E9C',
                                marginTop: '3px',
                                textAlign: outgoing ? 'right' : 'left',
                            }}
                        >
                            {statusHint ? (
                                <span style={{ fontWeight: 600 }}>{statusHint}</span>
                            ) : null}
                            {statusHint ? ' · ' : null}
                            {formatAdminMessageTime(m.created_at)}
                        </div>
                    </div>
                </div>
            )
        })
    }, [messages])

    return (
        <div
            style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <div
                ref={listRef}
                onScroll={handleListScroll}
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    padding: '12px 12px 8px',
                    paddingBottom: `${listBottomPad + 8 + keyboardInset}px`,
                    backgroundColor: CHAT_BG,
                }}
            >
                {loading && messages.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '13px', color: '#6B6B69' }}>Загрузка сообщений…</p>
                ) : null}

                {loadErr ? (
                    <div style={{ marginBottom: '12px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#B71C1C' }}>{loadErr}</p>
                        <button
                            type="button"
                            onClick={() => void loadMessages()}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #1D1D1B',
                                background: '#fff',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '13px',
                            }}
                        >
                            Повторить
                        </button>
                    </div>
                ) : null}

                {!loading && !loadErr && messages.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '13px', color: '#6B6B69', lineHeight: 1.45 }}>
                        Сообщений пока нет. Переписка с агентом появится здесь, когда пользователь напишет боту.
                    </p>
                ) : null}

                {loadingOlder ? (
                    <p
                        style={{
                            margin: '0 0 10px',
                            textAlign: 'center',
                            fontSize: '12px',
                            color: '#9E9E9C',
                        }}
                    >
                        Загрузка ранних сообщений…
                    </p>
                ) : null}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{messageItems}</div>
            </div>

            <div
                ref={composerOverlayRef}
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: keyboardInset,
                    padding:
                        keyboardInset > 0
                            ? '10px'
                            : '10px 10px calc(10px + env(safe-area-inset-bottom, 0px))',
                    pointerEvents: 'none',
                }}
            >
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: `${COMPOSER_LIST_FADE_PX}px`,
                        zIndex: 0,
                        background: `linear-gradient(180deg, rgba(${CHAT_BG_RGB}, 0) 0%, rgba(${CHAT_BG_RGB}, 1) 100%)`,
                        pointerEvents: 'none',
                    }}
                />
                <div
                    ref={composerShellRef}
                    style={{
                        position: 'relative',
                        zIndex: 1,
                        pointerEvents: 'auto',
                        border: '1px solid #EBE8E0',
                        borderRadius: `${COMPOSER_SHELL_RADIUS}px`,
                        backgroundColor: COMPOSER_FIELD_BG,
                        boxShadow: COMPOSER_SHELL_SHADOW,
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: composerExpanded ? 'flex-end' : 'center',
                            gap: '6px',
                            padding: `${SEND_BTN_INSET}px`,
                        }}
                    >
                        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                            {composerTopFade ? (
                                <div
                                    aria-hidden
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: '24px',
                                        background: `linear-gradient(180deg, ${COMPOSER_FIELD_BG} 0%, rgba(255, 255, 255, 0) 100%)`,
                                        pointerEvents: 'none',
                                        zIndex: 1,
                                    }}
                                />
                            ) : null}
                            <textarea
                                ref={textareaRef}
                                value={draft}
                                rows={1}
                                onChange={(e) => setDraft(e.target.value)}
                                onFocus={handleComposerFocus}
                                onBlur={handleComposerBlur}
                                onScroll={syncComposerScrollFade}
                                placeholder="Сообщение…"
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    border: 'none',
                                    resize: 'none',
                                    outline: 'none',
                                    margin: 0,
                                    padding: `0 ${COMPOSER_PAD_X}px`,
                                    fontSize: '14px',
                                    lineHeight: `${COMPOSER_LINE_HEIGHT_PX}px`,
                                    fontFamily: 'inherit',
                                    backgroundColor: 'transparent',
                                    overflowY: 'hidden',
                                }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={!draft.trim() || sending}
                            title="Отправить"
                            aria-label="Отправить"
                            style={{
                                flexShrink: 0,
                                width: `${SEND_BTN_SIZE}px`,
                                height: `${SEND_BTN_SIZE}px`,
                                borderRadius: '50%',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor:
                                    draft.trim() && !sending ? '#FFDF00' : '#EBE8E0',
                                cursor: draft.trim() && !sending ? 'pointer' : 'not-allowed',
                            }}
                        >
                            <ChatSendIcon
                                fill={draft.trim() && !sending ? '#1D1D1B' : '#9E9E9C'}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
