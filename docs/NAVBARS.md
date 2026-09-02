# The homepage navbars — one live, four parked

**Live: none of the components.** The homepage carries a plain line at the top —
a hairline edge to edge with the mark and the routes sitting on it, written
directly in `src/App.jsx` as `.home-line` and styled in `src/App.css`. It is a
header and a border, not a component, so there is nothing to import.

Four finished navbars are switched off, not deleted. All are whole and working,
and **none of them has an importer, so anything sweeping for unused files will
offer to delete them.** That is now four components being kept on the strength
of this file alone — worth deleting the ones that have been ruled out rather
than carrying all of them indefinitely.

| | Files | What it is |
|---|---|---|
| **Pill row** | `GooeyNavbar.{jsx,css}` | Separate glass pills that grow a waist to their neighbours on hover. Neutral white now; the five-colour field is in the history. |
| **Curtain menu** | `LayerNav.{jsx,css}` | An icon that sends four coloured bands down from the top edge, the menu read on the last one. Draws its own bar, including a wordmark and an account control. |
| **Morphed menu** | `MorphedMenu.{jsx,css}` | A glass pill that springs out into a card — the button *is* the panel. Links flip up on a perspective. |
| **Drop-down** | `DropMenu.{jsx,css}` | Three lines that turn into a cross, opening a framed panel: names on the left, a card on the right that swaps as you move down them, its line typing itself in. |

Putting any of them back is one import and one element in `src/App.jsx`, in
place of the `<header className="home-line">` block. Only the curtain menu
needs more than that, because it brings its own bar: see below.

Last commit where the curtain menu was live on the homepage: `613a23c`.

```
git show 613a23cow

**1. `src/App.jsx`** — import it, and restore the session read that decides the
third slot:

```jsx
import { useState } from 'react'
import GooeyNavbar from './components/GooeyNavbar.jsx'
import { loadBetaSession } from './lib/yom-api.js'

const [signedIn] = useState(() => Boolean(loadBetaSession()?.access_token))
```

**2. `src/App.jsx`** — first child of `.hero`:

```jsx
<GooeyNavbar
  items={[
    { label: 'About', to: '/about' },
    { label: 'How it works', to: '/how-it-works' },
    // Signed in, the avatar in the corner is the account control, so the
    // third slot would only repeat it.
    ...(signedIn ? [] : [{ label: 'Sign in', to: '/signin' }]),
  ]}
/>
```

It also takes `activePath`, which marks the matching item with a dot. The
homepage passed nothing, because no item points at `/`.

**3. `src/main.jsx`** — this one expects the floating corner avatar, so take
`pathname === '/'` **out** of the list of paths `AccountCorner` returns `null`
for.

Its position lives in `.hero > .gooey-nav` in `src/App.css`, which is still
there. Its colours are scoped to `.gooey-nav` inside its own stylesheet, so
nothing has to be restored globally.

## Bringing back the curtain menu

**1. `src/App.jsx`** — `import LayerNav from './components/LayerNav.jsx'`, plus
the same `signedIn` read as above.

**2. `src/App.jsx`** — first child of `.hero`:

```jsx
<LayerNav
  items={[
    { label: 'About', to: '/about' },
    { label: 'How it works', to: '/how-it-works' },
    { label: 'Start a trip', to: '/onboarding' },
    signedIn
      ? { label: 'Your yom', to: '/me' }
      : { label: 'Sign in', to: '/signin' },
  ]}
  email="support@youryom.com"
/>
```

It also takes `socials={[{ label, href }]}`, which fills the right-hand column
of the open sheet. It was left empty because yom has no accounts to point at
yet — passing nothing hides the column rather than printing a heading over
nothing.

**3. `src/main.jsx`** — this one draws its own bar with the wordmark centred,
the toggle left and the avatar right, so `pathname === '/'` must **stay** in
`AccountCorner`'s null list or there are two avatars in one corner.

## The two are not interchangeable

They disagree about who owns the top of the page, which is why each has its own
note about `AccountCorner`:

|  | Pill row | Curtain menu |
|---|---|---|
| Small wordmark | none — the hero's own `yom` is the mark | yes, centred in its own fixed bar |
| Account avatar | the global `AccountCorner` | drawn inside its bar, corner suppressed |
| Items when signed in | third slot dropped, the avatar covers it | fourth slot becomes *Your yom* |
| Contact / socials | nowhere | `email` and `socials` props |
| Positioned by | `.hero > .gooey-nav` in `src/App.css` | `position: fixed` in its own CSS |

Both read `--ink`, `--paper` and `--lime` from `:root` in `src/App.css`, so a
palette change follows either without edits. The curtain's four band colours are
hardcoded in `LayerNav.jsx` (`LAYERS`) because they are the sun / moon / rising
/ venus set, not theme tokens. The pill row's colour field is one custom
property, `--gooey-nav-field` on `.gooey-nav`, shared by the drawn row and the
phone stack.
