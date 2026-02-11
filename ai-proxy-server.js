/**
 * Web大学 AI 代理服务
 *
 * 用法:
 * 1) 复制 .env.example 为 .env 并填写 OPENAI_API_KEY
 * 2) 在当前目录运行: node ai-proxy-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

loadEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const server = http.createServer(async (req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'GET' && req.url === '/health') {
        sendJson(res, 200, {
            ok: true,
            service: 'webuni-ai-proxy',
            model: OPENAI_MODEL,
            hasServerKey: Boolean(OPENAI_API_KEY)
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/api/chat') {
        try {
            const body = await readBody(req);
            const payload = JSON.parse(body || '{}');

            const incomingAuth = extractBearer(req.headers.authorization || '');
            const apiKey = OPENAI_API_KEY || incomingAuth;
            if (!apiKey) {
                sendJson(res, 400, {
                    error: 'Missing API key',
                    message: 'Set OPENAI_API_KEY in .env or pass Authorization: Bearer sk-...'
                });
                return;
            }

            const messages = Array.isArray(payload.messages) ? payload.messages : [];
            if (!messages.length) {
                sendJson(res, 400, { error: 'messages is required' });
                return;
            }

            const model = payload.model || OPENAI_MODEL;
            const stream = Boolean(payload.stream);

            const openaiResp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.7,
                    stream
                })
            });

            const text = await openaiResp.text();
            if (!openaiResp.ok) {
                sendJson(res, openaiResp.status, {
                    error: 'OpenAI request failed',
                    upstream: safeParseJson(text) || text
                });
                return;
            }

            const data = safeParseJson(text);
            const content = data?.choices?.[0]?.message?.content || '';

            sendJson(res, 200, {
                content,
                model,
                raw: data
            });
        } catch (error) {
            sendJson(res, 500, { error: 'internal_error', message: error.message });
        }
        return;
    }

    sendJson(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
    console.log(`[webuni-ai-proxy] listening on http://localhost:${PORT}`);
    if (!OPENAI_API_KEY) {
        console.log('[webuni-ai-proxy] OPENAI_API_KEY not found in .env, waiting for Authorization header from client.');
    }
});

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function sendJson(res, code, obj) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => {
            data += chunk;
            if (data.length > 1_000_000) {
                reject(new Error('Payload too large'));
                req.destroy();
            }
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

function safeParseJson(text) {
    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}

function extractBearer(authorization) {
    if (!authorization.toLowerCase().startsWith('bearer ')) return '';
    return authorization.slice(7).trim();
}

function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const index = trimmed.indexOf('=');
        if (index === -1) return;
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!(key in process.env)) process.env[key] = value;
    });
}
