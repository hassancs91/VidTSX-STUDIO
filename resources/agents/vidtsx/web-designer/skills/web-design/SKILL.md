---
name: Web design
description: The type scale, spacing, responsive rules, accessibility basics and landing-page section patterns a page is built under. Read it before writing or editing a page — every page is judged against it.
when_to_use: Every time you write, edit or review a page.
---

# Web design

A landing page is read in eight seconds on a phone by someone who did not
ask for it. Everything below follows from that.

## Typography

- One display face for headings (the brand's, else a system serif or sans:
  `Georgia, "Times New Roman", serif` or `system-ui, -apple-system, "Segoe UI",
  Roboto, sans-serif`) and one text face for everything else. No web-font
  links — the page must not reach the network; system stacks are the font.
- A fixed scale, in rem, and nothing off it: **display 3.5 / h1 2.75 / h2
  2 / h3 1.375 / body 1.0625 / small 0.875**. On phones the display drops to
  2.25 and h1 to 2.
- Line-height 1.1 for display and h1, 1.2 for h2/h3, 1.6 for body. Measure:
  body copy no wider than **65 characters** (`max-width: 62ch`).
- Headline of at most **eight words**; a subhead of one sentence. Weight and
  colour carry emphasis, never italics or underlines.
- Set `margin: 0` on headings and paragraphs and space them with the scale
  below.

## Spacing and layout

- An 8 px grid: **8 / 16 / 24 / 32 / 48 / 64 / 96 / 128**. Section padding
  96 top and bottom on desktop, 64 on phone. Gaps inside a section 24–32.
- One container: `max-width: 1120px; margin: 0 auto; padding: 0 24px`.
- Cards on a CSS grid: `grid-template-columns: repeat(auto-fit, minmax(260px,
  1fr))` — three across on desktop, one column on phone with no media query.
- Radius 12 px on cards and 8 px on buttons; one border colour at low
  contrast, or none. Shadows only if the brand's style notes ask.
- Buttons: 48 px tall, 24 px side padding, one primary (filled, accent) and
  one secondary (outline). The primary call to action appears in the hero
  and again at the end.

## Responsive rules

- `<meta name="viewport" content="width=device-width, initial-scale=1">` in
  every page.
- Mobile first: the base styles are the phone layout; one media query at
  `min-width: 768px` and one at `min-width: 1024px` add columns and size.
- Media scales: `img, video { max-width: 100%; height: auto; display: block }`.
  A hero video sits in a box with `aspect-ratio: 16 / 9` and `object-fit:
  cover`, `autoplay muted loop playsinline`, with a `poster` when an image
  exists, and never carries the message on its own — the headline does.
- Touch targets at least 44 × 44 px; nav collapses to a single row of links
  (no hamburger script is worth it on a landing page).
- Check both captures: desktop for hierarchy, phone for stacking and
  overflow. Anything wider than the phone viewport is a bug.

## Accessibility basics

- Text contrast **4.5:1** against its ground (3:1 for text over 24 px).
  A dark brand background needs the brand's light text colour, not grey.
- One `<h1>`; headings in order; sections are `<section>` with an
  `aria-labelledby` or a heading inside.
- Every `<img>` has `alt` (empty for decoration); a `<video>` is `muted` and
  has `aria-label`; buttons are `<button>` or `<a>`, never a `<div>`.
- Visible focus: `:focus-visible { outline: 2px solid <accent>; outline-offset:
  2px }`. Respect `prefers-reduced-motion` on any animation.
- Language on `<html lang>`; a `<title>` that names the product.

## Landing-page section patterns

In the usual order; take what the brief needs, four to six sections.

1. **Nav** — wordmark left, two or three links, the primary button right.
2. **Hero** — headline, subhead, primary + secondary button, the hero video
   or image beside or beneath. The one section that may be full-bleed.
3. **Proof strip** — a line of logos, a number, or one quote. Small.
4. **Features** — three cards: an icon drawn in CSS or an inline SVG, a
   four-word title, a two-line blurb. Same height, same rhythm.
5. **How it works** — three numbered steps in a row.
6. **Showcase** — one big picture or clip with a caption.
7. **Testimonial** — one quote, name, role.
8. **Pricing** — only when the brief has prices; never invent them.
9. **Final call to action** — the headline's promise restated, one button.
10. **Footer** — wordmark, a few links, the year. Nothing else.

## Media references

Media made in this session is referenced by artifact id and nothing else:
`<video src="artifact:video-1" poster="artifact:image-set-2">`,
`<img src="artifact:image-set-2/1" alt="…">`, `background: url(artifact:image-set-3)`.
Everything else on the page is inline: CSS in one `<style>`, JS in one
`<script>`, icons as inline SVG. No external scripts, stylesheets, fonts,
images, iframes or fetches — a page that has them is rejected.

## Before you call it done

Headline under eight words; one h1; every colour from the brand; contrast
holds on the dark sections; both captures clean; the call to action appears
twice; no placeholder text ("lorem", "TODO") anywhere; nothing external.
