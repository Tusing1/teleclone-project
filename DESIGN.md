# StudyGram interface direction

## Campus after hours

A mobile-first student communication app with ink surfaces, violet identity,
and a lime primary creation action. Personality comes from shape, typography,
and a consistent color hierarchy, with restrained motion.

## Shared rules

- Use background/card/popover tokens for surfaces, including light mode.
- Violet identifies navigation, messages, and selected controls. Lime highlights creation.
- Use 44px minimum primary touch targets, visible focus, and accessible labels.
- Keep body text readable; avoid tiny uppercase labels and low-contrast gray copy.
- Use 20–28px cards, a floating navigation dock, and grouped sidebar actions.
- Keep message metadata outside text bubbles and use generous horizontal space.
- Respect reduced motion; keep the message canvas quiet.
- Do not add token economies, AI features, games, fake activity, or decorative metrics.

## Implementation plan

1. Establish shared palette, surfaces, typography, motion, and component styles.
2. Unify inbox rows, functional filters, empty state, and bottom dock.
3. Unify message bubbles, metadata, header, composer, and message menus.
4. Align buddy discovery, sidebar, authentication, profile, and dialogs.
5. Check production compilation and inspect the mobile UI in the browser.

## Scope boundaries

This is a design pass. Reply currently uses a text quote in direct messages;
pinning remains unfinished. UI polish must not be described as completion of
those backend features or of live recording verification.
