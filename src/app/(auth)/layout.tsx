// Route group layout for unauthenticated pages (login, etc.)
// Inherits the root layout (fonts, metadata) without the admin auth check.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
