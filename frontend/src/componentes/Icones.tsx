// Ícones no traço dos SF Symbols da Apple: linha fina e pontas arredondadas.
type Props = { className?: string }

function Icone({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

// sidebar.left
export function IconeLateral({ className }: Props) {
  return (
    <Icone className={className}>
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <path d="M9.5 4.5v15M5.75 8h1.5M5.75 10.75h1.5" />
    </Icone>
  )
}

// sidebar.right
export function IconePainel({ className }: Props) {
  return (
    <Icone className={className}>
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <path d="M14.5 4.5v15M16.75 8h1.5M16.75 10.75h1.5" />
    </Icone>
  )
}

// square.and.pencil
export function IconeNovo({ className }: Props) {
  return (
    <Icone className={className}>
      <path d="M11 4.5H7a3 3 0 0 0-3 3V17a3 3 0 0 0 3 3h9.5a3 3 0 0 0 3-3v-4" />
      <path d="M17.6 3.9a1.9 1.9 0 0 1 2.7 2.7L12.5 14.4l-3.4.8.8-3.4z" />
    </Icone>
  )
}

// ellipsis
export function IconeReticencias({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  )
}

// xmark
export function IconeFechar({ className }: Props) {
  return (
    <Icone className={className}>
      <path d="M7 7l10 10M17 7L7 17" />
    </Icone>
  )
}

// exclamationmark.triangle
export function IconeAlerta({ className }: Props) {
  return (
    <Icone className={className}>
      <path d="M10.3 4.6a2 2 0 0 1 3.4 0l7 12.1a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3z" />
      <path d="M12 9.5v4" />
      <circle cx="12" cy="16.6" r="0.4" fill="currentColor" />
    </Icone>
  )
}

// paperclip
export function IconeClipe({ className }: Props) {
  return (
    <Icone className={className}>
      <path d="m20.5 11.5-8.2 8.2a5.3 5.3 0 0 1-7.5-7.5l8.2-8.2a3.5 3.5 0 0 1 5 5l-8.2 8.2a1.8 1.8 0 0 1-2.5-2.5l7.6-7.6" />
    </Icone>
  )
}

// mic
export function IconeMicrofone({ className }: Props) {
  return (
    <Icone className={className}>
      <rect x="9" y="3" width="6" height="11.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </Icone>
  )
}

// arrow.up (dentro do círculo azul de enviar)
export function IconeEnviar({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  )
}

// wand.and.stars
export function IconeVarinha({ className }: Props) {
  return (
    <Icone className={className}>
      <path d="m4 20 11-11M13.5 7.5l3 3" />
      <path d="M18 3v3M16.5 4.5h3M20 10v2M19 11h2M9 3.5v2M8 4.5h2" />
    </Icone>
  )
}

// doc.text
export function IconeDocumento({ className }: Props) {
  return (
    <Icone className={className}>
      <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z" />
      <path d="M14 3v5h5M8.5 13h7M8.5 16.5h5" />
    </Icone>
  )
}

// chevron.up.chevron.down (botão de menu do Mac)
export function IconeSetas({ className }: Props) {
  return (
    <Icone className={className}>
      <path d="m8 9.5 4-4 4 4M8 14.5l4 4 4-4" />
    </Icone>
  )
}

// plus
export function IconeMais({ className }: Props) {
  return (
    <Icone className={className}>
      <path d="M12 5v14M5 12h14" />
    </Icone>
  )
}

// chevron.left
export function IconeVoltar({ className }: Props) {
  return (
    <Icone className={className}>
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </Icone>
  )
}
