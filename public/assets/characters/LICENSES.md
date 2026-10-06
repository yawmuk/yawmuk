# Character models — licence and credits

- Characters and animations by Quaternius (https://quaternius.com), CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/).
- male.glb: Quaternius "Ultimate Modular Men" pack via poly.pizza: Casual Character (https://poly.pizza/m/kZ3DmIoGip), Business Man (https://poly.pizza/m/JFrLIKqvCH), Hoodie Character (https://poly.pizza/m/gKLBoRsyKe), Farmer (https://poly.pizza/m/7pn3R6hPvE). Clips: Idle, Idle_Neutral, Walk, Run, Wave, Interact.
- female.glb: Quaternius "Ultimate Modular Women" pack via poly.pizza: Animated Woman, casual (https://poly.pizza/m/qJ2gsTUBHL), Animated Woman, formal (https://poly.pizza/m/nIItLV9nxS). Same clips.
- CC0 places the models in the public domain; attribution is not required (credited anyway). poly.pizza lists each model above as CC0 by Quaternius (checked 2026-10-06).
- Changes: tools/characters/fetch.mjs downloads the originals listed in tools/characters/sources.json; tools/characters/build.mjs merges the parts of each sex onto the shared 62-joint rig, keeps six clips and compresses with meshopt (glTF-Transform). No geometry was edited.
- Hijabs, kufis, beanies, Santa hats, beards, glasses, long skirts, long sleeves and trousers are generated at runtime by src/engine/accessories.js (our own code), fitted to these models.
