'use client'

import { useState } from 'react'
import Tabs from './components/Tabs'
import HallOfFame from './components/HallOfFame'
import TeamsRanking from './components/TeamsRanking'
import GamesList from './components/GamesList'
import UserProfile from './components/UserProfile'

export default function HomePage() {
  const [tab, setTab] = useState<'players' | 'teams' | 'games' | 'profile'>('players')

  return (
    <main style={{ padding: 12 }}>
      <Tabs active={tab} onChange={setTab} />

      {tab === 'players' && <HallOfFame />}
      {tab === 'teams' && <TeamsRanking />}
      {tab === 'games' && <GamesList />}
      {tab === 'profile' && <UserProfile />}
    </main>
  )
}