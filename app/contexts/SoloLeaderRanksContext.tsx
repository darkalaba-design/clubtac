'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { medalPrefixForUserId, type SoloLeaderRank } from '@/lib/soloLeaderMedals'

type Ctx = {
    getMedalPrefix: (userId: number | null | undefined) => string
}

const SoloLeaderRanksContext = createContext<Ctx | null>(null)

export function SoloLeaderRanksProvider({ children }: { children: ReactNode }) {
    const [rankByUserId, setRankByUserId] = useState<Record<number, SoloLeaderRank>>({})

    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()
                // Как в HallOfFame: `*`, иначе часть полей с матчами может не прийти — фильтр обнулит список и медали пропадут везде
                const { data, error } = await supabase
                    .from('clubtac_players_hall_of_fame_v3')
                    .select('*')
                    .order('place', { ascending: true })

                if (error || !data?.length) {
                    setRankByUserId({})
                    return
                }

                const filtered = (data as any[]).filter((player: any) => {
                    const gamesPlayed =
                        player.games_played ?? player.games ?? player.total_games
                    return gamesPlayed && Number(gamesPlayed) > 0
                })

                const map: Record<number, SoloLeaderRank> = {}
                for (const row of filtered) {
                    const pl = Number(row.place)
                    if (pl !== 1 && pl !== 2 && pl !== 3) continue
                    const uid = Number(row.user_id)
                    if (!Number.isFinite(uid) || uid <= 0) continue
                    map[uid] = pl as SoloLeaderRank
                }
                setRankByUserId(map)
            } catch {
                setRankByUserId({})
            }
        }
        load()
    }, [])

    const getMedalPrefix = useCallback(
        (userId: number | null | undefined) => medalPrefixForUserId(rankByUserId, userId),
        [rankByUserId]
    )

    return (
        <SoloLeaderRanksContext.Provider value={{ getMedalPrefix }}>{children}</SoloLeaderRanksContext.Provider>
    )
}

export function useSoloLeaderMedalPrefix(): (userId: number | null | undefined) => string {
    const ctx = useContext(SoloLeaderRanksContext)
    return ctx?.getMedalPrefix ?? (() => '')
}
