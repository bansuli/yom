# The layered curtain menu — parked, and how to bring it back

The homepage runs the pill row (`GooeyNavbar`). The layered curtain menu
(`LayerNav`) is switched off, not deleted. Both components are whole and in the
repo; the only thing that changed is which one the homepage imports.

`src/components/LayerNav.jsx` and `src/components/LayerNav.css` have no importer
right now. **They are kept on purpose.** Anything that sweeps for unused files
will offer to delete them — don't.

Last commit where the curtain was live: `86bbd37`. To read it as it shipped:

```
git show 86bbd37c/App.jsx` — the import**

```js
import LayerNav from './components/LayerNav.jsx'   // instead of GooeyNavbar
```

**2. `src/App.jsx` — the nav block in `.hero`**

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

`LayerNav` also takes `socials={[{ label, href }]}`, which fills the right-hand
column of the open sheet. It was left empty because yom has no accounts to
point at yet — passing nothing hides the column rather than printing a heading
over nothing.

**3. `src/main.jsx` — the account corner**

`LayerNav` draws its own bar with the wordmark centred, the toggle left and the
avatar right, so the floating corner avatar has to stand down on the homepage or
there are two of them in the same corner. Put `/` back at the top of the list of
paths `AccountCorner` returns `null` for:

```js
if (
  // The homepage menu carries the account link, and its toggle sits in this
  // exact corner.
  pathname === '/' ||
  pathname === '/signin' ||
  ...
```

## What differs between the two, so the swap isn't a surprise

|  | `GooeyNavbar` (live) | `LayerNav` (parked) |
|---|---|---|
| Shape | pill row, always visible, top of the hero | icon → four bands drop from the top |
| Small wordmark | none — the hero's own `yom` is the mark | yes, centred in its own fixed bar |
| Account avatar | the global `AccountCorner` | drawn inside the bar, corner suppressed |
| Items when signed in | third slot dropped, the avatar covers it | fourth slot becomes *Your yom* |
| Contact / socials | nowhere | `email` and `socials` props |
| Positioned by | `.hero > .gooey-nav` in `src/App.css` | `position: fixed` in its own CSS |

Both read `--ink`, `--paper` and `--lime` from `:root` in `src/App.css`, so a
palette change follows either of them without edits. The curtain's four band
colours are hardcoded in `LayerNav.jsx` (`LAYERS`) because they are the sun /
moon / rising / venus set, not theme tokens.
