// Pizza Artisan rules (pure, DOM-free; covered by tools/smoke_pizza.mjs).
// The real van (venues.md §5): a big shiny silver wood-fired pizza van outside Christ Church on St Aldate's, c. 2011–2019,
// cash only, no seating, free rocket / peppers / olive oil. Cherwell (June 2011) mentions a "six pound truck pizza".
// The real menu and opening hours were not found: the pizzas below are generic wood-fired staples at c. 2013 prices and
// the hours (17:00–23:30) are the brief's guess.
export const HOURS = { open: 17.0, close: 23.5 };
export const MENU = [
  { id: 'margherita', name: 'Margherita', desc: 'tomato, mozzarella, basil', price: 5.5 },
  { id: 'salami', name: 'Salami', desc: 'spicy salami, mozzarella', price: 6.5 },
  { id: 'mushroom', name: 'Mushroom & olive', desc: 'mushrooms, black olives, garlic oil', price: 6.0 },
  { id: 'rocket', name: 'Parma ham & rocket', desc: 'ham, rocket, parmesan', price: 7.5 },
  { id: 'quattro', name: 'Four cheese', desc: 'mozzarella, gorgonzola, parmesan, ricotta', price: 7.0 },
];
export const COOK_S = 20;          // seconds in the oven
export const ENERGY = 40;          // hunger/energy restored by a pizza
export const SOBER = 0.25;         // how much it sobers you up

export function isOpen(hour, force = null) {
  if (force === true || force === false) return force;
  return hour >= HOURS.open && hour < HOURS.close;
}
/** queue length for this hour; `day` (shared slot index) varies it a little so every client agrees */
export function queueSize(hour, day = 0, force = null) {
  if (!isOpen(hour, force)) return 0;
  const j = ((day * 7 + Math.floor(hour)) % 3 + 3) % 3;   // 0..2
  if (hour >= 22) return 4 + j;                            // the post-pub rush
  if (hour >= 19) return 2 + (j % 2);
  return 1 + (j === 2 ? 1 : 0);
}

/**
 * Order state machine. s = {stage:'idle'|'cooking'|'ready'|'carrying', item, t}. ev: {type:'order', item, money, open}
 * | {type:'tick', dt} | {type:'collect'} | {type:'eat'}. Returns an outcome string; mutates s.
 */
export function pizzaStep(s, ev) {
  switch (ev.type) {
    case 'order': {
      if (!ev.open) return 'closed';
      if (s.stage !== 'idle') return 'busy';
      const it = typeof ev.item === 'number' ? MENU[ev.item] : MENU.find((m) => m.id === ev.item);
      if (!it) return 'unknown';
      if (!(ev.money >= it.price)) return 'cash-only';      // "Cash only, mate."
      s.stage = 'cooking'; s.item = it; s.t = COOK_S;
      return 'ordered';
    }
    case 'tick':
      if (s.stage === 'cooking') { s.t -= ev.dt; if (s.t <= 0) { s.t = 0; s.stage = 'ready'; return 'ready'; } }
      return 'noop';
    case 'collect':
      if (s.stage !== 'ready') return 'not-ready';
      s.stage = 'carrying'; return 'collected';
    case 'eat':
      if (s.stage !== 'carrying') return 'nothing';
      s.stage = 'idle'; const it = s.item; s.item = null; void it; return 'eaten';
  }
  return 'noop';
}
/** effects of eating on the persisted state + the player */
export function eatEffects(flags, drunk, now) {
  flags.energy = Math.min(100, (flags.energy || 0) + ENERGY);
  flags.ateAt = now;
  flags.pizzas = (flags.pizzas || 0) + 1;
  return Math.max(0, (drunk || 0) - SOBER);
}
