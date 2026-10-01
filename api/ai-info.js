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

    const prompt =
      'Sen İsim Şehir oyununun tarafsız AI yardımcı hakemisin. Türkçe cevap ver. ' +
      'Verilen cevabın kategoriye ve varsa başlangıç harfine uygunluğunu analiz et. ' +
      'Son kararı oyuncular verir; sen sadece yardımcı değerlendirme sunarsın. ' +
      'Uygunluk için yalnızca "Uygun görünüyor", "Uygun görünmüyor" veya "Tartışmalı" kullan. ' +
      'Güven için yalnızca "Yüksek", "Orta" veya "Düşük" kullan. ' +
      'Kategorideki kullanım tartışmalıysa veya birden fazla makul yorum varsa "Tartışmalı" seç. ' +
      'Kategori bir varlık türü istiyorsa, cevabın o varlığın kendisi mi yoksa onun ürünü/parçası/özelliği mi olduğunu ayırt et. ' +
      'Özellikle "Şehir" kategorisinde yalnızca gerçek şehir/il veya oyunda şehir olarak kullanılan yerleşim adı kabul edilir. Mahalle, semt, köy, ilçe, belde, kasaba veya bir ilçeye bağlı küçük yerleşim birimi şehir değildir ve "Uygun görünüyor" denmemelidir. ' +
      'Örneğin "Özdil" için bilgi bunun Araklı ilçesine bağlı bir mahalle olduğunu söylüyorsa, "Şehir" kategorisinde sonuç kesin olarak "Uygun görünmüyor" olmalıdır. ' +
      'Aynı şekilde "Araklı" gibi bir ilçe, "Trabzon" gibi bir ilin ilçesi olarak tanımlanıyorsa "Şehir" kategorisinde kabul edilmemelidir. ' +
      'Benzer şekilde "Ülke" kategorisinde şehir, il, ilçe, mahalle veya bölge; "Hayvan" kategorisinde hayvan ürünü, yiyecek veya parça; "Bitki" kategorisinde yalnızca meyve/ürün adı gibi ilişkili ama farklı varlıklar doğrudan kabul edilmemeli. "Hayvan" için hayvanın kendisini, "Bitki" için bitkinin kendisini ara; bir hayvandan elde edilen ürün (ör. süt, yün) veya bitkiden elde edilen ürün (ör. un, yağ) doğrudan hayvan/bitki kabul edilmez. Ancak bir kelime Türkçede hem canlı varlığın hem ürününün adı olarak yerleşik biçimde kullanılıyorsa bağlama göre "Tartışmalı" seç. "Yemek malzemesi" kategorisinde de malzemenin kendisini ara; hazır yemek veya hayvan/bitki adı tek başına malzeme sayılmaz. ' +
      'Kategori ile cevap arasındaki ilişki net değilse "Yüksek" güven verme. ' +
      'Açık ve bariz yazım hatalarını değerlendir: Cevap, kategoriye uygun bilinen bir kelimenin küçük bir yazım hatalı biçimiyse ve ne kastedildiği tartışmasızsa sırf yazım hatası yüzünden reddetme. Türkçe karakterlerin yanlış yazılması (İ/I, Ş/S, Ğ/G, Ç/C, Ö/O, Ü/U) veya tek harfin fazladan/eksik olması, kelimenin anlamını açıkça koruyorsa tolere edilebilir. Örneğin "Eşşek" açıkça "eşek" kelimesinin yazımıdır ve Hayvan kategorisinde uygun kabul edilmelidir. Ancak yazım farkı başka gerçek bir kelime oluşturuyorsa, cevabı anlamı belirsiz hale getiriyorsa veya kategoriye uygunluğu değiştiriyorsa otomatik kabul etme; "Tartışmalı" veya "Uygun görünmüyor" kullan. ' +
      'Bazı cevaplar birden fazla varlık türünü ifade edebilir. Böyle durumlarda tek bir yorumla kesin "Uygun görünüyor" deme. Özellikle "Bitki" kategorisinde cevap yaygın olarak meyve/ürün adı olarak da kullanılıyorsa ve aynı kelime bitkinin kendisini de ifade edebiliyorsa "Tartışmalı" seç. Örneğin "Erik" hem erik ağacını hem meyvesini ifade edebildiği için "Bitki" kategorisinde tartışmalı kabul edilmelidir. "Elma", "armut", "kiraz" gibi benzer çift anlamlı örneklerde de aynı yaklaşımı kullan. Oyuncuların nihai kararı verebilmesi için gerekçede iki makul yorumu kısaca belirt. ' +
      'Başlangıç harfi verilmişse cevabın o harfle başlamasını da kontrol et. ' +
      'Kategori "3 harfli kelime" bir sözlük/kelime kategorisidir; cevap Türkçede anlamlı bir kelime olmalı ve tam 3 harf içermelidir. Harfleri gerçekten tek tek say. "Mal" ve "Mey" Türkçede kullanılan anlamlı 3 harfli kelimelerdir ve bu kategoriye uygundur; bunları uzunluk veya anlam nedeniyle yanlışlıkla reddetme. Yalnızca anlamsız bir harf dizisi veya başka bir kategoriye ait açıkça yanlış bir ifade ise reddet. ' +
      'Kategori "8 harfli kelime" ise cevabın tam 8 harfli olması gerekir; 8 harften kısa veya uzun cevapları uygun kabul etme. ' +
      'Cevap açıkça boşsa uygun olmadığını belirt. Emin olmadığın ayrıntıları uydurma. ' +
      'Ayrıca cevabın kendisi hakkında 1-2 cümlelik, en fazla 35 kelimelik kısa bilgi ver. ' +
      'Bilgi bölümünde cevabı onaylayan veya reddeden ifadeler kullanma. ' +
      'Yanıtı SADECE geçerli JSON olarak döndür ve başka hiçbir şey yazma. ' +
      'JSON: {"uygunluk":"Uygun görünüyor|Uygun görünmüyor|Tartışmalı","guven":"Yüksek|Orta|Düşük","gerekce":"en fazla 20 kelime","bilgi":"en fazla 35 kelime"}\\n\\n' +
      'Kategori: ' + cleanCategory + '\\n' +
      'Başlangıç harfi: ' + (cleanLetter || 'Belirtilmedi') + '\\n' +
      'Cevap: ' + cleanAnswer;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 180,
        responseMimeType: 'application/json'
      }
    };

    let response;
    let data = {};

    // Bir model/endpoint geçici olarak hata verirse diğer desteklenen modeli dene.
    // Böylece tek bir Gemini modelindeki kota, bölge veya geçici servis sorunu AI panelini tamamen bozmaz.
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
    // Açık kategori çelişkilerini güvenli biçimde yakala; yalnızca modelin kendi açıklamasında net bir karşıtlık varsa uygula.\n    const categoryConflictRules = {\n      'ülke': [\n        { test: /(?:şehir|il|ilçe|mahalle|semt|köy|bölge)\\b.*(?:değil|değildir|ülke değil)/i, reason: 'Gerekçede cevabın ülke değil, farklı bir yerleşim veya coğrafi birim olduğu belirtiliyor.' }\n      ],\n      'hayvan': [\n        { test: /(?:ürün|parça|yiyecek|et|süt|yün|deri|yumurta|bal)\\b.*(?:hayvan değil|hayvanın kendisi değil|hayvan değildir)/i, reason: 'Gerekçede cevabın hayvanın kendisi olmadığı belirtiliyor.' }\n      ],\n      'yemek malzemesi': [\n        { test: /(?:hazır yemek|yemek|hayvan|bitki)\\b.*(?:malzeme değil|malzeme değildir|tek başına malzeme sayılmaz)/i, reason: 'Gerekçede cevabın yemek malzemesi olmadığı belirtiliyor.' }\n      ]\n    };\n\n    const evidence = [String(parsed.gerekce || ''), String(parsed.bilgi || '')].join(' ').toLocaleLowerCase('tr-TR');\n    if (parsed.uygunluk === 'Uygun görünüyor') {\n      const rules = categoryConflictRules[categoryKey] || [];\n      const conflict = rules.find(rule => rule.test.test(evidence));\n      if (conflict) forceNotFit(conflict.reason);\n    }
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
    // Modelin kararı ile kendi gerekçesi çelişiyorsa gerekçedeki açık olguyu esas al.\n    // Bu, örneğin "Uygun görünüyor" deyip aynı anda "bir ilçe" veya "hayvan ürünü" demesini engeller.\n    const semanticConflict = [\n      { test: /(?:bir ilçe|ilçesidir|ilçesi|mahalle|semt|köy|belde|kasaba|mezra)/i, reason: 'Gerekçede cevabın şehir değil, alt yerleşim birimi olduğu belirtiliyor.' },\n      { test: /(?:hayvan(?:sal)? ürünü|hayvandan elde edilen|hayvanın ürünü|süt|yün|deri|yumurta|peynir|tereyağı)/i, reason: 'Gerekçede cevabın hayvanın kendisi değil, hayvansal bir ürün olduğu belirtiliyor.' },\n      { test: /(?:bitkisel ürün|işlenmiş ürün|bitkiden elde edilen|bitkinin ürünü|un|salça|reçel)/i, reason: 'Gerekçede cevabın bitkinin kendisi değil, bitkisel/işlenmiş bir ürün olduğu belirtiliyor.' },\n      { test: /(?:şehir değil|şehir değildir|ülke değil|ülke değildir)/i, reason: 'Gerekçede cevabın istenen varlık türü olmadığı açıkça belirtiliyor.' }\n    ];\n    if (parsed.uygunluk === 'Uygun görünüyor') {\n      const conflict = semanticConflict.find(item => item.test.test(evidence));\n      if (conflict) forceNotFit(conflict.reason);\n    }\n\n    if (categoryKey === 'şehir' && /(?:mahalle\\w*|semt\\w*|köy\\w*|ilçe\\w*|belde\\w*|kasaba\\w*|mezra\\w*)/i.test(evidence)) {
      parsed.uygunluk = 'Uygun görünmüyor';
      parsed.guven = parsed.guven === 'Düşük' ? 'Düşük' : 'Orta';
      parsed.gerekce = 'Cevap bir mahalle, ilçe veya başka bir alt yerleşim birimidir; Şehir kategorisine uygun değildir.';
    }

    // Belirsizlik sinyalleri varken modeli gereksiz kesin red/kabulden koru.\n    // Net bir yanlışlık yoksa "Tartışmalı" oyuncuların nihai kararı vermesine alan bırakır.\n    const ambiguitySignals = /(?:olabilir|olması mümkün|bağlama göre|kullanılabilir|bazı kaynaklarda|bazı kullanımlarda|iki anlam|çift anlam|belirsiz|kesin değil|tartışmalı|değişebilir)/i;\n    const hardRejectSignals = /(?:değildir|değil|uymaz|uygun değil|kabul edilmez|kategoriye girmez|bir .* değil)/i;\n    const hardAcceptSignals = /(?:tam olarak|doğrudan|kesinlikle|açıkça|kendisi olan|gerçek bir)/i;\n    if (parsed.uygunluk === 'Uygun görünmüyor' && ambiguitySignals.test(evidence) && !hardRejectSignals.test(evidence)) {\n      forceMaybe('Cevap için birden fazla makul yorum bulunuyor; kesin red yerine tartışmalı değerlendirme daha uygundur.');\n    }\n    if (parsed.uygunluk === 'Uygun görünüyor' && ambiguitySignals.test(evidence) && !hardAcceptSignals.test(evidence)) {\n      forceMaybe('Cevabın kategoriyle ilişkisi bağlama göre değişebiliyor; kesin kabul yerine tartışmalı değerlendirme daha uygundur.');\n    }\n\n    const allowedFit = new Set(['Uygun görünüyor', 'Uygun görünmüyor', 'Tartışmalı']);
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
