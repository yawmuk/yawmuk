// Shared material palette. Materials are SHARED across scenes: never dispose or mutate them in a
// scene — call mats.color('#hex') or .clone() if you need a variant (clones are disposed with the scene).
import * as THREE from 'three';

const std = (color, o = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
  m.userData.shared = true;
  return m;
};

export function createMats() {
  const mats = {
    // structure
    wall: std('#e9e4da'),
    wallWarm: std('#e8d5b9'),
    wallBlue: std('#c9d8e6'),
    wallGreen: std('#cfe0c8'),
    ceiling: std('#f4f1ea'),
    floor: std('#b89672', { roughness: 0.7 }),       // wooden floor
    floorTile: std('#d9d6cf', { roughness: 0.5 }),
    carpet: std('#7d5a50', { roughness: 1 }),
    concrete: std('#a3a3a0'),
    sidewalk: std('#bdbab3'),
    asphalt: std('#3c3f44', { roughness: 0.95 }),
    brick: std('#9c4a35'),
    roofTile: std('#6b3a2e'),
    // natural
    grass: std('#6f9e4c', { roughness: 1 }),
    leaf: std('#3f7d3a', { roughness: 0.9 }),
    trunk: std('#6b4a2f'),
    water: std('#4a90b8', { roughness: 0.15, metalness: 0.1 }),
    dirt: std('#8a6f4e'),
    // furniture / props
    wood: std('#a0703f', { roughness: 0.65 }),
    woodDark: std('#5e3d22', { roughness: 0.6 }),
    woodLight: std('#d2b48c', { roughness: 0.6 }),
    metal: std('#9aa3ab', { metalness: 0.7, roughness: 0.35 }),
    steel: std('#5c6670', { metalness: 0.6, roughness: 0.4 }),
    chrome: std('#d7dde2', { metalness: 0.9, roughness: 0.15 }),
    gold: std('#c9a227', { metalness: 0.8, roughness: 0.3 }),
    glass: std('#a9d6e5', { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    plastic: std('#f2f2f2', { roughness: 0.4 }),
    black: std('#1f2124', { roughness: 0.5 }),
    white: std('#fafafa', { roughness: 0.6 }),
    paper: std('#fbfaf5', { roughness: 0.9 }),
    screen: std('#1b2a3a', { emissive: '#3d7bd9', emissiveIntensity: 0.55, roughness: 0.3 }),
    screenOff: std('#111418', { roughness: 0.25 }),
    lampGlow: std('#fff3c4', { emissive: '#ffe08a', emissiveIntensity: 1.2 }),
    // fabrics
    fabricRed: std('#a83a3a', { roughness: 1 }),
    fabricBlue: std('#3a5f9a', { roughness: 1 }),
    fabricGreen: std('#3f7a5a', { roughness: 1 }),
    fabricBeige: std('#d8c8a8', { roughness: 1 }),
    fabricGray: std('#7a7f86', { roughness: 1 }),
    fabricPurple: std('#6b4c8a', { roughness: 1 }),
    // paint / signage
    paintWhite: std('#f5f5f0'),
    paintYellow: std('#e8c33a'),
    paintRed: std('#c0392b'),
    paintGreen: std('#27ae60'),
    paintBlue: std('#2e6fb7')
  };

  const cache = new Map();
  /** Cached shared material for any color: mats.color('#ff8800', { roughness: .4 }). */
  mats.color = (hex, opts) => {
    const key = hex + (opts ? JSON.stringify(opts) : '');
    if (!cache.has(key)) cache.set(key, std(hex, opts));
    return cache.get(key);
  };
  return mats;
}
