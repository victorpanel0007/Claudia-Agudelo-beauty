'use client'

export default function AdminHeader({ userEmail }: { userEmail: string }) {
  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Bogota',
  })

  return (
    <header className="bg-white border-b border-beauty-primary/20 px-4 sm:px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-30">
      <div className="ml-12 lg:ml-0">
        <p className="text-xs text-beauty-text-muted capitalize">{today}</p>
        <h1 className="font-semibold text-beauty-text text-sm sm:text-base">Panel Administrativo</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <p className="text-xs text-beauty-text-muted truncate max-w-[160px]">{userEmail}</p>
          <p className="text-[10px] text-beauty-borgona font-medium">Administrador</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-beauty-primary flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">{userEmail.charAt(0).toUpperCase()}</span>
        </div>
      </div>
    </header>
  )
}
