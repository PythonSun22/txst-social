"use client";

/** The three feed orderings each space offers (feeds: FR-61 through FR-65). There is no "Rising". */
export type SortOrder = "hot" | "new" | "top";

const orders: { value: SortOrder; label: string; icon: React.ReactNode }[] = [
  {
    value: "hot",
    label: "Hot",
    icon: <path d="M13.5 2c0 0-1 5-3 7-2-4-4-7-4-7S3 7 3 12a9 9 0 0018 0c0-5.5-4-9-7.5-10z" fill="currentColor" />,
  },
  {
    value: "new",
    label: "New",
    icon: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  },
  {
    value: "top",
    label: "Top",
    icon: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  },
];

/**
 * Hot / New / Top selector shown above a feed.
 *
 * @param value - The currently selected order.
 * @param onChange - Called with the order the user picked.
 */
export default function SortBar({ value, onChange }: { value: SortOrder; onChange: (order: SortOrder) => void }) {
  return (
    <div className="mb-3 flex items-center gap-1 rounded-card border border-border bg-card px-3 py-2" role="group" aria-label="Sort posts">
      {orders.map((order) => (
        <button
          key={order.value}
          type="button"
          onClick={() => onChange(order.value)}
          aria-pressed={value === order.value}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
            value === order.value ? "bg-[#f0e8dc] text-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {order.icon}
          </svg>
          {order.label}
        </button>
      ))}
    </div>
  );
}
