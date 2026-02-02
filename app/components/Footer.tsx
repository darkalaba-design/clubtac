export default function Footer() {
  return (
    <footer
      style={{
        padding: '16px 12px',
        marginBottom: '81px',
        backgroundColor: '#FFFEF7',
        borderTop: '1px solid #EBE8E0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
      }}
    >
      <a
        href="https://tak-game.ru/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
      >
        <img
          src="/takoff-logo.svg"
          alt="Настольная игра ТАК"
          style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
        />
      </a>
      <a
        href="https://derbushev.ru/about/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
      >
        <img
          src="/derbushev-logo.svg"
          alt="Антон Дербушев — Digital Designer"
          style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
        />
      </a>
    </footer>
  )
}
