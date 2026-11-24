export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, answer, letter } = req.body || {};
    const cleanCategory = String(category || '').trim().slice(0, 80);
    const cleanAnswer = String(answer || '').trim().slice(0, 160);
    const cleanLetter = String(letter || '').trim().slice(0, 3);

    if (!cleanCategory || !cleanAnswer || cleanAnswer === 'Cevap yok') {
      return res.status(400).json({ error: 'category and answer are required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
    }

    const normalizedAnswer = cleanAnswer.normalize('NFC').toLocaleUpperCase('tr-TR').replace(/\s+/g, '');
    const normalizedLetter = cleanLetter.normalize('NFC').toLocaleUpperCase('tr-TR').replace(/\s+/g, '');
    const promptLetterMatches = !normalizedLetter || normalizedAnswer.startsWith(normalizedLetter);

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

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 500,
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

    let response;
    let data = {};
    const modelCandidates = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
    const retryDelays = [0, 1000, 2500];

    for (const model of modelCandidates) {
      for (let attempt = 0; attempt < retryDelays.length; attempt++) {
        if (retryDelays[attempt]) {
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
        }

        response = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' +
          encodeURIComponent(process.env.GEMINI_API_KEY),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          }
        );

        data = await response.json().catch(() => ({}));
        if (response.ok) break;
        if (response.status < 500) break;
      }

      if (response && response.ok) break;
    }

    if (!response || !response.ok) {
      return res.status(502).json({
        error: 'AI_REQUEST_FAILED',
        upstreamStatus: response?.status || 502,
        upstreamMessage: data?.error?.message || null,
        modelsTried: modelCandidates
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

    const categoryKey = cleanCategory.toLocaleLowerCase('tr-TR');
    const normalizedSemanticAnswer = cleanAnswer.toLocaleLowerCase('tr-TR').replace(/[’']/g, '');
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

    const letterMismatchClaim = /(?:başlamıyor|başlamamaktadır|başlamamış|harfiyle başlam|seçilen harf|ilk harf|harf(?:i)? uyuşm)/i;
    const evidenceBeforeLetterRepair = [String(parsed.gerekce || ''), String(parsed.bilgi || '')].join(' ');
    if (
      normalizedLetter &&
      normalizedAnswer &&
      normalizedAnswer.startsWith(normalizedLetter) &&
      parsed.uygunluk === 'Uygun görünmüyor' &&
      letterMismatchClaim.test(evidenceBeforeLetterRepair)
    ) {
      const semanticReject = /(?:değil|değildir|uygun değil|kategoriye girmez|şehir değildir|ülke değildir|hayvan değildir|bitki değildir|ürünüdür|ürünü|mahalle|ilçe|köy|belde|semt)/i;
      if (!semanticReject.test(evidenceBeforeLetterRepair.replace(letterMismatchClaim, ''))) {
        forceMaybe('Cevap seçilen harfle başlıyor; harf kuralı açısından uygundur.');
      }
    }

    if (normalizedLetter && normalizedAnswer && !normalizedAnswer.startsWith(normalizedLetter)) {
      forceNotFit('Cevap seçilen harfle başlamıyor; bu nedenle kategori kuralına uygun değildir.');
    }

    if (categoryKey === 'bitki' && /^(erik|elma|armut|kiraz|şeftali|kayısı|portakal|limon|mandalina|nar|zeytin|incir|üzüm|dut|vişne|ayva)$/.test(normalizedSemanticAnswer)) {
      forceMaybe('Cevap hem bitkinin/ağacın adını hem de meyvesini ifade edebilir; hangi anlamın kastedildiği tartışılabilir.');
    }
    if (categoryKey === 'hayvan' && /^(süt|yün|deri|yumurta|bal|peynir|tereyağı)$/.test(normalizedSemanticAnswer)) {
      forceNotFit('Cevap bir hayvanın kendisi değil, hayvansal bir üründür.');
    }
    if (categoryKey === 'bitki' && /^(un|yağ|salça|şeker|reçel)$/.test(normalizedSemanticAnswer)) {
      forceNotFit('Cevap bitkinin kendisi değil, işlenmiş bitkisel bir üründür.');
    }
    if (categoryKey === 'ülke' && /^(trabzon|ankara|istanbul|izmir|bursa|antalya|rize|ordu|samsun)$/.test(normalizedSemanticAnswer)) {
      forceNotFit('Cevap bir ülke değil, şehir adıdır.');
    }

    const evidence = [String(parsed.gerekce || ''), String(parsed.bilgi || '')].join(' ').toLocaleLowerCase('tr-TR');
    const letterCount = Array.from(cleanAnswer.replace(/\s+/g, '')).length;
    if (/(?:^|\b)3\s*harfli\s+kelime(?:\b|$)/i.test(categoryKey) && letterCount !== 3) {
      forceNotFit('Cevap tam 3 harfli değil; bu kategori yalnızca 3 harfli kelimeleri kabul eder.');
    }
    if (/(?:^|\b)8\s*harfli\s+kelime(?:\b|$)/i.test(categoryKey) && letterCount !== 8) {
      forceNotFit('Cevap tam 8 harfli değil; bu kategori yalnızca 8 harfli kelimeleri kabul eder.');
    }
    if (categoryKey === 'şehir' && /(?:mahalle\w*|semt\w*|köy\w*|ilçe\w*|belde\w*|kasaba\w*|mezra\w*)/i.test(evidence) && /değil|ilçesi|mahallesi|semti|köyü|beldesi/i.test(evidence)) {
      forceNotFit('Cevap bir mahalle, ilçe veya alt yerleşim birimidir; Şehir kategorisine uygun değildir.');
    }

    const allowedFit = new Set(['Uygun görünüyor', 'Uygun görünmüyor', 'Tartışmalı']);
    const allowedConfidence = new Set(['Yüksek', 'Orta', 'Düşük']);
    const uygunluk = allowedFit.has(String(parsed.uygunluk)) ? String(parsed.uygunluk) : 'Tartışmalı';
    const guven = allowedConfidence.has(String(parsed.guven)) ? String(parsed.guven) : 'Düşük';
    const gerekce = String(parsed.gerekce || '').trim().slice(0, 180);
    const bilgi = String(parsed.bilgi || '').trim().slice(0, 260);

    if (!bilgi) {
      return res.status(502).json({ error: 'AI_EMPTY_RESPONSE' });
    }

    return res.status(200).json({ text: bilgi, analysis: { uygunluk, guven, gerekce } });
  } catch (error) {
    console.error('Gemini AI info error', error);
    return res.status(500).json({ error: 'AI_SERVER_ERROR' });
  }
}
