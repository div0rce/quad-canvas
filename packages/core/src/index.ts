// @quad/core — canonical shared contracts for Quad (T4 skeleton).
//
// Namespaced barrels: identically-named canonical concepts live side-by-side without collision,
// e.g. `events.PixelPlaced` (domain event) vs `ws.PixelPlaced` (broadcast message).
// This package is PURE: no I/O, no DB, no framework imports, no env reads. It is the single
// source of shared contracts — consumers (apps/web, apps/api, …) import from here; nothing
// duplicates these DTOs/events/messages. Real fields are filled in per-spec.
export * as domain from './domain/index.js';
export * as dto from './dto/index.js';
export * as events from './events/index.js';
export * as ws from './ws/index.js';
export * as cooldown from './cooldown/index.js';
export * as tenant from './tenant/index.js';
