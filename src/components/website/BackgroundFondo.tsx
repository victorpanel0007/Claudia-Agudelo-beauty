'use client'

/**
 * Imagen de fondo fija con efecto cinematográfico de zoom lento.
 * Solo anima la imagen — nada más de la página se toca.
 * Respeta prefers-reduced-motion.
 */
export default function BackgroundFondo() {
  return (
    <>
      {/* Keyframe definido inline — no requiere modificar globals.css */}
      <style>{`
        @keyframes kenBurns {
          0%   { transform: scale(1)    translateY(0px); }
          50%  { transform: scale(1.06) translateY(-12px); }
          100% { transform: scale(1)    translateY(0px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bg-ken-burns { animation: none !important; }
        }
      `}</style>

      {/* Contenedor fijo — igual que antes */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 overflow-hidden"
      >
        {/* La imagen es una capa interna que se anima SIN afectar al contenedor */}
        <div
          className="bg-ken-burns absolute inset-0 will-change-transform"
          style={{
            backgroundImage:    "url('/fondo.png')",
            backgroundSize:     'cover',
            backgroundPosition: 'center',
            /* Escala inicial ligeramente mayor para evitar bordes vacíos al animar */
            transform:          'scale(1)',
            animation:          'kenBurns 28s ease-in-out infinite',
          }}
        />
      </div>
    </>
  )
}
