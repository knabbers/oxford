// Ground-floor bays of GENERIC facades (world/buildings.js) that a walk-in room replaces with its own real window or
// door (places/_walkin_city.js `dressOpenings`): the painted cell of the bay that contains the given world point is
// swapped, so the outside of the building shows exactly one window / door there.
//   [x, z, cell]   x, z = a world point on (within 0.9 m of) the building's wall, anywhere inside the bay;
//                  cell = 'blank' (plain wall of the building's own material: the room draws the opening itself)
//                         or a FACADE_CELLS name ('renderDoor', 'stoneDoor', 'stoneSash', …: the bay is painted as that;
//                         a room's doorway / window can then be snapped onto it — planWalkin `snapBay`, `auto`).
// Keyed by map building id. Pure data: the same for every player. ONE LINE PER BUILDING, please (several agents edit this).
export const WALKIN_BAYS = {
  w69991346: [[-395.55, -177.9, 'blank'], [-396.45, -179.9, 'blank'], [-395.5, -156.0, 'blank'], [-396.6, -154.3, 'blank'], [-396.95, -156.6, 'blank']],   // Earl Building: the kitchen's end wall (its own timber window), the entrance and the recess's side walls
  w301621503: [[-232.9, 39.92, 'blank']],                                       // Worcester, Staircase 15 (Pump Quad): the pigeonhole room's door
  w93711480: [[-306.40, -29.30, 'stoneSash']],                                  // Worcester, Besse Building west range: the Memorial Room's middle bay is a window (was a painted door that led nowhere)
  w97822057: [[488.43, 31.98, 'blank']],                                       // Turf Tavern: the yard door
  w931833406: [[324.6, 562.15, 'blank']], w931780663: [[327.74, 549.4, 'blank']],   // Christ Church: the Hall stair door (Bodley's tower), the Cathedral door (east range of Tom Quad)
  w679676362: [[225.25, -446.54, 'blank']],                                     // Robert Hooke Building: the street door (places/hooke_building.js)
  'music--4.1_21.1_13.8_29.3': [[278.33, 705.80, 'blank'], [278.81, 708.86, 'blank']],   // Faculty of Music, rear block (places/music_faculty.js RANGES): the Bate Collection's two windows
  w126369481: [[762.16, 51.98, 'blank']],                                      // Former Morris Garage, Longwall Street: plain wall behind its blue plaque (systems/_curio_list.js morris-garage) whatever the window rhythm
  'music-19_25.9_-3.7_13.8': [[307.46, 697.89, 'blank']],                               // Faculty of Music, east arm: Denis Arnold Hall's window
};
