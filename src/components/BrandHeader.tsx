import type { ReactNode } from "react";

interface BrandHeaderProps {
  pageTitle: string;
  actions?: ReactNode;
}

export default function BrandHeader({ pageTitle, actions }: BrandHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex shrink-0 items-center gap-3">
          <svg
            aria-label="CunStone Logo"
            className="h-10 w-10 shrink-0 text-slate-950"
            role="img"
            viewBox="0 0 40 40"
          >
            <rect fill="currentColor" height="36" rx="7" width="36" x="2" y="2" />
            <rect
              fill="none"
              height="27"
              rx="4"
              stroke="white"
              strokeOpacity="0.24"
              strokeWidth="0.8"
              width="27"
              x="6.5"
              y="6.5"
            />
            <path
              d="M27.5 12.2C26.1 10.9 24.1 10.2 22 10.4C17.8 10.7 14.4 14.3 14.7 18.5C15 22.7 18.6 26.1 22.8 25.8C24.8 25.7 26.5 24.7 27.7 23.2"
              fill="none"
              stroke="white"
              strokeLinecap="round"
              strokeWidth="2.4"
            />
            <path
              d="M7.5 30.5H14M26 9.5H32.5"
              fill="none"
              stroke="white"
              strokeLinecap="round"
              strokeOpacity="0.58"
              strokeWidth="1.2"
            />
            <circle cx="31" cy="31" fill="white" r="1.15" />
          </svg>
          <span className="font-serif text-[25px] font-semibold tracking-[0.16em] text-slate-950">
            CUNSTONE
          </span>
        </div>
        <span aria-hidden="true" className="hidden h-8 w-px bg-slate-300 sm:block" />
        <h1 className="truncate text-lg font-semibold tracking-[0.04em] text-slate-800">
          {pageTitle}
        </h1>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
