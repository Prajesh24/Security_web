# Accessibility — Approach, Testing & Findings

Target: **WCAG 2.1 Level AA**.

## Testing approach

1. **Automated** — run in the browser during development:
   - Lighthouse (Chrome DevTools) → Accessibility category.
   - axe DevTools extension (deque) on each page.
2. **Manual keyboard** — Tab/Shift-Tab through every page: all interactive
   elements reachable, visible focus ring, logical order, no traps; the skip
   link jumps to `#main-content`.
3. **Manual screen reader** — VoiceOver (macOS) spot-check of login, register and
   account: form labels, headings and status messages are announced.

> Record your own Lighthouse score screenshot per page for the report evidence.

## Implemented accessibility features

| Concern | Implementation |
|---|---|
| Bypass blocks (2.4.1) | Skip-to-content link (`app/layout.tsx`, `.skip-link`) |
| Landmarks | `<nav aria-label="Primary">`, single `<main id="main-content">` |
| Focus visible (2.4.7) | Global `:focus-visible` outline in `globals.css` |
| Labels & instructions (3.3.2) | Every input has an associated `<label htmlFor>`; numeric inputs use `inputMode`/`autoComplete` |
| Status messages (4.1.3) | Errors use `role="alert"`; password strength uses `aria-live="polite"` |
| Non-text content (1.1.1) | QR image has `alt`; decorative CAPTCHA SVG + count badge are `aria-hidden`, with a text label alternative |
| Language of page (3.1.1) | `<html lang="en">` |
| Colour contrast (1.4.3) | Text/`--text` on light surfaces meets AA; strength bar colours paired with a text label (not colour-only) |

## Known findings / to verify (add your results)

- [ ] Confirm colour contrast of `.muted` (#64748b on #f6f7fb) meets AA for small
      text — darken if Lighthouse flags it.
- [ ] Add `aria-live` region to the account page flash messages if VoiceOver does
      not announce them.
- [ ] Verify the CAPTCHA has an accessible alternative for users who cannot solve
      a visual arithmetic image (documented trade-off: an audio/step-up
      alternative is future work).
