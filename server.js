// Unique FiveM - Web Menu Backend
// Vervangt uniquefivem.xyz met jouw eigen server
// Start met: node server.js
// Vereist: npm install express cors uuid

const express = require('express');
const cors    = require('cors');
const { v4: uuidv4 } = require('uuid');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Helper: bouw QR-URL ─────────────────────────────────────────
function menuUrl(sessionId, pairingCode) {
    const base = process.env.BASE_URL || `http://localhost:${PORT}`;
    return `${base}/menu?session=${sessionId}&code=${pairingCode}`;
}

// ── In-memory sessie store ──────────────────────────────────────
const sessions = new Map();

setInterval(() => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [id, sess] of sessions) {
        if (sess.lastSeen < cutoff) sessions.delete(id);
    }
}, 60_000);

// ── Session handler (gedeeld door alle route aliases) ───────────
function handleSession(req, res) {
    const sessionId    = uuidv4();
    const pairingCode  = Math.random().toString(36).substring(2, 10).toUpperCase();
    const clientSecret = uuidv4();
    const state        = req.body.state || {};

    sessions.set(sessionId, {
        state, clientSecret, pairingCode,
        lastSeen: Date.now(), commands: [], paired: false,
    });

    console.log(`[SESSION] ${sessionId} code=${pairingCode}`);

    res.json({
        sessionId, pairingCode, clientSecret,
        url: menuUrl(sessionId, pairingCode),
    });
}

// ── Sync handler ────────────────────────────────────────────────
function handleSync(req, res) {
    const { sessionId, clientSecret, state } = req.body;
    if (!sessionId || !clientSecret) return res.status(400).json({ error: 'missing fields' });

    const sess = sessions.get(sessionId);
    if (!sess) return res.status(404).json({ error: 'session not found' });
    if (sess.clientSecret !== clientSecret) return res.status(403).json({ error: 'forbidden' });

    sess.state    = state || sess.state;
    sess.lastSeen = Date.now();

    const commands = [...sess.commands];
    sess.commands  = [];

    res.json({ paired: sess.paired, commands });
}

// ── Routes: legacy paths ────────────────────────────────────────
app.post('/api/menu/session', handleSession);
app.post('/api/menu/sync',    handleSync);

// ── Routes: obfuscated paths (uit SecureRoutes.hpp) ─────────────
app.post('/r/552590a40afd1dbd77db', handleSession);   // menu_session
app.post('/r/f77a359b638a266c8c4a', handleSync);      // menu_sync

// ──────────────────────────────────────────────────────────────────
// GET /api/menu/state?session=<id>&code=<code>
// Website haalt de huidige cheat state op (leesbaar voor de telefoon)
// ──────────────────────────────────────────────────────────────────
app.get('/api/menu/state', (req, res) => {
    const { session: sessionId, code } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'missing session' });

    const sess = sessions.get(sessionId);
    if (!sess) return res.status(404).json({ error: 'session not found' });
    if (code && sess.pairingCode !== code) return res.status(403).json({ error: 'wrong code' });

    // Markeer als paired zodra de website verbindt
    if (!sess.paired) {
        sess.paired = true;
        console.log(`[PAIRED] Sessie ${sessionId} gekoppeld via web menu`);
    }

    res.json({ ok: true, state: sess.state });
});

// ──────────────────────────────────────────────────────────────────
// POST /api/menu/set?session=<id>&code=<code>
// Website stuurt een commando om een optie te veranderen
// Body: { key: string, value: number }
// ──────────────────────────────────────────────────────────────────
app.post('/api/menu/set', (req, res) => {
    const { session: sessionId, code } = req.query;
    const { key, value } = req.body;

    if (!sessionId || key === undefined || value === undefined)
        return res.status(400).json({ error: 'missing fields' });

    const sess = sessions.get(sessionId);
    if (!sess) return res.status(404).json({ error: 'session not found' });
    if (code && sess.pairingCode !== code) return res.status(403).json({ error: 'wrong code' });

    sess.commands.push({ key, value: Number(value) });
    console.log(`[SET] ${key} = ${value}  (sessie ${sessionId})`);

    res.json({ ok: true });
});

// ──────────────────────────────────────────────────────────────────
// POST /api/menu/batch?session=<id>&code=<code>
// Website stuurt meerdere commando's tegelijk
// Body: [{ key, value }, ...]
// ──────────────────────────────────────────────────────────────────
app.post('/api/menu/batch', (req, res) => {
    const { session: sessionId, code } = req.query;
    const cmds = req.body;

    if (!sessionId || !Array.isArray(cmds))
        return res.status(400).json({ error: 'missing fields' });

    const sess = sessions.get(sessionId);
    if (!sess) return res.status(404).json({ error: 'session not found' });
    if (code && sess.pairingCode !== code) return res.status(403).json({ error: 'wrong code' });

    for (const { key, value } of cmds) {
        if (key !== undefined && value !== undefined)
            sess.commands.push({ key, value: Number(value) });
    }

    res.json({ ok: true, queued: cmds.length });
});

// ── Serve de web menu pagina ────────────────────────────────────
// GET /menu  ->  public/menu.html
app.get('/menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

// Obfuscated page route (uit SecureRoutes.hpp page_menu)
app.get('/p/11d7480347142c22', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

// ── Fallback voor onbekende routes ─────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'not found' });
});

app.listen(PORT, () => {
    console.log(`\n✅ Unique Web Menu Server draait op http://localhost:${PORT}`);
    console.log(`   Web menu pagina: http://localhost:${PORT}/menu`);
    console.log(`   Stel BASE_URL in voor publieke URL (bijv. https://jouwnaam.nl)\n`);
});
