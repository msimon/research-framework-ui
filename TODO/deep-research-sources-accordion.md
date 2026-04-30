# Deep-research turn sources — collapsed accordion by default

## Problem

Each turn in a deep-research session has its own Sources section (`turn-block.component.tsx`), and they currently render expanded inline. After 3+ turns the page is dominated by lists of URLs and the user has to scroll past them to see the next turn's findings. The user wants:

- **Collapsed by default**, just a "Sources (N)" header.
- **Click the disclosure arrow** to expand that turn's source list.
- **Click a `[N]` bracket inside the turn's findings** to also expand the matching Sources section AND scroll to the cited row.

Landscape stays as-is — it has only one Sources section per page, and keeping it open is fine.

## Fix

### Wrap the Sources section in `<details>`

In `src/ui/views/deep-research/components/turn-block.component.tsx`, the existing `<section>` becomes a `<details>` (without `open`). Header inside `<summary>`:

```tsx
<details className="...">
  <summary className="cursor-pointer ...">
    Sources ({turnSources.length})
  </summary>
  <ul>...</ul>
</details>
```

The `<details>` element gets a stable `id` so it can be targeted programmatically — e.g. `id={`turn-${turn.turn_number}-sources`}`.

### Auto-open when a citation `[N]` is clicked

The bracket anchors in `findings_md` are server-baked plain `<a href="#turn-K-source-N">[N]</a>` (see `buildCitationOutput` with the `turn-${turn_number}-` prefix). Clicking them currently scrolls to the matching `<li>` — but if the parent `<details>` is closed, the scroll has nothing to land on (the list is hidden).

Hook `hashchange` in the session view (or in `turn-block.component.tsx`):

```tsx
useEffect(() => {
  function onHashChange() {
    const hash = location.hash;
    const match = hash.match(/^#turn-(\d+)-source-\d+$/);
    if (!match) return;
    const detailsId = `turn-${match[1]}-sources`;
    const details = document.getElementById(detailsId);
    if (details && !(details as HTMLDetailsElement).open) {
      (details as HTMLDetailsElement).open = true;
      // wait one frame for the content to be in the layout, then scroll
      requestAnimationFrame(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' });
      });
    }
  }
  onHashChange();  // handle the case where the page loads on a #turn-K-source-N URL
  window.addEventListener('hashchange', onHashChange);
  return () => window.removeEventListener('hashchange', onHashChange);
}, []);
```

The `requestAnimationFrame` matters because `<details>` only adds children to the layout flow when `open` flips. Without it, the scroll target has no offsetTop yet.

## Composition with the other citation TODOs

This composes cleanly with `citation-click-highlight-source.md` (the flash highlight). Order of effects after a `[N]` click:

1. Browser navigates to `#turn-K-source-N` → `hashchange` fires.
2. This handler opens the parent `<details>` if needed.
3. Scrolls into view.
4. The `citation-flash` handler from the other TODO toggles the background animation on the now-visible `<li>`.

Both handlers share the same `hashchange` event — order is determined by listener registration order, but they're independent so it doesn't matter.

## Out of scope here

- Landscape (single Sources section, stays auto-open)
- The flash highlight (separate TODO: `citation-click-highlight-source.md`)
- The hover URL tooltip (separate TODO: `citation-hover-url-tooltip.md`)
