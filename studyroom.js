/**
 * Web大学 - 自习室（番茄钟）
 * 精美的专注计时器，集成游戏化系统
 */

// ============================================
// 配置与状态
// ============================================

const STORAGE_KEY_FOCUS = 'webuni_focus_data';

const CONFIG = {
    focus: { duration: 25, label: '专注时间', xp: 30 },
    short: { duration: 5, label: '短休息', xp: 5 },
    long: { duration: 15, label: '长休息', xp: 10 }
};

let state = {
    mode: 'focus',
    timeLeft: CONFIG.focus.duration * 60,
    totalTime: CONFIG.focus.duration * 60,
    isRunning: false,
    pomodorosToday: 0,
    currentTask: null,
    intervalId: null
};

// ============================================
// DOM 元素
// ============================================

let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    initAmbiance();
    initModeSelector();
    initControls();
    initTaskSelector();
    loadTodayData();
    updateDisplay();
    renderHistory();
});

function cacheElements() {
    elements = {
        timerDisplay: document.getElementById('timerDisplay'),
        timerLabel: document.getElementById('timerLabel'),
        timerProgress: document.getElementById('timerProgress'),
        startBtn: document.getElementById('startBtn'),
        startIcon: document.getElementById('startIcon'),
        startText: document.getElementById('startText'),
        resetBtn: document.getElementById('resetBtn'),
        skipBtn: document.getElementById('skipBtn'),
        pomodoroDots: document.getElementById('pomodoroDots'),
        pomodoroCount: document.getElementById('pomodoroCount'),
        taskSelect: document.getElementById('taskSelect'),
        totalFocusTime: document.getElementById('totalFocusTime'),
        totalPomodoros: document.getElementById('totalPomodoros'),
        earnedXP: document.getElementById('earnedXP'),
        focusHistory: document.getElementById('focusHistory'),
        completionModal: document.getElementById('completionModal'),
        modalEmoji: document.getElementById('modalEmoji'),
        modalTitle: document.getElementById('modalTitle'),
        modalMessage: document.getElementById('modalMessage'),
        rewardXP: document.getElementById('rewardXP'),
        modalBtn: document.getElementById('modalBtn')
    };
}

// ============================================
// 氛围主题
// ============================================

function initAmbiance() {
    const buttons = document.querySelectorAll('.ambiance-btn');
    const savedTheme = localStorage.getItem('webuni_theme') || 'default';
    
    buttons.forEach(btn => {
        if (btn.dataset.theme === savedTheme) {
            btn.classList.add('active');
            applyTheme(savedTheme);
        }
        
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const theme = btn.dataset.theme;
            applyTheme(theme);
            localStorage.setItem('webuni_theme', theme);
        });
    });
}

function applyTheme(theme) {
    document.body.className = '';
    if (theme !== 'default') {
        document.body.classList.add(`theme-${theme}`);
    }
}

// ============================================
// 模式选择
// ============================================

function initModeSelector() {
    const buttons = document.querySelectorAll('.mode-btn');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (state.isRunning) return;
            
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            state.mode = btn.dataset.mode;
            state.timeLeft = parseInt(btn.dataset.duration) * 60;
            state.totalTime = state.timeLeft;
            
            updateDisplay();
        });
    });
}

// ============================================
// 计时器控制
// ============================================

function initControls() {
    elements.startBtn.addEventListener('click', toggleTimer);
    elements.resetBtn.addEventListener('click', resetTimer);
    elements.skipBtn.addEventListener('click', skipTimer);
    elements.modalBtn.addEventListener('click', closeModal);
}

function toggleTimer() {
    if (state.isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    state.isRunning = true;
    elements.startBtn.classList.add('running');
    elements.startIcon.textContent = '⏸';
    elements.startText.textContent = '暂停';
    
    state.intervalId = setInterval(() => {
        state.timeLeft--;
        updateDisplay();
        
        if (state.timeLeft <= 0) {
            completeTimer();
        }
    }, 1000);
}

function pauseTimer() {
    state.isRunning = false;
    elements.startBtn.classList.remove('running');
    elements.startIcon.textContent = '▶';
    elements.startText.textContent = '继续';
    
    if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
    }
}

function resetTimer() {
    pauseTimer();
    state.timeLeft = state.totalTime;
    elements.startText.textContent = '开始专注';
    updateDisplay();
}

function skipTimer() {
    if (confirm('确定要跳过当前计时吗？')) {
        completeTimer(true);
    }
}

function completeTimer(skipped = false) {
    pauseTimer();
    
    const config = CONFIG[state.mode];
    const xpEarned = skipped ? 0 : config.xp;
    
    if (state.mode === 'focus' && !skipped) {
        state.pomodorosToday++;
        updatePomodoroDots();
        
        // 记录专注历史
        saveFocusRecord(config.duration, xpEarned);
    }
    
    // 添加XP到游戏化系统
    if (xpEarned > 0 && window.WebUni && window.WebUni.addXP) {
        window.WebUni.addXP(xpEarned);
    }
    
    // 更新统计
    updateStats();
    renderHistory();
    
    // 显示完成弹窗
    if (!skipped) {
        showCompletionModal(config, xpEarned);
    }
    
    // 自动切换到下一个模式
    autoSwitchMode();
}

function autoSwitchMode() {
    const buttons = document.querySelectorAll('.mode-btn');
    
    if (state.mode === 'focus') {
        // 每4个番茄后长休息
        const nextMode = state.pomodorosToday % 4 === 0 ? 'long' : 'short';
        state.mode = nextMode;
        state.timeLeft = CONFIG[nextMode].duration * 60;
        state.totalTime = state.timeLeft;
        
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === nextMode);
        });
    } else {
        // 休息后回到专注
        state.mode = 'focus';
        state.timeLeft = CONFIG.focus.duration * 60;
        state.totalTime = state.timeLeft;
        
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === 'focus');
        });
    }
    
    elements.startText.textContent = '开始专注';
    updateDisplay();
}

// ============================================
// 显示更新
// ============================================

function updateDisplay() {
    // 更新时间显示
    const minutes = Math.floor(state.timeLeft / 60);
    const seconds = state.timeLeft % 60;
    elements.timerDisplay.textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // 更新标签
    elements.timerLabel.textContent = CONFIG[state.mode].label;
    
    // 更新进度环
    const circumference = 2 * Math.PI * 90; // r=90
    const progress = state.timeLeft / state.totalTime;
    const offset = circumference * (1 - progress);
    elements.timerProgress.style.strokeDasharray = circumference;
    elements.timerProgress.style.strokeDashoffset = offset;
}

function updatePomodoroDots() {
    const dots = elements.pomodoroDots.querySelectorAll('.dot');
    const count = state.pomodorosToday % 4 || (state.pomodorosToday > 0 ? 4 : 0);
    
    dots.forEach((dot, i) => {
        dot.classList.toggle('filled', i < count);
    });
    
    elements.pomodoroCount.textContent = `${state.pomodorosToday}/4`;
}

// ============================================
// 任务选择
// ============================================

function initTaskSelector() {
    loadTasks();
    
    elements.taskSelect.addEventListener('change', (e) => {
        state.currentTask = e.target.value || null;
    });
}

function loadTasks() {
    try {
        const tasks = JSON.parse(localStorage.getItem('webuni_tasks') || '[]');
        const todoTasks = tasks.filter(t => t.status !== 'done');
        
        elements.taskSelect.innerHTML = '<option value="">选择要专注的任务...</option>';
        
        todoTasks.forEach(task => {
            const option = document.createElement('option');
            option.value = task.id;
            option.textContent = `${getCategoryIcon(task.category)} ${task.title}`;
            elements.taskSelect.appendChild(option);
        });
    } catch (e) {
        console.warn('Failed to load tasks:', e);
    }
}

function getCategoryIcon(category) {
    const icons = {
        study: '🎓', language: '🌍', tech: '💻', health: '🏃',
        income: '💰', social: '👥', growth: '📚', other: '📌'
    };
    return icons[category] || '📌';
}

// ============================================
// 数据存储
// ============================================

function getTodayKey() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function loadTodayData() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY_FOCUS) || '{}');
        const todayKey = getTodayKey();
        const todayData = data[todayKey] || { pomodoros: 0, focusTime: 0, xp: 0, records: [] };
        
        state.pomodorosToday = todayData.pomodoros;
        updatePomodoroDots();
        updateStats();
    } catch (e) {
        console.warn('Failed to load focus data:', e);
    }
}

function saveFocusRecord(duration, xp) {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY_FOCUS) || '{}');
        const todayKey = getTodayKey();
        
        if (!data[todayKey]) {
            data[todayKey] = { pomodoros: 0, focusTime: 0, xp: 0, records: [] };
        }
        
        data[todayKey].pomodoros++;
        data[todayKey].focusTime += duration;
        data[todayKey].xp += xp;
        data[todayKey].records.push({
            time: new Date().toISOString(),
            duration,
            xp,
            taskId: state.currentTask
        });
        
        localStorage.setItem(STORAGE_KEY_FOCUS, JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to save focus record:', e);
    }
}

function updateStats() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY_FOCUS) || '{}');
        const todayKey = getTodayKey();
        const todayData = data[todayKey] || { pomodoros: 0, focusTime: 0, xp: 0 };
        
        elements.totalFocusTime.textContent = todayData.focusTime;
        elements.totalPomodoros.textContent = todayData.pomodoros;
        elements.earnedXP.textContent = todayData.xp;
    } catch (e) {
        console.warn('Failed to update stats:', e);
    }
}

function renderHistory() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY_FOCUS) || '{}');
        const todayKey = getTodayKey();
        const todayData = data[todayKey];
        
        if (!todayData || !todayData.records || todayData.records.length === 0) {
            elements.focusHistory.innerHTML = 
                '<p class="empty-history">今天还没有专注记录，开始你的第一个番茄吧！</p>';
            return;
        }
        
        const tasks = JSON.parse(localStorage.getItem('webuni_tasks') || '[]');
        
        elements.focusHistory.innerHTML = todayData.records.slice().reverse().map(record => {
            const task = tasks.find(t => t.id === record.taskId);
            const taskName = task ? task.title : '自由专注';
            const time = new Date(record.time);
            const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
            
            return `
                <div class="history-item">
                    <span class="history-icon">🍅</span>
                    <div class="history-info">
                        <div class="history-task">${taskName}</div>
                        <div class="history-time">${timeStr} · ${record.duration}分钟</div>
                    </div>
                    <span class="history-xp">+${record.xp}XP</span>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.warn('Failed to render history:', e);
    }
}

// ============================================
// 完成弹窗
// ============================================

function showCompletionModal(config, xp) {
    const emojis = {
        focus: '🎉',
        short: '☕',
        long: '🌿'
    };
    
    const messages = {
        focus: `太棒了，你完成了${config.duration}分钟的专注！`,
        short: '休息一下，准备下一轮！',
        long: '好好放松，你做得很好！'
    };
    
    elements.modalEmoji.textContent = emojis[state.mode];
    elements.modalTitle.textContent = state.mode === 'focus' ? '专注完成！' : '休息结束！';
    elements.modalMessage.textContent = messages[state.mode];
    elements.rewardXP.textContent = `+${xp} XP`;
    
    elements.completionModal.classList.remove('hidden');
    
    // 播放提示音（如果支持）
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleXBhdmVmbXQgAAAAEABAABAAEAIABAABAAEAIABkYXRh');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    } catch (e) {}
}

function closeModal() {
    elements.completionModal.classList.add('hidden');
}

// ============================================
// 页面可见性处理
// ============================================

document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.isRunning) {
        // 页面隐藏时记录时间戳
        state.hiddenAt = Date.now();
    } else if (!document.hidden && state.hiddenAt) {
        // 页面恢复时补偿时间
        const elapsed = Math.floor((Date.now() - state.hiddenAt) / 1000);
        state.timeLeft = Math.max(0, state.timeLeft - elapsed);
        state.hiddenAt = null;
        
        if (state.timeLeft <= 0) {
            completeTimer();
        } else {
            updateDisplay();
        }
    }
});


// ============================================
// 音乐播放器 - APlayer 自定义播放列表
// ============================================

const PLAYLIST_KEY = 'webuni_playlist';
let aplayer = null;

// 默认播放列表（一些免费的 lofi 音乐）
const DEFAULT_PLAYLIST = [
    {
        name: 'Lofi Study',
        artist: 'Lofi Girl',
        url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
        cover: 'https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?w=100&h=100&fit=crop'
    },
    {
        name: 'Chill Vibes',
        artist: 'Relaxing Music',
        url: 'https://cdn.pixabay.com/audio/2022/10/25/audio_946bc6eb4c.mp3',
        cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop'
    },
    {
        name: 'Focus Flow',
        artist: 'Study Beats',
        url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_8cb749d484.mp3',
        cover: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=100&h=100&fit=crop'
    }
];

function initMusicPlayer() {
    const playlist = loadPlaylist();
    
    aplayer = new APlayer({
        container: document.getElementById('aplayer'),
        listFolded: false,
        listMaxHeight: 200,
        audio: playlist.length > 0 ? playlist : DEFAULT_PLAYLIST,
        theme: '#D97757',
        loop: 'all',
        order: 'list',
        preload: 'metadata',
        volume: 0.7
    });
    
    // 添加音乐按钮
    document.getElementById('addMusicBtn').addEventListener('click', () => {
        document.getElementById('addMusicModal').classList.remove('hidden');
    });
    
    // 取消添加
    document.getElementById('cancelMusic').addEventListener('click', () => {
        document.getElementById('addMusicModal').classList.add('hidden');
        clearMusicForm();
    });
    
    // 点击背景关闭
    document.querySelector('#addMusicModal .modal-backdrop').addEventListener('click', () => {
        document.getElementById('addMusicModal').classList.add('hidden');
        clearMusicForm();
    });
    
    // 确认添加
    document.getElementById('confirmMusic').addEventListener('click', addMusicFromForm);
    
    // 清空播放列表
    document.getElementById('clearPlaylist').addEventListener('click', () => {
        if (confirm('确定清空播放列表吗？')) {
            aplayer.list.clear();
            savePlaylist([]);
        }
    });
    
    // 本地文件上传
    document.getElementById('localMusic').addEventListener('change', handleLocalFiles);
    
    // 监听播放列表变化
    aplayer.on('listswitch', saveCurrentPlaylist);
    aplayer.on('listadd', saveCurrentPlaylist);
}

function loadPlaylist() {
    try {
        const saved = localStorage.getItem(PLAYLIST_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
}

function savePlaylist(playlist) {
    try {
        localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlist));
    } catch (e) {
        console.warn('Failed to save playlist:', e);
    }
}

function saveCurrentPlaylist() {
    if (aplayer && aplayer.list) {
        const playlist = aplayer.list.audios.map(audio => ({
            name: audio.name,
            artist: audio.artist,
            url: audio.url,
            cover: audio.cover
        }));
        savePlaylist(playlist);
    }
}

function addMusicFromForm() {
    const name = document.getElementById('musicName').value.trim();
    const artist = document.getElementById('musicArtist').value.trim() || '未知歌手';
    const url = document.getElementById('musicUrl').value.trim();
    const cover = document.getElementById('musicCover').value.trim() || 
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop';
    
    if (!name || !url) {
        alert('请填写歌曲名称和音乐链接');
        return;
    }
    
    aplayer.list.add({
        name,
        artist,
        url,
        cover
    });
    
    saveCurrentPlaylist();
    document.getElementById('addMusicModal').classList.add('hidden');
    clearMusicForm();
}

function clearMusicForm() {
    document.getElementById('musicName').value = '';
    document.getElementById('musicArtist').value = '';
    document.getElementById('musicUrl').value = '';
    document.getElementById('musicCover').value = '';
}

function handleLocalFiles(e) {
    const files = e.target.files;
    
    Array.from(files).forEach(file => {
        const url = URL.createObjectURL(file);
        const name = file.name.replace(/\.[^/.]+$/, ''); // 去掉扩展名
        
        aplayer.list.add({
            name,
            artist: '本地文件',
            url,
            cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop'
        });
    });
    
    // 注意：本地文件的 blob URL 无法持久化保存
    e.target.value = ''; // 清空 input
}

// 页面关闭时保存播放列表
window.addEventListener('beforeunload', saveCurrentPlaylist);

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initMusicPlayer, 200);
});
