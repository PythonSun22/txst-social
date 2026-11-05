# TXST Lynx college explorer

Open the sandbox's **TXST Lynx** link, or visit `http://localhost:3000/#/blank` after `npm start`.

## Integration

Render `<CollegeCarousel />` from `CollegeCarousel.js` in the destination page. It owns its header and navigation; update those links for the destination router. The game does not participate in this component.

Dependencies: React, GSAP, and `@gsap/react`. Fonts currently come from the sandbox's global Google Fonts import; carry DM Sans and Space Grotesk into the destination stylesheet or self-host them.

Copy `public/colleges/` to the destination public assets directory. `colleges.js` contains all ten asset paths, display names, prototype descriptions, tags, palettes, and character positioning. Asset paths respect Create React App's `PUBLIC_URL`; adapt the base URL when integrating into another build system.

- `position.x` / `position.y`: CSS percentage translations within the character frame.
- `position.scale`: artwork scale anchored at its bottom center.
- `color` / `glow` / `dark`: accent, atmospheric lighting, and dark panel colors.
- `asset`: original transparent PNG, rendered with `object-fit: contain`.

The original files in `boko/` are preserved. Public copies retain their transparency and dimensions.

## Animation

The `useGSAP` timeline animates the outgoing artwork and copy, shifts diagonal panels, blends theme colors, and brings the next artwork in with overshoot. Transitions take approximately 1.05 seconds. A synchronous ref locks navigation until completion, including rapid keyboard and pointer input. Separate nested wrappers keep per-character positioning, transition transforms, and pointer parallax independent.

Reduced-motion preferences are observed live. In that mode, selection changes immediately and parallax is disabled. There is no autoplay. A polite live region announces selections, hidden slides are excluded from the accessibility tree, and all controls are keyboard accessible.

Desktop uses the reference's mirrored composition: character left, information right. Below 700px, character and information stack vertically.

## Verification

`npm run build`

`CI=true npm test -- --watchAll=false --runInBand`

The interaction tests cover all ten entries, direct selection, wraparound, arrow keys, editable-field handling, and animation locking. They use jsdom; visual appearance and perceived motion require browser review.

## Content

College names follow the ten supplied character categories and Texas State's academic college listing: https://studenthandbook.txst.edu/colleges.html. Descriptions and labels are original prototype copy, not official university text. Science and Engineering stays combined for this ten-character prototype.
