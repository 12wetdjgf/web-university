/**
 * Web大学 - AI教师模块
 * 对接笔记和信息流上下文，与CLI Agent通信
 */

const TEACHER_SETTINGS_KEY = 'webuni_teacher_settings';
const CHAT_HISTORY_KEY = 'webuni_teacher_history';

// 默认设置
const DEFAULT_SETTINGS = {
    apiEndpoint: 'http://localhost:3000/api/chat',
    apiKey: '',
    systemPrompt: '你是Web大学的AI助教，帮助学生解答学习问题、整理笔记、分析学习进度。请用友好、专业的语气回答。',
    streamResponse: true
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
        apiEndpoint: document.getElementById('apiEndpoint'),
        apiKey: document.getElementById('apiKey'),
        systemPrompt: document.getElementById('systemPrompt'),
        streamResponse: document.getElementById('streamResponse')
    };
}

function initEventListeners() {
    // 上下文面板
    elements.contextBtn.addEventListener('click', toggleContextPanel);
    elements.closeContext.addEventListener('click', () => elements.contextPanel.classList.add('hidden'));
    elements.includeContext.addEventListener('change', updateContextIndicator);
    
    // 输入框
    elements.userInput.addEventListener('input', handleInputChange);
    elements.userInput.addEventListener('keydown', handleKeyDown);
    elements.sendBtn.addEventListener('click', sendMessage);
    
    // 快捷按钮
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            elements.userInput.value = btn.dataset.prompt;
            handleInputChange();
            sendMessage();
        });
    });
    
    // 设置弹窗
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.closeSettings.addEventListener('click', closeSettings);
    elements.saveSettings.addEventListener('click', saveSettingsHandler);
    elements.resetSettings.addEventListener('click', resetSettingsHandler);
    document.querySelector('#settingsModal .modal-backdrop').addEventListener('click', closeSettings);
}

// ==================== 上下文管理 ====================

function loadContext() {
    loadRecentNotes();
    loadRecentFeed();
    loadTodayTasks();
    updateContextIndicator();
}

function loadRecentNotes() {
    const notes = JSON.parse(localStorage.getItem('webuni_notes') || '[]');
    const recent = notes.slice(0, 5);
    
    if (recent.length === 0) {
        elements.recentNotes.innerHTML = '<div class="context-empty">暂无笔记</div>';
        return;
    }
    
    elements.recentNotes.innerHTML = recent.map(note => `
        <div class="context-item" data-type="note" data-id="${note.id}">
            <div class="context-item-title">${escapeHtml(note.title)}</div>
            <div class="context-item-meta">${formatDate(note.updatedAt || note.createdAt)}</div>
        </div>
    `).join('');
    
    // 点击插入引用
    elements.recentNotes.querySelectorAll('.context-item').forEach(item => {
        item.addEventListener('click', () => insertContextReference(item.dataset.type, item.dataset.id));
    });
}

function loadRecentFeed() {
    const feed = JSON.parse(localStorage.getItem('webuni_feed') || '[]');
    const recent = feed.slice(0, 5);
    
    if (recent.length === 0) {
        elements.recentFeed.innerHTML = '<div class="context-empty">暂无信息</div>';
        return;
    }
    
    elements.recentFeed.innerHTML = recent.map(item => `
        <div class="context-item" data-type="feed" data-id="${item.id}">
            <div class="context-item-title">${escapeHtml(item.title || item.content?.substring(0, 30) || '无标题')}</div>
            <div class="context-item-meta">${formatDate(item.createdAt)}</div>
        </div>
    `).join('');
    
    elements.recentFeed.querySelectorAll('.context-item').forEach(item => {
        item.addEventListener('click', () => insertContextReference(item.dataset.type, item.dataset.id));
    });
}

function loadTodayTasks() {
    const tasks = JSON.parse(localStorage.getItem('webuni_tasks') || '[]');
    const today = new Date().toDateString();
    const todayTasks = tasks.filter(t => !t.completed && new Date(t.dueDate).toDateString() === today);
    
    if (todayTasks.length === 0) {
        elements.todayTasks.innerHTML = '<div class="context-empty">今日无任务</div>';
        return;
    }
    
    elements.todayTasks.innerHTML = todayTasks.slice(0, 5).map(task => `
        <div class="context-item" data-type="task" data-id="${task.id}">
            <div class="context-item-title">${escapeHtml(task.title)}</div>
            <div class="context-item-meta">${task.priority || '普通'}</div>
        </div>
    `).join('');
}

function insertContextReference(type, id) {
    const current = elements.userInput.value;
    const ref = `[@${type}:${id}] `;
    elements.userInput.value = ref + current;
    elements.userInput.focus();
    handleInputChange();
}

function toggleContextPanel() {
    elements.contextPanel.classList.toggle('hidden');
}

function updateContextIndicator() {
    const enabled = elements.includeContext.checked;
    elements.contextIndicator.classList.toggle('disabled', !enabled);
    elements.contextIndicator.textContent = enabled ? '📚 已加载上下文' : '📚 上下文已禁用';
}

// ==================== 构建上下文 ====================

function buildContextPrompt() {
    if (!elements.includeContext.checked) return '';
    
    const notes = JSON.parse(localStorage.getItem('webuni_notes') || '[]').slice(0, 3);
    const feed = JSON.parse(localStorage.getItem('webuni_feed') || '[]').slice(0, 3);
    const tasks = JSON.parse(localStorage.getItem('webuni_tasks') || '[]').filter(t => !t.completed).slice(0, 5);
    
    let context = '\n\n--- 学习上下文 ---\n';
    
    if (notes.length > 0) {
        context += '\n【最近笔记】\n';
        notes.forEach(n => {
            context += `- ${n.title}: ${(n.content || '').substring(0, 200)}...\n`;
        });
    }
    
    if (feed.length > 0) {
        context += '\n【信息流】\n';
        feed.forEach(f => {
            context += `- ${f.title || '无标题'}: ${(f.content || '').substring(0, 150)}...\n`;
        });
    }
    
    if (tasks.length > 0) {
        context += '\n【待办任务】\n';
        tasks.forEach(t => {
            context += `- ${t.title} (${t.dueDate || '无截止日期'})\n`;
        });
    }
    
    context += '--- 上下文结束 ---\n\n';
    return context;
}

// ==================== 聊天功能 ====================

function handleInputChange() {
    const text = elements.userInput.value;
    elements.charCount.textContent = text.length;
    
    // 自动调整高度
    elements.userInput.style.height = 'auto';
    elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 150) + 'px';
}

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const text = elements.userInput.value.trim();
    if (!text || isLoading) return;
    
    // 隐藏欢迎消息
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    // 添加用户消息
    addMessage('user', text);
    elements.userInput.value = '';
    handleInputChange();
    
    // 显示加载状态
    isLoading = true;
    elements.sendBtn.disabled = true;
    const typingEl = addTypingIndicator();
    
    try {
        const response = await callAgent(text);
        typingEl.remove();
        addMessage('assistant', response);
    } catch (error) {
        typingEl.remove();
        addMessage('assistant', `❌ 错误: ${error.message}\n\n请检查设置中的API端点是否正确配置。`);
    } finally {
        isLoading = false;
        elements.sendBtn.disabled = false;
    }
    
    saveChatHistory();
}

function addMessage(role, content) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    
    const avatar = role === 'assistant' ? '🤖' : '👤';
    
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
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    elements.chatMessages.appendChild(el);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    return el;
}

function formatMessageContent(content) {
    // 简单的代码块处理
    return escapeHtml(content)
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

// ==================== API 调用 ====================

async function callAgent(userMessage) {
    const contextPrompt = buildContextPrompt();
    const fullMessage = userMessage + contextPrompt;
    
    // 构建消息历史
    const messages = [
        { role: 'system', content: settings.systemPrompt },
        ...chatHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: fullMessage }
    ];
    
    // 如果没有配置API，使用模拟响应
    if (!settings.apiEndpoint || settings.apiEndpoint === DEFAULT_SETTINGS.apiEndpoint) {
        return simulateResponse(userMessage, contextPrompt);
    }
    
    const response = await fetch(settings.apiEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(settings.apiKey && { 'Authorization': `Bearer ${settings.apiKey}` })
        },
        body: JSON.stringify({
            messages,
            stream: settings.streamResponse
        })
    });
    
    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    return data.content || data.message || data.response || JSON.stringify(data);
}

// 模拟响应（未配置API时使用）
function simulateResponse(userMessage, context) {
    const lower = userMessage.toLowerCase();
    
    if (lower.includes('总结') && lower.includes('笔记')) {
        const notes = JSON.parse(localStorage.getItem('webuni_notes') || '[]');
        if (notes.length === 0) return '你还没有任何笔记哦！去笔记页面创建一些吧 📝';
        return `📝 你目前有 ${notes.length} 篇笔记。\n\n最近的笔记包括：\n${notes.slice(0, 3).map(n => `• ${n.title}`).join('\n')}\n\n要我帮你整理这些笔记的要点吗？`;
    }
    
    if (lower.includes('学习') && (lower.includes('进度') || lower.includes('分析'))) {
        const userData = JSON.parse(localStorage.getItem('webuni_user') || '{}');
        return `📊 学习进度分析：\n\n• 等级: Lv.${userData.level || 1}\n• 经验值: ${userData.totalXP || 0} XP\n• 连续学习: ${userData.streak || 0} 天\n\n继续保持！每天学习一点点，积少成多 💪`;
    }
    
    if (lower.includes('测试') || lower.includes('题')) {
        return '❓ 好的，我来根据你的笔记出几道题：\n\n1. 请简述你最近学习的主要内容\n2. 这些知识点之间有什么联系？\n3. 你觉得哪个部分最难理解？\n\n（提示：配置API后，我可以生成更智能的测试题！）';
    }
    
    if (lower.includes('计划')) {
        return '📅 制定学习计划建议：\n\n1. 先回顾今天的笔记\n2. 完成待办任务\n3. 预习明天的内容\n4. 做一个番茄钟专注学习\n\n需要我帮你设置具体的时间安排吗？';
    }
    
    return `我收到了你的消息："${userMessage}"\n\n⚠️ 当前使用的是模拟响应模式。\n\n要获得真正的AI回答，请在设置中配置你的API端点，可以连接：\n• OpenAI API\n• 本地 Ollama\n• 自定义 CLI Agent 后端\n\n点击右上角 ⚙️ 进行配置。`;
}

// ==================== 设置管理 ====================

function loadSettings() {
    try {
        const saved = localStorage.getItem(TEACHER_SETTINGS_KEY);
        if (saved) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {}
}

function saveSettings() {
    localStorage.setItem(TEACHER_SETTINGS_KEY, JSON.stringify(settings));
}

function openSettings() {
    elements.apiEndpoint.value = settings.apiEndpoint;
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
    settings.apiKey = elements.apiKey.value.trim();
    settings.systemPrompt = elements.systemPrompt.value.trim() || DEFAULT_SETTINGS.systemPrompt;
    settings.streamResponse = elements.streamResponse.checked;
    saveSettings();
    closeSettings();
}

function resetSettingsHandler() {
    if (confirm('确定要重置所有设置吗？')) {
        settings = { ...DEFAULT_SETTINGS };
        saveSettings();
        openSettings();
    }
}

// ==================== 聊天历史 ====================

function loadChatHistory() {
    try {
        const saved = localStorage.getItem(CHAT_HISTORY_KEY);
        if (saved) chatHistory = JSON.parse(saved);
    } catch (e) {
        chatHistory = [];
    }
}

function saveChatHistory() {
    // 只保留最近50条
    const toSave = chatHistory.slice(-50);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
}

function renderChatHistory() {
    if (chatHistory.length === 0) return;
    
    // 隐藏欢迎消息
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    // 渲染历史消息
    chatHistory.forEach(msg => {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${msg.role}`;
        const avatar = msg.role === 'assistant' ? '🤖' : '👤';
        messageEl.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">${formatMessageContent(msg.content)}</div>
        `;
        elements.chatMessages.appendChild(messageEl);
    });
    
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// ==================== 工具函数 ====================

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 导出API
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
