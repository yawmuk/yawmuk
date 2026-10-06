# Quran panel sources — «المصحف المرتل مع ترجمة المعاني»

The Quran panel in the mosque (`src/features/quran/`) shows **no Quran text, translation or tafsir typed by hand or produced by AI**. All of it comes from the endpoints below, either at runtime or through the offline bundle that `tools/quran/fetch.mjs` builds.

The competition's scientific package asks for *"النص القرآني بالرسم والنص المعتمد، مع ترجمات معتمدة لكل لغة مستخدمة (طبعة مجمع الملك فهد أو ترجماته أو الواردة في quranpedia.net)"*. The table shows how each source meets that.

| What | Source | Endpoint (all keyless, CORS `*`, checked 2026-10-06) | Why it counts as approved |
|---|---|---|---|
| Quran text (Hafs, Uthmani script) | Quran.com API v4 | `https://api.quran.com/api/v4/verses/by_chapter/{surah}?fields=text_qpc_hafs&per_page=300&page=1` | The `text_qpc_hafs` field is the **King Fahd Glorious Quran Printing Complex (KFGQPC) Hafs text**. `per_page=300` returns all 286 ayahs of Al-Baqarah on one page (`total_pages: 1` checked). |
| Second copy of the text, used for cross-checking | Encyclopedia of the Noble Quran (موسوعة القرآن الكريم) | `arabic_text` in the translation response below | It matches `text_qpc_hafs` exactly once the verse number and whitespace are ignored. |
| English translation of meanings (default for EN) | quranenc.com, `english_saheeh` v1.1.2 | `https://quranenc.com/api/v1/translation/sura/english_saheeh/{surah}` | Saheeh International, **issued by Noor International Center** (as quranenc.com states). It is labelled that way and **not** as a KFGQPC edition. |
| English translation, second option (selectable) | quranenc.com, `english_hilali_khan` v1.1.2 | `https://quranenc.com/api/v1/translation/sura/english_hilali_khan/{surah}` | "Translated by Taqi-ud-Din al-Hilali and Muhammad Muhsin Khan" (quranenc.com). The quranenc pages do not name a publisher, so the panel does not label it as a King Fahd Complex edition. |
| Concise Arabic tafsir (default for AR) | quranenc.com, `arabic_moyassar` | `https://quranenc.com/api/v1/translation/sura/arabic_moyassar/{surah}` | التفسير الميسر, as hosted by quranenc.com. The translations-list API publishes no version number for it (see Known limits). |
| Surah names and ayah counts | Quran.com API v4 | `https://api.quran.com/api/v4/chapters?language=en` and `?language=ar` | Bundled in `content/quran/surahs.json`: 114 surahs, 6236 ayahs, plus `bismillah_pre`. |
| Recitation audio, per ayah | EveryAyah | `https://everyayah.com/data/{folder}/{SSS}{AAA}.mp3` | Each folder returns `audio/mpeg` with `Access-Control-Allow-Origin: *` (checked with `curl -I`). |

## Reciters (EveryAyah folders)

| id | folder | reciter |
|---|---|---|
| `alafasy` | `Alafasy_128kbps` | Mishary Rashid Alafasy |
| `husary` | `Husary_128kbps` | Mahmoud Khalil Al-Husary |
| `minshawy` | `Minshawy_Murattal_128kbps` | Mohamed Siddiq Al-Minshawi (Murattal) |
| `abdulbasit` | `Abdul_Basit_Murattal_192kbps` | Abdul Basit Abdul Samad (Murattal) |

Two more folders were also checked and work: `MaherAlMuaiqly128kbps` and `Abdurrahmaan_As-Sudais_192kbps`. The basmala that opens a surah (every surah with `bismillahPre: true`) is played from `001001.mp3`. Its text is taken from the bundled Al-Fatiha 1:1 and is never typed.

## Terms of use

- **quranenc.com** ("Terms and Policies", quoted from the site): content may be republished provided there is (1) no modification, addition or deletion, (2) clear reference to the publisher and to QuranEnc.com, (3) the version number is mentioned, (4) transcript information is kept, (5) notes are sent back to QuranEnc.com, (6) the latest version is used, and (7) no inappropriate advertisements appear. How the panel complies:
  - Translations are shown **exactly as returned**, footnote markers included. The footnotes are listed under each ayah in a «حواشي الترجمة / Translator footnotes» disclosure.
  - The footer names the publisher, links to quranenc.com and shows the version (from `offline.json → translations`).
  - Every ayah has a link to that ayah on quranenc.com.
  - The game shows no advertising.
- **Quran.com API v4**: public read API, used read-only, with attribution and links in the footer.
- **EveryAyah**: public recitation files streamed through `<audio>`. Nothing is re-hosted.

## Verification

1. **At build time:** `node tools/quran/fetch.mjs`
   - Fetches `/chapters` and checks that there are 114 surahs and 6236 ayahs.
   - For each offline surah (1, 112, 113, 114), fetches the QPC Hafs text, `english_saheeh` and `arabic_moyassar`.
   - **Aborts without writing** if any ayah count disagrees with `/chapters`, if the ayah order is wrong, or if any ayah of `text_qpc_hafs` differs from quranenc's `arabic_text`. Only whitespace and the trailing Arabic-Indic verse number are ignored.
   - Writes `content/quran/surahs.json` and `content/quran/offline.json` with `fetchedAt`, the edition name, the cross-check statement, translation versions and the exact source URL of every surah.
2. **At runtime:**
   - Each surah is fetched from both sources in parallel and merged by `mergeVerses()` in `src/features/quran/lib.js`.
   - The Arabic shown is always the QPC Hafs text.
   - If an ayah differs from quranenc's copy, the panel shows a visible warning badge instead of hiding the mismatch.
   - If only one source answered, the ayah is labelled «من مصدر واحد / single source».
3. **Offline:**
   - If the network fails, surahs 1, 112, 113 and 114 load from the bundle and a notice says so.
   - Any other surah shows an error naming the four surahs that are available offline, plus a Retry button.
4. **Tests:** `node --test tests/quran.test.mjs` checks:
   - ayah counts 7/4/5/6, and 114 surahs / 6236 ayahs;
   - no Latin letters or digits in the Arabic text;
   - each footnote marker has its footnote;
   - provenance URLs;
   - URL builders (`001001`, `114006`, `002286`) and range checks;
   - attribution strings in both languages;
   - that Saheeh International is not labelled as a KFGQPC edition;
   - the mismatch flag.

## Known limits

- The quranenc translations-list API (`/api/v1/translations/list`) does not list `arabic_moyassar`, so its version number is not shown. The surah endpoint for it works.
- Audio needs a network connection, including for the four offline surahs. Their text and meanings still work without one.
- The text is rendered with the Amiri Quran web font that is already loaded in `index.html`, not with the KFGQPC page fonts, so the glyph shapes differ slightly from the printed Mushaf. The text itself is the KFGQPC text.
