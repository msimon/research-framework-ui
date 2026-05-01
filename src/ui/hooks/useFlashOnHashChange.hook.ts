'use client';

import { useEffect } from 'react';

const SOURCE_HASH_RE = /^#(?:turn-\d+-)?source-\d+$/;

// Briefly flashes the citation source row that the URL hash points to.
// Triggered when the user clicks an inline `[N]` bracket — restarts the
// animation on every click (including re-clicks of the same hash) so dense
// source lists are easy to spot after the scroll lands.
export function useFlashOnHashChange() {
  useEffect(() => {
    function flash(hash: string) {
      if (!SOURCE_HASH_RE.test(hash)) return;
      const el = document.getElementById(hash.slice(1));
      if (!el) return;
      el.classList.remove('citation-flash');
      void el.offsetWidth;
      el.classList.add('citation-flash');
    }

    function onHashChange() {
      flash(window.location.hash);
    }

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!SOURCE_HASH_RE.test(href)) return;
      // Browser updates the hash and scrolls before this microtask runs.
      queueMicrotask(() => flash(href));
    }

    flash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      document.removeEventListener('click', onClick);
    };
  }, []);
}
