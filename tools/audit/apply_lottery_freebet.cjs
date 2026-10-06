// Adds a sourced practical-guidance bullet on promotional "free bets" to street.lottery (idempotent).
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', '..', 'content', 'rulings', 'street.json');
const a = JSON.parse(fs.readFileSync(f, 'utf8'));
const r = a.find(x => x.id === 'street.lottery');
const AR = '«الرهان المجاني» (free bet) في تطبيقات المراهنات ليس كالسحب المجاني الذي «لا يشترط شراءً»: فهو رهان على نتيجة مباراة يقوم بها غيرك، وقد نص قرار مجمع الفقه الإسلامي الدولي 127 على تحريم «المراهنة بين طرفين أو أكثر على نتيجة فعل يقوم به غيرهم»، وهو يقتضي فتح حساب في منصة قمار، وغالباً ما يُربط بإيداع أو بشرط مراهنة لاحقة، فهو باب إلى الميسر الذي أُمرنا باجتنابه ﴿فاجتنبوه﴾ (المائدة 90)، وقد أمر النبي ﷺ من قال لصاحبه «تعال أقامرك» أن يتصدق (البخاري 4860)، فكيف بالدخول فيه. فلا تسجّل في هذه التطبيقات لأجل العروض المجانية.';
const EN = 'A promotional "free bet" in a betting app is not like a "no purchase necessary" sweepstakes: it is a wager on the outcome of a game played by others, and IIFA Resolution 127 prohibits "betting between two or more parties on the result of an act performed by others"; it also requires opening an account on a gambling platform and is often tied to a deposit or further wagering requirements, so it is a door to the maysir we are commanded to avoid ("so avoid it", 5:90). The Prophet ﷺ ordered whoever merely says "come, let me gamble with you" to give charity (Bukhari 4860), so taking part is graver. Do not sign up to these apps for their free offers.';
const has = r.practical_guidance.ar.some(s => s.includes('الرهان المجاني'));
if (!has) {
  r.practical_guidance.ar.splice(1, 0, AR);
  r.practical_guidance.en.splice(1, 0, EN);
  r.notes_for_reviewer += '\n\n[تدقيق — إضافة «الرهان المجاني»، 2026-10-05] أُضيف بند في practical_guidance (عربي/إنجليزي) عن الرهانات المجانية الترويجية في تطبيقات المراهنة، مبني حصراً على أدلة موجودة في الملف: قرار المجمع 127 (تحريم المراهنة على نتيجة فعل الغير)، والمائدة 90 (الأمر بالاجتناب)، وحديث البخاري 4860. هو تخريج من المدقق لا فتوى منقولة؛ وعبارة «غالباً ما يُربط بإيداع أو بشرط مراهنة» وصف عام لممارسة السوق يحتاج تأكيد المراجع. يسند هذا وسم السيناريو wrong لخيار «الرهان المجاني».';
}
fs.writeFileSync(f, JSON.stringify(a, null, 2) + '\n');
console.log(has ? 'already present' : 'added');
