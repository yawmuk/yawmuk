# «يومك» micro-study protocol (Track 3 success metric)

**Question.** Does playing «يومك» improve a newcomer's understanding of how Muslims handle everyday situations? Does the AI-personalised journey do better than the fixed route?

**Design.** Pre/post, within-subject, with two arms assigned by alternation (between-subject).
- **Arms.** Participants alternate by enrolment order: 1st AI-personalised (`?arm=ai`), 2nd fixed route (`?arm=fixed`), and so on. The server makes the assignment (`POST /.netlify/functions/study {action:'enroll'}`). Pilot runs (`?pilot=1`) are left out of the alternation and of every estimate.
- **Realized arm.** The AI arm only happens when the participant picks a day context on the start screen and the AI planner answers. Otherwise the game uses its deterministic fallback, which is the fixed order. At post-test the game's `plan.source` is recorded, and the dashboard reports **both** the assigned arm (intention-to-treat) and the realized arm, along with how many participants differ between the two.
- **Instrument.** Five multiple-choice concept items, copied word for word from the reviewed `check_question` of five situations (`src/features/study/questions.js`; a test fails if any copy drifts from its source):

| Concept | Ruling card |
|---|---|
| Riba (interest on debt) | `home.credit_card` |
| Maysir (gambling) | `street.lottery` |
| Luqata (lost property) | `street.lost_wallet` |
| Honesty (cheating) | `school.cheating` |
| When to ask a scholar | `private_events.neighbor_funeral` |

  Every item also offers "I don't know", which is scored as incorrect. The post-test asks the same items in a fixed rotated order. We planned a tawhid item, but the game has no reviewed tawhid card, so we did not write one.
- **Secondary measures.** Three Likert items (1–5): clarity, respectful tone, and "I know my next step (and when to ask a scholar)". Also an optional comment (≤300 chars; emails and phone numbers are stripped; never published), the number of situations finished, and how many of the 5 tested situations were actually played (exposure).
- **Telemetry.** Sent only while a participant is enrolled, as anonymous counts: day started, situation finished, day finished, and ask-panel outcome (answered, abstain, refer). No question text is ever sent.
- **Analysis** (`src/features/study/stats.js`, live at `/results.html`). The analysis computes each participant's gain as post minus pre, and reports the mean of each arm with a 95% t-interval. It compares the arms by Welch difference with a 95% interval. Any estimate built on fewer than **5** completed participants per arm shows as "insufficient data". The page also shows the completion rate (post ÷ pre) and the per-item before/after correct rate.

## Ethics and privacy
- Participation is opt-in. The consent screen (ar/en) explains the study, the 18+ requirement and the right to stop at any time.
- No name, email, phone, location, religion or belief is asked, and none is inferred. No IP address or user agent is stored; the rate limiter keeps the client key in memory only.
- Each participant gets a random 10-character code. It is the only key linking their answers, and it is shown to them so they can delete their record: in-game through "Leave and delete my data", or at `/results.html` → Withdraw.
- Results are published only as aggregates. The public CSV has no free text. Comments appear only in the CSV when the request sends `x-study-key: $STUDY_ADMIN_KEY`.
- The game content is educational, not a fatwa, and the consent screen discloses that AI is used.
- **Never type in data, "fix" scores or add made-up rows.** The dashboard shows only real submissions. If fewer than 5 people per arm complete, report "insufficient data" and the raw counts.

## Running 5–8 participants tonight (facilitator script)

**Before (10 min)**
1. Deploy with persistent storage. On Cloud Run, set `STORE=firestore`; the local JSON store is lost when the instance restarts. Open `/results.html` and confirm it loads and shows the store type.
2. Do one dry run with `?study=1&pilot=1`. Pilot runs are labelled and left out of the results.
3. Use a fresh browser profile or private window for each participant, or a different device. The study clears the game's saved day when the participant starts, so everyone begins with a new day.

**Recruit.** Adults (18+) from the target group: non-Muslims, new Muslims, or people curious about Islam in an everyday US setting. Do not ask about anyone's religion. Record who took part only in terms of the arm sequence the server reports.

**Script (read aloud, in their language)**
> "Thanks for helping. This is a short educational game about how Muslims handle everyday situations. It is not a test of you, and there are no wrong reasons to pick 'I don't know'. We don't collect your name or anything about your beliefs. You can stop at any time. It takes about 20 minutes."

1. Open `https://<app>/?study=1` (add `&lang=en` for English). The participant reads the consent screen and ticks the 18+/agree box **themselves**.
2. They answer the 5 questions. Don't help, and don't explain terms.
3. On the "Now play your day" screen they press **Start playing**, then choose **New day**, then **pick any day context** in the picker. Give both arms the same instruction; the participant does not know their arm. They may skip the game's own 3-question check.
4. They play for 10–15 minutes, at least 3 situations. Answer only usability questions ("how do I walk?"), never content questions. If they ask about Islam, point them to the in-game Ask panel.
5. They press **Finish study** (bottom of the screen) → **Final questions now**, then complete the questions, the ratings and the optional comment.
6. The thank-you screen shows their before/after score and the correct answers with the ruling cards behind them. Tell them they can keep the code to delete their data later.

**After.** Refresh `/results.html`, download the CSV, and screenshot the dashboard with its timestamp for the presentation. Report exactly what it says: N per arm, the gains with intervals or "insufficient data", the completion rate, the arm mismatch, and the limitations listed on the page.

## Known limitations (also stated on the dashboard)
- Small convenience sample collected on submission night: this is a pilot signal, not proof.
- Repeating the same items before and after can produce a testing effect.
- Arms alternate rather than being randomised, and the realized arm can differ from the assigned one.
- The game's own end-of-day measure (3 items, collected with consent) is shown separately. It is not merged with the study.
