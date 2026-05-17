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
                const { data, error } = await supabase
                    .from('clubtac_elo_leaderboard')
                    .select('user_id, place')
                    .order('place', { ascending: true })

                if (error || !data?.length) {
                    setRankByUserId({})
                    return
                }

                const map: Record<number, SoloLeaderRank> = {}
                for (const row of data as { user_id: number; place: number }[]) {
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
