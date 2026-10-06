# Islamic bank: sources and how they were checked

Content file: `content/bank/cards.json`. Panel: `src/features/bank/`. Scene: `src/scenes/bank.js`.

## Rules followed

- The cards do not write any new verdict. Each position is reported from a named body and linked to the page that reports it. For the game's own rulings, the cards link by id to `home.mortgage`, `home.credit_card`, `work.retirement_401k` and `school.student_loan`, which open the existing ruling card.
- The cards contain no Quran or hadith text. The one Quran reference (Al-Baqarah 2:275) is a link to QuranEnc.
- Level ج items (tawarruq, takaful, and the interest-mortgage point in the comparison) are marked `disputed`. They name at least two bodies and carry no certainty wording and no "confidence" field. `tests/bank.test.mjs` enforces this.
- The zakat calculator never fetches prices; the user types them in. It shows both thresholds and attributes each one (see below). It is labelled general education, not a fatwa.
- All of this was prepared by AI from the pages below (`review_status: ai_draft`). A scholar has not reviewed it yet.

## Verified on 2026-10-06

Each page was opened, and the title and the quoted resolution text were checked against its content. Dorar pages were read through a reader proxy because dorar.net blocks automated clients.

| Topic | Page | What it supports |
|---|---|---|
| Riba | https://dorar.net/feqhia/7595 | Ruling on riba; reported consensus |
| Bank interest | https://shamela.ws/book/968/1267 | Text of IIFA 10 (10/2): «كل زيادة أو فائدة على الدين الذي حل أجله… وكذلك الزيادة أو الفائدة على القرض منذ بداية العقد… هاتان الصورتان ربا محرم شرعاً» |
| Murabaha | https://dorar.net/feqhia/7136 | Permitted if the promise is non-binding, not permitted if binding on both parties; IIFA 5th session, Kuwait 1988 |
| Murabaha | https://shamela.ws/book/968/1614 | Quoted text of the IIFA resolution on keeping promises (2 and 3 of the 5th session) |
| Ijara muntahia bittamleek | https://dorar.net/feqhia/8182, https://dorar.net/feqhia/8180 | IIFA 110 (4/12), Riyadh 2000: conditions for the permitted forms and the prohibited forms |
| Diminishing musharaka | https://dorar.net/feqhia/8555, https://dorar.net/feqhia/8557 | IIFA 15th session, Muscat 2004; AAOIFI Shari'ah Standard No. 12; conditions |
| Mudaraba | https://dorar.net/feqhia/8380, https://dorar.net/feqhia/8382 | Definition; permitted in principle |
| Tawarruq | https://dorar.net/feqhia/7195 | Individual tawarruq: Hanbali (permitted), Maliki (disliked); MWL Fiqh Council, 15th session 1419 AH |
| Organised tawarruq | https://dorar.net/feqhia/7197 | IIFA 179 (5/19) and the MWL Fiqh Council, 17th session (2003): not permitted |
| Insurance | https://dorar.net/feqhia/7031 | Cooperative insurance permitted (IIFA, MWL, Al-Azhar IRA, ECFR, Permanent Committee); commercial insurance prohibited in general (IIFA 9 (9/2), MWL, Council of Senior Scholars) |
| Sukuk | https://dorar.net/feqhia/7344, https://dorar.net/feqhia/7346 | Definition; trading rules from IIFA 30 (3/4) and 178 (4/19) |
| Zakat on gold and silver | https://dorar.net/feqhia/2125, https://dorar.net/feqhia/2157 | Zakat is obligatory; the rate is a quarter of a tenth (2.5%) |
| Nisab in grams | https://dorar.net/feqhia/2153 | 20 mithqal × 4.25 g = 85 g of gold; 200 dirham × 2.975 g = 595 g of silver (Ibn Uthaymeen; Contemporary Zakat Issues seminars) |
| Paper money | https://dorar.net/feqhia/2162 | Zakat is due; the nisab is the lower of the two thresholds (MWL Fiqh Council, Council of Senior Scholars, Permanent Committee, Ibn Baz) |

## AAOIFI standard numbers

Search results confirmed these numbers: No. 8 Murabahah, No. 9 Ijarah and Ijarah Muntahia Bittamleek, No. 13 Mudarabah and No. 17 Investment Sukuk. No. 12 is cited on the Dorar page. The numbers for the insurance, tawarruq and zakah standards could not be verified, so those cards do not cite them. The cards link to https://aaoifi.com/ as the institutional page. AAOIFI's standards are sold, so no free deep link is given.

## Not verified, so not used

- IIFA resolution pages on iifa-aifi.org: the resolutions URL returns 404. The cards cite the resolution number and link to the Dorar or Shamela page that quotes it.
- Any live gold or silver price.
