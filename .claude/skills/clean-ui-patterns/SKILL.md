---
name: clean-ui-patterns
description: Use whenever building any user-facing screen or component — forms, dashboards, lists, the POS sale screen. Apply this while building the UI, not just when asked to "make it look nice".
---

# Clean UI patterns

Default to these while building — don't ship the generic "card in a gray container with a shadow" look.

## Before adding a wrapping container
Ask: does this boundary group things that actually relate, or is it decoration? Don't nest a card inside a card inside a page with matching padding/radius. If a section doesn't need visual separation from the page, don't give it one.

## Hierarchy, every screen
- One primary action, visually the most prominent thing on the screen (size, color, position).
- Secondary actions visually secondary — not the same button style as primary.
- The most important number on the screen (total, stock alert, sale amount) should be scannable without reading labels first.

## This project is mobile-first, used under time pressure
- Tap targets ≥44px, thumb-reachable primary actions (bottom of screen on mobile, not buried at the top).
- Minimize steps for the cajero flow specifically — every extra tap during a sale is friction a real cashier will complain about.
- Every action gets visible feedback (button state change, confirmation) within ~300ms, or a loading indicator if it'll take longer. Never leave a tap with no visible response.

## Consistency
- Use one accent color for primary actions/success states, one for warnings, one for errors — pick these once and reuse them, don't introduce new colors per screen.
- Reuse the same button/input/card components across screens rather than rebuilding similar-looking one-offs.

## Accessibility basics, always
- Real form labels, not placeholder-as-label.
- Don't convey status (in stock / low stock / out) with color alone — pair with text or an icon.
