const MODEL_CANDIDATES = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/\\s+/g, '');
}

function categoryKey(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

function letterCount(value) {
  return Array.from(String(value || '').replace(/\\s+/g, '')).length;
}

function forceNotFit(parsed, reason) {
  parsed.uygunluk = 'Uygun görünmüyor';
  parsed.guven = 'Yüksek';
  parsed.gerekce = reason;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/ai-info') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      return handleAi(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleAi(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const cleanCategory = String(body.category || '').trim().slice(0, 80);
    const cleanAnswer = String(body.answer || '').trim().slice(0, 160);
    const cleanLetter = String(body.letter || '').trim().slice(0, 3);

    if (!cleanCategory || !cleanAnswer) {
      return json({ error: 'category and answer are required' }, 400);
    }

    if (!env.GEMINI_API_KEY) {
      return json({ error: 'AI_NOT_CONFIGURED' }, 503);
    }

    const answerNorm = normalize(cleanAnswer);
    const letterNorm = normalize(cleanLetter);
    const startsWithLetter = !letterNorm || answerNorm.startsWith(letterNorm);
    const category = categoryKey(cleanCategory);

    const prompt =
      'Sen İsim Şehir oyununun tarafsız yardımcı hakemisin. Türkçe cevap ver. ' +
      'Yalnızca verilen Cevap ve Kategori için değerlendirme yap; başka örnek cevapları veya başka kategorileri gerekçene taşıma. ' +
      'Önce başlangıç harfini kontrol et. Cevap verilen harfle başlıyorsa harf nedeniyle reddetme; başlamıyorsa bunu belirt. ' +
      'Sonra cevabın gerçekten istenen kategoriye ait olup olmadığını değerlendir. Belirsizlik varsa Tartışmalı seç. ' +
      'Bilgi tarafsız ve kısa olmalı; gerekçe yalnızca bu cevabın bu kategoriye uygunluğunu açıklamalı. ' +
      'Bilgi ve gerekçe çelişirse kesin hüküm verme, Tartışmalı seç. ' +
      'Şehir kategorisinde mahalle, köy, ilçe, belde veya küçük alt yerleşimleri şehir olarak kabul etme. ' +
      'Ülke kategorisinde şehir/il/ilçe gibi yerleri ülke kabul etme. ' +
      'Hayvan veya Bitki kategorisinde ürününü değil varlığın kendisini değerlendir; yerleşik çift anlam varsa Tartışmalı seç. ' +
      '3 harfli kelime kategorisinde tam 3 harf, 8 harfli kelime kategorisinde tam 8 harf şartını kontrol et. ' +
      'Küçük ve açık yazım hatalarında ne kastedildiği netse sırf yazım hatası nedeniyle kesin red verme. Emin olmadığın bilgiyi uydurma. ' +
      'Yanıtı yalnızca JSON olarak döndür. ' +
      'uygunluk yalnızca "Uygun görünüyor", "Uygun görünmüyor", "Tartışmalı"; guven yalnızca "Yüksek", "Orta", "Düşük" olabilir. ' +
      'gerekce en fazla 20 kelime, bilgi en fazla 35 kelime olsun. ' +
      'Hesaplanmış harf kontrolü: ' + (startsWithLetter ? 'UYUMLU' : 'UYUMSUZ') + '. ' +
      'Kategori: ' + cleanCategory + '. Başlangıç harfi: ' + (cleanLetter || 'Belirtilmedi') + '. Cevap: ' + cleanAnswer;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 220,
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
    };

    let response = null;
    let data = {};

    for (const model of MODEL_CANDIDATES) {
      response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' +
          model +
          ':generateContent?key=' +
          encodeURIComponent(env.GEMINI_API_KEY),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      data = await response.json().catch(() => ({}));
      if (response.ok) break;
    }

    if (!response?.ok) {
      return json({
        error: 'AI_REQUEST_FAILED',
        upstreamStatus: response?.status || 502,
        upstreamMessage: data?.error?.message || null,
        modelsTried: MODEL_CANDIDATES
      }, 502);
    }

    const raw = String(
      data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || ''
    ).trim();

    if (!raw) return json({ error: 'AI_EMPTY_RESPONSE' }, 502);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: 'AI_INVALID_RESPONSE' }, 502);
    }

    const evidence = [String(parsed.gerekce || ''), String(parsed.bilgi || '')].join(' ');
    const count = letterCount(cleanAnswer);

    // Oyun kurallarının kesin olduğu noktalar modelden bağımsızdır.
    if (letterNorm && answerNorm && !startsWithLetter) {
      forceNotFit(parsed, 'Cevap seçilen harfle başlamıyor; bu nedenle harf kuralına uygun değildir.');
    }

    if (category === '3 harfli kelime' && count !== 3) {
      forceNotFit(parsed, 'Cevap tam 3 harfli değil; bu kategori yalnızca 3 harfli kelimeleri kabul eder.');
    }

    if (category === '8 harfli kelime' && count !== 8) {
      forceNotFit(parsed, 'Cevap tam 8 harfli değil; bu kategori yalnızca 8 harfli kelimeleri kabul eder.');
    }

    // Model doğru başlayan cevabı yalnızca harf gerekçesiyle reddederse bunu düzelt.
    if (
      startsWithLetter &&
      parsed.uygunluk === 'Uygun görünmüyor' &&
      /başlamıyor|başlamamaktadır|seçilen harf|ilk harf|harf.*uyuşm/i.test(evidence)
    ) {
      parsed.uygunluk = 'Tartışmalı';
      parsed.guven = 'Orta';
      parsed.gerekce = 'Cevap seçilen harfle başlıyor; harf kuralı açısından uygundur.';
    }

    // Model bilgi/gerekçe arasında açık çelişki ürettiyse kesin hükmü yumuşat.
    const contradiction =
      /bir (isim|şehir|il|hayvan|bitki|ülke) (değil|değildir)/i.test(evidence) &&
      /bir (isim|şehir|il|hayvan|bitki|ülke) (dir|dır|türüdür|adıdır)/i.test(evidence);

    if (contradiction) {
      parsed.uygunluk = 'Tartışmalı';
      parsed.guven = 'Düşük';
      parsed.gerekce = 'Bilgi ve gerekçe birbiriyle çelişiyor; kesin karar vermek yerine tartışmalı bırakıldı.';
    }

    const allowedFit = new Set(['Uygun görünüyor', 'Uygun görünmüyor', 'Tartışmalı']);
    const allowedConfidence = new Set(['Yüksek', 'Orta', 'Düşük']);

    const uygunluk = allowedFit.has(String(parsed.uygunluk))
      ? String(parsed.uygunluk)
      : 'Tartışmalı';
    const guven = allowedConfidence.has(String(parsed.guven))
      ? String(parsed.guven)
      : 'Düşük';
    const gerekce = String(parsed.gerekce || '').trim().slice(0, 180);
    const bilgi = String(parsed.bilgi || '').trim().slice(0, 260);

    if (!bilgi) return json({ error: 'AI_EMPTY_RESPONSE' }, 502);

    return json({
      text: bilgi,
      analysis: { uygunluk, guven, gerekce }
    });
  } catch (error) {
    console.error('Cloudflare AI info error', error);
    return json({ error: 'AI_SERVER_ERROR' }, 500);
  }
}
