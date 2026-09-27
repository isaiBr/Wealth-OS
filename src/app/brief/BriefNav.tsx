"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/brief",
    label: "Hoy",
    icon: <path d="M12 3a9 9 0 1 0 9 9M12 8v4l3 2" />,
  },
  {
    href: "/brief/historial",
    label: "Historial",
    icon: <path d="M3 6h18v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM3 10h18M8 4v4M16 4v4" />,
  },
  {
    href: "/brief/config",
    label: "Config",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
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

function isActive(pathname: string, href: string) {
  return href === "/brief" ? pathname === "/brief" : pathname.startsWith(href);
}

export function BriefBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Navegación de Brief">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={isActive(pathname, item.href) ? "active" : ""}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
        >
          <Icon>{item.icon}</Icon>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function BriefTopNav() {
  const pathname = usePathname();
  return (
    <nav className="top-nav" aria-label="Navegación de Brief">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={isActive(pathname, item.href) ? "active" : ""}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
        >
          <Icon>{item.icon}</Icon>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
