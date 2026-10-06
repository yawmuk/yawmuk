// «Talk to anyone nearby» (src/engine/ui/nearbyTalkCore.js): who is talkable, proximity pick, free-chat payload, strings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { talkables, pickTalkable, freePayload, TALK_RADIUS, NEARBY_STR, ns, isBackground } from '../src/engine/ui/nearbyTalkCore.js';

const sceneNpcs = [
  { id: 'neighbor_yusuf', position: [3, 0, 1], yaw: 0, talk: { name: { ar: 'يوسف', en: 'Yusuf' }, role: { ar: 'جار', en: 'Neighbour' }, persona: { ar: 'يحب الحديقة.', en: 'Loves his garden.' } } },
  { id: 'bg_walker', position: [0.5, 0, 0.5], talk: { name: { ar: 'عابر', en: 'Passer-by' } } }, // background extra: never talkable
  { id: 'statue', position: [1, 0, 1] } // no talk entry
];
const figures = {
  neighbor_yusuf: { position: { x: 3, z: 1 } }, bg_walker: { position: { x: 0.5, z: 0.5 } }, statue: { position: { x: 1, z: 1 } },
  omar: { position: { x: -5, z: -3 } }, bg_sarah: { position: { x: -1, z: -2 } }
};
const situations = [
  { ruling_id: 'home.purity_mosque', npc: { id: 'omar', name: { ar: 'عُمَر', en: 'Omar' }, role: { ar: 'جار آدم', en: "Adam's neighbour" } }, setup: { ar: 'يقف عُمَر عند الحوض.', en: 'Omar stands at the sink.' } },
  { ruling_id: 'home.second', npc: { id: 'omar', name: { ar: 'عُمَر', en: 'Omar' } }, setup: { ar: 'عُمَر عند الباب.', en: 'Omar at the door.' } },
  { ruling_id: 'home.ghost', npc: { id: 'nobody', name: { ar: 'لا أحد', en: 'Nobody' } }, setup: 'x' } // no figure in the scene -> no position -> not talkable
];

test('talkables: scene NPCs with a talk entry + script NPCs with a figure; bg_ and figure-less ids are skipped', () => {
  const list = talkables(sceneNpcs, figures, situations);
  assert.deepEqual(list.map((p) => p.id).sort(), ['neighbor_yusuf', 'omar']);
  const y = list.find((p) => p.id === 'neighbor_yusuf');
  assert.equal(y.source, 'scene');
  assert.deepEqual([y.x, y.z], [3, 1]);
  assert.equal(y.persona.en, 'Loves his garden.');
  const o = list.find((p) => p.id === 'omar');
  assert.equal(o.source, 'script');
  assert.equal(o.role.en, "Adam's neighbour");
  assert.equal(o.contexts.length, 2); // both situations' setups become background context
  assert.deepEqual(talkables(undefined, {}, undefined), []);
  assert.ok(isBackground('bg_sarah') && !isBackground('omar'));
});

test('talkables: a scene talk entry wins over the script data for the same id, script setups still add context', () => {
  const list = talkables([{ id: 'omar', position: [0, 0, 0], talk: { name: { ar: 'عمر', en: 'Omar (scene)' }, role: { ar: 'جار', en: 'Neighbour' }, persona: { en: 'p' } } }], figures, situations);
  const o = list.find((p) => p.id === 'omar');
  assert.equal(o.name.en, 'Omar (scene)');
  assert.equal(o.source, 'scene');
  assert.equal(o.contexts.length, 2);
});

test('pickTalkable: nearest within the radius, ignores bg_, prefers the closer one, null when nobody is near', () => {
  const list = [
    { id: 'bg_x', x: 0.1, z: 0 },
    { id: 'far', x: 10, z: 0 },
    { id: 'near', x: 1.5, z: 0 },
    { id: 'nearer', x: 0, z: 1 }
  ];
  assert.equal(pickTalkable({ x: 0, z: 0 }, list).id, 'nearer');
  assert.equal(pickTalkable({ x: 1.6, z: 0 }, list).id, 'near');
  assert.equal(pickTalkable({ x: 0, z: 0 }, list, 0.5), null);
  assert.equal(pickTalkable({ x: 20, z: 20 }, list), null);
  assert.equal(pickTalkable({ x: 10 + TALK_RADIUS - 0.01, z: 0 }, list).id, 'far');
  assert.equal(pickTalkable({ x: 10 + TALK_RADIUS + 0.01, z: 0 }, list), null);
  assert.equal(pickTalkable({ x: 0, z: 0 }, []), null);
  assert.equal(TALK_RADIUS, 2.6);
});

test('freePayload: mode free, the player language, capped fields, persona + script context, last 6 turns', () => {
  const list = talkables(sceneNpcs, figures, situations);
  const omar = list.find((p) => p.id === 'omar');
  const history = Array.from({ length: 9 }, (_, i) => ({ who: i % 2 ? 'npc' : 'player', text: `t${i}` }));
  const p = freePayload(omar, 'ar', history, '  كيف   حالك؟ '.repeat(80), { ar: 'البيت — صباح الاثنين', en: 'Home — Monday Morning' });
  assert.equal(p.mode, 'free');
  assert.equal(p.lang, 'ar');
  assert.deepEqual(p.npc, { id: 'omar', name: 'عُمَر', role: 'جار آدم' });
  assert.equal(p.persona, 'يقف عُمَر عند الحوض. عُمَر عند الباب.');
  assert.equal(p.place, 'البيت — صباح الاثنين');
  assert.equal(p.history.length, 6);
  assert.equal(p.history[0].text, 't3');
  assert.ok(p.text.length <= 300);
  assert.equal(p.choices, undefined);
  const y = freePayload(list.find((x) => x.id === 'neighbor_yusuf'), 'en', [], 'hi', '');
  assert.equal(y.npc.name, 'Yusuf');
  assert.equal(y.persona, 'Loves his garden.');
  assert.equal(y.place, '');
  assert.ok(Buffer.byteLength(JSON.stringify(p)) < 16 * 1024);
});

test('strings: every key exists in the 5 languages; the AI note names the guide and the mosque imam', () => {
  for (const [k, v] of Object.entries(NEARBY_STR)) for (const lang of ['ar', 'en', 'es', 'zh', 'hi']) assert.ok(v[lang], `${k}.${lang}`);
  assert.equal(ns('prompt', 'ar', 'يوسف'), 'تحدّث مع يوسف');
  assert.equal(ns('prompt', 'en', 'Yusuf'), 'Talk to Yusuf');
  assert.equal(ns('note', 'ar'), 'محادثة بالذكاء الاصطناعي؛ للأحكام اسأل المرشد أو إمام المسجد.');
  assert.equal(ns('send', 'xx'), 'Send'); // unknown UI language falls back to English
});
