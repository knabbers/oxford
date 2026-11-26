// North and west photo-comparison pass (2026-11; docs/research/photo_comparison_north.md).
// `?north=0` in the URL (GTO_NORTH=0 in node) turns the whole pass off: before / after shots from identical cameras.
export const NORTH = !((typeof location !== 'undefined' && location && /[?&]north=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_NORTH === '0'));
