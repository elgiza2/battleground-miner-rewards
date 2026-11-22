import type { ReactNode } from "react";
import { DotText } from "./DotText";

export function Masthead({ lead, dots, line2, intro, right }: { lead: string; dots: string; line2?: string; intro?: ReactNode; right?: ReactNode }) {
  return (
    <header className="entrance mb-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="headline">
          <span className="headline__line">
            {lead}
            <span className="dot-word" aria-label={dots}>
              <DotText text={dots} />
            </span>
          </span>
          {line2 && <span className="headline__line">{line2}</span>}
        </h1>
        {right}
      </div>
      {intro && <p className="intro">{intro}</p>}
    </header>
  );
}

export function StateGate({ isLoading, error, children }: { isLoading: boolean; error: unknown; children: ReactNode }) {
  if (error)
    return (
      <div className="glass mx-auto mt-10 max-w-sm p-6 text-center">
        <p className="text-[15px] font-semibold text-ink">Can’t reach base</p>
        <p className="mt-1 text-[13px] text-copy">{(error as Error).message}</p>
      </div>
    );
  if (isLoading)
    return (
      <div className="mt-16 flex justify-center">
        <span className="dot-word pulse-dot" style={{ height: 22 }}>
          <DotText text="DROP" />
        </span>
      </div>
    );
  return <>{children}</>;
}
