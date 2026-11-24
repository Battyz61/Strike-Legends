// Optimized Vercel Serverless AI Referee Handler for Strike-Legends (İsim Şehir)
// Includes:
// 1. Pre-flight deterministic short-circuiting (instant 0ms response for letter/length violations without burning Gemini quota)
// 2. Bounded in-memory LRU cache (instant response for repeated category+letter+answer queries across rooms)
// 3. AbortController request timeout & smart retry backoff
// 4. Unified deterministic Turkish validation layer synced with cloudflare/worker.js

const CACHE_LIMIT = 500;
const responseCache = new Map();

function getCachedResult(key) {
  if (!responseCache.has(key)) return null;
  const value = responseCache.get(key);
  responseCache.delete(key);
  responseCache.set(key, value);
  return value;
}

function setCachedResult(key, value) {
  if (responseCache.has(key)) responseCache.delete(key);
  else if (responseCache.size >= CACHE_LIMIT) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey !== undefined) responseCache.delete(oldestKey);
  }
  responseCache.set(key, value);
}

const COMPACT_CHAR_MAP = {
  'ı': 'i', 'İ': 'i', 'ş': 's', 'ğ': 'g', 'ç': 'c', 'ö': 'o', 'ü': 'u'
};

function compactSpelling(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/['’]/g, '')
    .replace(/[ıİşğçöü]/g, ch => COMPACT_CHAR_MAP[ch] || ch)
    .replace(/[^a-z0-9]/g, '');
}

function oneEditAway(a, b) {
  if (!a || !b || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i] && ++diff > 1) return false;
    }
    return diff === 1;
  }
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  let i = 0, j = 0, diff = 0;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++;
      j++;
    } else {
      j++;
      if (++diff > 1) return false;
    }
  }
  return true;
}

const AMBIGUOUS_FRUITS_RE = /^(erik|elma|armut|kiraz|şeftali|kayısı|portakal|limon|mandalina|nar|zeytin|incir|üzüm|dut|vişne|ayva)$/;
const ANIMAL_PRODUCTS_RE = /^(süt|yün|deri|yumurta|bal|peynir|tereyağı)$/;
const PLANT_PRODUCTS_RE = /^(un|yağ|salça|şeker|çay|kahve|reçel)$/;
const TURKISH_CITIES_IN_COUNTRY_RE = /^(trabzon|ankara|istanbul|izmir|bursa|antalya|rize|ordu|samsun|adana|konya|gaziantep|kayseri|mersin|eskişehir|diyarbakır|denizli|şanlıurfa|malatya|erzurum)$/;

const LETTER_MISMATCH_CLAIM_RE = /(?:başlamıyor|başlamamaktadır|başlamamış|harfiyle başlam|seçilen harf|ilk harf|harf(?:i)? uyuşm)/i;
const SEMANTIC_REJECT_RE = /(?:değil|değildir|uygun değil|kategoriye girmez|şehir değildir|ülke değildir|hayvan değildir|bitki değildir|ürünüdür|ürünü|mahalle|ilçe|köy|belde|semt)/i;
const SPELLING_EVIDENCE_RE = /yazım|yazim|harf|yanlış yaz|yanlis yaz|typo/;
const SUB_SETTLEMENT_RE = /(?:mahalle\w*|semt\w*|köy\w*|ilçe\w*|belde\w*|kasaba\w*|mezra\w*)/i;
const AMBIGUITY_SIGNALS_RE = /(?:olabilir|olması mümkün|bağlama göre|kullanılabilir|bazı kaynaklarda|bazı kullanımlarda|iki anlam|çift anlam|belirsiz|kesin değil|tartışmalı|değişebilir)/i;
const HARD_REJECT_SIGNALS_RE = /(?:değildir|değil|uymaz|uygun değil|kabul edilmez|kategoriye girmez|bir .* değil)/i;
const HARD_ACCEPT_SIGNALS_RE = /(?:tam olarak|doğrudan|kesinlikle|açıkça|kendisi olan|gerçek bir)/i;

const CATEGORY_CONFLICT_RULES = {
  'ülke': [
    { test: /(?:şehir|il|ilçe|mahalle|semt|köy|bölge)\b.*(?:değil|değildir|ülke değil)/i, reason: 'Gerekçede cevabın ülke değil, farklı bir yerleşim veya coğrafi birim olduğu belirtiliyor.' }
  ],
  'hayvan': [
    { test: /(?:ürün|parça|yiyecek|et|süt|yün|deri|yumurta|bal)\b.*(?:hayvan değil|hayvanın kendisi değil|hayvan değildir)/i, reason: 'Gerekçede cevabın hayvanın kendisi olmadığı belirtiliyor.' }
  ],
  'yemek malzemesi': [
    { test: /(?:hazır yemek|yemek|hayvan|bitki)\b.*(?:malzeme değil|malzeme değildir|tek başına malzeme sayılmaz)/i, reason: 'Gerekçede cevabın yemek malzemesi olmadığı belirtiliyor.' }
  ]
};

const ALLOWED_FIT = new Set(['Uygun görünüyor', 'Uygun görünmüyor', 'Tartışmalı']);
const ALLOWED_CONFIDENCE = new Set(['Yüksek', 'Orta', 'Düşük']);
const MODEL_CANDIDATES = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const RETRY_DELAYS = [0, 700, 1600];
const FETCH_TIMEOUT_MS = 6500;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, answer, letter } = req.body || {};
    const cleanCategory = String(category || '').trim().slice(0, 80);
    const cleanAnswer = String(answer || '').trim().slice(0, 160);
    const cleanLetter = String(letter || '').trim().slice(0, 3);

    if (!cleanCategory || !cleanAnswer) {
      return res.status(400).json({ error: 'category and answer are required' });
    }

    const normalizedAnswer = cleanAnswer.replace(/\s+/g, '').toLocaleUpperCase('tr-TR');
    const normalizedLetter = cleanLetter.replace(/\s+/g, '').toLocaleUpperCase('tr-TR');
    const promptLetterMatches = !normalizedLetter || normalizedAnswer.startsWith(normalizedLetter);
    const categoryKey = cleanCategory.toLocaleLowerCase('tr-TR');
    const normalizedSemanticAnswer = cleanAnswer.toLocaleLowerCase('tr-TR').replace(/['’]/g, '').trim();
    const letterCount = Array.from(cleanAnswer.replace(/\s+/g, '')).length;
    const isThreeLetterCategory = /(?:^|\b)3\s*harfli\s+kelime(?:\b|$)/i.test(categoryKey);
    const isEightLetterCategory = /(?:^|\b)8\s*harfli\s+kelime(?:\b|$)/i.test(categoryKey);

    if (normalizedLetter && normalizedAnswer && !promptLetterMatches) {
      return res.status(200).json({
        text: `"${cleanAnswer}" cevabı "${cleanLetter}" harfiyle başlamıyor.`,
        analysis: {
          uygunluk: 'Uygun görünmüyor',
          guven: 'Yüksek',
          gerekce: 'Cevap seçilen harfle başlamıyor; bu nedenle kategori kuralına uygun değildir.'
        }
      });
    }

    if (isThreeLetterCategory && letterCount !== 3) {
      return res.status(200).json({
        text: `"${cleanAnswer}" toplam ${letterCount} harflidir.`,
        analysis: {
          uygunluk: 'Uygun görünmüyor',
          guven: 'Yüksek',
          gerekce: 'Cevap tam 3 harfli değil; bu kategori yalnızca 3 harfli kelimeleri kabul eder.'
        }
      });
    }

    if (isEightLetterCategory && letterCount !== 8) {
      return res.status(200).json({
        text: `"${cleanAnswer}" toplam ${letterCount} harflidir.`,
        analysis: {
          uygunluk: 'Uygun görünmüyor',
          guven: 'Yüksek',
          gerekce: 'Cevap tam 8 harfli değil; bu kategori yalnızca 8 harfli kelimeleri kabul eder.'
        }
      });
    }

    if (categoryKey === 'hayvan' && ANIMAL_PRODUCTS_RE.test(normalizedSemanticAnswer)) {
      return res.status(200).json({
        text: `"${cleanAnswer}" hayvansal bir üründür, bir hayvan türü değildir.`,
        analysis: {
          uygunluk: 'Uygun görünmüyor',
          guven: 'Yüksek',
          gerekce: 'Cevap bir hayvanın kendisi değil, hayvansal bir ürün veya hayvandan elde edilen bir üründür.'
        }
      });
    }

    if (categoryKey === 'bitki' && PLANT_PRODUCTS_RE.test(normalizedSemanticAnswer)) {
      return res.status(200).json({
        text: `"${cleanAnswer}" bitkisel veya işlenmiş bir gıda ürünüdür.`,
        analysis: {
          uygunluk: 'Uygun görünmüyor',
          guven: 'Yüksek',
          gerekce: 'Cevap bitkinin kendisi değil, bitkisel bir ürün veya işlenmiş bir üründür.'
        }
      });
    }

    if (categoryKey === 'ülke' && TURKISH_CITIES_IN_COUNTRY_RE.test(normalizedSemanticAnswer)) {
      return res.status(200).json({
        text: `"${cleanAnswer}" Türkiye'de yer alan bir şehirdir, bağımsız bir ülke değildir.`,
        analysis: {
          uygunluk: 'Uygun görünmüyor',
          guven: 'Yüksek',
          gerekce: 'Cevap bir ülke değil, şehir adıdır.'
        }
      });
    }

    const cacheKey = `${categoryKey}|${normalizedLetter}|${normalizedAnswer}`;
    const cached = getCachedResult(cacheKey);
    if (cached) {
      res.setHeader('X-AI-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
    }

    const prompt =
      'Sen İsim Şehir oyununun tarafsız yardımcı hakemisin. Türkçe cevap ver ve yalnızca verilen Cevap + Kategori için değerlendirme yap. ' +
      'Asla başka örnek cevapların veya başka kategorilerin gerekçelerini kopyalama. ' +
      'Önce somut kuralları kontrol et: Başlangıç harfi verilmişse Cevap metninin ilk harfini gerçekten karşılaştır. ' +
      'Cevap seçilen harfle başlıyorsa harf nedeniyle reddetme ve gerekçede başlamadığını söyleme. Cevap seçilen harfle başlamıyorsa bunu açıkça belirt. ' +
      'Sonra cevabın gerçekten istenen kategoriye ait olup olmadığını değerlendir. Kategori ile cevap arasında belirsizlik varsa Tartışmalı seç. ' +
      'Bilgi, cevabın kendisi hakkında tarafsız kısa bir bilgidir; gerekçe ise yalnızca bu cevabın bu kategoriye neden uyup uymadığını açıklar. ' +
      'Bilgi ile gerekçe birbiriyle çelişirse kesin kabul veya kesin red verme; Tartışmalı seç. ' +
      'Uygunluk için yalnızca "Uygun görünüyor", "Uygun görünmüyor" veya "Tartışmalı"; güven için yalnızca "Yüksek", "Orta" veya "Düşük" kullan. ' +
      'Şehir kategorisinde mahalle, köy, ilçe, belde veya küçük alt yerleşimleri şehir olarak kabul etme. Ülke kategorisinde şehir/il/ilçe gibi yerleri ülke kabul etme. ' +
      'Hayvan veya Bitki kategorisinde ürününü değil varlığın kendisini değerlendir; iki anlamlı yerleşik kullanımlarda Tartışmalı seç. ' +
      '3 harfli kelime kategorisinde cevap tam 3 harf olmalı ve Türkçede anlamlı bir kelime olmalı. 8 harfli kelime kategorisinde tam 8 harf olmalı. ' +
      'Yazım hatası küçük ve ne kastedildiği açıkça anlaşılırsa sırf bu nedenle kesin red verme. Emin olmadığın ayrıntıları uydurma. ' +
      'Yanıtı SADECE geçerli JSON olarak döndür. ' +
      'JSON alanları: uygunluk, guven, gerekce (en fazla 20 kelime), bilgi (en fazla 35 kelime). ' +
      'Kontrol için hesaplanmış harf bilgisi: Cevap="' + cleanAnswer + '", Başlangıç harfi="' + (cleanLetter || 'Belirtilmedi') + '", Harf eşleşmesi=' + (promptLetterMatches ? 'EVET' : 'HAYIR') + '. ' +
      'Kategori: ' + cleanCategory;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 220,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            uygunluk: {
              type: 'string',
              enum: ['Uygun görünüyor', 'Uygun görünmüyor', 'Tartışmalı']
            },
            guven: {
              type: 'string',
              enum: ['Yüksek', 'Orta', 'Düşük']
            },
            gerekce: { type: 'string' },
            bilgi: { type: 'string' }
          },
          required: ['uygunluk', 'guven', 'gerekce', 'bilgi']
        }
      }
    });

    let response = null;
    let data = {};
    const encodedKey = encodeURIComponent(process.env.GEMINI_API_KEY);

    for (const model of MODEL_CANDIDATES) {
      for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
        if (RETRY_DELAYS[attempt]) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodedKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: requestBody,
              signal: controller.signal
            }
          );
          data = await response.json().catch(() => ({}));
        } catch (fetchErr) {
          response = null;
          data = { error: { message: fetchErr?.message || 'Fetch timeout or network error' } };
        } finally {
          clearTimeout(timeoutId);
        }

        if (response && response.ok) break;

        console.error('Gemini API error', {
          model,
          status: response?.status || 'TIMEOUT',
          message: data?.error?.message || null
        });

        if (response && response.status < 500 && response.status !== 429) break;
        if (attempt === RETRY_DELAYS.length - 1) break;
      }

      if (response && response.ok) break;
    }

    if (!response || !response.ok) {
      return res.status(502).json({
        error: 'AI_REQUEST_FAILED',
        upstreamStatus: response?.status || 502,
        upstreamMessage: data?.error?.message || null,
        modelsTried: MODEL_CANDIDATES
      });
    }

    const raw = String(
      data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || ''
    ).trim();

    if (!raw) {
      return res.status(502).json({ error: 'AI_EMPTY_RESPONSE' });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return res.status(502).json({ error: 'AI_INVALID_RESPONSE' });
      }
    }

    const normalizedForComparison = compactSpelling(normalizedSemanticAnswer);
    const forceNotFit = (reason) => {
      parsed.uygunluk = 'Uygun görünmüyor';
      parsed.guven = 'Yüksek';
      parsed.gerekce = reason;
    };
    const forceMaybe = (reason) => {
      parsed.uygunluk = 'Tartışmalı';
      parsed.guven = 'Orta';
      parsed.gerekce = reason;
    };

    const evidenceBeforeLetterRepair = `${parsed.gerekce || ''} ${parsed.bilgi || ''}`;
    if (
      normalizedLetter &&
      normalizedAnswer &&
      promptLetterMatches &&
      parsed.uygunluk === 'Uygun görünmüyor' &&
      LETTER_MISMATCH_CLAIM_RE.test(evidenceBeforeLetterRepair)
    ) {
      if (!SEMANTIC_REJECT_RE.test(evidenceBeforeLetterRepair.replace(LETTER_MISMATCH_CLAIM_RE, ''))) {
        if (isThreeLetterCategory && letterCount === 3) {
          parsed.uygunluk = 'Uygun görünüyor';
          parsed.guven = 'Yüksek';
          parsed.gerekce = 'Cevap seçilen harfle başlıyor ve tam 3 harfli.';
        } else if (isEightLetterCategory && letterCount === 8) {
          parsed.uygunluk = 'Uygun görünüyor';
          parsed.guven = 'Yüksek';
          parsed.gerekce = 'Cevap seçilen harfle başlıyor ve tam 8 harfli.';
        } else {
          forceMaybe('Cevap seçilen harfle başlıyor; harf kuralı açısından uygundur, kategori değerlendirmesi ayrıca ele alınmalıdır.');
        }
      }
    }

    if (categoryKey === 'bitki' && AMBIGUOUS_FRUITS_RE.test(normalizedSemanticAnswer)) {
      forceMaybe('Cevap hem bitkinin/ağacın adını hem de meyvesini ifade edebilir; hangi anlamın kastedildiği tartışılabilir.');
    }

    const evidence = evidenceBeforeLetterRepair.toLocaleLowerCase('tr-TR');
    if (
      parsed.uygunluk === 'Uygun görünmüyor' &&
      SPELLING_EVIDENCE_RE.test(evidence) &&
      normalizedForComparison.length >= 3
    ) {
      const quoted = evidence.match(/["'“”‘’]([a-zçğıöşü]+)["'“”‘’]/i);
      if (quoted && oneEditAway(normalizedForComparison, compactSpelling(quoted[1]))) {
        forceMaybe('Cevap küçük bir yazım farkı içeriyor; kastedilen kelime açıkça anlaşılabiliyor.');
      }
    }

    if (parsed.uygunluk === 'Uygun görünüyor') {
      const rules = CATEGORY_CONFLICT_RULES[categoryKey] || [];
      const conflict = rules.find(rule => rule.test(evidence));
      if (conflict) forceNotFit(conflict.reason);
    }

    if (isThreeLetterCategory && parsed.uygunluk === 'Uygun görünmüyor' && /\b(\d+|üç|dört|beş|altı|yedi|sekiz|dokuz|on)\s*harf/.test(evidence)) {
      parsed.uygunluk = 'Uygun görünüyor';
      parsed.guven = 'Yüksek';
      parsed.gerekce = 'Cevap tam 3 harflidir ve 3 harfli kelime kategorisine uyar.';
    }

    if (isEightLetterCategory && parsed.uygunluk === 'Uygun görünmüyor' && /\b(\d+|yedi|sekiz|dokuz|on)\s*harf/.test(evidence)) {
      parsed.uygunluk = 'Uygun görünüyor';
      parsed.guven = 'Yüksek';
      parsed.gerekce = 'Cevap tam 8 harflidir ve 8 harfli kelime kategorisine uyar.';
    }

    if (categoryKey === 'şehir' && SUB_SETTLEMENT_RE.test(evidence)) {
      parsed.uygunluk = 'Uygun görünmüyor';
      parsed.guven = parsed.guven === 'Düşük' ? 'Düşük' : 'Orta';
      parsed.gerekce = 'Cevap bir mahalle, ilçe veya başka bir alt yerleşim birimidir; Şehir kategorisine uygun değildir.';
    }

    if (parsed.uygunluk === 'Uygun görünmüyor' && AMBIGUITY_SIGNALS_RE.test(evidence) && !HARD_REJECT_SIGNALS_RE.test(evidence)) {
      forceMaybe('Cevap için birden fazla makul yorum bulunuyor; kesin red yerine tartışmalı değerlendirme daha uygundur.');
    }
    if (parsed.uygunluk === 'Uygun görünüyor' && AMBIGUITY_SIGNALS_RE.test(evidence) && !HARD_ACCEPT_SIGNALS_RE.test(evidence)) {
      forceMaybe('Cevabın kategoriyle ilişkisi bağlama göre değişebiliyor; kesin kabul yerine tartışmalı değerlendirme daha uygundur.');
    }

    const uygunluk = ALLOWED_FIT.has(String(parsed.uygunluk)) ? String(parsed.uygunluk) : 'Tartışmalı';
    const guven = ALLOWED_CONFIDENCE.has(String(parsed.guven)) ? String(parsed.guven) : 'Düşük';
    const gerekce = String(parsed.gerekce || '').trim().slice(0, 180);
    const bilgi = String(parsed.bilgi || '').trim().slice(0, 260);

    if (!bilgi) {
      return res.status(502).json({ error: 'AI_EMPTY_RESPONSE' });
    }

    const finalPayload = { text: bilgi, analysis: { uygunluk, guven, gerekce } };
    setCachedResult(cacheKey, finalPayload);

    res.setHeader('X-AI-Cache', 'MISS');
    return res.status(200).json(finalPayload);
  } catch (error) {
    console.error('Gemini AI info error', error);
    return res.status(500).json({ error: 'AI_SERVER_ERROR' });
  }
}
