'use client'

import { useState } from 'react'
import Tabs from './components/Tabs'
import HallOfFame from './components/HallOfFame'
import TeamsRanking from './components/TeamsRanking'
import GamesList from './components/GamesList'

export default function HomePage() {
  const [tab, setTab] = useState<'players' | 'teams' | 'games'>('players')

  return (
    <main style={{ padding: 12 }}>
      <h1>ClubTac Rating</h1>

      <Tabs active={tab} onChange={setTab} />

      {tab === 'players' && <HallOfFame />}
      {tab === 'teams' && <TeamsRanking />}
      {tab === 'games' && <GamesList />}
    </main>
  )
}