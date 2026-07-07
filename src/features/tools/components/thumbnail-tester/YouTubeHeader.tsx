interface YouTubeHeaderProps {
  searchQuery?: string;
}

export function YouTubeHeader({ searchQuery }: YouTubeHeaderProps) {
  return (
    <div
      className="flex items-center h-[56px] px-4 shrink-0"
      style={{ backgroundColor: '#0f0f0f', borderBottom: '1px solid #272727' }}
    >
      {/* Left — Logo */}
      <div className="flex items-center gap-4 w-[200px] shrink-0">
        {/* Hamburger */}
        <div className="w-6 h-6 flex flex-col items-center justify-center gap-[5px] opacity-80">
          <span className="block w-[18px] h-[1.5px]" style={{ backgroundColor: '#f1f1f1' }} />
          <span className="block w-[18px] h-[1.5px]" style={{ backgroundColor: '#f1f1f1' }} />
          <span className="block w-[18px] h-[1.5px]" style={{ backgroundColor: '#f1f1f1' }} />
        </div>
        {/* YouTube Logo */}
        <div className="flex items-center gap-[2px]">
          <svg width="28" height="20" viewBox="0 0 90 65" fill="none">
            <rect width="90" height="65" rx="16" fill="#FF0000" />
            <path d="M36 18V47L62 32.5L36 18Z" fill="white" />
          </svg>
          <span
            className="text-[18px] tracking-[-0.5px]"
            style={{ color: '#f1f1f1', fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 600, letterSpacing: '-0.6px' }}
          >
            YouTube
          </span>
        </div>
      </div>

      {/* Center — Search Bar */}
      <div className="flex-1 flex items-center justify-center max-w-[640px] mx-auto">
        <div className="flex flex-1">
          <div
            className="flex-1 flex items-center h-[40px] px-4 rounded-l-full"
            style={{ backgroundColor: '#121212', border: '1px solid #303030', borderRight: 'none' }}
          >
            <span className="text-[16px]" style={{ color: searchQuery ? '#f1f1f1' : '#888888', fontFamily: 'Roboto, Arial, sans-serif' }}>
              {searchQuery || 'Search'}
            </span>
          </div>
          <div
            className="flex items-center justify-center w-[64px] h-[40px] rounded-r-full"
            style={{ backgroundColor: '#222222', border: '1px solid #303030' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#f1f1f1">
              <path d="M20.87 20.17l-5.59-5.59A6.96 6.96 0 0017 10c0-3.87-3.13-7-7-7s-7 3.13-7 7 3.13 7 7 7a6.96 6.96 0 004.58-1.72l5.59 5.59.7-.7zM4 10c0-3.31 2.69-6 6-6s6 2.69 6 6-2.69 6-6 6-6-2.69-6-6z" />
            </svg>
          </div>
        </div>
        {/* Mic */}
        <div
          className="flex items-center justify-center w-[40px] h-[40px] rounded-full ml-3"
          style={{ backgroundColor: '#222222' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#f1f1f1">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </div>
      </div>

      {/* Right — Action Icons */}
      <div className="flex items-center gap-2 w-[200px] justify-end shrink-0">
        {/* Create */}
        <div className="w-[40px] h-[40px] flex items-center justify-center rounded-full" style={{ cursor: 'default' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#f1f1f1">
            <path d="M14 13h-3v3H9v-3H6v-2h3V8h2v3h3v2zm3-6v12H3V7h14zm1-2H2v16h16V5zm4 2v12h-2V7h2zM6 19h10V9H6v10z" />
          </svg>
        </div>
        {/* Notifications */}
        <div className="w-[40px] h-[40px] flex items-center justify-center rounded-full" style={{ cursor: 'default' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#f1f1f1">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
          </svg>
        </div>
        {/* Avatar */}
        <div
          className="w-[32px] h-[32px] rounded-full ml-1"
          style={{ backgroundColor: '#3a3a3a' }}
        />
      </div>
    </div>
  );
}
