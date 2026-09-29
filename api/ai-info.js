export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, answer } = req.body || {};
    const cleanCategory = String(category || '').trim().slice(0, 80);
    const cleanAnswer = String(answer || '').trim().slice(0, 160);

    if (!cleanCategory || !cleanAnswer) {
      return res.status(400).json({ error: 'category and answer are required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
    }

    const prompt =
      'Sen İsim Şehir oyununun kısa bilgi asistanısın. Türkçe cevap ver. ' +
      'Kullanıcının verdiği cevabın kategoriyle ilişkisini açıklayan 1-2 cümlelik, ' +
      'en fazla 45 kelimelik bilgi üret. Emin olmadığın ayrıntıları uydurma. ' +
      'Cevap açıkça yanlışsa bunu nazikçe belirt ve doğru bilgiyi kısaca ver. ' +
      'Yalnızca bilgi metnini döndür; başlık, emoji, madde işareti veya kaynak ekleme.\n\n' +
      'Kategori: ' + cleanCategory + '\nCevap: ' + cleanAnswer;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 120,
        temperature: 0.3
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

      // Retry transient 5xx/503 responses; quota/rate-limit errors are not retried.
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

    const text = String(
      data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || ''
    ).trim();

    if (!text) {
      return res.status(502).json({ error: 'AI_EMPTY_RESPONSE' });
    }

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Gemini AI info error', error);
    return res.status(500).json({ error: 'AI_SERVER_ERROR' });
  }
}
