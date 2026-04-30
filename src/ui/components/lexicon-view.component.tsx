import { cn } from '@/lib/utils';
import type { LexiconEntry } from '@/prompts/landscape/landscape.schema';

// Renders the subject-wide lexicon as three flat sections directly as JSX —
// no markdown round-trip. Null-kind entries (drift fallback in
// lexiconEntrySchema) bucket under Terms & concepts so they survive instead
// of disappearing.
export function LexiconView({ entries, className }: { entries: LexiconEntry[]; className?: string }) {
  if (entries.length === 0) return null;

  const abbreviations = entries.filter((e) => e.kind === 'abbreviation');
  const terms = entries.filter((e) => e.kind === 'term' || e.kind === null);
  const entities = entries.filter((e) => e.kind === 'entity');

  return (
    <div className={cn('flex flex-col gap-6 text-sm', className)}>
      {abbreviations.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Abbreviations</h4>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1 pr-3 font-normal">Abbrev</th>
                <th className="py-1 pr-3 font-normal">Expansion</th>
                <th className="py-1 font-normal">One-line meaning</th>
              </tr>
            </thead>
            <tbody>
              {abbreviations.map((e) => (
                <tr key={e.label} className="border-b border-border/50 align-top">
                  <td className="py-1.5 pr-3 font-mono text-xs">{e.label}</td>
                  <td className="py-1.5 pr-3">{e.expansion ?? ''}</td>
                  <td className="py-1.5">{e.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {terms.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Terms &amp; concepts</h4>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1 pr-3 font-normal">Term</th>
                <th className="py-1 font-normal">One-line meaning</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((e) => (
                <tr key={e.label} className="border-b border-border/50 align-top">
                  <td className="py-1.5 pr-3">{e.label}</td>
                  <td className="py-1.5">{e.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {entities.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Entities (companies, institutions, tools, policies)</h4>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1 pr-3 font-normal">Name</th>
                <th className="py-1 font-normal">What it is / what it does</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.label} className="border-b border-border/50 align-top">
                  <td className="py-1.5 pr-3">{e.label}</td>
                  <td className="py-1.5">{e.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
