# Adhkar sources and verification — «يومك»

Feature: `src/features/adhkar/` (panel `open({ lang, onClose })`). Data: `content/adhkar/adhkar.json`. Raw source records used: `content/adhkar/source_snapshot.json`. Tests: `tests/adhkar.test.mjs`.

## Method

1. **Text.** Arabic and English were fetched from the Hisn al-Muslim API (Sa'id ibn Wahf al-Qahtani): `https://www.hisnmuslim.com/api/ar/husn_ar.json` → chapter files `https://www.hisnmuslim.com/api/ar/{chapter}.json` and the English counterparts under `/api/en/`. Nothing was typed from memory. Only formatting was removed (the `(( ))` wrappers and count instructions such as «ثلاث مرات», which the counter shows). Where Hisn al-Muslim adds a bracketed phrase from outside the cited hadith, that phrase is left out and the omission is noted on the item.
2. **Qur'an.** The text of al-Ikhlas, al-Falaq and an-Nas comes from QuranEnc (King Fahd Complex), `https://quranenc.com/api/v1/translation/sura/english_saheeh/{112,113,114}`. It is Madinah Mushaf text, not Hisn al-Muslim's retyped text. The translation of meanings is Saheeh International as published on QuranEnc, with the footnote markers removed.
3. **Hadith number and wording.** Every reference was checked against the Arabic text of the six books. The source is fawazahmed0/hadith-api (the same text as sunnah.com), using the copy cached by `tools/audit/verify.mjs`. A wording fragment (`matn_fragment`) from each cited hadith is stored with the reference. Sahih Muslim uses the Fu'ad Abd al-Baqi numbering.
4. **Grade.** An item is included only if its hadith is in al-Bukhari or Muslim, or al-Albani graded it Sahih or Hasan. Each hadith from the Sunan was also looked up on **dorar.net**, through `https://dorar.net/dorar_api.json?skey=…`, fetched in a browser on 2026-10-06. The matching record (المحدث / المصدر / الرقم / الحكم) is stored on the item (`dorar`), and every query result is saved in the snapshot. The test suite checks that each stored record really appears in the fetched results.
5. **Virtue lines.** These appear only when the wording is in the cited hadith itself. The Arabic is the hadith text; the English is the sunnah.com translation, taken from the hadith-api English editions.
6. **English corrections.** Two corrections are marked on the items as `erratum`. Hisn EN says "All-Seeing" for «السميع», which was corrected to "All-Hearing". Hisn EN says "I live and die" for «أموت وأحيا», which was reordered to match the Arabic. One line is our own guidance, not source text: the English evening note on `me_asbahna_mulk` ("In the evening, say …"). Hisn EN has no evening wording for that item, and the Arabic evening note shown beside it is verbatim from the source.

## Items (27)

| id | tab | Hisn # | ×  | references (grade — grader) | dorar.net record |
|---|---|---|---|---|---|
| `me_mu3awwidhat` | both | 76 | 3 | Sunan Abi Dawud 5082 (حسن — الألباني); Jami' at-Tirmidhi 3575 (حسن — الألباني) | الألباني، صحيح أبي داود 5082: حسن; الألباني، صحيح الترمذي 3575: حسن |
| `me_asbahna_mulk` | both | 77 | 1 | Sahih Muslim 2723 (صحيح — مسلم (أخرجه في صحيحه)) | — (Sahihayn) |
| `me_bika_asbahna` | both | 78 | 1 | Jami' at-Tirmidhi 3391 (صحيح — الألباني); Sunan Abi Dawud 5068 (صحيح — الألباني) | الألباني، صحيح ابن ماجه 3133: صحيح |
| `me_sayyid_istighfar` | both | 79 | 1 | Sahih al-Bukhari 6306 (صحيح — البخاري (أخرجه في صحيحه)) | — (Sahihayn) |
| `me_afw_afiya` | both | 84 | 1 | Sunan Abi Dawud 5074 (صحيح — الألباني); Sunan Ibn Majah 3871 (صحيح — الألباني) | الألباني، صحيح ابن ماجه 3135: صحيح |
| `me_alim_ghayb` | both | 85 | 1 | Jami' at-Tirmidhi 3392 (صحيح — الألباني); Jami' at-Tirmidhi 3529 (صحيح — الألباني) | الترمذي، سنن الترمذي 3392: حسن صحيح |
| `me_bismillah_la_yadurr` | both | 86 | 3 | Sunan Abi Dawud 5088 (صحيح — الألباني); Jami' at-Tirmidhi 3388 (حسن صحيح — الألباني) | الألباني، صحيح الأدب المفرد 513: حسن صحيح |
| `me_subhanallah_100` | both | 91 | 100 | Sahih Muslim 2692 (صحيح — مسلم (أخرجه في صحيحه)) | — (Sahihayn) |
| `me_tahlil_100` | morning | 93 | 100 | Sahih al-Bukhari 3293 (صحيح — البخاري (أخرجه في صحيحه)); Sahih Muslim 2691 (صحيح — مسلم (أخرجه في صحيحه)) | — (Sahihayn) |
| `me_subhanallah_adada_khalqih` | morning | 94 | 3 | Sahih Muslim 2726 (صحيح — مسلم (أخرجه في صحيحه)) | — (Sahihayn) |
| `me_kalimat_tammat` | evening | 97 | 1 | Sahih Muslim 2709 (صحيح — مسلم (أخرجه في صحيحه)) | — (Sahihayn) |
| `day_istighfar_100` | daily | 96 | 100 | Sahih Muslim 2702 (صحيح — مسلم (أخرجه في صحيحه)); Sahih al-Bukhari 6307 (صحيح — البخاري (أخرجه في صحيحه)) | — (Sahihayn) |
| `day_wake_ahyana` | daily | 1 | 1 | Sahih al-Bukhari 6312 (صحيح — البخاري (أخرجه في صحيحه)) | — (Sahihayn) |
| `day_wake_afani` | daily | 3 | 1 | Jami' at-Tirmidhi 3401 (حسن — الألباني) | الألباني، صحيح الترمذي 3401: حسن |
| `day_restroom_enter` | daily | 10 | 1 | Sahih al-Bukhari 142 (صحيح — البخاري (أخرجه في صحيحه)) | — (Sahihayn) |
| `day_restroom_exit` | daily | 11 | 1 | Sunan Abi Dawud 30 (صحيح — الألباني); Jami' at-Tirmidhi 7 (صحيح — الألباني) | الألباني، صحيح أبي داود 30: صحيح |
| `day_leave_home_tawakkul` | daily | 16 | 1 | Sunan Abi Dawud 5095 (صحيح — الألباني); Jami' at-Tirmidhi 3426 (صحيح — الألباني) | الألباني، صحيح أبي داود 5095: صحيح |
| `day_leave_home_dalal` | daily | 17 | 1 | Sunan Abi Dawud 5094 (صحيح — الألباني) | الألباني، صحيح أبي داود 5094: صحيح |
| `day_mosque_enter` | daily | 20 | 1 | Sunan Abi Dawud 466 (صحيح — الألباني); Sahih Muslim 713 (صحيح — مسلم (أخرجه في صحيحه)); Sunan Abi Dawud 465 (صحيح — الألباني) | الألباني، صحيح أبي داود 466: صحيح |
| `day_mosque_exit` | daily | 21 | 1 | Sahih Muslim 713 (صحيح — مسلم (أخرجه في صحيحه)); Sunan Ibn Majah 773 (صحيح — الألباني) | الألباني، صحيح ابن ماجه 634: صحيح |
| `day_eat_before` | daily | 178 | 1 | Sunan Abi Dawud 3767 (صحيح — الألباني); Sunan Ibn Majah 3264 (صحيح — الألباني) | الألباني، صحيح الترمذي 1858: صحيح |
| `day_eat_after` | daily | 180 | 1 | Sunan Abi Dawud 4023 (حسن — الألباني); Jami' at-Tirmidhi 3458 (حسن — الألباني) | الألباني، صحيح أبي داود 4023: حسن دون زيادة: "وما تأخر" في الموضعين |
| `day_sleep_bismika` | daily | 105 | 1 | Sahih al-Bukhari 6324 (صحيح — البخاري (أخرجه في صحيحه)) | — (Sahihayn) |
| `day_sleep_qini` | daily | 104 | 1 | Sunan Abi Dawud 5045 (صحيح — الألباني); Jami' at-Tirmidhi 3399 (صحيح — الألباني) | الألباني، صحيح الترمذي 3399: صحيح |
| `day_sleep_tasbih` | daily | 106 | 100 | Sahih al-Bukhari 5361 (صحيح — البخاري (أخرجه في صحيحه)); Sahih Muslim 2727 (صحيح — مسلم (أخرجه في صحيحه)) | — (Sahihayn) |
| `day_sleep_aslamtu` | daily | 111 | 1 | Sahih al-Bukhari 6313 (صحيح — البخاري (أخرجه في صحيحه)) | — (Sahihayn) |
| `day_sleep_nafth` | daily | 99 | 3 | Sahih al-Bukhari 5017 (صحيح — البخاري (أخرجه في صحيحه)) | — (Sahihayn) |

## Excluded from Hisn al-Muslim, and why

- Hisn #18: Entering home formula «بسم الله ولجنا…» — Abu Dawud 5096, al-Albani: Daif.
- Hisn #80: «اللهم إني أصبحت أشهدك…» — Abu Dawud 5069, al-Albani: Daif.
- Hisn #81: «اللهم ما أصبح بي من نعمة…» — Abu Dawud 5073, al-Albani: Daif.
- Hisn #87: «رضيت بالله ربا…» — Abu Dawud 5072 / Tirmidhi 3389, al-Albani: Daif.
- Hisn #89: «أصبحنا وأصبح الملك لله رب العالمين… فتحه ونصره» — Abu Dawud 5084, al-Albani: Daif.
- Hisn #82: «اللهم عافني في بدني…» — Abu Dawud 5090, al-Albani: Hasan al-isnad only; excluded for strictness.
- Hisn #95: «اللهم إني أسألك علما نافعا…» — Ibn Majah 925: al-Albani Sahih, but Shu'ayb al-Arna'ut, Ibn Baz and Ibn Uthaymin weakened it (unknown narrator); excluded as contested.
- Hisn #83: «حسبي الله…» ×7 — outside the six books; not machine-verifiable in the time available.
- Hisn #88: «يا حي يا قيوم…» — outside the six books; not machine-verifiable in the time available.
- Hisn #19: Going to the mosque (long «نور» supplication) — Hisn wording is a composite longer than Bukhari 6316 / Muslim 763.
- Hisn #75: Ayat al-Kursi for morning/evening — evidence is outside the six books (al-Nasa'i al-Kubra / al-Hakim); omitted in this build.

Items from outside the six books, such as Ayat al-Kursi in the morning and evening, «حسبي الله» and «يا حي يا قيوم», were left out of this build. They can be added once someone checks each one by hand on dorar.net. Reciting the dhikr when entering the home has no formula here: the only Hisn al-Muslim formula (Abu Dawud 5096) is graded Da'if by al-Albani. Sahih Muslim 2018 supports the general instruction to remember Allah on entering.

## Notes on differing grades

- `day_eat_after` (Abu Dawud 4023 / Tirmidhi 3458): al-Albani graded it Hasan, without the addition «وما تأخر». Shu'ayb al-Arna'ut graded its chain weak. The panel shows this note to the user.
- `day_sleep_qini`: al-Albani doubted the «ثلاث مرات» addition, so the counter is set to 1 and the reason is shown.
- `me_kalimat_tammat`: Hisn al-Muslim gives three repetitions. The Sahih Muslim narration cited here gives no number, so the counter is 1 and a note explains why.

## How to verify

- `npm test`: `tests/adhkar.test.mjs` runs offline. It checks that every Arabic text is a verbatim substring of the saved Hisn record, that every English text is in the source or carries a documented erratum, that each reference has a book, number, allowed grade and named grader, that every dorar record is present in the saved dorar responses, that weak-graded hadith are absent and their exclusions documented, and that counters are valid.
- Each card's "Reference and grading" section links to sunnah.com (the hadith text), dorar.net (a search for the wording), QuranEnc and the Hisn al-Muslim API.
- Audio (Hisn al-Muslim recitation) is streamed over https from `https://www.hisnmuslim.com/audio/ar/{id}.mp3`. It is offered only where the text on screen is the whole Hisn item (bracketed evening notes aside). It is not offered on shortened items.

Checked: 2026-10-06. No text in this feature is AI-generated.
