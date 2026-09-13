import { NavLink } from "react-router-dom"

const items = [
  {
    to: "/",
    label: "Home",
    path: "M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  },
  {
    to: "/log",
    label: "Log",
    path: "M5 4h14M5 10h14M5 16h9",
  },
  {
    to: "/trends",
    label: "Trends",
    path: "M4 15l5-6 4 4 7-9",
  },
  {
    to: "/family",
    label: "Family",
    path: "M3 20c0-3 2.7-5 6-5s6 2 6 5",
    extra: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M14 15.3c2.6.2 4.6 1.9 4.6 4.2" /></>,
  },
  {
    to: "/you",
    label: "You",
    path: "M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6",
    extra: <circle cx="12" cy="8" r="3.4" />,
  },
] as const

export function BottomNav() {
  return (
    <div className="flex shrink-0 gap-1 border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 pb-[18px] pt-2.5">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 rounded-[10px] py-1.5 text-[0.64rem] font-bold ${
              isActive ? "text-[color:var(--color-sage)]" : "text-[color:var(--color-ink-faint)]"
            }`
          }
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={item.path} />
            {"extra" in item ? item.extra : null}
          </svg>
          {item.label}
        </NavLink>
      ))}
    </div>
  )
}
