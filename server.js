const express = require('express');
const cors    = require('cors');
 
const app  = express();
const PORT = process.env.PORT || 3000;
 
const API_KEY       = process.env.API_KEY || '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';
const CHAT_URL      = 'https://api.groq.com/openai/v1/chat/completions';
const CHAT_MODEL    = 'llama-3.1-8b-instant';
const VISION_MODEL  = 'meta-llama/llama-4-scout-17b-16e-instruct'; // image analysis
 
const SYSTEM_PROMPT = 'You are NexusAI, a helpful and friendly AI assistant. Give clear, concise, and accurate answers. Format code in markdown code blocks when needed.';
 
app.use(cors({ origin:'*', methods:['GET','POST','OPTIONS'], allowedHeaders:['Content-Type','Authorization'] }));
app.options('*', cors());
app.use(express.json({ limit: '20mb' })); // image ke liye zyada limit
 
const sessions = {};
 
app.get('/', (req, res) => {
  res.json({ status:'✅ NexusAI Backend Running', model: CHAT_MODEL });
});
 
// ── POST /chat — Text chat with memory ──
app.post('/chat', async (req, res) => {
  res.header('Access-Control-Allow-Origin','*');
  const { message, sessionId } = req.body;
  if (!message?.trim()) return res.status(400).json({ error:'Message required.', status:'error' });
 
  const sid = sessionId || 'default';
  if (!sessions[sid]) sessions[sid] = [];
  sessions[sid].push({ role:'user', content: message.trim() });
  if (sessions[sid].length > 20) sessions[sid] = sessions[sid].slice(-20);
 
  try {
    const reply = await callChat(sessions[sid]);
    sessions[sid].push({ role:'assistant', content: reply });
    return res.status(200).json({ reply, status:'success' });
  } catch(err) {
    sessions[sid].pop();
    return res.status(500).json({ error: err.message, status:'error' });
  }
});
 
// ── POST /analyze — Image analysis ──
app.post('/analyze', async (req, res) => {
  res.header('Access-Control-Allow-Origin','*');
  const { image, prompt, mimeType } = req.body;
  if (!image) return res.status(400).json({ error:'Image required.', status:'error' });
 
  try {
    const reply = await callVision(image, prompt || 'Describe this image in detail.', mimeType || 'image/jpeg');
    return res.status(200).json({ reply, status:'success' });
  } catch(err) {
    return res.status(500).json({ error: err.message, status:'error' });
  }
});
 
// ── POST /clear — Memory clear ──
app.post('/clear', (req, res) => {
  res.header('Access-Control-Allow-Origin','*');
  const sid = req.body?.sessionId || 'default';
  sessions[sid] = [];
  res.json({ status:'success' });
});
 
// ── Chat API ──
async function callChat(history) {
  const response = await fetch(CHAT_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${API_KEY}` },
    body: JSON.stringify({ model: CHAT_MODEL, messages:[{ role:'system', content: SYSTEM_PROMPT }, ...history], max_tokens:1024, temperature:0.7 })
  });
  const data = await response.json();
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (data?.error?.message) throw new Error(data.error.message);
  throw new Error('No response from AI.');
}
 
// ── Vision API ──
async function callVision(base64Image, prompt, mimeType) {
  const response = await fetch(CHAT_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages:[{
        role:'user',
        content:[
          { type:'image_url', image_url:{ url:`data:${mimeType};base64,${base64Image}` } },
          { type:'text', text: prompt }
        ]
      }],
      max_tokens: 1024
    })
  });
  const data = await response.json();
  console.log('Vision response:', JSON.stringify(data).substring(0,200));
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (data?.error?.message) throw new Error(data.error.message);
  throw new Error('No response from vision AI.');
}
 
// ── Keep Alive ──
setInterval(async () => {
  try { await fetch('https://nexus-ai-agent-production.up.railway.app/'); console.log('✅ Ping'); } catch(e) {}
}, 14 * 60 * 1000);
 
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ NexusAI running on port ${PORT}`);
});
