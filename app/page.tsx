'use client'

import { useState } from 'react'
import Tabs from './components/Tabs'
import HallOfFame from './components/HallOfFame'
import TeamsRanking from './components/TeamsRanking'
import GamesList from './components/GamesList'
import UserProfile from './components/UserProfile'

export default function HomePage() {
  const [tab, setTab] = useState<'players' | 'teams' | 'games' | 'profile'>('profile')

  return (
    <>
      <main style={{ padding: tab === 'profile' ? '0 0 100px 0' : '12px 0', paddingBottom: 100 }}>
        {tab === 'profile' && <UserProfile />}
        {tab === 'players' && <HallOfFame />}
        {tab === 'teams' && <TeamsRanking />}
        {tab === 'games' && <GamesList />}
      </main>
      <Tabs active={tab} onChange={setTab} />
    </>
  )
}