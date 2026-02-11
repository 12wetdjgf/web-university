/**
 * Web大学 - AI教师模块
 * 支持上下文拼接 + 自定义 API 接入
 */

const TEACHER_SETTINGS_KEY = 'webuni_teacher_settings';
const CHAT_HISTORY_KEY = 'webuni_teacher_chat';

const DEFAULT_SETTINGS = {
    apiEndpoint: 'http://localhost:8787/api/chat',
    apiKey: '',
    model: 'gpt-4o-mini',
    systemPrompt: '你是Web大学的AI教师。请结合学习上下文，给出清晰、可执行的建议。',
    streamResponse: false
};

let settings = { ...DEFAULT_SETTINGS };
let chatHistory = [];
let isLoading = false;
let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    loadSettings();
    loadChatHistory();
    initEventListeners();
    loadContext();
    renderChatHistory();
});

function cacheElements() {
    elements = {
        contextPanel: document.getElementById('contextPanel'),
        contextBtn: document.getElementById('contextBtn'),
        closeContext: document.getElementById('closeContext'),
        recentNotes: document.getElementById('recentNotes'),
        recentFeed: document.getElementById('recentFeed'),
        todayTasks: document.getElementById('todayTasks'),
        includeContext: document.getElementById('includeContext'),
        contextIndicator: document.getElementById('contextIndicator'),
        chatMessages: document.getElementById('chatMessages'),
        userInput: document.getElementById('userInput'),
        sendBtn: document.getElementById('sendBtn'),
        charCount: document.getElementById('charCount'),
        settingsModal: document.getElementById('settingsModal'),
        settingsBtn: document.getElementById('settingsBtn'),
        closeSettings: document.getElementById('closeSettings'),
        saveSettings: document.getElementById('saveSettings'),
        resetSettings: document.getElementById('resetSettings'),
        testConnection: document.getElementById('testConnection'),
        apiEndpoint: document.getElementById('apiEndpoint'),
        modelName: document.getElementById('modelName'),
        apiKey: document.getElementById('apiKey'),
        systemPrompt: document.getElementById('systemPrompt'),
        streamResponse: document.getElementById('streamResponse')
    };
}

function initEventListeners() {
    elements.contextBtn.addEventListener('click', toggleContextPanel);
    elements.closeContext.addEventListener('click', () => elements.contextPanel.classList.add('hidden'));
    elements.includeContext.addEventListener('change', updateContextIndicator);

    elements.userInput.addEventListener('input', handleInputChange);
    elements.userInput.addEventListener('keydown', handleKeyDown);
    elements.sendBtn.addEventListener('click', sendMessage);

    document.querySelectorAll('.quick-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            elements.userInput.value = btn.dataset.prompt;
            handleInputChange();
            sendMessage();
        });
    });

    elements.settingsBtn.addEventListener('click', openSettings);
    elements.closeSettings.addEventListener('click', closeSettings);
    elements.saveSettings.addEventListener('click', saveSettingsHandler);
    elements.resetSettings.addEventListener('click', resetSettingsHandler);
    elements.testConnection.addEventListener('click', testConnection);
    document.querySelector('#settingsModal .modal-backdrop').addEventListener('click', closeSettings);
}

function loadContext() {
    loadRecentNotes();
    loadRecentFeed();
    loadTodayTasks();
    updateContextIndicator();
}

function loadRecentNotes() {
    const notes = JSON.parse(localStorage.getItem('webuni_notes') || '[]').slice(0, 5);
    if (notes.length === 0) {
        elements.recentNotes.innerHTML = '<div class="context-empty">暂无笔记</div>';
        return;
    }
    elements.recentNotes.innerHTML = notes.map((note) => `
        <div class="context-item">
            <div class="context-item-title">${escapeHtml(note.title)}</div>
            <div class="context-item-meta">${formatDate(note.updatedAt || note.createdAt)}</div>
        </div>
    `).join('');
}

function loadRecentFeed() {
    const feed = JSON.parse(localStorage.getItem('webuni_feed') || '[]').slice(0, 5);
    if (feed.length === 0) {
        elements.recentFeed.innerHTML = '<div class="context-empty">暂无信息</div>';
        return;
    }
    elements.recentFeed.innerHTML = feed.map((item) => `
        <div class="context-item">
            <div class="context-item-title">${escapeHtml(item.title || '未命名信息')}</div>
            <div class="context-item-meta">${formatDate(item.createdAt)}</div>
        </div>
    `).join('');
}

function loadTodayTasks() {
    const tasks = JSON.parse(localStorage.getItem('webuni_tasks') || '[]');
    const today = new Date().toDateString();
    const todayTasks = tasks.filter((task) => {
        if (!task.dueDate || task.completed) return false;
        return new Date(task.dueDate).toDateString() === today;
    }).slice(0, 5);

    if (todayTasks.length === 0) {
        elements.todayTasks.innerHTML = '<div class="context-empty">今日无任务</div>';
        return;
    }

    elements.todayTasks.innerHTML = todayTasks.map((task) => `
        <div class="context-item">
            <div class="context-item-title">${escapeHtml(task.title)}</div>
            <div class="context-item-meta">${escapeHtml(task.priority || 'normal')}</div>
        </div>
    `).join('');
}

function buildContextPrompt() {
    if (!elements.includeContext.checked) return '';

    const notes = JSON.parse(localStorage.getItem('webuni_notes') || '[]').slice(0, 3);
    const tasks = JSON.parse(localStorage.getItem('webuni_tasks') || '[]').filter((t) => !t.completed).slice(0, 5);
    const schedule = JSON.parse(localStorage.getItem('webuni_courses') || '[]').slice(0, 6);

    const parts = [];

    if (notes.length) {
        parts.push('【最近笔记】');
        notes.forEach((n) => {
            parts.push(`- ${n.title}: ${(n.content || '').slice(0, 140)}`);
        });
    }

    if (tasks.length) {
        parts.push('【待办任务】');
        tasks.forEach((t) => {
            parts.push(`- ${t.title} (${t.dueDate || '无截止日期'})`);
        });
    }

    if (schedule.length) {
        parts.push('【课表安排】');
        schedule.forEach((c) => {
            const day = weekLabel(c.dayOfWeek);
            const time = `${c.startTime || ''}-${c.endTime || ''}`.replace(/^-|-$/g, '');
            parts.push(`- ${c.name || c.title} ${day} ${time}`.trim());
        });
    }

    if (!parts.length) return '';
    return `\n\n--- 学习上下文 ---\n${parts.join('\n')}\n--- 上下文结束 ---\n`;
}

function handleInputChange() {
    const text = elements.userInput.value;
    elements.charCount.textContent = String(text.length);
    elements.userInput.style.height = 'auto';
    elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 150) + 'px';
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const text = elements.userInput.value.trim();
    if (!text || isLoading) return;

    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    addMessage('user', text);
    elements.userInput.value = '';
    handleInputChange();

    isLoading = true;
    elements.sendBtn.disabled = true;
    const typingEl = addTypingIndicator();

    try {
        const response = await callAgent(text);
        typingEl.remove();
        addMessage('assistant', response);
    } catch (error) {
        typingEl.remove();
        addMessage('assistant', `请求失败：${error.message}\n\n请检查 API 端点、代理服务和 Key 配置。`);
    } finally {
        isLoading = false;
        elements.sendBtn.disabled = false;
    }

    saveChatHistory();
}

function addMessage(role, content) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    const avatar = role === 'assistant' ? '🤖' : '🧑';

    messageEl.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">${formatMessageContent(content)}</div>
    `;

    elements.chatMessages.appendChild(messageEl);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    chatHistory.push({ role, content, timestamp: Date.now() });
}

function addTypingIndicator() {
    const el = document.createElement('div');
    el.className = 'message assistant';
    el.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="typing-indicator"><span></span><span></span><span></span></div>
        </div>
    `;
    elements.chatMessages.appendChild(el);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    return el;
}

function formatMessageContent(content) {
    return escapeHtml(content)
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

async function callAgent(userMessage) {
    const endpoint = settings.apiEndpoint.trim();
    if (!endpoint) {
        throw new Error('未配置 API 端点');
    }

    const fullUserMessage = userMessage + buildContextPrompt();
    const historyMessages = [
        { role: 'system', content: settings.systemPrompt },
        ...chatHistory.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: fullUserMessage }
    ];

    const isAnthropic = shouldUseAnthropic(endpoint, settings.model);
    if (isAnthropic) {
        return callAnthropic(endpoint, historyMessages);
    }
    return callOpenAICompatible(endpoint, historyMessages);
}

async function callOpenAICompatible(endpoint, messages) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(settings.apiKey && { Authorization: `Bearer ${settings.apiKey}` })
        },
        body: JSON.stringify({
            model: settings.model || DEFAULT_SETTINGS.model,
            messages,
            stream: settings.streamResponse
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 220)}`);
    }

    const data = await response.json();
    if (data.content) return data.content;
    if (data.message) return data.message;
    if (data.response) return data.response;
    return JSON.stringify(data);
}

async function callAnthropic(endpoint, messages) {
    const apiKey = settings.apiKey.trim();
    if (!apiKey) {
        throw new Error('Anthropic 格式需要在设置中填写 API Key');
    }

    const requestUrl = buildAnthropicMessagesUrl(endpoint);
    const payload = buildAnthropicPayload(messages);

    const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: settings.model || 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            system: settings.systemPrompt,
            messages: payload,
            stream: false
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 220)}`);
    }

    const data = await response.json();
    const textBlocks = Array.isArray(data.content)
        ? data.content.filter((item) => item && item.type === 'text').map((item) => item.text)
        : [];
    if (textBlocks.length) return textBlocks.join('\n');
    if (data.content && typeof data.content === 'string') return data.content;
    if (data.message) return data.message;
    return JSON.stringify(data);
}

function shouldUseAnthropic(endpoint, model) {
    const endpointLower = endpoint.toLowerCase();
    const modelLower = (model || '').toLowerCase();
    return modelLower.includes('claude') || endpointLower.includes('/v1') || endpointLower.includes('anthropic');
}

function buildAnthropicMessagesUrl(endpoint) {
    const normalized = endpoint.replace(/\/+$/, '');
    if (normalized.endsWith('/messages')) return normalized;
    if (normalized.endsWith('/v1')) return `${normalized}/messages`;
    return `${normalized}/v1/messages`;
}

function buildAnthropicPayload(messages) {
    const filtered = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    if (!filtered.length || filtered[filtered.length - 1].role !== 'user') {
        filtered.push({ role: 'user', content: '' });
    }
    return filtered.map((m) => ({ role: m.role, content: m.content || '' }));
}

function loadSettings() {
    try {
        const saved = localStorage.getItem(TEACHER_SETTINGS_KEY);
        if (saved) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (error) {
        console.warn('Failed to load settings', error);
    }
}

function saveSettings() {
    localStorage.setItem(TEACHER_SETTINGS_KEY, JSON.stringify(settings));
}

function openSettings() {
    elements.apiEndpoint.value = settings.apiEndpoint;
    elements.modelName.value = settings.model;
    elements.apiKey.value = settings.apiKey;
    elements.systemPrompt.value = settings.systemPrompt;
    elements.streamResponse.checked = settings.streamResponse;
    elements.settingsModal.classList.remove('hidden');
}

function closeSettings() {
    elements.settingsModal.classList.add('hidden');
}

function saveSettingsHandler() {
    settings.apiEndpoint = elements.apiEndpoint.value.trim();
    settings.model = elements.modelName.value.trim() || DEFAULT_SETTINGS.model;
    settings.apiKey = elements.apiKey.value.trim();
    settings.systemPrompt = elements.systemPrompt.value.trim() || DEFAULT_SETTINGS.systemPrompt;
    settings.streamResponse = elements.streamResponse.checked;
    saveSettings();
    closeSettings();
}

function resetSettingsHandler() {
    if (!confirm('确定重置 AI 设置吗？')) return;
    settings = { ...DEFAULT_SETTINGS };
    saveSettings();
    openSettings();
}

async function testConnection() {
    const endpoint = elements.apiEndpoint.value.trim();
    const model = elements.modelName.value.trim() || DEFAULT_SETTINGS.model;
    const key = elements.apiKey.value.trim();

    if (!endpoint) {
        alert('请先填写 API 端点');
        return;
    }

    try {
        const useAnthropic = shouldUseAnthropic(endpoint, model);
        const response = await fetch(
            useAnthropic ? buildAnthropicMessagesUrl(endpoint) : endpoint,
            {
                method: 'POST',
                headers: useAnthropic
                    ? {
                        'Content-Type': 'application/json',
                        ...(key && { 'x-api-key': key }),
                        'anthropic-version': '2023-06-01'
                    }
                    : {
                        'Content-Type': 'application/json',
                        ...(key && { Authorization: `Bearer ${key}` })
                    },
                body: JSON.stringify(
                    useAnthropic
                        ? {
                            model,
                            max_tokens: 128,
                            messages: [{ role: 'user', content: '请回复：连接成功' }],
                            stream: false
                        }
                        : {
                            model,
                            messages: [{ role: 'user', content: '请回复：连接成功' }],
                            stream: false
                        }
                )
            }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const anthText = Array.isArray(data.content)
            ? data.content.filter((item) => item?.type === 'text').map((item) => item.text).join('\n')
            : '';
        alert(`连接成功：${(anthText || data.content || data.message || 'OK').slice(0, 50)}`);
    } catch (error) {
        alert(`连接失败：${error.message}`);
    }
}

function loadChatHistory() {
    try {
        const saved = localStorage.getItem(CHAT_HISTORY_KEY);
        if (saved) chatHistory = JSON.parse(saved);
    } catch (error) {
        chatHistory = [];
    }
}

function saveChatHistory() {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory.slice(-50)));
}

function renderChatHistory() {
    if (!chatHistory.length) return;

    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    chatHistory.forEach((msg) => {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${msg.role}`;
        const avatar = msg.role === 'assistant' ? '🤖' : '🧑';
        messageEl.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">${formatMessageContent(msg.content)}</div>
        `;
        elements.chatMessages.appendChild(messageEl);
    });

    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function toggleContextPanel() {
    elements.contextPanel.classList.toggle('hidden');
}

function updateContextIndicator() {
    const enabled = elements.includeContext.checked;
    elements.contextIndicator.classList.toggle('disabled', !enabled);
    elements.contextIndicator.textContent = enabled ? '📎 已附加上下文' : '📎 上下文已关闭';
}

function weekLabel(dayOfWeek) {
    const found = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][Number(dayOfWeek)];
    return found || '';
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.Teacher = {
    sendMessage: (msg) => {
        elements.userInput.value = msg;
        sendMessage();
    },
    getHistory: () => chatHistory,
    clearHistory: () => {
        chatHistory = [];
        saveChatHistory();
        location.reload();
    }
};
