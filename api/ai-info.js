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

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        input: [
          {
            role: 'system',
            content: 'Sen İsim Şehir oyununun kısa bilgi asistanısın. Türkçe cevap ver. Kullanıcının verdiği cevabın kategoriyle ilişkisini açıklayan 1-2 cümlelik, en fazla 45 kelimelik bilgi üret. Bilgi vermek için emin olmadığın ayrıntıları uydurma. Cevap açıkça yanlışsa bunu nazikçe belirt ve doğru bilgiyi kısaca ver. Yalnızca bilgi metnini döndür; başlık, emoji, madde işareti veya kaynak ekleme.'
          },
          {
            role: 'user',
            content: 'Kategori: ' + cleanCategory + '\nCevap: ' + cleanAnswer
          }
        ],
        max_output_tokens: 120
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI API error', data);
      return res.status(502).json({
        error: 'AI_REQUEST_FAILED',
        upstreamStatus: response.status
      });
    }

    const text = String(data.output_text || '').trim();
    if (!text) {
      return res.status(502).json({ error: 'AI_EMPTY_RESPONSE' });
    }

    return res.status(200).json({ text });
  } catch (error) {
    console.error('AI info error', error);
    return res.status(500).json({ error: 'AI_SERVER_ERROR' });
  }
}
