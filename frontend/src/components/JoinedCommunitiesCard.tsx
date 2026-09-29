import PawIcon from "./PawIcon";

export interface JoinedCommunity {
  id: string;
  name: string;
  description: string;
  member_count: number;
}

export default function JoinedCommunitiesCard({
  communities = [],
}: {
  communities?: JoinedCommunity[];
}) {
  return (
    <aside
      aria-labelledby="joined-communities-heading"
      className="self-start overflow-hidden rounded-card border border-border bg-card shadow-sm lg:sticky lg:top-20"
    >
      <div aria-hidden="true" className="h-1 bg-accent" />
      <div className="p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm">
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <div>
            <h2
              id="joined-communities-heading"
              className="font-serif text-base font-bold text-primary"
            >
              Joined Communities
            </h2>
            <p className="text-xs text-muted-foreground">
              Your spaces around campus
            </p>
          </div>
        </div>

        {communities.length ? (
          <ul className="space-y-3">
            {communities.map((community) => (
              <li
                key={community.id}
                className="flex gap-3 rounded-card border border-border bg-secondary p-3"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-primary text-white"
                >
                  <PawIcon size={19} />
                </span>
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-bold text-primary">
                    {community.name}
                  </h3>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {community.description}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {community.member_count.toLocaleString()} members
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-card border border-dashed border-border bg-secondary px-4 py-6 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-accent bg-card text-accent">
              <PawIcon size={19} />
            </span>
            <p className="mt-3 text-sm font-semibold text-primary">
              No joined communities yet
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Communities you join will appear here.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
