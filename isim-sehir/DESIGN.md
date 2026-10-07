# İsim Şehir — DESIGN.md

## Product personality
İsim Şehir is a fast, social Turkish party game. The interface should feel playful, competitive, premium and instantly readable rather than like a generic dashboard.

Design goals:
- Game first: every screen should make the next action obvious.
- Social energy: subtle motion, avatars, reactions and score changes should feel alive.
- Premium dark stage: deep near-black surfaces with controlled violet/cyan energy.
- Strong hierarchy: large game state, compact supporting information.
- Mobile first: the game must remain comfortable on a phone held vertically.
- Never sacrifice readability for decoration.

## Visual direction
Use a dark cinematic game-room aesthetic:
- Background: near-black navy, not pure black.
- Primary accent: electric violet.
- Secondary accent: cyan.
- Positive state: emerald/green.
- Negative state: rose/red.
- Warning/attention: amber.
- Surfaces: layered translucent navy/black cards with subtle borders.
- Avoid rainbow gradients, excessive glow, glass everywhere, or noisy particle effects.

Recommended palette:
- --bg: #03040B
- --surface: #090B15
- --surface-raised: #101426
- --surface-soft: rgba(255,255,255,.035)
- --border: rgba(255,255,255,.09)
- --text: #F7F8FC
- --muted: rgba(255,255,255,.52)
- --faint: rgba(255,255,255,.30)
- --violet: #8B5CF6
- --violet-bright: #A78BFA
- --cyan: #22D3EE
- --success: #34D399
- --danger: #FB7185
- --warning: #FBBF24

## Typography
Use a modern geometric/system sans stack.
- Display/game title: 900 weight, tight tracking, short line-height.
- Screen title: 700–900.
- Section title: 700–800.
- Body: 400–500.
- Labels: 700–900, uppercase only for compact metadata.
- Numeric game values: tabular/monospace-friendly digits where possible.
Do not use more than three text weights on one screen.

## Layout
Desktop: max content width around 1120–1200px; prefer 12/8/4 spacing; keep primary actions in the first viewport; use two columns only when both are genuinely useful.
Mobile: single-column by default; minimum interactive target 44px; primary actions may become sticky; avoid horizontal scrolling; keep room code and current letter visually dominant.

## Components
### Buttons
Primary: violet gradient or solid violet, strong white label, rounded 14–18px, subtle shadow/glow only on hover/active.
Secondary: dark translucent surface, thin border, accent text.
Destructive: rose only when actually destructive.
All buttons need visible hover, pressed, disabled and keyboard-focus states.

### Cards
- Radius: 18–26px for major cards.
- Border is more important than shadow.
- Use one elevated card level at a time.
- Avoid stacking more than two translucent layers.

### Inputs
- Minimum height 48px.
- Clear label/placeholder.
- Focus uses accent border + soft ring.
- Error is shown next to the affected field, not only at page level.

### Avatars
- Always show selection state.
- Selected avatar gets an accent ring and small scale increase.
- Do not rely on color alone to communicate selection.

## Game-state hierarchy
During a round: 1) current letter/round state, 2) time or completion state, 3) answer inputs, 4) submit/finish action, 5) other players' progress, 6) secondary controls.
During voting: 1) player answer, 2) category, 3) correct/incorrect vote, 4) vote progress, 5) score impact.
During results: 1) winner/score change, 2) scoreboard, 3) round summary, 4) next-round action.

## Motion
Motion should communicate game state, not decorate every element.
- 150–220ms for hover/focus transitions.
- 250–450ms for panel transitions.
- 500–900ms for celebratory score/round moments.
- Slight spring motion for avatars, selected chips and the letter wheel.
- Avoid constant pulsing, infinite attention-grabbing animations, large layout shifts, or blocking input.
- Respect prefers-reduced-motion.

## Letter wheel
The wheel is a signature interaction: center it precisely; keep the selected letter dominant; use controlled acceleration/deceleration; keep the result state still and readable; never make the player wait unnecessarily.

## Scoring and feedback
Green means accepted/correct. Rose means rejected/incorrect. Amber means unresolved/reviewing. Violet means active player/action. Cyan means secondary interactive information.
Score changes should animate once and settle quickly.

## Responsive rules
Test at 320px, 375px, 390px, 430px, 768px, 1024px and 1440px.
No core game action should disappear below the fold on common mobile sizes without an intentional sticky action.

## Accessibility
- Keyboard focus must always be visible.
- Text must maintain strong contrast against its surface.
- Never use color as the only indication of correctness.
- Inputs and buttons need accessible names.
- Respect reduced motion.
- Preserve native semantics where possible.

## Do / Don't
### Do
- Make the current game state obvious within one glance.
- Use restrained glow to establish hierarchy.
- Keep controls tactile and large.
- Celebrate scores and round wins.
- Make multiplayer status easy to scan.
### Don't
- Turn every surface into glass.
- Use huge shadows around every card.
- Hide essential actions behind tiny icons.
- Use tiny gray text for important information.
- Mix unrelated accent colors.
- Reintroduce the old monolithic legacy UI styling into the new React screens.

## Implementation rule
When adding or changing a screen, first follow this document, then reuse existing shadcn-style components and Tailwind utilities. Prefer tokens and shared components over one-off visual values.
The interface should feel like one game from the lobby through the final scoreboard.