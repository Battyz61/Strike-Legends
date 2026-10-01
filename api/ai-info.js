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
      'Benzer şekilde "Ülke" kategorisinde şehir, il, ilçe, mahalle veya bölge; "Hayvan" kategorisinde hayvan ürünü; "Bitki" kategorisinde yalnızca meyve/ürün adı gibi ilişkili ama farklı varlıklar doğrudan kabul edilmemeli. ' +
      'Kategori ile cevap arasındaki ilişki net değilse "Yüksek" güven verme. ' +
      'Açık ve bariz yazım hatalarını da değerlendir: Cevap, kategoriye uygun bilinen bir kelimenin küçük bir yazım hatalı biçimiyse ve ne kastedildiği tartışmasızsa cevabı sırf yazım hatası yüzünden reddetme. Örneğin "Eşşek" açıkça "eşek" kelimesinin fazladan ş harfi içeren yazımıdır; "Hayvan" kategorisinde uygun kabul edilmelidir. Yazım hatası anlamı belirsizleştiriyorsa "Tartışmalı" kullan. ' +
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
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    };

    let response;
    let data = {};
    const retryDelays = [0, 1000, 2500];

    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      if (retryDelays[attempt]) {
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }

      response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' +
        encodeURIComponent(process.env.GEMINI_API_KEY),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      data = await response.json().catch(() => ({}));

      if (response.ok) break;

      if (response.status < 500 || attempt === retryDelays.length - 1) break;
    }

    if (!response.ok) {
      console.error('Gemini API error', data);
      return res.status(502).json({
        error: 'AI_REQUEST_FAILED',
        upstreamStatus: response.status,
        upstreamMessage: data?.error?.message || null
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
    const evidence = [String(parsed.gerekce || ''), String(parsed.bilgi || '')].join(' ').toLocaleLowerCase('tr-TR');
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
        /\\b(\\d+|üç|dört|beş|altı|yedi|sekiz|dokuz|on)\\s*harf/.test(lengthEvidence)
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
        /\\b(\\d+|yedi|sekiz|dokuz|on)\\s*harf/.test(lengthEvidence)
      ) {
        parsed.uygunluk = 'Uygun görünüyor';
        parsed.guven = 'Yüksek';
        parsed.gerekce = 'Cevap tam 8 harflidir ve 8 harfli kelime kategorisine uyar.';
      }
    }
    if (categoryKey === 'şehir' && /(?:mahalle\\w*|semt\\w*|köy\\w*|ilçe\\w*|belde\\w*|kasaba\\w*|mezra\\w*)/i.test(evidence)) {
      parsed.uygunluk = 'Uygun görünmüyor';
      parsed.guven = parsed.guven === 'Düşük' ? 'Düşük' : 'Orta';
      parsed.gerekce = 'Cevap bir mahalle, ilçe veya başka bir alt yerleşim birimidir; Şehir kategorisine uygun değildir.';
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
