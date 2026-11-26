// Worcester College Darts 1st VIII, 2016-17 (reference/people/darts_team.md). DARTS NICKNAMES ONLY — they are used
// only in the darts context (board, scorer, caller). NPC name tags and ordinary dialogue use firstName only;
// Duke of Doubles was not tagged (firstName null -> shown by nickname). Surnames are never stored or shown. Looks are loosely from the team photo (hair, build) in ordinary pub clothes.
// Skill levels and throwing personalities are INVENTED for the game (captain and vice-captain made the strongest).
//  sigma    : 1-sd scatter of a dart around the aim point (mm). ~8 = county star, 14 = strong pub, 20 = decent, 30 = casual
//  dblSigma : scatter when aiming at a double / bull (if better or worse than scoring)
//  aspect   : >1 = more vertical than horizontal scatter
//  arc      : height of the flight arc (m), tempo: seconds between darts (scaled by the throw animation)
export const ROSTER = [
  { nick: 'The Baron', firstName: 'Rob', role: 'captain', sigma: 11, dblSigma: 11, aspect: 1.3, arc: 0.12, tempo: 1.0,
    style: 'Captain. Metronomic scoring, takes the standard out every time.',
    look: { hair: 0x3a2618, hairStyle: 'short', build: 1.0, height: 1.8, top: 0x2a3550, topStyle: 'shirt', bottom: 0x222630 },
    lines: ['Game on.', 'Plenty of time, plenty of time.', 'Good darts, that.'] },
  { nick: 'Tender Wrists', firstName: 'Jamie', role: 'vice-captain', sigma: 12, dblSigma: 12.5, aspect: 1.2, arc: 0.1, tempo: 0.9,
    style: 'Vice-captain. Soft, floaty throw; deadly on the doubles.',
    look: { hair: 0x3a2618, hairStyle: 'short', build: 0.95, height: 1.76, top: 0x5a6a5a, topStyle: 'jumper', bottom: 0x202020 },
    lines: ['It is all in the wrist.', 'Nice and gentle.', 'Shot!'] },
  { nick: 'Duke of Doubles', firstName: null, role: 'player', sigma: 15, dblSigma: 10, aspect: 1.25, arc: 0.12, tempo: 1.0,
    style: 'Average scorer, but leave him a double and it is gone.',
    look: { hair: 0x8a6440, hairStyle: 'short', beard: 'stubble', build: 0.88, height: 1.78, top: 0x6a6a6e, topStyle: 'jumper', bottom: 0x1e2636 },
    lines: ['Leave me a double.', 'Tops, please.', 'Your Grace will take that.'] },
  { nick: 'Brown Magic', firstName: 'Akhil', role: 'player', sigma: 14, dblSigma: 15, aspect: 1.2, arc: 0.11, tempo: 0.85, streaky: true,
    style: 'Streaky: once he hits a treble, the next one is likelier.',
    look: { skin: 0x8d5a3b, hair: 0x15100c, hairStyle: 'short', build: 1.08, height: 1.78, top: 0x7a1e2a, topStyle: 'tee', bottom: 0x1d2a44 },
    lines: ['Watch this.', 'Magic.', 'Heating up now.'] },
  { nick: 'Six Stings', firstName: 'Will', role: 'player', sigma: 16, dblSigma: 17, aspect: 1.3, arc: 0.13, tempo: 0.95, stingy: true,
    style: 'Big lad, big arm. Gets looser (not worse) as the night goes on.',
    look: { hair: 0x17110c, hairStyle: 'quiff', build: 1.25, height: 1.92, top: 0x26282c, topStyle: 'shirt', bottom: 0xe48aac },
    lines: ['Whose round is it?', 'Get the Stings in.', 'One more Sting, then I am on fire.'] },
  { nick: 'The Trebuchet', firstName: 'Matt', role: 'player', sigma: 17, dblSigma: 17, aspect: 1.6, arc: 0.3, tempo: 1.1,
    style: 'Lobs it in on a huge arc. Vertical scatter is the problem.',
    look: { hair: 0x3a2618, hairStyle: 'short', build: 1.0, height: 1.9, top: 0x30485a, topStyle: 'hoodie', bottom: 0x202024 },
    lines: ['Incoming.', 'Siege mode.', 'Up and over.'] },
  { nick: 'Long Shaft', firstName: 'Tim', role: 'player', sigma: 18, dblSigma: 17, aspect: 1.2, arc: 0.14, tempo: 1.3,
    style: 'Long-stemmed darts, slow and deliberate.',
    look: { hair: 0x5a3a22, hairStyle: 'short', beard: 'full', build: 1.0, height: 1.8, top: 0x3a4a2a, topStyle: 'shirt', bottom: 0x2a2a30 },
    lines: ['No rush.', 'Steady.', 'Long game, this.'] },
  { nick: 'Shbeard', firstName: 'Harry', role: 'player', sigma: 17, dblSigma: 18, aspect: 1.2, arc: 0.12, tempo: 1.0,
    style: 'Solid, unflashy, rarely busts.',
    look: { hair: 0x1e1612, hairStyle: 'short', beard: 'full', build: 1.02, height: 1.8, top: 0x4a3a2a, topStyle: 'jumper', bottom: 0x202024 },
    lines: ['Steady as she goes.', 'Fine.', 'Hm.'] },
  { nick: 'Iron Fist', firstName: 'Tom', role: 'player', sigma: 16, dblSigma: 18, aspect: 1.1, arc: 0.09, tempo: 0.8,
    style: 'Firm, flat throw. Never leaves the twenty.',
    look: { skin: 0xf2cfb4, hair: 0xa04a1e, hairStyle: 'short', build: 1.0, height: 1.77, top: 0x1f2f4f, topStyle: 'polo', bottom: 0x2a2a2a },
    lines: ['Twenty. Always twenty.', 'Iron.', 'Hard and flat.'] },
  { nick: 'The Hulk', firstName: 'Sam', role: 'player', sigma: 19, dblSigma: 19, aspect: 1.1, arc: 0.07, tempo: 0.75,
    style: 'Throws it very hard. Fast visits, wide scatter.',
    look: { hair: 0xa07a4a, hairStyle: 'short', build: 0.88, height: 1.8, top: 0x2f6a3a, topStyle: 'tee', bottom: 0x1e2636 },
    lines: ['Smash.', 'Hulk throw.', 'Bit too hard, that.'] },
  { nick: 'Big Boy', firstName: 'Nick', role: 'player', sigma: 20, dblSigma: 20, aspect: 1.2, arc: 0.12, tempo: 1.0, switcher: true,
    style: 'Switches to the 19s when the 20 bed is blocked.',
    look: { hair: 0x1a1410, hairStyle: 'short', build: 1.12, height: 1.84, top: 0x5a2a5a, topStyle: 'shirt', bottom: 0x222222 },
    lines: ['Blocked? Nineteens then.', 'Big finish coming.', 'Easy.'] },
  // THE USER (confirmed): the player plays as M'Jumbo when their name is Matt. Never spawned or offered as an opponent.
  { nick: "M'Jumbo", firstName: 'Matt', role: 'player', npc: false, sigma: 15, dblSigma: 15, aspect: 1.2, arc: 0.12, tempo: 1.0,
    style: '', look: { hair: 0x8a6a44, hairStyle: 'curly', build: 0.9 }, lines: [] },
];
export const OPPONENTS = ROSTER.filter((p) => p.npc !== false);
/** 1..5 stars for the menu */
export function stars(p) { return Math.max(1, Math.min(5, Math.round((24 - p.sigma) / 2.6))); }
/** Name tag / ordinary dialogue name: first name only (nickname if the first name is not known). */
export function tagName(p) { return p.firstName || p.nick; }
/**
 * Is the local player Matt (= M'Jumbo)? Uses the shared people roster (_people.js, if another module provides it and the
 * player picked that person) or simply the player's name.
 */
export function playerIsMJumbo(game, people = null) {
  const look = game.player.look || {};
  if (people && look.personId) { const p = people.find ? people.find((q) => q.id === look.personId) : people[look.personId]; if (p) return /m.?jumbo/i.test(p.nick || p.darts || '') || p.id === 'mjumbo'; }
  if (look.personId && /jumbo/i.test(String(look.personId))) return true;
  return /^\s*matt(hew)?\b/i.test(game.player.name || '');
}
export function playerDartsName(game, people = null) { return playerIsMJumbo(game, people) ? "M'Jumbo" : (game.player.name || 'You'); }
