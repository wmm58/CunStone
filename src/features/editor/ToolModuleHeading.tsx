export type ToolModuleIcon =
  | "upload"
  | "background"
  | "shape"
  | "effect"
  | "brush"
  | "seal"
  | "crop"
  | "eraser";

interface ToolModuleHeadingProps {
  icon: ToolModuleIcon;
  title: string;
}

export default function ToolModuleHeading({
  icon,
  title,
}: ToolModuleHeadingProps) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span
        aria-label={`${title}图标`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-700"
        role="img"
      >
        <ToolIcon name={icon} />
      </span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    </div>
  );
}

function ToolIcon({ name }: { name: ToolModuleIcon }) {
  const paths: Record<ToolModuleIcon, React.ReactNode> = {
    upload: (
      <>
        <rect height="12" rx="1.5" width="14" x="5" y="7" />
        <path d="M12 3v8M9 6l3-3 3 3" />
      </>
    ),
    background: (
      <>
        <rect height="14" rx="1.5" width="14" x="3" y="5" />
        <path d="M3 10h14M8 5v14M13 5v14" opacity="0.5" />
        <path d="M15.5 15.5l3-3M16 13.5h3v3" />
      </>
    ),
    shape: (
      <>
        <rect height="11" rx="1" width="14" x="5" y="6" />
        <path d="M8 20h8M12 17v3M4 9v5M20 9v5" opacity="0.65" />
      </>
    ),
    effect: (
      <>
        <path d="M4 8h16M4 16h16" />
        <circle cx="9" cy="8" fill="currentColor" r="2" />
        <circle cx="15" cy="16" fill="currentColor" r="2" />
      </>
    ),
    brush: (
      <>
        <path d="M15.5 4.5l4 4L9 19H5v-4L15.5 4.5z" />
        <path d="M13 7l4 4" opacity="0.65" />
      </>
    ),
    seal: (
      <>
        <rect height="14" rx="2" width="14" x="5" y="5" />
        <path d="M9 15c2.5-5 3.5-5 6 0M9 9h6" />
      </>
    ),
    crop: (
      <>
        <path d="M6 3v15h15M3 6h15v15" />
        <path d="M10 10h4v4h-4z" opacity="0.6" />
      </>
    ),
    eraser: (
      <>
        <path d="M4 15l8-8 5 5-8 8H6l-2-2v-3z" />
        <path d="M10 9l5 5" opacity="0.6" />
      </>
    ),
  };
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}
