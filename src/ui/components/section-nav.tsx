'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type Section = { id: string; label: string };

export function SectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    );

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  }

  if (sections.length === 0) return null;

  return (
    <nav className="sticky top-0 z-10 -mx-6 flex gap-1 border-b bg-background/95 px-6 py-2 backdrop-blur">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => scrollTo(s.id)}
          className={cn(
            'relative cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors hover:text-foreground',
            active === s.id ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          {s.label}
          {active === s.id ? (
            <span className="absolute right-3 bottom-0 left-3 h-0.5 rounded-full bg-primary" />
          ) : null}
        </button>
      ))}
    </nav>
  );
}
