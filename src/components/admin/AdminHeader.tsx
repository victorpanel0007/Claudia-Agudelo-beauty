'use client'

export default function AdminHeader({ userEmail }: { userEmail: string }) {
  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Bogota',
  })

  return (
    <header className="bg-white border-b border-beauty-primary/20 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-30">
      {/* Left: title — on mobile leave room for the hamburger button (ml-14) */}
      <div className="ml-14 lg:ml-0 min-w-0">
        <p className="text-[11px] text-beauty-text-muted capitalize truncate hidden sm:block">{today}</p>
        <h1 className="font-semibold text-beauty-text text-sm sm:text-base truncate">Panel Admin</h1>
      </div>

      {/* Right: avatar + email */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:block text-right">
          <p className="text-xs text-beauty-text-muted truncate max-w-[150px]">{userEmail}</p>
          <p className="text-[10px] text-beauty-borgona font-medium">Administrador</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-beauty-primary flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">{userEmail.charAt(0).toUpperCase()}</span>
        </div>
      </div>
    </header>
  )
}
