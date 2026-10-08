# 13 — UI direction and implemented prototype

## Visual thesis

Passion Fruit uses an airy, calm product language: generous white space, strong readable typography, light blue/green atmosphere, white cards with quiet borders, and a restrained dark-green/lime brand accent. Colour communicates meaning; it is not used as decoration everywhere.

The owner-supplied screenshots are inspiration for cleanliness, hierarchy, spacing, typography and the connected-node interaction pattern. Their brands, medical content, data, page structure and product modules are not copied.

## System rules

- Manrope is the primary interface typeface. Large marketing headings use a moderate weight and tight spacing; working surfaces use compact, readable hierarchy.
- Marketing content uses a maximum width of 1240px and generous vertical rhythm. Product surfaces use compact 8–18px gaps.
- Primary ink is deep green-black; the signature accent is passion-fruit lime. Blue, violet and amber appear only in data and semantic categories.
- Cards use restrained 10–18px radii, one-pixel pale borders and shadows only when a surface needs clear elevation.
- Controls stay deliberately small and precise. Body copy remains readable, while metadata and dense workspace labels use a compact scale.
- Public pages may use soft atmospheric gradients. Dashboard backgrounds remain quiet and nearly neutral.
- Icons are simple line icons. Buttons use plain action labels and rounded forms; no decorative arrow is required.
- All major working surfaces retain useful controls above the fold. Navigation collapses to a bottom bar on mobile.
- Workflow nodes show an icon, action title, short configuration summary and visible connection points. The right inspector edits the selected node.

## Implemented local routes

| Route | Surface |
| --- | --- |
| `/` | Marketing home with product preview and workflow story |
| `/features` | Feature details |
| `/workflows` | Full visual workflow explanation and interactive canvas |
| `/about` | Product point of view and pilot approach |
| `/demo` | Local demo-request prototype with an honest non-delivery state |
| `/app` | Customer dashboard overview |
| `/app/inbox` | Interactive shared inbox and local reply composer |
| `/app/campaigns` | Campaign list and safe draft interaction |
| `/app/workflows` | Interactive node selection and publish-state demo |
| `/app/agents`, `/app/contacts`, `/app/commerce`, `/app/reports`, `/app/team`, `/app/settings` | Planned module previews |
| `/admin` | Super-admin customer list, feature controls and provisioning drawer |

The UI is a front-end prototype backed by local sample state. It does not authenticate users, persist changes, send messages, create real customers or submit the demo form externally. These actions are connected during the foundation and messaging milestones.

## Implementation location

The Hostinger-oriented Next.js application is in `apps/web`. Root npm workspace commands run the local development server, type check and production build. Visual tokens and responsive rules live in `apps/web/src/app/globals.css`; reusable product, marketing and workflow components live in `apps/web/src/components`.

## Next UI pass

Keep this system while connecting Supabase Auth/RLS, real tenant grants and the official messaging core. Replace sample values with explicit loading, empty, denied, error and live states. Add product imagery only when it helps explain an implemented capability. Do not show planned modules as available in the customer-facing marketing site without clear status.
