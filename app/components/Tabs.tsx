type Tab = 'players' | 'teams'

export default function Tabs({
    active,
    onChange,
}: {
    active: Tab
    onChange: (tab: Tab) => void
}) {
    return (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button
                onClick={() => onChange('players')}
                style={{
                    fontWeight: active === 'players' ? 'bold' : 'normal',
                }}
            >
                🏆 Hall of Fame
            </button>

            <button
                onClick={() => onChange('teams')}
                style={{
                    fontWeight: active === 'teams' ? 'bold' : 'normal',
                }}
            >
                👥 Team Ranking
            </button>
        </div>
    )
}
