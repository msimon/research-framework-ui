# Citation [N] click — flash-highlight target source

## Problem

Clicking `[1]` scrolls to the matching source list item via the `#source-N` anchor (or `#turn-K-source-N` for deep-research turns). The scroll lands the user on the source, but they have to visually re-find which row in the list is the target. For dense source lists (10+ entries) this is annoying.

## Fix

When the user clicks a `[N]` bracket:
1. Scroll to `#source-N` (current behavior — `scroll-mt-16` already gives header offset).
2. **Briefly flash the target `<li>`** with a primary-tinted background, fading in then out over ~3 seconds.

## Implementation sketch

The bracket anchors are server-baked plain `<a href="#...">` elements, so this needs to be hooked client-side. Two angles:

### A. Hash-change listener on the markdown page

Listen for `hashchange` (or intercept clicks within the rendered markdown), find the element with the matching `id`, and toggle a transient CSS class.

```tsx
// src/ui/components/markdown.tsx (or a child component)
useEffect(() => {
  function onHashChange() {
    if (!location.hash.startsWith('#source-') && !location.hash.startsWith('#turn-')) return;
    const el = document.getElementById(location.hash.slice(1));
    if (!el) return;
    el.classList.add('citation-flash');
    setTimeout(() => el.classList.remove('citation-flash'), 3000);
  }
  window.addEventListener('hashchange', onHashChange);
  return () => window.removeEventListener('hashchange', onHashChange);
}, []);
```

Add the keyframe in `globals.css`:
```css
.citation-flash {
  animation: citation-flash 3s ease-in-out;
}
@keyframes citation-flash {
  0%, 100% { background-color: transparent; }
  10%, 70% { background-color: var(--primary); opacity: 0.15; }
}
```

### B. Custom anchor click handler

Hijack the bracket anchor click in markdown's `components.a` override. Better control (works even if the user re-clicks the same bracket while still on hash), but more code.

## Recommendation

**A**. Smaller surface, works for any anchor including direct URL pastes. Hash-change fires on every navigation including the same hash if the user clicks twice and the browser dispatches a fresh event — works for the re-click case in modern browsers.

## Out of scope here

- URL preview tooltip on hover (separate TODO: `citation-hover-url-tooltip.md`)
- Trust score / weight (separate TODO: `source-trust-score-and-weight.md`)
