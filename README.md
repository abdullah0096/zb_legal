# ZB Legal Solutions — website

Static site (HTML + CSS + vanilla JS). No build step, no dependencies.
Open `index.html` directly, or serve locally:

    python3 -m http.server 8000

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home — hero, practice areas, why-us, stats, quote, reviews, insights, location, CTA |
| `about.html` | The advocate, team, courts & areas served, affiliations, gallery, Join Us |
| `services.html` | Six practice areas in detail — scope, documents to bring, timelines |
| `fees.html` | Fee models, indicative ranges, what's included, fee FAQ |
| `blog.html` | Insights listing with client-side category filtering |
| `contact.html` | Consultation form, office details, map, main FAQ |
| `thank-you.html` | Post-submission confirmation (`noindex`) |
| `404.html` | Custom not-found page (uses root-relative paths) |

`robots.txt` and `sitemap.xml` are included. Update the domain in both, plus the
`<link rel="canonical">` tag on each page, once the real domain is registered.

## Design system

All tokens live at the top of `assets/css/styles.css` under `:root` — colour,
type scale, 4px spacing scale, radii, shadows. Palette and typography are taken
from the office-opening brochure: ivory ground, antique gold (`#B08A33`), ink
black, Playfair Display over Inter.

## Motion system

`assets/css/motion.css` + `assets/js/motion.js`. The timings, easing curves and
intensity tiers are ported from the **ui-ux-pro-max-skill** motion rules
(`nextlevelbuilder/ui-ux-pro-max-skill` → `src/ui-ux-pro-max/data/motion.csv`),
translated from that file's GSAP snippets into dependency-free CSS + vanilla JS.
Row numbers in the source comments map back to that CSV.

| Effect | Tier | Duration | Easing (GSAP → cubic-bezier) |
|---|---|---|---|
| Button hover | subtle | 170ms | `power1.out` → `.25,.46,.45,.94` |
| Card hover (y −4, scale 1.015) | standard | 250ms | `power2.out` → `.22,.61,.36,1` |
| Magnetic CTA (pull ×0.3) | complex | 400ms | `back.out` → `.34,1.56,.64,1` |
| Scroll reveal fade (y 12) | subtle | 350ms | `power1.out` |
| Scroll reveal up (y 24, stagger 80ms) | standard | 520ms | `power2.out` |
| Grid wave (scale .92, stagger 60ms) | standard | 420ms | `back.out(1.4)` |
| Split-text headline (chars, stagger 15ms) | complex | 620ms | `expo.out` |
| Page wipe out / in | standard | 220 / 380ms | `power2.inOut` |
| Parallax layers | subtle | scroll-linked | linear |

Constraints taken straight from the skill's "Don't" and "Performance" columns:

- **Transform and opacity only** — nothing animates width/height/top/left, so
  every tween stays on the compositor thread.
- **Stagger capped at 8 children**; beyond that the last items feel laggy.
- **Split-text only on headlines** — anything over 10 words is skipped.
- **Magnetic pull on at most 2 elements per screen**, clamped to ×0.3 so the
  button never leaves its own hit box. Skipped entirely on touch devices.
- **Parallax on decorative layers only**, never on text or controls, yPercent
  delta kept in the 5–15 band.
- **One pinned section per page.** The quote gallery pins with native
  `position: sticky` rather than JS, so there is no layout thrash.
- **Navigation is never blocked on animation** — the page wipe has a 700ms
  hard timeout that fires the navigation regardless.
- `will-change` is applied for the duration of a tween and released after, so
  idle elements do not hold GPU memory.

### Accessibility

- `prefers-reduced-motion: reduce` kills every non-essential animation and
  renders the **final state immediately** — reveals visible, quote gallery
  unpinned and stacked, marquee stopped, page wipe disabled. A mid-session
  change of the preference is picked up live.
- Split text sets `aria-label` on the heading and `aria-hidden` on every
  generated character span, so screen readers read the sentence, not the letters.
- The marquee pauses on hover, on focus within, when scrolled offscreen, and
  when the tab is hidden.
- Without JS, `motion-ready` is never applied and **all content renders visible** —
  nothing is hidden behind an animation that may not run.

### Verified in-browser

Driven with Playwright/Chromium at 1440×900 and 390×844: zero console errors on
all 8 pages, all 24 reveals fire, the quote scrub advances correctly, the wipe
engages and completes navigation, reduced-motion leaves 0 of 24 elements hidden,
and there is no horizontal overflow at 390px.

## Quotations

The "Voices on the law" gallery on the home page and the pull-quotes on the
interior pages use sourced quotations, each with its primary reference shown on
the page:

| Figure | Source |
|---|---|
| Marcus Tullius Cicero | *Pro Cluentio* 53.146 (66 BCE) |
| Mohandas K. Gandhi | *An Autobiography: The Story of My Experiments with Truth* |
| Dr. B. R. Ambedkar | Constituent Assembly, 25 November 1949 |
| Justice H. R. Khanna | Dissent, *ADM Jabalpur v. Shivkant Shukla* (1976) |
| Justice V. R. Krishna Iyer | Supreme Court of India |
| Nani A. Palkhivala | Privy Purse case (1970) |
| Oliver Wendell Holmes Jr. | *The Common Law* (1881) — about page |
| Abraham Lincoln | Notes for a Law Lecture — fees page |
| Rev. Dr. Martin Luther King Jr. | *Letter from Birmingham Jail* (1963) — insights page |

A "Justice delayed is justice denied" line attributed to Gladstone was removed:
the attribution does not hold up to checking. If you add more quotations, keep
the source line — an unattributed quote on a law firm site invites the obvious
question.

## Before launch — required

1. **Phone number.** Every page has `+91 XXXXX XXXXX` and `href="tel:+910000000000"`.
   Replace both, everywhere:

       grep -rn "910000000000\|XXXXX XXXXX" *.html

2. **Email.** `contact@zblegalsolutions.in` is assumed, not confirmed.
3. **Wire up the form.** `#consult-form` in `contact.html` has `data-demo="true"`,
   which validates and redirects to `thank-you.html` without sending anything.
   Instructions for Formspree / Netlify / your own endpoint are in the comment
   directly above the form. Keep the `company` honeypot field.
4. **Fill or delete the 37 placeholders.** Every one is marked in-page with an
   amber `TODO` chip and its container carries `data-placeholder`:

       grep -rn 'class="todo"' *.html

   The significant ones:
   - Home statistics — all four counters read `0`. Use real figures or delete the section.
   - Reviews and the Google rating badge — **do not invent these.**
   - Fee figures on `fees.html` — every `₹ Add` marker.
   - Bar Council enrolment number, year of enrolment, memberships.
   - Gallery photos (only the opening invitation is real).
   - Social media URLs (currently `#`).
5. **Write the Insights articles or trim the list.** The nine cards on `blog.html`
   have accurate topic summaries but all link to `#`. Create one page per post, or
   cut the page down to the posts that actually exist.
6. **Privacy Policy, Terms and Cookie Policy** — three footer links point at `#`.
7. **Have an advocate review the copy.** Bar Council of India Rule 36 restricts
   advertising and solicitation by advocates. The fees page and the claims on the
   home page are the parts most worth a second look. A BCI disclaimer is already
   in the footer of every page.

## Notes on what was deliberately left out

- **Child support calculator** (from `notes.txt`). The reference was
  `legalsolutionslawfirm.ca`, which is Canadian — the Federal Child Support
  Guidelines give a table-driven figure. India has no equivalent statutory
  formula; maintenance under §125 CrPC / §144 BNSS and the personal laws is
  judicial discretion. A calculator would produce numbers with no legal basis and
  expose the firm to a misleading-advice complaint. If you want a lead-capture
  tool in that slot, a document checklist or a "which forum applies to me" guide
  works without inventing law.

## Behaviour

`assets/js/main.js` — mobile nav, sticky-header shadow, single-open accordions,
animated counters, form validation (10-digit Indian mobile + email), cookie
consent in `localStorage`, footer year, blog category filtering.

`assets/js/motion.js` — everything in the Motion system section above.

Everything degrades gracefully: with JS disabled, all content is visible, the nav
links work, and the form submits natively.

## Browser support

Modern evergreen browsers. Uses `IntersectionObserver` (feature-detected with a
fallback), CSS custom properties, grid, `backdrop-filter`, `position: sticky`
and `svh` units.

Note: `.quotes` must **not** carry `overflow: hidden` — it would create a scroll
container and silently break the sticky pin on `.quotes__sticky`.
