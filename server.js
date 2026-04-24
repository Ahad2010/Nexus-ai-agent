 const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ══════════════════════════════════════════
//  🔑 API KEY
// ══════════════════════════════════════════
const API_KEY = process.env.API_KEY || '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';
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL   = ' openai/gpt-oss-safeguard-20b'; // Groq model

const SYSTEM_PROMPT = 'You are NexusAI, a helpful and friendly AI assistant. Give clear, concise, and accurate answers. Format code in markdown code blocks when needed.';

// ══════════════════════════════════════════
//  🔓 CORS — Mobile ke liye zaroori
// ══════════════════════════════════════════
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

app.options('*', cors()); // preflight requests handle karo

app.use(express.json({ limit: '10mb' }));

// 🧠 Memory
const sessions = {};

// ══════════════════════════════════════════
//  GET / — Health check
// ══════════════════════════════════════════
app.get('/', (req, res) => {
  res.json({
    status : '✅ NexusAI Backend Running',
    model  : MODEL,
    time   : new Date().toISOString()
  });
});

// ══════════════════════════════════════════
//  POST /chat — Main endpoint
// ══════════════════════════════════════════
app.post('/chat', async (req, res) => {
  // CORS headers manually bhi set karo
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  const { message, sessionId } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message required.', status: 'error' });
  }

  if (message.length > 4000) {
    return res.status(400).json({ error: 'Message too long.', status: 'error' });
  }

  const sid = sessionId || 'default';
  if (!sessions[sid]) sessions[sid] = [];

  sessions[sid].push({ role: 'user', content: message.trim() });
  if (sessions[sid].length > 20) sessions[sid] = sessions[sid].slice(-20);

  try {
    const reply = await callAI(sessions[sid]);
    sessions[sid].push({ role: 'assistant', content: reply });
    return res.status(200).json({ reply, status: 'success' });
  } catch (err) {
    sessions[sid].pop();
    console.error('AI Error:', err.message);
    return res.status(500).json({ error: err.message, status: 'error' });
  }
});

// ══════════════════════════════════════════
//  POST /clear — Memory clear
// ══════════════════════════════════════════
app.post('/clear', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const sid = req.body?.sessionId || 'default';
  sessions[sid] = [];
  res.json({ status: 'success' });
});

// ══════════════════════════════════════════
//  AI CALL — Groq
// ══════════════════════════════════════════
async function callAI(history) {
  const response = await fetch(API_URL, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model   : MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history
      ],
      max_tokens  : 1024,
      temperature : 0.7
    })
  });

  const data = await response.json();
  console.log('Groq Response:', JSON.stringify(data).substring(0, 150));

  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (data?.error?.message) throw new Error(data.error.message);
  throw new Error('No response from AI.');
}

// ══════════════════════════════════════════
//  🔁 KEEP ALIVE — Server na soye
// ══════════════════════════════════════════
const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://nexus-ai-agent-production.up.railway.app';

setInterval(async () => {
  try {
    await fetch(RAILWAY_URL + '/');
    console.log('✅ Keep alive ping:', new Date().toLocaleTimeString());
  } catch(e) {
    console.log('Ping failed:', e.message);
  }
}, 14 * 60 * 1000); // har 14 minute

// ══════════════════════════════════════════
//  START
// ══════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ NexusAI running on port ${PORT}`);
  console.log(`🌐 CORS: enabled for all origins`);
  console.log(`🧠 Memory: ON`);
  console.log(`🔁 Keep-alive: ON (every 14 min)`);
});
