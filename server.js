const express = require('express');
const cors    = require('cors');
 
const app  = express();
const PORT = process.env.PORT || 3000;
 
const API_KEY = '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';   // ← apni key daalo
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'tencent/hy3-preview:free';
 
const SYSTEM_PROMPT = 'You are NexusAI, a helpful and friendly AI assistant. Give clear, concise, and accurate answers. Format code in markdown code blocks when needed.';
 
// 🧠 MEMORY
const sessions = {};
 
app.use(cors());
app.use(express.json());
 
app.get('/', (req, res) => {
  res.json({ status: '✅ NexusAI Backend Running', model: MODEL });
});
 
app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
 
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message required.', status: 'error' });
  }
 
  const sid = sessionId || 'default';
  if (!sessions[sid]) sessions[sid] = [];
 
  sessions[sid].push({ role: 'user', content: message.trim() });
  if (sessions[sid].length > 20) sessions[sid] = sessions[sid].slice(-20);
 
  try {
    const reply = await callAI(sessions[sid]);
    sessions[sid].push({ role: 'assistant', content: reply });
    return res.status(200).json({ reply, status: 'success', sessionId: sid });
  } catch (err) {
    sessions[sid].pop();
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message, status: 'error' });
  }
});
 
app.post('/clear', (req, res) => {
  const sid = req.body.sessionId || 'default';
  sessions[sid] = [];
  res.json({ status: 'success' });
});
 
async function callAI(history) {
  const response = await fetch(API_URL, {
    method : 'POST',
     
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'HTTP-Referer' : 'http://localhost:3000',
      'X-Title'      : 'NexusAI'
    },
    body: JSON.stringify({
      model   : MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history
      ],
      max_tokens: 1024
    })
  });
 
  const data = await response.json();
  console.log('Response:', JSON.stringify(data).substring(0, 200));
 
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (data?.error?.message) throw new Error(data.error.message);
  throw new Error('No response from AI.');
}
 
app.listen(PORT, () => {
  console.log(`✅ NexusAI running on http://localhost:${PORT}`);
  console.log(`🧠 Memory: ON`);
});
