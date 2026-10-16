// Cosmetics: bought once, then usable on any car. Each car remembers what it wears.
// paint: { color, metal (0..1), rough (0..1), neon (glows) }
// rim:   { style: classic | disc | star | mesh | neon, color, neon }
// glow:  underglow colour, null for none

export const PAINTS = [
  // Metallic
  { id: 'factory', name: 'Factory', price: 0, factory: true },
  { id: 'crimson', name: 'Crimson', price: 300, paint: { color: '#c8102e', metal: 0.6, rough: 0.28 } },
  { id: 'cobalt', name: 'Cobalt', price: 300, paint: { color: '#1f4fd6', metal: 0.65, rough: 0.25 } },
  { id: 'emerald', name: 'Emerald', price: 400, paint: { color: '#0b8f5a', metal: 0.65, rough: 0.25 } },
  { id: 'gunmetal', name: 'Gunmetal', price: 400, paint: { color: '#3b3f4a', metal: 0.85, rough: 0.3 } },
  { id: 'pearl', name: 'Pearl', price: 600, paint: { color: '#f2efe8', metal: 0.5, rough: 0.2 } },
  { id: 'sunset', name: 'Sunset Gold', price: 800, paint: { color: '#e0a500', metal: 0.9, rough: 0.2 } },
  // Neon
  { id: 'neon-pink', name: 'Neon Pink', price: 1000, paint: { color: '#ff2bd6', metal: 0.2, rough: 0.4, neon: true } },
  { id: 'neon-lime', name: 'Cyber Lime', price: 1000, paint: { color: '#9dff00', metal: 0.2, rough: 0.4, neon: true } },
  { id: 'neon-blue', name: 'Electric Blue', price: 1200, paint: { color: '#00c8ff', metal: 0.2, rough: 0.4, neon: true } },
  { id: 'neon-orange', name: 'Plasma Orange', price: 1200, paint: { color: '#ff6a00', metal: 0.2, rough: 0.4, neon: true } },
  { id: 'neon-violet', name: 'UV Violet', price: 1500, paint: { color: '#a24dff', metal: 0.2, rough: 0.4, neon: true } },
];

export const RIMS = [
  { id: 'classic', name: 'Classic', price: 0, rim: { style: 'classic', color: '#c8ccd8' } },
  { id: 'disc', name: 'Disc', price: 400, rim: { style: 'disc', color: '#e8ebf2' } },
  { id: 'star', name: 'Star', price: 600, rim: { style: 'star', color: '#ffd400' } },
  { id: 'mesh', name: 'Mesh', price: 800, rim: { style: 'mesh', color: '#d0d4de' } },
  { id: 'black', name: 'Blackout', price: 800, rim: { style: 'classic', color: '#1a1a1f' } },
  { id: 'neon', name: 'Neon Ring', price: 1500, rim: { style: 'neon', color: '#00f0ff', neon: true } },
];

export const GLOWS = [
  { id: 'none', name: 'None', price: 0, glow: null },
  { id: 'cyan', name: 'Cyan', price: 700, glow: '#00f0ff' },
  { id: 'pink', name: 'Pink', price: 700, glow: '#ff2bd6' },
  { id: 'lime', name: 'Lime', price: 900, glow: '#9dff00' },
  { id: 'violet', name: 'Violet', price: 900, glow: '#8a4dff' },
  { id: 'gold', name: 'Gold', price: 1200, glow: '#ffc400' },
];

export const COSMETICS = { paint: PAINTS, rim: RIMS, glow: GLOWS };
