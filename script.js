'use strict';
/* =========================================================
   الحاسبة العلمية الذكية — script.js
   المحرك: math.js (حساب عددي ومصفوفات) + nerdamer (اشتقاق/تكامل/حل رمزي)
   الرسم: Plotly.js | التعرف على الصور: Tesseract.js
   ========================================================= */

/* ---------- 1) أدوات مساعدة ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
/* إعدادات المستخدم: الدقة، الصيغة العلمية، الاهتزاز */
const cfg = store.get('cfg', { prec: 10, sci: false, vib: false });
const buzz = () => { if (cfg.vib && navigator.vibrate) navigator.vibrate(12); };
const fmt = x => { try { if (typeof x === 'number') return cfg.sci ? x.toExponential(cfg.prec - 1) : String(+x.toPrecision(cfg.prec)); return math.format(x, { precision: cfg.prec }); } catch { return String(x); } };
let favs = store.get('favs', []);   // الأدوات المفضلة
let vars = store.get('vars', {});      // المتغيرات المخصصة المحفوظة
let hist = store.get('hist', []);      // سجل العمليات
/* دوال مثلثية بالدرجات تُستخدم في وضع DEG */
const D = Math.PI / 180;
const TRIG = { sind: x => Math.sin(x * D), cosd: x => Math.cos(x * D), tand: x => Math.tan(x * D), asind: x => Math.asin(x) / D, acosd: x => Math.acos(x) / D, atand: x => Math.atan(x) / D };
const scope = () => ({ ...TRIG, ...vars });
/* تحويل نص حقل إلى رقم (يقبل تعبيرات مثل 3*4 والمتغيرات المحفوظة) */
const num = t => {
  const v = math.evaluate(String(t), scope());
  if (typeof v !== 'number' || !isFinite(v)) throw new Error('NaN:' + t);
  return v;
};

/* ---------- 2) شرح الأخطاء بلغة مفهومة ---------- */
function explain(e) {
  const m = String((e && e.message) || e); let x;
  if (m[0] === '!') return m.slice(1);
  if (m === 'DIV0') return 'حدثت قسمة على صفر (أو نتيجة لا نهائية). المقام يجب ألا يساوي صفراً؛ راجع القيم الموجودة في المقام وغيّرها.';
  if (m === 'MULTI') return 'اترك حقلاً واحداً فقط فارغاً — وهو المجهول الذي تريد حسابه — واملأ بقية الحقول.';
  if (m === 'NOSOL') return 'لا يوجد حل حقيقي بهذه المعطيات؛ قد تكون القيم متناقضة (مثل جيب زاوية أكبر من 1، أو جذر عدد سالب). عدّل المعطيات وأعد المحاولة.';
  if (m.startsWith('NaN:')) return `القيمة «${m.slice(4)}» ليست رقماً صالحاً. اكتب رقماً مثل 12.5 أو تعبيراً مثل 3*4.`;
  if ((x = /Undefined symbol (\w+)/.exec(m))) return `الرمز «${x[1]}» غير معرّف. اكتب قيمته، أو احفظه في قسم «المتغيرات»، وتحقّق من اسم الدالة (مثل sin وليس sen).`;
  if (/singular|determinant is zero/i.test(m)) return 'المصفوفة شاذة (محددها يساوي صفراً) فلا يوجد لها معكوس.';
  if (/dimension|size|square/i.test(m)) return 'أبعاد المصفوفة لا تناسب العملية (المحدد والمعكوس والقيم الذاتية تحتاج مصفوفة مربعة). الصيغة الصحيحة مثل [[1,2],[3,4]].';
  if (/Units do not match|not found|Unit/i.test(m) && /unit/i.test(m)) return 'الوحدتان غير متوافقتين أو إحداهما غير معروفة. اكتب الوحدة بالرمز الإنجليزي (مثل km, m, kg, lb, degC, degF, bar, psi, kWh) وتأكد أنهما من نفس النوع (طول إلى طول مثلاً).';
  if (/Parenthes|Unexpected|Syntax|Value expected|char/i.test(m)) return 'صياغة التعبير غير صحيحة: تحقّق من الأقواس وعلامات العمليات (* و / و ^) وأن لكل عملية طرفين. التفاصيل: ' + m;
  return 'تعذّر إتمام العملية: ' + m;
}

/* ---------- 3) الرسم التفاعلي ---------- */
const plot = (traces, layout = {}) => id => {
  const el = document.getElementById(id);
  if (typeof Plotly === 'undefined') { el.textContent = 'مكتبة الرسم غير متاحة (تحتاج اتصالاً بالإنترنت في أول تشغيل).'; return; }
  const cs = getComputedStyle(document.documentElement), c = cs.getPropertyValue('--tx').trim(), ac = cs.getPropertyValue('--ac').trim();
  Plotly.newPlot(id, traces.map(t => ({ line: { color: ac }, ...t })), {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: c, family: 'Cairo' },
    margin: { t: 30, r: 10, b: 40, l: 45 }, ...layout
  }, { responsive: true, displaylogo: false });
};

/* ---------- 4) قاموس القوانين (فيزياء/ميكانيكا/كيمياء) ----------
   eq: المعادلة | v: المتغيرات ووحداتها | c: ثوابت | num: حل عددي فقط
   المستخدم يترك المجهول فارغاً فيُحل تلقائياً */
const FM = [
  // الفيزياء
  { s: 'phys', id: 'newton', n: 'قانون نيوتن الثاني', eq: 'F=m*a', v: { F: 'N', m: 'kg', a: 'm/s²' } },
  { s: 'phys', id: 'kin', n: 'الطاقة الحركية', eq: 'KE=1/2*m*v^2', v: { KE: 'J', m: 'kg', v: 'm/s' } },
  { s: 'phys', id: 'v1', n: 'السرعة بتسارع ثابت', eq: 'v=u+a*t', v: { v: 'm/s', u: 'm/s', a: 'm/s²', t: 's' } },
  { s: 'phys', id: 'd1', n: 'الإزاحة بتسارع ثابت', eq: 's=u*t+1/2*a*t^2', v: { s: 'm', u: 'm/s', a: 'm/s²', t: 's' } },
  { s: 'phys', id: 'ohm', n: 'قانون أوم', eq: 'V=I*R', v: { V: 'V', I: 'A', R: 'Ω' } },
  { s: 'phys', id: 'pwr', n: 'القدرة الكهربائية', eq: 'P=V*I', v: { P: 'W', V: 'V', I: 'A' } },
  { s: 'phys', id: 'par', n: 'مقاومتان على التوازي', eq: '1/Rt=1/R1+1/R2', v: { Rt: 'Ω', R1: 'Ω', R2: 'Ω' } },
  { s: 'phys', id: 'kvl', n: 'كيرشوف للجهد (حلقة)', eq: 'E=I*(R1+R2+r)', v: { E: 'V', I: 'A', R1: 'Ω', R2: 'Ω', r: 'Ω' } },
  { s: 'phys', id: 'coul', n: 'قانون كولوم', eq: 'F=k*q1*q2/r^2', v: { F: 'N', q1: 'C', q2: 'C', r: 'm' }, c: { k: 8.99e9 } },
  { s: 'phys', id: 'ind', n: 'الحث الكهرومغناطيسي', eq: 'E=L*dI/dt', v: { E: 'V', L: 'H', dI: 'A', dt: 's' } },
  { s: 'phys', id: 'heat', n: 'الحرارة النوعية', eq: 'Q=m*c*dT', v: { Q: 'J', m: 'kg', c: 'J/(kg·K)', dT: 'K' } },
  { s: 'phys', id: 'eff', n: 'كفاءة المحرك الحراري', eq: 'eta=1-Qc/Qh', v: { eta: '(نسبة)', Qc: 'J', Qh: 'J' } },
  { s: 'phys', id: 'wrk', n: 'الشغل عند ضغط ثابت', eq: 'W=P*dV', v: { W: 'J', P: 'Pa', dV: 'm³' } },
  { s: 'phys', id: 'snell', n: 'قانون سنيل (البصريات)', eq: 'n1*sin(a1*pi/180)=n2*sin(a2*pi/180)', v: { n1: '', a1: '°', n2: '', a2: '°' } },
  { s: 'phys', id: 'lens', n: 'معادلة العدسة', eq: '1/f=1/u+1/w', v: { f: 'm', u: 'm', w: 'm' } },
  { s: 'phys', id: 'wave', n: 'معادلة الموجة', eq: 'v=f*lam', v: { v: 'm/s', f: 'Hz', lam: 'm' } },
  // الميكانيكا والهندسة
  { s: 'mech', id: 'mom', n: 'الزخم الخطي', eq: 'p=m*v', v: { p: 'kg·m/s', m: 'kg', v: 'm/s' } },
  { s: 'mech', id: 'torque', n: 'العزم', eq: 'tau=F*r*sin(th*pi/180)', v: { tau: 'N·m', F: 'N', r: 'm', th: '°' } },
  { s: 'mech', id: 'fric', n: 'الاحتكاك', eq: 'f=mu*m*g', v: { f: 'N', mu: '', m: 'kg' }, c: { g: 9.81 } },
  { s: 'mech', id: 'ramp', n: 'التسارع على مستوى مائل', eq: 'a=g*(sin(th*pi/180)-mu*cos(th*pi/180))', v: { a: 'm/s²', th: '°', mu: '' }, c: { g: 9.81 } },
  { s: 'mech', id: 'stress', n: 'الإجهاد', eq: 'sigma=F/A', v: { sigma: 'Pa', F: 'N', A: 'm²' } },
  { s: 'mech', id: 'strain', n: 'الانفعال', eq: 'eps=dL/L0', v: { eps: '', dL: 'm', L0: 'm' } },
  { s: 'mech', id: 'young', n: 'معامل يونغ', eq: 'Y=sigma/eps', v: { Y: 'Pa', sigma: 'Pa', eps: '' } },
  // الكيمياء
  { s: 'chem', id: 'gas', n: 'الغاز المثالي PV=nRT', eq: 'P*V=n*R*T', v: { P: 'atm', V: 'L', n: 'mol', T: 'K' }, c: { R: 0.082057 } },
  { s: 'chem', id: 'vdw', n: 'غاز حقيقي (فان دير فالس)', eq: '(P+a*n^2/V^2)*(V-n*b)=n*R*T', v: { P: 'atm', V: 'L', n: 'mol', T: 'K', a: 'L²·atm/mol²', b: 'L/mol' }, c: { R: 0.082057 }, num: true },
  { s: 'chem', id: 'conc', n: 'المولارية', eq: 'C=n/V', v: { C: 'mol/L', n: 'mol', V: 'L' } },
  { s: 'chem', id: 'molal', n: 'المولالية', eq: 'mb=n/w', v: { mb: 'mol/kg', n: 'mol', w: 'kg' } },
  { s: 'chem', id: 'mol', n: 'عدد المولات من الكتلة', eq: 'n=m/M', v: { n: 'mol', m: 'g', M: 'g/mol' } },
  { s: 'chem', id: 'dil', n: 'قانون التخفيف', eq: 'C1*V1=C2*V2', v: { C1: 'M', V1: 'L', C2: 'M', V2: 'L' } },
  { s: 'chem', id: 'ph', n: 'الأس الهيدروجيني pH', eq: 'pH=-log(H)/log(10)', v: { pH: '', H: 'mol/L' } },
  { s: 'chem', id: 'yield', n: 'النسبة المئوية للناتج', eq: 'Y=act/theo*100', v: { Y: '%', act: 'g', theo: 'g' } },
  { s: 'chem', id: 'half', n: 'التحلل ونصف العمر', eq: 'N=N0*(1/2)^(t/th)', v: { N: '', N0: '', t: 's', th: 's' }, num: true },
  { s: 'phys', id: 'pe', n: 'الطاقة الكامنة', eq: 'PE=m*g*h', v: { PE: 'J', m: 'kg', h: 'm' }, c: { g: 9.81 } },
  { s: 'phys', id: 'grav', n: 'قانون الجذب العام', eq: 'F=G*m1*m2/r^2', v: { F: 'N', m1: 'kg', m2: 'kg', r: 'm' }, c: { G: 6.674e-11 } },
  { s: 'phys', id: 'esc', n: 'سرعة الإفلات', eq: 've=sqrt(2*G*M/r)', v: { ve: 'm/s', M: 'kg', r: 'm' }, c: { G: 6.674e-11 } },
  { s: 'phys', id: 'pend', n: 'زمن تذبذب البندول', eq: 'T=2*pi*sqrt(Lp/g)', v: { T: 's', Lp: 'm' }, c: { g: 9.81 } },
  { s: 'phys', id: 'hooke', n: 'قانون هوك (الزنبرك)', eq: 'F=k*x', v: { F: 'N', k: 'N/m', x: 'm' } },
  { s: 'phys', id: 'cent', n: 'القوة المركزية', eq: 'F=m*v^2/r', v: { F: 'N', m: 'kg', v: 'm/s', r: 'm' } },
  { s: 'phys', id: 'dens', n: 'الكثافة', eq: 'rho=m/V', v: { rho: 'kg/m³', m: 'kg', V: 'm³' } },
  { s: 'phys', id: 'press', n: 'الضغط', eq: 'P=F/A', v: { P: 'Pa', F: 'N', A: 'm²' } },
  { s: 'phys', id: 'buoy', n: 'قوة الطفو', eq: 'Fb=rho*V*g', v: { Fb: 'N', rho: 'kg/m³', V: 'm³' }, c: { g: 9.81 } },
  { s: 'phys', id: 'cap', n: 'المكثف', eq: 'Q=C*V', v: { Q: 'C', C: 'F', V: 'V' } },
  { s: 'phys', id: 'rc', n: 'ثابت زمن دائرة RC', eq: 'tau=R*C', v: { tau: 's', R: 'Ω', C: 'F' } },
  { s: 'mech', id: 'beam', n: 'انحناء عارضة (حمل مركزي)', eq: 'd=F*L^3/(48*E*I)', v: { d: 'm', F: 'N', L: 'm', E: 'Pa', I: 'm⁴' } },
  { s: 'mech', id: 'sf', n: 'معامل الأمان', eq: 'n=sy/sigma', v: { n: '', sy: 'Pa', sigma: 'Pa' } },
  { s: 'mech', id: 'euler', n: 'حمل الانبعاج (أويلر)', eq: 'Pcr=pi^2*E*I/(K*L)^2', v: { Pcr: 'N', E: 'Pa', I: 'm⁴', K: '', L: 'm' } },
  { s: 'mech', id: 'mpow', n: 'القدرة الدورانية', eq: 'P=tau*w', v: { P: 'W', tau: 'N·m', w: 'rad/s' } }
];

/* حل قانون: يعزل المجهول رمزياً (nerdamer) وإن تعذّر يحله عددياً (نيوتن) */
function solveFormula(f, v) {
  const vals = {}, empty = [], c = f.c || {};
  for (const k in f.v) { const t = String(v[k] ?? '').trim(); if (t === '') empty.push(k); else vals[k] = num(t); }
  if (empty.length !== 1) throw new Error('MULTI');
  const t = empty[0], all = { ...scope(), ...c, ...vals }, [L, R] = f.eq.split('=');
  let val = null, sol = null, div0 = false, numeric = false;
  if (!f.num) {
    try {
      const cands = nerdamer.solve(f.eq, t).toString().replace(/^\[|\]$/g, '').split(',');
      const ok = [];
      for (const cd of cands) {
        try { const r = math.evaluate(cd, all); if (typeof r === 'number') { if (isFinite(r)) ok.push([cd, r]); else div0 = true; } } catch {}
      }
      const pick = ok.find(o => o[1] > 0) || ok[0];
      if (pick) { sol = pick[0]; val = pick[1]; }
    } catch {}
  }
  if (val === null) { // حل عددي بطريقة نيوتن
    const g = x => math.evaluate(`(${L})-(${R})`, { ...all, [t]: x });
    for (const s0 of [1, .5, 10, -1, 100, .1]) {
      let x = s0;
      try {
        for (let i = 0; i < 100; i++) {
          const y = g(x), h = 1e-6 * (1 + Math.abs(x)), d = (g(x + h) - g(x - h)) / (2 * h);
          if (typeof y !== 'number' || !d || !isFinite(d)) { x = NaN; break; }
          const nx = x - y / d; if (!isFinite(nx)) { x = NaN; break; }
          if (Math.abs(nx - x) < 1e-12 * (1 + Math.abs(x))) { x = nx; break; } x = nx;
        }
        if (isFinite(x) && Math.abs(g(x)) < 1e-6 * (1 + Math.abs(x))) { val = x; numeric = true; break; }
      } catch {}
    }
  }
  if (val === null) throw new Error(div0 ? 'DIV0' : 'NOSOL');
  const unit = f.v[t] || '';
  const given = Object.entries(vals).map(([k, x]) => `${k} = ${fmt(x)} ${f.v[k]}`).join('، ');
  const consts = Object.entries(c).map(([k, x]) => `${k} = ${x}`).join('، ');
  const steps = [`القانون: <code>${esc(f.eq)}</code>`, `المعطيات: ${esc(given)}${consts ? ' | ثوابت: ' + esc(consts) : ''}`, `المطلوب: <code>${t}</code> (${unit || 'بلا وحدة'})`];
  if (numeric) steps.push('تعذّر عزل المجهول جبرياً، فحُلّت المعادلة عددياً بطريقة نيوتن–رافسون.');
  else {
    steps.push(`إعادة الترتيب: <code>${t} = ${esc(sol)}</code>`);
    steps.push(`التعويض: <code>${t} = ${esc(sol.replace(/\b[A-Za-z_]\w*\b/g, w => (w in all ? `(${fmt(all[w])})` : w)))}</code>`);
  }
  try { // التحقق بالتعويض العكسي في المعادلة الأصلية
    const lv = math.evaluate(L, { ...all, [t]: val }), rv = math.evaluate(R, { ...all, [t]: val });
    if (typeof lv === 'number' && typeof rv === 'number') steps.push(`التحقق: الطرف الأيسر = <code>${fmt(lv)}</code> ، الأيمن = <code>${fmt(rv)}</code> ${Math.abs(lv - rv) <= 1e-6 * Math.max(1, Math.abs(lv), Math.abs(rv)) ? '✓' : '⚠ فرق تقريبي'}`);
  } catch {}
  return { steps, res: `${t} = ${fmt(val)} ${unit}`, val };
}
const formulaTool = f => ({
  n: f.n, note: 'املأ المعطيات واترك المجهول فارغاً — سيُحسب تلقائياً مع الوحدات.',
  fields: Object.keys(f.v).map(k => ({ k, l: `${k}${f.v[k] ? ' (' + f.v[k] + ')' : ''}`, d: '' })),
  run: v => solveFormula(f, v)
});

/* ---------- 5) الكيمياء: الكتل المولية وموازنة المعادلات ---------- */
const AM = { H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.18, Na: 22.99, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.948, K: 39.098, Ca: 40.078, Ti: 47.867, Cr: 51.996, Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Br: 79.904, Ag: 107.87, Sn: 118.71, I: 126.9, Ba: 137.33, Au: 196.97, Hg: 200.59, Pb: 207.2, U: 238.03 };
/* تحليل صيغة كيميائية مع دعم الأقواس مثل Ca(OH)2 */
function parseF(s) {
  const st = [{}], re = /([A-Z][a-z]?)(\d*)|(\()|\)(\d*)/g; let m;
  while ((m = re.exec(s))) {
    if (m[1]) { const o = st[st.length - 1]; o[m[1]] = (o[m[1]] || 0) + (+m[2] || 1); }
    else if (m[3]) st.push({});
    else { if (st.length < 2) throw new Error('!الأقواس غير متوازنة في الصيغة ' + s); const t = st.pop(), k = +m[4] || 1, o = st[st.length - 1]; for (const e in t) o[e] = (o[e] || 0) + t[e] * k; }
  }
  return st[0];
}
function balance(eq) {
  const parts = eq.split(/->|→|=>|=/);
  if (parts.length !== 2 || !parts[1].trim()) throw new Error('!اكتب المعادلة بالشكل: H2 + O2 -> H2O');
  const sp = s => s.split('+').map(x => x.trim()).filter(Boolean);
  const R = sp(parts[0]), P = sp(parts[1]), all = [...R, ...P], comp = all.map(parseF);
  const els = [...new Set(comp.flatMap(c => Object.keys(c)))];
  const M = els.map(e => comp.map((c, j) => (c[e] || 0) * (j < R.length ? 1 : -1)));
  const rows = M.length, cols = all.length, piv = []; let r0 = 0;
  for (let c = 0; c < cols && r0 < rows; c++) { // اختزال غاوس–جوردان
    let p = r0; for (let i = r0; i < rows; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    if (Math.abs(M[p][c]) < 1e-9) continue;
    [M[r0], M[p]] = [M[p], M[r0]]; const d = M[r0][c]; M[r0] = M[r0].map(x => x / d);
    for (let i = 0; i < rows; i++) if (i !== r0) { const f = M[i][c]; M[i] = M[i].map((x, j) => x - f * M[r0][j]); }
    piv.push(c); r0++;
  }
  const free = [...Array(cols).keys()].filter(c => !piv.includes(c));
  if (free.length !== 1) throw new Error('!تعذّرت الموازنة: تأكد أن نفس العناصر موجودة في الطرفين وأن الصيغ صحيحة (الحرف الأول كبير).');
  const x = Array(cols).fill(0); x[free[0]] = 1; piv.forEach((c, i) => x[c] = -M[i][free[0]]);
  if (x.some(v => v < -1e-9)) throw new Error('!لا توجد معاملات موجبة تُوازن هذه المعادلة؛ راجع المواد المتفاعلة والناتجة.');
  let k = 1; for (; k <= 120; k++) if (x.every(v => Math.abs(v * k - Math.round(v * k)) < 1e-6)) break;
  const co = x.map(v => Math.round(v * k));
  const side = (arr, off) => arr.map((s, i) => (co[off + i] > 1 ? co[off + i] : '') + s).join(' + ');
  return { text: `${side(R, 0)} → ${side(P, R.length)}`, co };
}
function molarMass(f) {
  const c = parseF(f), rows = []; let tot = 0;
  for (const e in c) { if (!AM[e]) throw new Error(`!العنصر «${e}» غير موجود في الجدول الدوري المضمّن`); const m = AM[e] * c[e]; rows.push([e, c[e], m]); tot += m; }
  return { tot, rows };
}

/* ---------- 6) الفهم الطبيعي للمسائل (قواعد محلية بدون إنترنت) ---------- */
const UNITS = [['a', /م\/ث²|m\/s²/], ['v', /م\/ث|متر\s*(?:في|\/)\s*(?:ال)?ثانية|m\/s/], ['A', /م²|متر\s*مربع|m²/], ['V', /م³|متر\s*مكعب|m³|لتر/], ['h', /متر(?!\s*(?:في|\/))|\bm\b/], ['m', /كجم|كغ|كيلوجرام|كيلوغرام|kg/], ['F', /نيوتن|newton|N\b/], ['V', /فولت|volt|V\b/], ['R', /أوم|اوم|Ω|ohm/], ['I', /أمبير|امبير|amp|A\b/], ['t', /ثانية|ثوان|s\b/]];
const INTENTS = [[/تسارع|acceleration/i, 'newton', 'a'], [/طاقة الحركة|kinetic/i, 'kin', 'KE'], [/القوة|قوة|force/i, 'newton', 'F'], [/الجهد|فولتية|voltage/i, 'ohm', 'V'], [/التيار|current/i, 'ohm', 'I'], [/المقاومة|مقاومة|resistance/i, 'ohm', 'R'], [/الزخم|momentum/i, 'mom', 'p'], [/القدرة|power/i, 'pwr', 'P'], [/الطاقة الكامنة|potential/i, 'pe', 'PE'], [/الكثافة|density/i, 'dens', 'rho'], [/الضغط|pressure/i, 'press', 'P']];
function nlp(text) {
  text = text.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  let best = null;
  for (const [re, id, t] of INTENTS) { const m = re.exec(text); if (m && (!best || m.index < best.i)) best = { i: m.index, id, t }; }
  if (!best) { // لا يوجد قانون مطابق: جرّب كتعبير رياضي
    const r = math.evaluate(text, scope()); return { steps: ['لم أجد قانوناً فيزيائياً في النص، فعُومل كتعبير رياضي.'], res: fmt(r) };
  }
  const f = FM.find(x => x.id === best.id), vals = {}, re = /-?\d+(?:\.\d+)?/g; let m; const found = [];
  while ((m = re.exec(text))) {
    const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 24);
    const u = UNITS.find(([, r]) => new RegExp('^\\s*(?:' + r.source + ')', 'i').test(tail));
    if (u && u[0] in f.v && u[0] !== best.t) { vals[u[0]] = m[0]; found.push(`${u[0]} = ${m[0]}`); }
  }
  const missing = Object.keys(f.v).filter(k => k !== best.t && !(k in vals));
  if (missing.length) throw new Error(`!فهمتُ أن المطلوب هو «${best.t}» من قانون «${f.n}»، لكن ينقصني: ${missing.join('، ')}. أضف قيمها مع وحداتها (مثل: 10 كجم، 5 م/ث، 50 نيوتن).`);
  const r = solveFormula(f, { ...vals, [best.t]: '' });
  r.steps.unshift(`فهمتُ المسألة: القانون «${f.n}» والمطلوب <code>${best.t}</code>، والمعطيات المستخرجة: ${esc(found.join('، '))}`);
  return r;
}

/* ---------- 7) أدوات الرياضيات المتقدمة ---------- */
const ruleHints = e => {
  const r = [];
  if (/\*/.test(e)) r.push('قاعدة الضرب (u·v)′ = u′v + uv′');
  if (/\//.test(e)) r.push('قاعدة القسمة (u/v)′ = (u′v − uv′)/v²');
  if (/\^/.test(e)) r.push('قاعدة القوة (xⁿ)′ = n·xⁿ⁻¹');
  if (/(sin|cos|tan|exp|log|sqrt)\(/.test(e)) r.push('مشتقات الدوال الأساسية + قاعدة السلسلة (f(g))′ = f′(g)·g′');
  return r.length ? r : ['الاشتقاق حدّاً بحدّ'];
};
const intHints = e => {
  const r = [];
  if (/\*/.test(e) && /(sin|cos|exp|log)/.test(e)) r.push('التكامل بالتجزيء ∫u dv = uv − ∫v du');
  if (/\^/.test(e)) r.push('قاعدة القوة ∫xⁿ dx = xⁿ⁺¹/(n+1)');
  if (/(sin|cos|exp|1\/)/.test(e)) r.push('جدول تكاملات الدوال الأساسية');
  return r.length ? r : ['التكامل حدّاً بحدّ'];
};
const vlist = s => s.split(',').map(x => x.trim()).filter(Boolean);
const num_ = (t, sc = {}) => math.evaluate(t, { ...scope(), ...sc });

const MATH = [
  { n: 'حاسبة تعبيرات', note: 'يدعم الدوال: sin, cos, log, sqrt, factorial وغيرها، والمتغيرات المحفوظة.',
    fields: [{ k: 'expr', l: 'التعبير', d: 'sqrt(16)+2^3*sin(pi/6)' }],
    run: v => { const r = math.evaluate(v.expr, scope()); if (typeof r === 'number' && !isFinite(r)) throw new Error('DIV0'); return { steps: [`التعبير: <code>${esc(v.expr)}</code>`, 'يُحسب بترتيب العمليات: الأقواس ثم القوى ثم الضرب والقسمة ثم الجمع والطرح.'], res: fmt(r), val: typeof r === 'number' ? r : undefined }; } },
  { n: 'التفاضل', note: 'للمشتقات الجزئية أو العليا اكتب عدة متغيرات مفصولة بفاصلة (مثل x,x للمشتقة الثانية).',
    fields: [{ k: 'expr', l: 'الدالة', d: 'x^2*sin(x)' }, { k: 'vars', l: 'المتغيرات', d: 'x' }],
    run: v => { let cur = v.expr; const st = [`الدالة: <code>${esc(cur)}</code>`];
      for (const x of vlist(v.vars)) { const n = nerdamer(`diff(${cur},${x})`).toString(); st.push(`القواعد: ${ruleHints(cur).join(' ، ')}`, `d/d${x} = <code>${esc(n)}</code>`); cur = n; }
      return { steps: st, res: cur }; } },
  { n: 'التكامل', note: 'اترك الحدّين فارغين لتكامل غير محدود، أو أدخلهما للتكامل المحدود. عدة متغيرات = تكامل متعدد متتابع.',
    fields: [{ k: 'expr', l: 'الدالة', d: 'x*sin(x)' }, { k: 'vars', l: 'المتغيرات', d: 'x' }, { k: 'a', l: 'الحد الأدنى', d: '' }, { k: 'b', l: 'الحد الأعلى', d: '' }],
    run: v => { const vs = vlist(v.vars), st = [`الدالة: <code>${esc(v.expr)}</code>`, `الطريقة: ${intHints(v.expr).join(' ، ')}`];
      if (v.a && v.b) {
        const x = vs[0]; let exact = '', dec;
        try { exact = nerdamer(`defint(${v.expr},${v.a},${v.b},${x})`).toString(); dec = nerdamer(exact).evaluate().text(); } catch {
          const f = math.compile(v.expr), a = num(v.a), b = num(v.b), n = 2000, h = (b - a) / n; let s = f.evaluate({ ...scope(), [x]: a }) + f.evaluate({ ...scope(), [x]: b });
          for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f.evaluate({ ...scope(), [x]: a + i * h }); dec = String(s * h / 3); st.push('حُسب التكامل عددياً بطريقة سيمبسون.'); }
        st.push(`∫ من ${esc(v.a)} إلى ${esc(v.b)}: <code>${esc(exact || dec)}</code>`); return { steps: st, res: dec, val: parseFloat(dec) };
      }
      let cur = v.expr; for (const x of vs) { cur = nerdamer(`integrate(${cur},${x})`).toString(); st.push(`∫ بالنسبة إلى ${x}: <code>${esc(cur)}</code>`); }
      return { steps: st, res: cur + ' + C' }; } },
  { n: 'حل المعادلات', note: 'اكتب معادلة مثل x^2-5*x+6=0 (يُفترض =0 إن لم تكتب مساواة).',
    fields: [{ k: 'eq', l: 'المعادلة', d: 'x^2-5*x+6=0' }, { k: 'x', l: 'المتغير', d: 'x' }],
    run: v => { const eq = v.eq.includes('=') ? v.eq : v.eq + '=0', s = nerdamer.solve(eq, v.x).toString().replace(/^\[|\]$/g, '');
      if (!s) throw new Error('NOSOL'); return { steps: [`المعادلة: <code>${esc(eq)}</code>`, `عزل المتغير <code>${esc(v.x)}</code> جبرياً.`], res: `${v.x} ∈ { ${s} }` }; } },
  { n: 'الجبر الخطي', note: 'اكتب المصفوفة بالشكل [[1,2],[3,4]]. للنظام Ax=b أدخل المتجه b مثل [5,6].',
    fields: [{ k: 'A', l: 'المصفوفة A', d: '[[2,1],[1,3]]' }, { k: 'B', l: 'B أو b (اختياري)', d: '' },
      { k: 'op', l: 'العملية', o: [['det', 'المحدد'], ['inv', 'المعكوس'], ['eig', 'القيم الذاتية'], ['tr', 'المنقول'], ['mul', 'A × B'], ['sys', 'حل Ax=b']] }],
    run: v => { const A = math.evaluate(v.A), st = [`A = <code>${esc(math.format(A, { precision: 6 }))}</code>`]; let r;
      if (v.op === 'det') { r = math.det(A); const a = math.matrix(A).toArray(); st.push(a.length === 2 ? 'للمصفوفة 2×2: det = a·d − b·c' : 'يُحسب المحدد بالنشر على صف أو بالاختزال الغاوسي.'); }
      else if (v.op === 'inv') { r = math.inv(A); st.push('A⁻¹ = adj(A)/det(A) (تشترط det ≠ 0).'); }
      else if (v.op === 'eig') { r = math.eigs(A).values; st.push('القيم الذاتية λ هي جذور المعادلة المميزة det(A − λI) = 0.'); }
      else if (v.op === 'tr') r = math.transpose(A);
      else if (v.op === 'mul') { r = math.multiply(A, math.evaluate(v.B)); st.push('صف × عمود لكل عنصر.'); }
      else { r = math.lusolve(A, math.evaluate(v.B)); st.push('تحليل LU ثم التعويض الأمامي والخلفي.'); }
      return { steps: st, res: math.format(r, { precision: 8 }), val: typeof r === 'number' ? r : undefined }; } },
  { n: 'الإحصاء', note: 'أدخل القيم مفصولة بفواصل.',
    fields: [{ k: 'd', l: 'البيانات', d: '2, 4, 4, 5, 7, 9' }],
    run: v => { const a = v.d.split(/[,،\s]+/).filter(Boolean).map(num); if (a.length < 2) throw new Error('!أدخل قيمتين على الأقل.');
      const o = { 'العدد': a.length, 'المتوسط': math.mean(a), 'الوسيط': math.median(a), 'المنوال': math.mode(a).join('، '), 'الانحراف المعياري (عيّنة)': math.std(a), 'الانحراف المعياري (مجتمع)': math.std(a, 'uncorrected'), 'التباين': math.variance(a), 'الأصغر': math.min(a), 'الأكبر': math.max(a) };
      return { steps: Object.entries(o).map(([k, x]) => `${k}: <code>${fmt(x)}</code>`), res: 'المتوسط = ' + fmt(o['المتوسط']), val: o['المتوسط'], plot: plot([{ x: a, type: 'histogram', marker: { color: getComputedStyle(document.documentElement).getPropertyValue('--ac') } }]) }; } },
  { n: 'معادلة تفاضلية عادية', note: 'يحل dy/dx = f(x,y) عددياً بطريقة رانج–كوتا من الرتبة 4 ويرسم الحل.',
    fields: [{ k: 'f', l: 'f(x,y)', d: 'x-y' }, { k: 'x0', l: 'x0', d: '0' }, { k: 'y0', l: 'y0', d: '1' }, { k: 'x1', l: 'x النهائية', d: '5' }],
    run: v => { const f = math.compile(v.f), g = (x, y) => f.evaluate({ ...scope(), x, y }), x0 = num(v.x0), x1 = num(v.x1), n = 400, h = (x1 - x0) / n, X = [x0], Y = [num(v.y0)];
      for (let i = 0; i < n; i++) { const x = X[i], y = Y[i], k1 = g(x, y), k2 = g(x + h / 2, y + h * k1 / 2), k3 = g(x + h / 2, y + h * k2 / 2), k4 = g(x + h, y + h * k3); X.push(x + h); Y.push(y + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6); }
      if (!Y.every(isFinite)) throw new Error('!الحل يتباعد إلى ما لا نهاية في هذا المجال؛ جرّب مجالاً أقصر.');
      return { steps: [`المعادلة: <code>dy/dx = ${esc(v.f)}</code>`, `الشرط الابتدائي: y(${v.x0}) = ${v.y0}`, 'خطوة التكامل h = ' + fmt(h) + ' (400 خطوة)'], res: `y(${v.x1}) ≈ ${fmt(Y[n])}`, val: Y[n], plot: plot([{ x: X, y: Y, mode: 'lines' }], { xaxis: { title: 'x' }, yaxis: { title: 'y' } }) }; } },
  { n: 'معادلة تفاضلية جزئية (حرارة)', note: 'معادلة الحرارة أحادية البعد u_t = α·u_xx بحدود صفرية، بطريقة الفروق المحدودة.',
    fields: [{ k: 'u0', l: 'الشرط الابتدائي u(x,0)', d: 'sin(pi*x)' }, { k: 'al', l: 'α', d: '0.1' }, { k: 'L', l: 'الطول L', d: '1' }, { k: 'T', l: 'الزمن الكلي T', d: '1' }],
    run: v => { const f = math.compile(v.u0), al = num(v.al), L = num(v.L), T = num(v.T), N = 50, dx = L / N, dt = 0.4 * dx * dx / al, steps = Math.min(Math.ceil(T / dt), 200000);
      let u = Array.from({ length: N + 1 }, (_, i) => f.evaluate({ ...scope(), x: i * dx })); u[0] = u[N] = 0; const tr = [], snap = [0, .1, .3, .6, 1].map(p => Math.round(p * steps));
      const xs = u.map((_, i) => i * dx); for (let s = 0; s <= steps; s++) { if (snap.includes(s)) tr.push({ x: xs, y: [...u], mode: 'lines', name: 't=' + fmt(s * dt), line: {} });
        const nu = u.slice(); for (let i = 1; i < N; i++) nu[i] = u[i] + 0.4 * (u[i + 1] - 2 * u[i] + u[i - 1]); u = nu; }
      return { steps: [`المعادلة: <code>u_t = ${al}·u_xx</code>`, `شبكة من ${N} نقطة، خطوة زمنية ${fmt(dt)} (شرط الاستقرار r=0.4).`], res: `u الأعظم عند t=${fmt(T)}: ${fmt(Math.max(...u))}`, plot: plot(tr, { xaxis: { title: 'x' } }) }; } },
  { n: 'رسم دالة', note: 'ارسم عدة دوال معاً بفصلها بفاصلة منقوطة، مثل: sin(x); cos(x); x^2/10',
    fields: [{ k: 'f', l: 'f(x)', d: 'sin(x)/x; cos(x)' }, { k: 'a', l: 'من', d: '-10' }, { k: 'b', l: 'إلى', d: '10' }],
    run: v => { const fs = v.f.split(';').map(x => x.trim()).filter(Boolean).slice(0, 6); if (!fs.length) throw new Error('!اكتب دالة واحدة على الأقل.');
      const a = num(v.a), b = num(v.b); if (a >= b) throw new Error('!يجب أن يكون الحد الأدنى أصغر من الأعلى.');
      const X = Array.from({ length: 501 }, (_, i) => a + (b - a) * i / 500);
      const tr = fs.map(src => { const f = math.compile(src); return { x: X, y: X.map(x => { try { const y = f.evaluate({ ...scope(), x }); return typeof y === 'number' && isFinite(y) ? y : null; } catch { return null; } }), mode: 'lines', connectgaps: false, name: src, line: {} }; });
      return { steps: [`الدوال: ${fs.map(x => `<code>${esc(x)}</code>`).join(' ، ')} على المجال [${v.a}, ${v.b}]`, 'النقاط غير المعرّفة (مثل القسمة على صفر) تُترك فجوة في الرسم.'], res: `تم رسم ${fs.length} دالة`, plot: plot(tr, { showlegend: fs.length > 1 }) }; } }
];

/* ---------- 8) أدوات الميكانيكا والكيمياء الخاصة ---------- */
const MECH_EXTRA = [
  { n: 'تحليل القوى (محصلة)', note: 'اكتب القوى بصيغة قيمة@زاوية بالدرجات، مفصولة بفواصل. تتغير الرسمة فور تعديل القيم.',
    fields: [{ k: 'fs', l: 'القوى', d: '50@0, 30@90, 20@210' }],
    run: v => { const fs = v.fs.split(',').map(s => s.trim().split('@').map(num)); if (fs.some(p => p.length !== 2)) throw new Error('!اكتب كل قوة بالشكل قيمة@زاوية مثل 50@30');
      let sx = 0, sy = 0; const tr = fs.map(([F, a], i) => { const x = F * Math.cos(a * Math.PI / 180), y = F * Math.sin(a * Math.PI / 180); sx += x; sy += y; return { x: [0, x], y: [0, y], mode: 'lines+markers', name: `F${i + 1}` }; });
      const R = Math.hypot(sx, sy), ang = Math.atan2(sy, sx) * 180 / Math.PI; tr.push({ x: [0, sx], y: [0, sy], mode: 'lines+markers', name: 'المحصلة', line: { dash: 'dash', width: 4, color: '#fb7185' } });
      return { steps: ['تحليل كل قوة: Fx = F·cosθ ، Fy = F·sinθ', `ΣFx = ${fmt(sx)} N ، ΣFy = ${fmt(sy)} N`, 'المحصلة R = √(ΣFx² + ΣFy²) والزاوية θ = atan2(ΣFy, ΣFx)'], res: `R = ${fmt(R)} N ، θ = ${fmt(ang)}°`, val: R, plot: plot(tr, { yaxis: { scaleanchor: 'x' } }) }; } },
  { n: 'حركة المقذوفات', fields: [{ k: 'v0', l: 'السرعة الابتدائية (m/s)', d: '30' }, { k: 'th', l: 'زاوية الإطلاق (°)', d: '45' }, { k: 'h0', l: 'الارتفاع الابتدائي (m)', d: '0' }, { k: 'g', l: 'الجاذبية (m/s²)', d: '9.81' }],
    run: v => { const v0 = num(v.v0), th = num(v.th) * Math.PI / 180, h0 = num(v.h0), g = num(v.g); if (g === 0) throw new Error('DIV0');
      const vx = v0 * Math.cos(th), vy = v0 * Math.sin(th), T = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g, H = h0 + vy * vy / (2 * g), Rg = vx * T, X = [], Y = [];
      for (let i = 0; i <= 100; i++) { const t = T * i / 100; X.push(vx * t); Y.push(h0 + vy * t - g * t * t / 2); }
      return { steps: ['x = v₀·cosθ·t ، y = h₀ + v₀·sinθ·t − ½·g·t²', `زمن التحليق = ${fmt(T)} s`, `أقصى ارتفاع = ${fmt(H)} m`], res: `المدى = ${fmt(Rg)} m`, val: Rg, plot: plot([{ x: X, y: Y, mode: 'lines' }], { xaxis: { title: 'المسافة (m)' }, yaxis: { title: 'الارتفاع (m)' } }) }; } }
];
const CHEM_EXTRA = [
  { n: 'موازنة معادلة', note: 'اكتب المعادلة بالصيغ الكيميائية، مثل: Fe + O2 -> Fe2O3 أو Ca(OH)2 + H3PO4 -> Ca3(PO4)2 + H2O',
    fields: [{ k: 'eq', l: 'المعادلة', d: 'Al + HCl -> AlCl3 + H2' }],
    run: v => { const b = balance(v.eq); return { steps: ['تُبنى مصفوفة العناصر × المواد (موجب للمتفاعلات وسالب للنواتج).', 'يُحل النظام المتجانس بالاختزال الغاوسي ثم تُحوَّل النسب إلى أصغر أعداد صحيحة.'], res: b.text }; } },
  { n: 'الكتلة المولية والنسب المئوية', fields: [{ k: 'f', l: 'الصيغة', d: 'Ca(OH)2' }],
    run: v => { const m = molarMass(v.f); return { steps: m.rows.map(([e, n, x]) => `${e}: ${n} × ${AM[e]} = ${fmt(x)} g/mol → <code>${fmt(x / m.tot * 100)}%</code>`), res: `M = ${fmt(m.tot)} g/mol`, val: m.tot }; } }
];

/* أدوات إضافية: تحويل الوحدات، تايلور، نظرية الأعداد */
MATH.push(
  { n: 'تحويل الوحدات', note: 'أمثلة: km→mi ، kg→lb ، degC→degF ، bar→psi ، kWh→J ، hp→W ، m/s→km/h',
    fields: [{ k: 'val', l: 'القيمة', d: '100' }, { k: 'from', l: 'من وحدة', d: 'km/h' }, { k: 'to', l: 'إلى وحدة', d: 'm/s' }],
    run: v => { const x = num(v.val), r = math.unit(x, v.from).to(v.to); return { steps: [`القيمة: <code>${fmt(x)} ${esc(v.from)}</code>`, 'تُحوَّل عبر الوحدات الأساسية في النظام الدولي (SI) ثم إلى الوحدة المطلوبة.'], res: r.format({ precision: 10 }), val: r.toNumber(v.to) }; } },
  { n: 'متسلسلة تايلور', note: 'تقريب الدالة بكثير حدود حول نقطة، مع رسم الدالة والتقريب معاً.',
    fields: [{ k: 'expr', l: 'الدالة', d: 'sin(x)' }, { k: 'x', l: 'المتغير', d: 'x' }, { k: 'a', l: 'النقطة a', d: '0' }, { k: 'n', l: 'الرتبة (≤12)', d: '7' }],
    run: v => { const n = Math.min(Math.max(+v.n || 5, 1), 12), a = num(v.a), x = v.x || 'x'; let cur = v.expr; const co = [], st = [];
      for (let k = 0; k <= n; k++) { const d = Number(nerdamer(cur, { [x]: a }).evaluate().text()); if (!isFinite(d)) throw new Error('!الدالة أو مشتقاتها غير معرّفة عند النقطة a؛ اختر نقطة أخرى.'); co.push(d / math.factorial(k)); if (k < 4) st.push(`f<sup>(${k})</sup>(${a})/${k}! = <code>${fmt(d / math.factorial(k))}</code>`); cur = nerdamer(`diff(${cur},${x})`).toString(); }
      const poly = co.map((c, k) => c === 0 ? '' : `${fmt(c)}*(${x}-${a})^${k}`).filter(Boolean).join(' + ') || '0', f = math.compile(v.expr), X = [], Y = [], T = [];
      for (let i = 0; i <= 400; i++) { const t = a - 4 + 8 * i / 400; X.push(t); Y.push(f.evaluate({ [x]: t })); T.push(co.reduce((s, c, k) => s + c * Math.pow(t - a, k), 0)); }
      return { steps: ['f(x) ≈ Σ f⁽ᵏ⁾(a)/k! · (x−a)ᵏ', ...st], res: poly, plot: plot([{ x: X, y: Y, mode: 'lines', name: 'الدالة' }, { x: X, y: T, mode: 'lines', name: 'تايلور', line: { dash: 'dash', color: '#fb7185' } }], { yaxis: { range: [Math.min(...Y.filter(isFinite)) - 1, Math.max(...Y.filter(isFinite)) + 1] } }) }; } },
  { n: 'نظرية الأعداد والأنظمة', note: 'عدد صحيح موجب: التحليل لعوامل أولية والتحويل إلى ثنائي وثماني وست عشري. أدخل m اختيارياً لحساب القاسم المشترك الأكبر والمضاعف المشترك الأصغر.',
    fields: [{ k: 'n', l: 'العدد n', d: '360' }, { k: 'm', l: 'العدد m (اختياري)', d: '84' }],
    run: v => { const n = num(v.n); if (!Number.isInteger(n) || n < 2 || n > 1e12) throw new Error('!أدخل عدداً صحيحاً بين 2 و 1,000,000,000,000.'); let r = n; const f = {}; for (let p = 2; p * p <= r; p++) while (r % p === 0) { f[p] = (f[p] || 0) + 1; r /= p; } if (r > 1) f[r] = (f[r] || 0) + 1;
      const st = [`العوامل الأولية: <code>${Object.entries(f).map(([p, e]) => e > 1 ? `${p}^${e}` : p).join(' × ')}</code> ${Object.keys(f).length === 1 && Object.values(f)[0] === 1 ? '(العدد أولي)' : ''}`, `ثنائي: <code>${n.toString(2)}</code> ، ثماني: <code>${n.toString(8)}</code> ، ست عشري: <code>${n.toString(16).toUpperCase()}</code>`, `عدد القواسم: <code>${Object.values(f).reduce((s, e) => s * (e + 1), 1)}</code>`];
      let res = 'n = ' + n; if (v.m) { const m = num(v.m); st.push(`gcd(${n}, ${m}) = <code>${math.gcd(n, m)}</code> ، lcm = <code>${math.lcm(n, m)}</code>`); res = `gcd = ${math.gcd(n, m)} ، lcm = ${math.lcm(n, m)}`; } return { steps: st, res }; } }
);
/* ثوابت فيزيائية تُضاف إلى المتغيرات دفعة واحدة */
const CONSTS = { n: 'الثوابت الفيزيائية', note: 'اضغط «احسب» لإضافة هذه الثوابت إلى متغيراتك واستخدام أسمائها في أي أداة.', fields: [],
  run: () => { const C = { c0: [299792458, 'سرعة الضوء m/s'], Gc: [6.674e-11, 'ثابت الجذب'], hP: [6.62607015e-34, 'ثابت بلانك'], kB: [1.380649e-23, 'ثابت بولتزمان'], NA: [6.02214076e23, 'عدد أفوجادرو'], qe: [1.602176634e-19, 'شحنة الإلكترون'], eps0: [8.8541878128e-12, 'سماحية الفراغ'], mu0: [1.25663706212e-6, 'نفاذية الفراغ'], g0: [9.80665, 'تسارع الجاذبية'], Rg: [8.314462618, 'ثابت الغازات J/(mol·K)'] };
    for (const k in C) vars[k] = C[k][0]; store.set('vars', vars); return { steps: Object.entries(C).map(([k, [x, d]]) => `<code>${k}</code> = ${x} — ${d}`), res: 'أُضيفت 10 ثوابت إلى المتغيرات' }; } };
/* الأدوات ذات الرسم التفاعلي تتحدّث فور تغيير القيم */
['رسم دالة', 'معادلة تفاضلية عادية', 'متسلسلة تايلور'].forEach(n => { const t = MATH.find(x => x.n === n); if (t) t.live = true; });
MECH_EXTRA.forEach(t => t.live = true);

/* ---------- 9) تعريف الأقسام ---------- */
const SEC = {
  calc: { n: 'الحاسبة', i: 'fa-calculator', c: '#6366f1', custom: renderCalc },
  math: { n: 'الرياضيات', i: 'fa-square-root-variable', c: '#8b5cf6', tools: MATH },
  phys: { n: 'الفيزياء', i: 'fa-atom', c: '#3b82f6', tools: [...FM.filter(f => f.s === 'phys').map(formulaTool), CONSTS] },
  chem: { n: 'الكيمياء', i: 'fa-flask', c: '#22c55e', tools: [...CHEM_EXTRA, ...FM.filter(f => f.s === 'chem').map(formulaTool)] },
  mech: { n: 'الميكانيكا والهندسة', i: 'fa-gears', c: '#f59e0b', tools: [...MECH_EXTRA, ...FM.filter(f => f.s === 'mech').map(formulaTool)] },
  ai: { n: 'الذكاء والصور', i: 'fa-wand-magic-sparkles', c: '#ec4899', tools: [
    { n: 'مسألة بلغة طبيعية', note: 'اكتب المسألة بالعربية أو الإنجليزية مع الوحدات؛ يتعرف التطبيق على القانون والمعطيات ويحلها.',
      fields: [{ k: 'txt', l: 'المسألة', area: true, d: 'احسب تسارع جسم كتلته 10 كغ يتعرض لقوة 50 نيوتن' }], run: v => nlp(v.txt) },
    { n: 'قراءة معادلة من صورة (OCR)', note: 'التقط صورة أو اخترها؛ تُقرأ المعادلة المطبوعة وتُحسب إن أمكن. تحتاج اتصالاً بالإنترنت.',
      fields: [{ k: 'file', l: 'الصورة', file: true }],
      run: async v => { if (!v.file) throw new Error('!اختر صورة أولاً.'); if (typeof Tesseract === 'undefined') throw new Error('!مكتبة القراءة غير محمّلة؛ تحقق من الاتصال بالإنترنت.');
        const { data } = await Tesseract.recognize(v.file, 'eng'); const t = data.text.trim().replace(/[×x]/g, '*').replace(/÷/g, '/'), st = [`النص المستخرج: <pre>${esc(t)}</pre>`]; let res = t || 'لم يُعثر على نص';
        try { const r = math.evaluate(t.replace(/\n/g, ' ').replace(/=\s*\??$/, '')); st.push('بدت العبارة تعبيراً قابلاً للحساب فحُسبت.'); res = t + '  →  ' + fmt(r); } catch { st.push('انسخ النص إلى أداة الرياضيات بعد تصحيح أي حرف أُسيء فهمه.'); }
        return { steps: st, res }; } }
  ] },
  fav: { n: 'المفضلة', i: 'fa-star', c: '#f59e0b', custom: renderFav },
  vars: { n: 'المتغيرات', i: 'fa-database', c: '#14b8a6', custom: renderVars },
  set: { n: 'الإعدادات', i: 'fa-gear', c: '#94a3b8', custom: renderSettings }
};

SEC.ai.tools[0].voice = true; // الإملاء الصوتي لقسم المسائل

/* ---------- 10) رسم الواجهة ---------- */
const fieldHTML = f => f.o ? `<label>${f.l}<select data-k="${f.k}">${f.o.map(([a, b]) => `<option value="${a}">${b}</option>`).join('')}</select></label>`
  : f.file ? `<label>${f.l}<input type="file" accept="image/*" capture="environment" data-k="${f.k}"></label>`
  : f.area ? `<label style="grid-column:1/-1">${f.l}<textarea data-k="${f.k}">${esc(f.d || '')}</textarea></label>`
  : `<label>${f.l}<input data-k="${f.k}" value="${esc(f.d || '')}" autocomplete="off" spellcheck="false"></label>`;

function open(s, t = 0) {
  const S = SEC[s]; document.documentElement.style.setProperty('--ac', S.c);
  $('#title').textContent = S.n; $('#hist').classList.remove('show');
  $$('#nav button,#gnav button').forEach(b => b.classList.toggle('on', b.dataset.s === s));
  const v = $('#view'); if (S.custom) { S.custom(v); return mkSync(); }
  const T = S.tools[t];
  v.innerHTML = `<div class="chips">${S.tools.map((x, i) => `<button class="chip ${i === t ? 'on' : ''}" data-i="${i}">${x.n}</button>`).join('')}</div>
  <div class="card"><h2>${T.n} <button class="icon" id="fav" title="إضافة للمفضلة" style="display:inline-grid;vertical-align:middle"><i class="fa-${favs.includes(s + ':' + t) ? 'solid' : 'regular'} fa-star"></i></button></h2>${T.note ? `<p class="note">${T.note}</p>` : ''}<div class="fields">${T.fields.map(fieldHTML).join('')}</div>
  <button class="btn" id="go"><i class="fa-solid fa-play"></i> احسب</button></div><div id="out"></div>`;
  $$('.chip', v).forEach(b => b.onclick = () => open(s, +b.dataset.i));
  $('#go').onclick = () => run(T);
  $('#fav').onclick = () => { const k = s + ':' + t; favs = favs.includes(k) ? favs.filter(x => x !== k) : [...favs, k]; store.set('favs', favs); $('#fav i').className = `fa-${favs.includes(k) ? 'solid' : 'regular'} fa-star`; };
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (T.voice && SR) { const mic = document.createElement('button'); mic.className = 'btn ghost'; mic.style.marginInlineStart = '8px'; const lbl = '<i class="fa-solid fa-microphone"></i> إملاء صوتي'; mic.innerHTML = lbl; $('#go').after(mic);
    mic.onclick = () => { const r = new SR(); r.lang = 'ar-SA'; r.interimResults = false; mic.textContent = '… أستمع'; r.onresult = e => { $('[data-k=txt]').value = e.results[0][0].transcript; run(T); }; r.onerror = () => modal('تعذّر الإملاء الصوتي: تأكد من السماح باستخدام الميكروفون.'); r.onend = () => mic.innerHTML = lbl; r.start(); }; }
  if (T.live) { let tm; $$('input[data-k],select[data-k]', v).forEach(i => i.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => run(T, true), 350); })); }
  $$('input[data-k]:not([type=file])', v).forEach(i => i.onkeydown = e => { if (e.key === 'Enter') run(T); });
  const act = $('.chip.on', v); if (act) act.scrollIntoView({ inline: 'center', block: 'nearest' });
  mkSync();
}
async function run(T, live) {
  const out = $('#out'), v = {};
  $$('[data-k]', $('#view')).forEach(el => v[el.dataset.k] = el.type === 'file' ? el.files[0] : el.value);
  out.innerHTML = '<div class="card loading"><i class="fa-solid fa-spinner fa-spin"></i> جارٍ الحساب…</div>';
  try {
    const r = await T.run(v);
    out.innerHTML = `<div class="card res"><h3>الحل خطوة بخطوة</h3><ol>${r.steps.map(x => `<li>${x}</li>`).join('')}</ol><div class="big">${esc(r.res)}</div>
    <button class="btn ghost" id="cp"><i class="fa-regular fa-copy"></i> نسخ</button> ${navigator.share ? '<button class="btn ghost" id="shr"><i class="fa-solid fa-share-nodes"></i> مشاركة</button>' : ''} ${r.val !== undefined && isFinite(r.val) ? '<button class="btn ghost" id="sv"><i class="fa-solid fa-bookmark"></i> حفظ كمتغير</button>' : ''}${r.plot ? '<div id="plot"></div>' : ''}</div>`;
    if (r.plot) r.plot('plot');
    $('#cp').onclick = async e => { try { await navigator.clipboard.writeText(r.res); e.currentTarget.textContent = 'تم النسخ ✓'; } catch {} };
    if (r.val !== undefined && isFinite(r.val)) { vars.ans = r.val; store.set('vars', vars); }
    const sh = $('#shr'); if (sh) sh.onclick = () => navigator.share({ title: T.n, text: T.n + ': ' + r.res }).catch(() => {});
    const sv = $('#sv'); if (sv) sv.onclick = () => { const n = prompt('اسم المتغير (حروف إنجليزية):', 'r1'); if (n && /^[A-Za-z_]\w*$/.test(n)) { vars[n] = r.val; store.set('vars', vars); sv.textContent = 'تم الحفظ ✓'; } };
    if (!live) hist.unshift({ t: T.n, r: r.res }); hist = hist.slice(0, 40); store.set('hist', hist); renderHist();
  } catch (e) {
    out.innerHTML = `<div class="card err"><h3><i class="fa-solid fa-triangle-exclamation"></i> تعذّر الحساب</h3><p>${esc(explain(e))}</p></div>`;
  }
}
function renderHist() {
  $('#histList').innerHTML = hist.length ? hist.map((h, i) => `<li data-n="${i}" style="cursor:pointer" title="اضغط للنسخ"><small>${esc(h.t)}</small><b>${esc(h.r)}</b></li>`).join('') : '<li><small>لا توجد عمليات بعد — ابدأ بأي أداة.</small></li>';
  $$('#histList li[data-n]').forEach(li => li.onclick = async () => { try { await navigator.clipboard.writeText(hist[+li.dataset.n].r); li.style.outline = '2px solid var(--ac)'; setTimeout(() => li.style.outline = '', 600); } catch {} });
}

/* الحاسبة العلمية ذات الأزرار: كل العمليات على الشاشة، مع طبقة ثانية (2nd) وذاكرة */
let degMode = store.get('deg', true);
function calcEval(t) {
  if (degMode) t = t.replace(/\b(a?(?:sin|cos|tan))\(/g, '$1d(');
  const r = math.evaluate(t.replace(/%/g, '/100'), scope());
  if (typeof r === 'number' && !isFinite(r)) throw new Error('DIV0');
  return r;
}
/* عرض التعبير بالرموز الجميلة: √ π × ÷ ² ³ */
const pretty = s => s.replace(/\blog\(/g, 'ln(').replace(/log10\(/g, 'log(').replace(/nthRoot\(/g, 'ⁿ√(').replace(/sqrt\(/g, '√(').replace(/cbrt\(/g, '∛(')
  .replace(/\^2(?!\d)/g, '²').replace(/\^3(?!\d)/g, '³').replace(/\bpi\b/g, 'π').replace(/\*10\^/g, '×10^').replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
function renderCalc(v) {
  // [التسمية، الإدخال، الصنف، تسمية الطبقة الثانية، إدخالها]
  const K = [['2nd', '2ND', 'fn'], ['DEG', 'MODE', 'fn'], ['(', '('], [')', ')'], ['⌫', 'B', 'op'], ['C', 'C', 'op'],
    ['sin', 'sin(', 'fn', 'sin⁻¹', 'asin('], ['x²', '^2', 'fn', 'x³', '^3'], ['7'], ['8'], ['9'], ['÷', '/', 'op'],
    ['cos', 'cos(', 'fn', 'cos⁻¹', 'acos('], ['√', 'sqrt(', 'fn', '∛', 'cbrt('], ['4'], ['5'], ['6'], ['×', '*', 'op'],
    ['tan', 'tan(', 'fn', 'tan⁻¹', 'atan('], ['xⁿ', '^', 'fn', 'ⁿ√', 'nthRoot('], ['1'], ['2'], ['3'], ['−', '-', 'op'],
    ['log', 'log10(', 'fn', '10ˣ', '10^('], ['ln', 'log(', 'fn', 'eˣ', 'exp('], ['0'], ['.'], ['EXP', '*10^', 'fn'], ['+', '+', 'op'],
    ['π', 'pi', 'fn', 'e', 'e'], ['x!', '!', 'fn', 'nCr', 'combinations('], ['1/x', '1/(', 'fn', 'mod', ' mod '], ['abs', 'abs(', 'fn', ',', ','], ['ans', 'ans', 'fn', '%', '%'], ['=', '=', 'eq'],
    ['MC', 'MC', 'mem'], ['MR', 'MR', 'mem'], ['M+', 'M+', 'mem'], ['M−', 'M-', 'mem'], ['±', 'PM', 'fn'], ['a/b', 'FRAC', 'fn']];
  v.innerHTML = `<div class="card calc"><input id="disp" class="disp" dir="ltr" inputmode="none" autocomplete="off" placeholder="اكتب أو اضغط الأزرار…">
  <div id="pretty" class="pretty">&nbsp;</div><div id="cres" class="cres">&nbsp;</div>
  <div class="keys">${K.map(([l, i = l, c = '', l2 = '', i2 = '']) => `<button class="k ${c}" data-l="${esc(i === 'MODE' ? (degMode ? 'DEG' : 'RAD') : l)}" data-i="${esc(i)}" data-l2="${esc(l2)}" data-i2="${esc(i2)}">${i === 'MODE' ? (degMode ? 'DEG' : 'RAD') : l}</button>`).join('')}</div>
  <p class="note" style="margin-top:12px">كل العمليات على الشاشة: اضغط <b>2nd</b> للدوال العكسية والجذر التكعيبي والتكعيب. <code>ans</code> آخر ناتج، و<code>M</code> الذاكرة.</p></div>`;
  const d = $('#disp'), res = $('#cres'), pr = $('#pretty'); let sec = false;
  const show = () => { pr.textContent = pretty(d.value) || '\u00a0'; };
  const preview = () => { show(); res.style.color = ''; try { res.textContent = d.value.trim() ? '= ' + fmt(calcEval(d.value)) : '\u00a0'; } catch { res.textContent = '\u00a0'; } };
  const equals = () => { try { const r = calcEval(d.value), s = fmt(r); if (typeof r === 'number') { vars.ans = r; store.set('vars', vars); }
      hist.unshift({ t: 'الحاسبة', r: pretty(d.value) + ' = ' + s }); hist = hist.slice(0, 40); store.set('hist', hist); renderHist(); show(); res.style.color = ''; res.textContent = '= ' + s; d.value = s; }
    catch (e) { res.style.color = 'var(--er)'; res.textContent = explain(e); } };
  $$('.k', v).forEach(b => b.onclick = () => {
    buzz();
    const i = sec && b.dataset.i2 ? b.dataset.i2 : b.dataset.i;
    try {
      if (i === 'C') d.value = ''; else if (i === 'B') d.value = d.value.slice(0, -1); else if (i === '=') return equals();
      else if (i === '2ND') { sec = !sec; b.classList.toggle('sec', sec); $$('.k', v).forEach(k => { k.textContent = sec && k.dataset.l2 ? k.dataset.l2 : k.dataset.l; }); return; }
      else if (i === 'MODE') { degMode = !degMode; store.set('deg', degMode); b.dataset.l = b.textContent = degMode ? 'DEG' : 'RAD'; }
      else if (i === 'MC') { delete vars.M; store.set('vars', vars); res.textContent = 'تم مسح الذاكرة'; return; }
      else if (i === 'MR') d.value += 'M';
      else if (i === 'M+' || i === 'M-') { const r = calcEval(d.value); vars.M = (vars.M || 0) + (i === 'M+' ? r : -r); store.set('vars', vars); res.textContent = 'M = ' + fmt(vars.M); return; }
      else if (i === 'PM') d.value = d.value ? (d.value.startsWith('-(') ? d.value.slice(2, -1) : '-(' + d.value + ')') : '-';
      else if (i === 'FRAC') { const r = calcEval(d.value); res.textContent = '= ' + math.format(math.fraction(r)); return; }
      else d.value += i;
      if (sec && i !== '2ND') { sec = false; $$('.k', v).forEach(k => { k.textContent = k.dataset.l; k.classList.remove('sec'); }); }
    } catch (e) { res.style.color = 'var(--er)'; res.textContent = explain(e); return; }
    preview();
  });
  d.oninput = preview; d.onkeydown = e => { if (e.key === 'Enter') equals(); };
}

/* ---------- لوحة الرياضيات العامة: تُدخل الرموز في أي حقل بأي أداة ---------- */
const MK = {
  'أساسي': [['7'], ['8'], ['9'], ['÷', '/'], ['⌫', 'B'], ['C', 'C'], ['4'], ['5'], ['6'], ['×', '*'], ['(', '('], [')', ')'], ['1'], ['2'], ['3'], ['−', '-'], ['x²', '^2'], ['x³', '^3'],
    ['0'], ['.'], [',', ','], ['+', '+'], ['√', 'sqrt('], ['xⁿ', '^'], ['←', 'L'], ['→', 'R'], ['∛', 'cbrt('], ['π', 'pi'], ['e', 'e'], ['1/x', '1/(']],
  'دوال': [['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('], ['asin', 'asin('], ['acos', 'acos('], ['atan', 'atan('], ['sinh', 'sinh('], ['cosh', 'cosh('], ['tanh', 'tanh('], ['log', 'log10('], ['ln', 'log('], ['eˣ', 'exp('],
    ['abs', 'abs('], ['floor', 'floor('], ['ceil', 'ceil('], ['round', 'round('], ['x!', '!'], ['mod', ' mod '], ['gcd', 'gcd('], ['lcm', 'lcm('], ['nCr', 'combinations('], ['nPr', 'permutations('], ['mean', 'mean('], ['⌫', 'B']],
  'رموز': [['x', 'x'], ['y', 'y'], ['z', 'z'], ['t', 't'], ['n', 'n'], ['a', 'a'], ['b', 'b'], ['th', 'th'], ['i', 'i'], ['∞', 'Infinity'], ['°', '*pi/180'], ['%', '%'],
    ['[', '['], [']', ']'], ['[[', '[['], [']]', ']]'], ['=', '='], ['@', '@'], ['<', '<'], ['>', '>'], ['dx', 'dx'], ['dt', 'dt'], ['←', 'L'], ['→', 'R'], ['⌫', 'B'], ['C', 'C']]
};
let lastField = null, kbOn = store.get('kb', matchMedia('(pointer:coarse)').matches), sysKb = false;
const mk = document.createElement('div'); mk.className = 'mk glass';
const mkBtn = document.createElement('button'); mkBtn.id = 'mkBtn'; mkBtn.setAttribute('aria-label', 'لوحة الرياضيات'); mkBtn.innerHTML = '<i class="fa-solid fa-square-root-variable"></i>';
document.body.append(mk, mkBtn);
const mkFields = () => $$('#view input[data-k]:not([type=file]), #view textarea[data-k], #vv');
function mkSync() { // يظهر الزر فقط حين توجد حقول نصية في الأداة الحالية
  const has = mkFields().length > 0; mkBtn.style.display = has && !mk.classList.contains('on') ? '' : 'none';
  if (!has) { mk.classList.remove('on'); document.body.classList.remove('mkon'); }
  mkFields().forEach(f => f.inputMode = mk.classList.contains('on') && !sysKb ? 'none' : 'text');
}
function mkShow(on) { mk.classList.toggle('on', on); document.body.classList.toggle('mkon', on); store.set('kb', on); kbOn = on; mkSync(); }
function mkDraw(tab = 'أساسي') {
  mk.innerHTML = `<div class="tabs">${Object.keys(MK).map(t => `<button data-t="${t}" class="${t === tab ? 'on' : ''}">${t}</button>`).join('')}<button data-sys="1">${sysKb ? 'لوحتي' : 'abc'}</button><button data-x="1">✕</button></div>
  <div class="kg">${MK[tab].map(([l, i = l]) => `<button data-i="${esc(i)}">${l}</button>`).join('')}</div>`;
}
function mkInsert(i) {
  const f = lastField; if (!f || !document.contains(f)) return;
  let s = f.selectionStart ?? f.value.length, e = f.selectionEnd ?? s;
  if (i === 'C') { f.value = ''; s = e = 0; }
  else if (i === 'B') { if (s === e && s > 0) s--; f.setRangeText('', s, e, 'end'); }
  else if (i === 'L') { f.setSelectionRange(Math.max(0, s - 1), Math.max(0, s - 1)); return; }
  else if (i === 'R') { f.setSelectionRange(s + 1, s + 1); return; }
  else f.setRangeText(i, s, e, 'end');
  f.dispatchEvent(new Event('input', { bubbles: true }));
}
mkDraw();
mk.addEventListener('pointerdown', e => e.preventDefault()); // لا تُفقد التركيز عن الحقل
mk.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; buzz();
  if (b.dataset.t) return mkDraw(b.dataset.t);
  if (b.dataset.x) return mkShow(false);
  if (b.dataset.sys) { sysKb = !sysKb; mkDraw($('.tabs .on', mk)?.dataset.t); mkSync(); if (lastField) { lastField.blur(); lastField.focus(); } return; }
  mkInsert(b.dataset.i); });
mkBtn.onclick = () => { mkShow(true); if (!lastField || !document.contains(lastField)) lastField = mkFields()[0] || null; if (lastField) lastField.focus(); };
document.addEventListener('focusin', e => { if (mkFields().includes(e.target)) { lastField = e.target; if (kbOn && !mk.classList.contains('on')) mkShow(true); } });

/* قسم المفضلة */
function renderFav(v) {
  const L = favs.map(k => { const [sk, i] = k.split(':'), T = SEC[sk] && SEC[sk].tools && SEC[sk].tools[+i]; return T ? { sk, i: +i, n: T.n, sn: SEC[sk].n } : null; }).filter(Boolean);
  v.innerHTML = `<div class="card"><h2>الأدوات المفضلة</h2><p class="note">اضغط النجمة ⭐ داخل أي أداة لتثبيتها هنا والوصول إليها بسرعة.</p>${L.length ? L.map(x => `<button class="chip" style="margin:4px" data-s="${x.sk}" data-i="${x.i}">${x.n} · ${x.sn}</button>`).join('') : '<p class="note">لا توجد أدوات مفضلة بعد.</p>'}</div>`;
  $$('[data-s]', v).forEach(b => b.onclick = () => open(b.dataset.s, +b.dataset.i));
}

/* قسم المتغيرات المخصصة */
function renderVars(v) {
  const rows = Object.entries(vars).map(([k, x]) => `<tr><td dir="ltr"><code>${esc(k)}</code></td><td dir="ltr">${fmt(x)}</td><td><button class="icon" data-d="${esc(k)}"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
  v.innerHTML = `<div class="card"><h2>المتغيرات والثوابت المخصصة</h2><p class="note">احفظ قيمة مرة واحدة ثم استخدم اسمها في أي حقل (مثل m*g أو 2*r).</p>
  <div class="fields"><label>الاسم<input id="vn" placeholder="r"></label><label>القيمة<input id="vv" placeholder="0.5"></label></div><button class="btn" id="vadd">حفظ المتغير</button></div>
  <div class="card">${rows ? `<table>${rows}</table>` : '<p class="note">لا توجد متغيرات محفوظة بعد.</p>'}</div>`;
  $('#vadd').onclick = () => { try { const n = $('#vn').value.trim(); if (!/^[A-Za-z_]\w*$/.test(n)) throw new Error('!اسم المتغير يجب أن يبدأ بحرف إنجليزي ويتكون من حروف وأرقام فقط.'); vars[n] = num($('#vv').value); store.set('vars', vars); renderVars(v); } catch (e) { modal(explain(e)); } };
  $$('[data-d]', v).forEach(b => b.onclick = () => { delete vars[b.dataset.d]; store.set('vars', vars); renderVars(v); });
}

/* قسم الإعدادات (يتضمن مكان الباركود) */
function renderSettings(v) {
  const sel = (id, l, o, cur) => `<label>${l}<select id="${id}">${o.map(([x, y]) => `<option value="${x}" ${String(x) === String(cur) ? 'selected' : ''}>${y}</option>`).join('')}</select></label>`;
  v.innerHTML = `<div class="card"><h2>المظهر</h2><p class="note">نهار / ليل</p><button class="dn" id="dn" aria-label="تبديل المظهر"></button>
  <div class="fields" style="margin-top:14px">${sel('fs', 'حجم الخط', [['14px', 'صغير'], ['16px', 'متوسط'], ['18px', 'كبير'], ['20px', 'كبير جداً']], store.get('fs', '16px'))}</div></div>
  <div class="card"><h2>الدقة والحساب</h2><div class="fields">
    ${sel('prec', 'الأرقام المعنوية', [[6, '6'], [8, '8'], [10, '10 (افتراضي)'], [12, '12'], [15, '15']], cfg.prec)}
    ${sel('fmtn', 'صيغة الأعداد', [['n', 'عادية'], ['s', 'علمية (1.23e+5)']], cfg.sci ? 's' : 'n')}
    ${sel('ang', 'وحدة الزوايا', [['d', 'درجات DEG'], ['r', 'راديان RAD']], degMode ? 'd' : 'r')}
    ${sel('vib', 'اهتزاز الأزرار', [['0', 'متوقف'], ['1', 'مفعّل']], cfg.vib ? '1' : '0')}
    ${sel('kbp', 'لوحة الرياضيات', [['1', 'تظهر تلقائياً عند الكتابة'], ['0', 'عند الطلب فقط']], kbOn ? '1' : '0')}</div></div>
  <div class="card"><h2>مشاركة التطبيق</h2><p class="note">امسح الباركود أو شارك الرابط.</p><div class="qr" id="qrBox"></div><br>
  <button class="btn" id="share"><i class="fa-solid fa-share-nodes"></i> مشاركة الرابط</button></div>
  <div class="card"><h2>النسخ الاحتياطي</h2><p class="note">صدّر متغيراتك وسجلك ومفضلتك وإعداداتك كملف، واستعدها في أي جهاز.</p>
    <button class="btn ghost" id="exp"><i class="fa-solid fa-file-export"></i> تصدير نسخة</button>
    <label class="btn ghost" style="display:inline-flex;cursor:pointer"><i class="fa-solid fa-file-import"></i>&nbsp;استعادة نسخة<input id="imp" type="file" accept=".json,application/json" hidden></label>
    <button class="btn ghost" id="exh"><i class="fa-solid fa-file-lines"></i> تصدير السجل كنص</button></div>
  <div class="card"><h2>الصيانة</h2><button class="btn ghost" id="upd"><i class="fa-solid fa-rotate"></i> تحديث التطبيق وإفراغ الذاكرة المؤقتة</button>
    <button class="btn ghost" id="ch">مسح السجل</button> <button class="btn ghost" id="cv">مسح المتغيرات</button></div>
  <div class="card"><h2>عن MathNova</h2><p class="note">الإصدار 3 — الحسابات تعمل على جهازك. أول تشغيل يحتاج إنترنت لتحميل المكتبات، ثم تعمل دون اتصال (ما عدا قراءة الصور).</p></div>`;
  const save = () => store.set('cfg', cfg), box = $('#qrBox');
  box.textContent = 'مكان الباركود: ضع الملف qr.png بجانب index.html';
  const img = new Image(); img.alt = 'باركود MathNova'; img.onload = () => { box.classList.add('ok'); box.replaceChildren(img); }; img.src = 'qr.png';
  $('#dn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('#fs').onchange = e => { store.set('fs', e.target.value); document.documentElement.style.setProperty('--fs', e.target.value); };
  $('#prec').onchange = e => { cfg.prec = +e.target.value; save(); };
  $('#fmtn').onchange = e => { cfg.sci = e.target.value === 's'; save(); };
  $('#ang').onchange = e => { degMode = e.target.value === 'd'; store.set('deg', degMode); };
  $('#vib').onchange = e => { cfg.vib = e.target.value === '1'; save(); buzz(); };
  $('#kbp').onchange = e => { kbOn = e.target.value === '1'; store.set('kb', kbOn); };
  $('#share').onclick = async () => { const d = { title: document.title, text: 'MathNova — العلم في معادلة واحدة', url: location.href }; try { navigator.share ? await navigator.share(d) : (await navigator.clipboard.writeText(location.href), modal('تم نسخ الرابط.')); } catch {} };
  const dl = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  $('#exp').onclick = () => dl('mathnova-backup.json', JSON.stringify({ app: 'MathNova', vars, hist, favs, cfg, deg: degMode, theme: store.get('theme', 'dark'), fs: store.get('fs', '16px') }, null, 1), 'application/json');
  $('#exh').onclick = () => dl('mathnova-history.txt', hist.map(h => `${h.t}: ${h.r}`).join('\n') || 'السجل فارغ', 'text/plain;charset=utf-8');
  $('#imp').onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (d.app !== 'MathNova') throw 0;
      vars = d.vars || {}; hist = d.hist || []; favs = d.favs || []; Object.assign(cfg, d.cfg || {}); if (d.deg !== undefined) degMode = d.deg;
      store.set('vars', vars); store.set('hist', hist); store.set('favs', favs); store.set('cfg', cfg); store.set('deg', degMode); renderHist(); modal('تمت استعادة النسخة الاحتياطية ✓'); }
    catch { modal('الملف غير صالح: اختر ملفاً صدّرته من MathNova.'); } };
  $('#upd').onclick = async () => { try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); for (const k of await caches.keys()) await caches.delete(k); } catch {} location.reload(); };
  $('#ch').onclick = () => { hist = []; store.set('hist', hist); renderHist(); modal('تم مسح السجل.'); };
  $('#cv').onclick = () => { vars = {}; store.set('vars', vars); modal('تم مسح المتغيرات.'); };
}
function setTheme(t) { document.documentElement.dataset.theme = t; store.set('theme', t); $('meta[name=theme-color]').content = t === 'dark' ? '#0b1020' : '#eef1fb'; }
function modal(h) { $('#modalBody').innerHTML = h; $('#modal').hidden = false; }

/* ---------- 11) تشغيل التطبيق ---------- */
setTheme(store.get('theme', 'dark')); document.documentElement.style.setProperty('--fs', store.get('fs', '16px'));
const items = Object.entries(SEC);
$('#nav').innerHTML = items.map(([k, S]) => `<button data-s="${k}"><i class="fa-solid ${S.i}"></i><span>${S.n}</span></button>`).join('');
$('#gnav').innerHTML = items.filter(([k]) => !['vars', 'fav'].includes(k)).map(([k, S]) => `<button data-s="${k}"><i class="fa-solid ${S.i}"></i>${S.n.split(' ')[0]}</button>`).join('');
$$('#nav button,#gnav button').forEach(b => b.onclick = () => open(b.dataset.s));
$('#collapse').onclick = () => { $('#side').classList.toggle('collapsed'); $('#app').classList.toggle('col'); };
$('#histToggle').onclick = () => $('#hist').classList.toggle('show');
$('#clearHist').onclick = () => { hist = []; store.set('hist', hist); renderHist(); };
$('#modalClose').onclick = () => $('#modal').hidden = true;

/* البحث عن الأدوات */
const q = $('#q');
q.oninput = () => {
  const s = q.value.trim().toLowerCase(), h = $('#hits'); if (!s) { h.innerHTML = ''; return; }
  h.innerHTML = items.flatMap(([k, S]) => (S.tools || []).map((t, i) => ({ k, i, n: t.n, sn: S.n }))).filter(x => x.n.toLowerCase().includes(s) || x.sn.includes(s))
    .slice(0, 12).map(x => `<button data-k="${x.k}" data-i="${x.i}">${x.n}<small>${x.sn}</small></button>`).join('') || '<button disabled>لا توجد نتائج</button>';
  $$('#hits button[data-k]').forEach(b => b.onclick = () => { open(b.dataset.k, +b.dataset.i); q.value = ''; h.innerHTML = ''; });
};

/* ---------- 12) تثبيت PWA ---------- */
let deferred = null; const ib = $('#installBtn');
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
addEventListener('appinstalled', () => { ib.style.setProperty('--p', '100%'); $('b', ib).textContent = 'تم التثبيت ✓'; deferred = null; });
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) ib.hidden = true;
ib.onclick = async () => {
  if (!deferred) return modal('<b>طريقة التثبيت يدوياً:</b><br>• آيفون (Safari): زر المشاركة ← «إضافة إلى الشاشة الرئيسية».<br>• أندرويد/كمبيوتر (Chrome أو Edge): قائمة المتصفح ← «تثبيت التطبيق».<br>يظهر الزر الآلي بعد زيارة الصفحة عبر https.');
  ib.style.setProperty('--p', '35%'); deferred.prompt();
  const { outcome } = await deferred.userChoice; ib.style.setProperty('--p', outcome === 'accepted' ? '100%' : '0%'); deferred = null;
};
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

renderHist(); const h0 = location.hash.slice(1); open(SEC[h0] ? h0 : 'calc');
