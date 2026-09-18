"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/",
    label: "Inicio",
    icon: (
      <path d="M3 11.5 12 4l9 7.5M5 10v9.5a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    ),
  },
  {
    href: "/movimientos",
    label: "Movimientos",
    icon: (
      <path d="M7 3h10a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1ZM8 8h8M8 12h8M8 16h5" />
    ),
  },
  {
    href: "/presupuesto",
    label: "Presupuesto",
    icon: <path d="M12 3a9 9 0 1 0 9 9h-9V3ZM15 3.5A9 9 0 0 1 20.5 9H15V3.5Z" />,
  },
  {
    href: "/cuentas",
    label: "Cuentas",
    icon: <path d="M3 6h18v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM3 10h18M7 15h4" />,
  },
  {
    href: "/configuracion",
    label: "Config",
    icon: (
      <>
        <line x1="4" y1="6" x2="20" y2="6" />
        <circle cx="9" cy="6" r="2" fill="var(--surface)" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <circle cx="15" cy="12" r="2" fill="var(--surface)" />
        <line x1="4" y1="18" x2="20" y2="18" />
        <circle cx="7" cy="18" r="2" fill="var(--surface)" />
      </>
    ),
  },
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href ? "active" : ""}
          aria-current={pathname === item.href ? "page" : undefined}
        >
          <Icon>{item.icon}</Icon>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="top-nav" aria-label="Navegación principal">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href ? "active" : ""}
          aria-current={pathname === item.href ? "page" : undefined}
        >
          <Icon>{item.icon}</Icon>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
