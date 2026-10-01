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

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
    }

    const normalizedPromptAnswer = cleanAnswer.toLocaleUpperCase('tr-TR').replace(/\\s+/g, '');
    const normalizedPromptLetter = cleanLetter.toLocaleUpperCase('tr-TR').replace(/\\s+/g, '');
    const promptLetterMatches = !normalizedPromptLetter || normalizedPromptAnswer.startsWith(normalizedPromptLetter);

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

    let response;
    let data = {};

    // Bir model/endpoint geçici olarak hata verirse diğer desteklenen modeli dene.
    // Böylece tek bir Gemini modelindeki kota, bölge veya geçici servis sorunu AI panelini tamamen bozmaz.
    // 2.5 Flash-Lite yeni kullanıcılar için erişim kısıtlamasına
    // takılabildiği için fallback listesinden çıkarıldı.
    // Güncel ana model 3.5 Flash-Lite, yedek model 3.1 Flash-Lite.
    const modelCandidates = [
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite'
    ];
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

        console.error('Gemini API error', {
          model,
          status: response.status,
          message: data?.error?.message || null
        });

        // 4xx genellikle model/parametre/API erişim problemidir; aynı modeli tekrar tekrar dövmek yerine
        // diğer adaya geç. 5xx ise kısa retry yap.
        if (response.status < 500) break;
        if (attempt === retryDelays.length - 1) break;
      }

      if (response && response.ok) break;
    }

    if (!response || !response.ok) {
      console.error('Gemini API all models failed', data);
      return res.status(502).json({
        error: 'AI_REQUEST_FAILED',
        upstreamStatus: response?.status || 502,
        upstreamMessage: data?.error?.message || null,
        modelsTried: modelCandidates
      });
    }

    const raw = String(
      (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts
        ? data.candidates[0].content.parts.map(p => p.text || '').join('')
        : '') || ''
    ).trim();

    if (!raw) {
      return res.status(502).json({ error: 'AI_EMPTY_RESPONSE' });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const cleaned = raw.replace(/^\\s*\`\`\`(?:json)?\\s*/i, '').replace(/\\s*\`\`\`\\s*$/i, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch (e2) {
        console.error('Gemini returned invalid JSON', raw);
        return res.status(502).json({ error: 'AI_INVALID_RESPONSE' });
      }
    }

    // Model yanıtını, özellikle yerleşim türü karışıklıklarına karşı küçük bir deterministik güvenlik katmanından geçir.
    // Böylece "Şehir" kategorisinde mahalle/ilçe/köy gibi alt yerleşimler yanlışlıkla kabul edilmez.
    const categoryKey = cleanCategory.toLocaleLowerCase('tr-TR');
    const normalizedSemanticAnswer = cleanAnswer.toLocaleLowerCase('tr-TR').replace(/[’']/g, '');
    const normalizedForComparison = normalizedSemanticAnswer
      .replace(/ı/g, 'i').replace(/İ/g, 'i')
      .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c')
      .replace(/ö/g, 'o').replace(/ü/g, 'u')
      .replace(/[^a-z0-9]/g, '');
    const compactSpelling = (value) => String(value || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/[’']/g, '')
      .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
      .replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
      .replace(/[^a-z0-9]/g, '');
    const oneEditAway = (a, b) => {
      if (!a || !b || Math.abs(a.length - b.length) > 1) return false;
      if (a.length === b.length) {
        let diff = 0;
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++diff > 1) return false;
        return diff === 1;
      }
      const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
      let i = 0, j = 0, diff = 0;
      while (i < shorter.length && j < longer.length) {
        if (shorter[i] === longer[j]) { i++; j++; }
        else { j++; if (++diff > 1) return false; }
      }
      return true;
    };
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

    // Harf kontrolü deterministiktir. Model, doğru başlayan bir cevabı yanlışlıkla
    // "harfle başlamıyor" diye reddederse bu hatayı modelin semantik kararından ayır.
    const letterMismatchClaim = /(?:başlamıyor|başlamıyor|başlamamaktadır|başlamamış|harfiyle başlam|seçilen harf|ilk harf|harf(?:i)? uyuşm)/i;
    const evidenceBeforeLetterRepair = [String(parsed.gerekce || ''), String(parsed.bilgi || '')].join(' ');
    if (
      normalizedLetter &&
      normalizedAnswer &&
      normalizedAnswer.startsWith(normalizedLetter) &&
      parsed.uygunluk === 'Uygun görünmüyor' &&
      letterMismatchClaim.test(evidenceBeforeLetterRepair)
    ) {
      // Red yalnızca harf gerekçesine dayanıyorsa, harf kuralını kesin olarak düzelt.
      const semanticReject = /(?:değil|değildir|uygun değil|kategoriye girmez|şehir değildir|ülke değildir|hayvan değildir|bitki değildir|ürünüdür|ürünü|mahalle|ilçe|köy|belde|semt)/i;
      if (!semanticReject.test(evidenceBeforeLetterRepair.replace(letterMismatchClaim, ''))) {
        if (categoryKey === '3 harfli kelime' && Array.from(cleanAnswer.replace(/\\s+/g, '')).length === 3) {
          parsed.uygunluk = 'Uygun görünüyor';
          parsed.guven = 'Yüksek';
          parsed.gerekce = 'Cevap seçilen harfle başlıyor ve tam 3 harfli.';
        } else if (categoryKey === '8 harfli kelime' && Array.from(cleanAnswer.replace(/\\s+/g, '')).length === 8) {
          parsed.uygunluk = 'Uygun görünüyor';
          parsed.guven = 'Yüksek';
          parsed.gerekce = 'Cevap seçilen harfle başlıyor ve tam 8 harfli.';
        } else {
          parsed.uygunluk = 'Tartışmalı';
          parsed.guven = 'Orta';
          parsed.gerekce = 'Cevap seçilen harfle başlıyor; harf kuralı açısından uygundur, kategori değerlendirmesi ayrıca ele alınmalıdır.';
        }
      }
    }
    const answerKey = cleanAnswer.toLocaleLowerCase('tr-TR');
    // Bazı Türkçe kategori cevapları iki farklı varlık türüne doğal olarak işaret eder.
    // Özellikle meyve adı aynı zamanda ağacın/bitkinin adıysa oyuncuların tartışabilmesi için kesin kabul verme.
    if (categoryKey === 'bitki' && /^(erik|elma|armut|kiraz|şeftali|kayısı|portakal|limon|mandalina|nar|zeytin|incir|üzüm|dut|vişne|ayva)$/.test(answerKey)) {
      parsed.uygunluk = 'Tartışmalı';
      parsed.guven = 'Orta';
      parsed.gerekce = 'Cevap hem bitkinin/ağacın adını hem de meyvesini ifade edebilir; hangi anlamın kastedildiği tartışılabilir.';
    }
    const normalizedAnswer = cleanAnswer.replace(/\s+/g, '').toLocaleUpperCase('tr-TR');
    const normalizedLetter = cleanLetter.replace(/\s+/g, '').toLocaleUpperCase('tr-TR');
    // Başlangıç harfi oyun kuralıdır; model yanlışlıkla harf uyuşmazlığını gözden kaçırırsa
    // bunu deterministik olarak düzelt.
    if (normalizedLetter && normalizedAnswer && !normalizedAnswer.startsWith(normalizedLetter)) {
      parsed.uygunluk = 'Uygun görünmüyor';
      parsed.guven = 'Yüksek';
      parsed.gerekce = 'Cevap seçilen harfle başlamıyor; bu nedenle kategori kuralına uygun değildir.';
    }
    // Modelin semantik kararını, çok bariz ve sık görülen kategori karışıklıklarına karşı
    // küçük bir deterministik katmanla destekle.
    if (categoryKey === 'hayvan' && /^(süt|yün|deri|yumurta|bal|peynir|tereyağı)$/.test(normalizedSemanticAnswer)) {
      forceNotFit('Cevap bir hayvanın kendisi değil, hayvansal bir ürün veya hayvandan elde edilen bir üründür.');
    }
    if (categoryKey === 'bitki' && /^(un|yağ|salça|şeker|çay|kahve|reçel)$/.test(normalizedSemanticAnswer)) {
      forceNotFit('Cevap bitkinin kendisi değil, bitkisel bir ürün veya işlenmiş bir üründür.');
    }
    if (categoryKey === 'ülke' && /^(trabzon|ankara|istanbul|izmir|bursa|antalya|rize|ordu|samsun)$/.test(normalizedSemanticAnswer)) {
      forceNotFit('Cevap bir ülke değil, şehir adıdır.');
    }
    const spellingEvidence = [String(parsed.gerekce || ''), String(parsed.bilgi || '')].join(' ').toLocaleLowerCase('tr-TR');
    if (
      parsed.uygunluk === 'Uygun görünmüyor' &&
      /yazım|yazim|harf|yanlış yaz|yanlis yaz|typo/.test(spellingEvidence) &&
      normalizedForComparison.length >= 3
    ) {
      // Modelin sırf küçük yazım farkı yüzünden verdiği red kararını ikinci kez değerlendir.
      // Kategoriye ait kelimeyi model gerekçesinde açıkça isimlendirdiyse ve fark tek karakter civarındaysa,
      // kesin red yerine tartışmalı bırakmak daha güvenlidir.
      const quoted = spellingEvidence.match(/[“"']([a-zçğıöşüı]+)[”"']/i);
      if (quoted && oneEditAway(normalizedForComparison, compactSpelling(quoted[1]))) {
        forceMaybe('Cevap küçük bir yazım farkı içeriyor; kastedilen kelime açıkça anlaşılabiliyor.');
      }
    }
    // Açık kategori çelişkilerini güvenli biçimde yakala; yalnızca modelin kendi açıklamasında net bir karşıtlık varsa uygula.
    const categoryConflictRules = {
      'ülke': [
        { test: /(?:şehir|il|ilçe|mahalle|semt|köy|bölge)\\b.*(?:değil|değildir|ülke değil)/i, reason: 'Gerekçede cevabın ülke değil, farklı bir yerleşim veya coğrafi birim olduğu belirtiliyor.' }
      ],
      'hayvan': [
        { test: /(?:ürün|parça|yiyecek|et|süt|yün|deri|yumurta|bal)\\b.*(?:hayvan değil|hayvanın kendisi değil|hayvan değildir)/i, reason: 'Gerekçede cevabın hayvanın kendisi olmadığı belirtiliyor.' }
      ],
      'yemek malzemesi': [
        { test: /(?:hazır yemek|yemek|hayvan|bitki)\\b.*(?:malzeme değil|malzeme değildir|tek başına malzeme sayılmaz)/i, reason: 'Gerekçede cevabın yemek malzemesi olmadığı belirtiliyor.' }
      ]
    };

    const evidence = [String(parsed.gerekce || ''), String(parsed.bilgi || '')].join(' ').toLocaleLowerCase('tr-TR');
    if (parsed.uygunluk === 'Uygun görünüyor') {
      const rules = categoryConflictRules[categoryKey] || [];
      const conflict = rules.find(rule => rule.test.test(evidence));
      if (conflict) forceNotFit(conflict.reason);
    }
    const normalizedAnswerForLength = cleanAnswer.replace(/\s+/g, '');
    const letterCount = Array.from(normalizedAnswerForLength).length;
    const lengthEvidence = [String(parsed.gerekce || ''), String(parsed.bilgi || '')].join(' ').toLocaleLowerCase('tr-TR');
    if (categoryKey === '3 harfli kelime') {
      if (letterCount !== 3) {
        parsed.uygunluk = 'Uygun görünmüyor';
        parsed.guven = 'Yüksek';
        parsed.gerekce = 'Cevap tam 3 harfli değil; bu kategori yalnızca 3 harfli kelimeleri kabul eder.';
      } else if (
        parsed.uygunluk === 'Uygun görünmüyor' &&
        /\b(\d+|üç|dört|beş|altı|yedi|sekiz|dokuz|on)\s*harf/.test(lengthEvidence)
      ) {
        // Model bazen 3 harfli cevapları yanlış sayabiliyor. Harf sayısını burada deterministik olarak esas al.
        parsed.uygunluk = 'Uygun görünüyor';
        parsed.guven = 'Yüksek';
        parsed.gerekce = 'Cevap tam 3 harflidir ve 3 harfli kelime kategorisine uyar.';
      }
    }
    if (categoryKey === '8 harfli kelime') {
      if (letterCount !== 8) {
        parsed.uygunluk = 'Uygun görünmüyor';
        parsed.guven = 'Yüksek';
        parsed.gerekce = 'Cevap tam 8 harfli değil; bu kategori yalnızca 8 harfli kelimeleri kabul eder.';
      } else if (
        parsed.uygunluk === 'Uygun görünmüyor' &&
        /\b(\d+|yedi|sekiz|dokuz|on)\s*harf/.test(lengthEvidence)
      ) {
        parsed.uygunluk = 'Uygun görünüyor';
        parsed.guven = 'Yüksek';
        parsed.gerekce = 'Cevap tam 8 harflidir ve 8 harfli kelime kategorisine uyar.';
      }
    }
    // Genel tutarlılık artık model promptu + JSON şeması ile sağlanıyor.
    // Burada kategori bağımsız anahtar kelime taraması yapılmaz; aksi halde başka kategoriden
    // kalmış bir ifade (ör. "bitkisel ürün") doğru cevabı yanlışlıkla reddedebilir.

    if (categoryKey === 'şehir' && /(?:mahalle\\w*|semt\\w*|köy\\w*|ilçe\\w*|belde\\w*|kasaba\\w*|mezra\\w*)/i.test(evidence)) {
      parsed.uygunluk = 'Uygun görünmüyor';
      parsed.guven = parsed.guven === 'Düşük' ? 'Düşük' : 'Orta';
      parsed.gerekce = 'Cevap bir mahalle, ilçe veya başka bir alt yerleşim birimidir; Şehir kategorisine uygun değildir.';
    }

    // Belirsizlik sinyalleri varken modeli gereksiz kesin red/kabulden koru.
    // Net bir yanlışlık yoksa "Tartışmalı" oyuncuların nihai kararı vermesine alan bırakır.
    const ambiguitySignals = /(?:olabilir|olması mümkün|bağlama göre|kullanılabilir|bazı kaynaklarda|bazı kullanımlarda|iki anlam|çift anlam|belirsiz|kesin değil|tartışmalı|değişebilir)/i;
    const hardRejectSignals = /(?:değildir|değil|uymaz|uygun değil|kabul edilmez|kategoriye girmez|bir .* değil)/i;
    const hardAcceptSignals = /(?:tam olarak|doğrudan|kesinlikle|açıkça|kendisi olan|gerçek bir)/i;
    if (parsed.uygunluk === 'Uygun görünmüyor' && ambiguitySignals.test(evidence) && !hardRejectSignals.test(evidence)) {
      forceMaybe('Cevap için birden fazla makul yorum bulunuyor; kesin red yerine tartışmalı değerlendirme daha uygundur.');
    }
    if (parsed.uygunluk === 'Uygun görünüyor' && ambiguitySignals.test(evidence) && !hardAcceptSignals.test(evidence)) {
      forceMaybe('Cevabın kategoriyle ilişkisi bağlama göre değişebiliyor; kesin kabul yerine tartışmalı değerlendirme daha uygundur.');
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
