// Adam's house: the ONE description of its envelope, shared by the interior (home.js) and the exterior (town.js)
// so that the house seen from the street and the room Adam walks into are the same building.
// Local frame = the interior's: origin at the centre of the ground floor, +Z towards the street (front door side),
// floor at y = 0. town.js places this frame at INTERIOR_ANCHORS.home.

export const HOUSE = {
  w: 12, d: 9, h: 2.7,                       // ground-floor footprint (x -6..6, z -4.5..4.5) and wall height
  colors: { siding: '#f2ede1', trim: '#fbf8f2', door: '#2f5a6b', roof: '#4a5260', porch: '#d6c6aa' },
  door: { x: 4.5, w: 1.0, h: 2.1 },           // in the south (street) wall, centre x
  // ground-floor windows per wall; x/z = centre along the wall, w = width, y0..y1 = sill..head
  front: [{ x: 2.3, w: 1.4, y0: 0.95, y1: 2.15 }, { x: -0.9, w: 1.2, y0: 0.95, y1: 2.15 }],   // south wall (street)
  back: [{ x: -4.1, w: 1.0, y0: 1.15, y1: 2.15 }, { x: 0, w: 2.6, y0: 0.7, y1: 2.3 }, { x: 2.4, w: 1.0, y0: 0.9, y1: 2.3 }],  // north wall
  west: [{ z: 1.0, w: 1.2, y0: 0.95, y1: 2.15 }],   // x = -6
  east: [{ z: 1.7, w: 1.4, y0: 0.95, y1: 2.2 }],    // x = +6
  // porch along the street wall around the door (local x range), deck depth out from the wall
  porch: { x0: 1.0, x1: 6.0, depth: 1.9, deckH: 0.16, roofY: 2.75 }
};
