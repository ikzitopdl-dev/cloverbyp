// Clover – Web Menu Backend
// Start: node server.js  |  Required: npm install express cors uuid

const express = require('express');
const cors    = require('cors');
const { v4: uuidv4 } = require('uuid');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Helper ────────────────────────────────────────────────────────────
function menuUrl(sessionId, pairingCode) {
  const base = process.env.BASE_URL || `http://localhost:${PORT}`;
  return `${base}/menu?session=${sessionId}&code=${pairingCode}`;
}

// ── In-memory session store ───────────────────────────────────────────
// Session shape:
// { state, clientSecret, pairingCode, lastSeen, commands, paired, codeUsed }
const sessions = new Map();

// Clean up sessions idle for more than 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [id, sess] of sessions) {
    if (sess.lastSeen < cutoff) sessions.delete(id);
  }
}, 60_000);

// ── POST /api/menu/session  (cheat creates session) ───────────────────
function handleSession(req, res) {
  const sessionId    = uuidv4();
  const pairingCode  = Math.random().toString(36).substring(2, 10).toUpperCase();
  const clientSecret = uuidv4();
  const state        = req.body.state || {};

  sessions.set(sessionId, {
    state,
    clientSecret,
    pairingCode,
    lastSeen: Date.now(),
    commands: [],
    paired:   false,
    codeUsed: false,   // ← one-time flag
  });

  console.log(`[SESSION] ${sessionId}  code=${pairingCode}`);
  res.json({ sessionId, pairingCode, clientSecret, url: menuUrl(sessionId, pairingCode) });
}

// ── POST /api/menu/sync  (cheat pushes state every ~600ms) ────────────
function handleSync(req, res) {
  const { sessionId, clientSecret, state } = req.body;
  if (!sessionId || !clientSecret) return res.status(400).json({ error: 'missing fields' });

  const sess = sessions.get(sessionId);
  if (!sess)                          return res.status(404).json({ error: 'session not found' });
  if (sess.clientSecret !== clientSecret) return res.status(403).json({ error: 'forbidden' });

  sess.state    = state || sess.state;
  sess.lastSeen = Date.now();

  const commands = [...sess.commands];
  sess.commands  = [];
  res.json({ paired: sess.paired, commands });
}

// ── GET /api/menu/state  (web page reads current state) ───────────────
// Security:
//  - Code must match
//  - Code can only be used to pair ONCE; subsequent reads from the same
//    paired tab are allowed, but a second device trying the same code is blocked.
app.get('/api/menu/state', (req, res) => {
  const { session: sessionId, code } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'missing session' });

  const sess = sessions.get(sessionId);
  if (!sess)  return res.status(404).json({ error: 'session not found' });

  // Code validation
  if (!code || sess.pairingCode !== code.toUpperCase())
    return res.status(403).json({ error: 'Verkeerde code.' });

  // One-time pairing: if code was already used by ANOTHER connection, block it
  if (!sess.paired && sess.codeUsed)
    return res.status(403).json({ error: 'Deze code is al gebruikt.' });

  // First successful pair
  if (!sess.paired) {
    sess.paired   = true;
    sess.codeUsed = true;
    console.log(`[PAIRED] Sessie ${sessionId} gekoppeld`);
  }

  res.json({ ok: true, state: sess.state });
});

// ── POST /api/menu/set  (web page sends a single command) ─────────────
app.post('/api/menu/set', (req, res) => {
  const { session: sessionId, code } = req.query;
  const { key, value } = req.body;
  if (!sessionId || key === undefined || value === undefined)
    return res.status(400).json({ error: 'missing fields' });

  const sess = sessions.get(sessionId);
  if (!sess)  return res.status(404).json({ error: 'session not found' });
  if (!sess.paired || sess.pairingCode !== code?.toUpperCase())
    return res.status(403).json({ error: 'not paired' });

  sess.commands.push({ key, value: Number(value) });
  console.log(`[SET] ${key} = ${value}  (sessie ${sessionId})`);
  res.json({ ok: true });
});

// ── POST /api/menu/batch  (web page sends multiple commands) ──────────
app.post('/api/menu/batch', (req, res) => {
  const { session: sessionId, code } = req.query;
  const cmds = req.body;
  if (!sessionId || !Array.isArray(cmds))
    return res.status(400).json({ error: 'missing fields' });

  const sess = sessions.get(sessionId);
  if (!sess)  return res.status(404).json({ error: 'session not found' });
  if (!sess.paired || sess.pairingCode !== code?.toUpperCase())
    return res.status(403).json({ error: 'not paired' });

  for (const { key, value } of cmds) {
    if (key !== undefined && value !== undefined)
      sess.commands.push({ key, value: Number(value) });
  }
  res.json({ ok: true, queued: cmds.length });
});

// ── Serve web menu page ───────────────────────────────────────────────
app.get('/menu', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

// Obfuscated page route (SecureRoutes.hpp page_menu)
app.get('/p/11d7480347142c22', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

// Legacy + obfuscated API routes
app.post('/api/menu/session',      handleSession);
app.post('/api/menu/sync',         handleSync);
app.post('/r/552590a40afd1dbd77db', handleSession);  // menu_session obfuscated
app.post('/r/f77a359b638a266c8c4a', handleSync);     // menu_sync obfuscated

// ── 404 fallback ──────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'not found' }));

app.listen(PORT, () => {
  console.log(`\n✅ Clover Web Menu Server op http://localhost:${PORT}`);
  console.log(`   Web menu: http://localhost:${PORT}/menu\n`);
});
