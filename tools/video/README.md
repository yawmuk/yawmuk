# Demo video recorder

`record.mjs` records the ≤ 2:00 demo (shot list: `docs/VIDEO_SCRIPT.md`) automatically. It drives real Chrome (puppeteer-core, Metal GPU, 1920×1080), records each shot with the CDP screencast, burns in Arabic + English captions (rendered as PNGs by Chrome, because this ffmpeg has no drawtext), adds title and end cards, and joins everything into an H.264 yuv420p 30 fps faststart MP4 with no audio. Loading waits are never recorded. The script fails if the result is longer than 120 s.

Shots: title → town walk to the bank door → mosque prayer panel + «استماع للأذان» → Quran panel (ayah + play) → adhkar → bank cards + zakat calculator → home dialogue → choice → ruling card → guide question «لماذا يتجنب المسلمون الفائدة؟» → personal mortgage question → referral → «أرسل سؤالك إلى أهل العلم» → ticket code → `/experts` with the question open → `/results` → end card.

## Live run (the submission video)

```bash
cd /Users/abusham/Downloads/islamicaich/project/yawmuk
EXPERTS_PASSCODE='<dashboard passcode>' node tools/video/record.mjs \
  --base https://yawmuk-851682870274.us-central1.run.app \
  --out /Users/abusham/Downloads/islamicaich/submission/video/yawmuk-demo.mp4
```

The passcode is typed before that shot is recorded, so it never appears on screen. If `EXPERTS_PASSCODE` is not set, the login step is skipped and the shot shows whatever `/experts` shows. **Note:** the run submits two real questions to the scholars' queue («لماذا يتجنب…» and the Ohio mortgage one). Remove them from the live queue afterwards if needed.

## Local dry run (as done on 2026-10-06)

```bash
S=/private/tmp/yawmuk-video   # any scratch dir
rsync -a --exclude node_modules --exclude .git --exclude dist ./ $S/yk/ && ln -sfn "$PWD/node_modules" $S/yk/node_modules
(cd $S/yk && npx vite build --outDir dist)
(cd $S/yk && PORT=8095 DATA_DIR=$S/data EXPERTS_PASSCODE=demo-pass-2026 SESSION_SECRET=0123456789abcdef0123456789abcdef node server.mjs &)
EXPERTS_PASSCODE=demo-pass-2026 node tools/video/record.mjs --base http://localhost:8095 \
  --out /Users/abusham/Downloads/islamicaich/submission/video/yawmuk-demo-local.mp4 --work $S/work
```

Locally there is no `ANTHROPIC_API_KEY`, so the guide answers with its fallback text instead of an AI answer with citations.

Options: `--out`, `--work <dir>` (frames + segments), `--live-url` (shown on the end card), `--town-door bank|school|…` (the door Adam walks toward), `--only town,ruling,…` (re-record some shots for debugging), `--headful`. The env vars `CHROME_PATH` and `FFMPEG` override the default paths. A thumbnail (the title card) is written next to the MP4 as `*-thumbnail.png`.
