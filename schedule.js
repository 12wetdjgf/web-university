/**
 * Web大学 - 智能日程系统
 * 神经网络式任务匹配：输入当前状态 → 输出最适合的任务
 */

// ============================================
// 数据结构与存储
// ============================================

const STORAGE_KEY = 'webuni_tasks';

// 默认任务池（基于你的目标预设）
const DEFAULT_TASKS = [
    // 学业
    { id: 'd1', title: '复习机械制图', category: 'study', energy: 2, time: 30, urgency: 3, xp: 30 },
    // 语言
    { id: 'd2', title: '背20个雅思单词', category: 'language', energy: 1, time: 15, urgency: 2, xp: 15 },
    { id: 'd3', title: '看一集美剧(英文字幕)', category: 'language', energy: 1, time: 45, urgency: 1, xp: 20 },
    { id: 'd4', title: '和GPT英语对话10分钟', category: 'language', energy: 2, time: 15, urgency: 2, xp: 25 },
    { id: 'd5', title: '学粤语日常用语', category: 'language', energy: 1, time: 20, urgency: 1, xp: 15 },
    // 技术
    { id: 'd6', title: 'CS61A一个小节', category: 'tech', energy: 3, time: 60, urgency: 2, xp: 50 },
    { id: 'd7', title: '刷一道LeetCode', category: 'tech', energy: 3, time: 30, urgency: 1, xp: 35 },
    { id: 'd8', title: '用Cursor做一个小项目', category: 'tech', energy: 2, time: 60, urgency: 1, xp: 40 },
    // 健康
    { id: 'd9', title: '出门走15分钟', category: 'health', energy: 1, time: 15, urgency: 1, xp: 20 },
    { id: 'd10', title: '做10个俯卧撑', category: 'health', energy: 2, time: 5, urgency: 1, xp: 15 },
    { id: 'd11', title: '整理房间', category: 'health', energy: 1, time: 20, urgency: 2, xp: 20 },
    // 成长
    { id: 'd12', title: '用NotebookLM读一篇文章', category: 'growth', energy: 2, time: 30, urgency: 1, xp: 25 },
    { id: 'd13', title: '听一首新歌', category: 'growth', energy: 1, time: 5, urgency: 1, xp: 10 },
];

// 获取所有任务
function getTasks() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Failed to load tasks:', e);
    }
    // 首次使用，初始化默认任务
    const tasks = DEFAULT_TASKS.map(t => ({
        ...t,
        status: 'todo',
        createdAt: new Date().toISOString(),
        completedAt: null
    }));
    saveTasks(tasks);
    return tasks;
}

// 保存任务
function saveTasks(tasks) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
        console.warn('Failed to save tasks:', e);
    }
}


// ============================================
// 核心：智能匹配算法
// ============================================

/**
 * 计算任务与当前状态的匹配分数
 * 类似神经网络的加权求和，输入状态向量 → 输出匹配度
 */
function calculateMatchScore(task, state) {
    let score = 0;
    
    // 1. 精力匹配（权重最高）
    // 精力低时推荐低能耗任务，精力高时可以做高能耗任务
    const energyDiff = state.energy - task.energy;
    if (energyDiff >= 0) {
        score += 30; // 精力足够
        if (energyDiff === 0) score += 10; // 精力刚好匹配，额外加分
    } else {
        score -= 40; // 精力不足，大幅扣分
    }
    
    // 2. 时间匹配
    if (task.time <= state.time) {
        score += 25;
        // 时间利用率越高越好（避免推荐5分钟任务给2小时空闲）
        const utilization = task.time / state.time;
        if (utilization > 0.5) score += 10;
    } else {
        score -= 30; // 时间不够
    }
    
    // 3. 心情调节
    if (state.mood === 'anxious') {
        // 焦虑时：推荐低精力、短时间、能快速完成的任务
        if (task.energy === 1) score += 20;
        if (task.time <= 20) score += 15;
        if (task.category === 'health') score += 15; // 运动减压
        if (task.category === 'growth' && task.time <= 15) score += 10; // 听音乐等
    } else if (state.mood === 'energetic') {
        // 积极时：推荐高价值、有挑战的任务
        if (task.energy === 3) score += 15;
        if (task.xp >= 30) score += 10;
        if (task.category === 'tech' || task.category === 'study') score += 10;
    }
    // calm状态不做特殊调整，保持中性
    
    // 4. 紧急程度加成
    score += task.urgency * 8;
    
    // 5. XP奖励（轻微影响，鼓励高价值任务）
    score += Math.min(task.xp / 5, 10);
    
    return score;
}

/**
 * 获取推荐任务列表
 * @param {Object} state - 当前状态 {energy, time, mood}
 * @returns {Array} 排序后的推荐任务（最多5个）
 */
function getRecommendations(state) {
    const tasks = getTasks().filter(t => t.status !== 'done');
    
    // 计算每个任务的匹配分数
    const scored = tasks.map(task => ({
        ...task,
        matchScore: calculateMatchScore(task, state)
    }));
    
    // 按分数排序，取前5个
    scored.sort((a, b) => b.matchScore - a.matchScore);
    
    return scored.slice(0, 5).filter(t => t.matchScore > 0);
}


// ============================================
// UI 交互逻辑
// ============================================

// 当前选择的状态
let currentState = {
    energy: null,
    time: null,
    mood: null
};

// DOM 元素缓存
let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    initStateSelectors();
    initTaskModal();
    initFilters();
    renderTaskList();
});

function cacheElements() {
    elements = {
        energySelector: document.getElementById('energySelector'),
        timeSelector: document.getElementById('timeSelector'),
        moodSelector: document.getElementById('moodSelector'),
        recommendBtn: document.getElementById('getRecommendation'),
        recommendations: document.getElementById('recommendations'),
        recommendationList: document.getElementById('recommendationList'),
        anxietyMode: document.getElementById('anxietyMode'),
        taskList: document.getElementById('taskList'),
        emptyState: document.getElementById('emptyState'),
        taskModal: document.getElementById('taskModal'),
        taskForm: document.getElementById('taskForm'),
        addTaskBtn: document.getElementById('addTaskBtn'),
        closeModal: document.getElementById('closeModal'),
        cancelTask: document.getElementById('cancelTask'),
        filterBtns: document.querySelectorAll('.filter-btn')
    };
}

function initStateSelectors() {
    // 精力选择
    elements.energySelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.state-btn');
        if (btn) {
            selectState('energy', parseInt(btn.dataset.value), elements.energySelector);
        }
    });
    
    // 时间选择
    elements.timeSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.state-btn');
        if (btn) {
            selectState('time', parseInt(btn.dataset.value), elements.timeSelector);
        }
    });
    
    // 心情选择
    elements.moodSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.state-btn');
        if (btn) {
            selectState('mood', btn.dataset.value, elements.moodSelector);
            // 焦虑模式特殊处理
            if (btn.dataset.value === 'anxious') {
                elements.anxietyMode.classList.remove('hidden');
            } else {
                elements.anxietyMode.classList.add('hidden');
            }
        }
    });
    
    // 获取推荐按钮
    elements.recommendBtn.addEventListener('click', showRecommendations);
    
    // 焦虑模式快捷操作
    document.querySelectorAll('.relief-btn').forEach(btn => {
        btn.addEventListener('click', () => handleReliefAction(btn.dataset.action));
    });
}

function selectState(type, value, container) {
    // 更新状态
    currentState[type] = value;
    
    // 更新UI
    container.querySelectorAll('.state-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = container.querySelector(`[data-value="${value}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // 检查是否可以获取推荐
    checkRecommendReady();
}

function checkRecommendReady() {
    const ready = currentState.energy && currentState.time && currentState.mood;
    elements.recommendBtn.disabled = !ready;
}

function showRecommendations() {
    const recommendations = getRecommendations(currentState);
    
    if (recommendations.length === 0) {
        elements.recommendationList.innerHTML = `
            <div class="no-recommendations">
                <p>没有匹配的任务，试试添加新任务？</p>
            </div>
        `;
    } else {
        elements.recommendationList.innerHTML = recommendations.map((task, index) => `
            <div class="recommendation-card ${index === 0 ? 'top-pick' : ''}" data-id="${task.id}">
                ${index === 0 ? '<span class="top-badge">🎯 最佳匹配</span>' : ''}
                <div class="rec-header">
                    <span class="rec-category">${getCategoryIcon(task.category)}</span>
                    <span class="rec-title">${task.title}</span>
                </div>
                <div class="rec-meta">
                    <span>⏱️ ${task.time}分钟</span>
                    <span>✨ +${task.xp}XP</span>
                </div>
                <button class="start-task-btn" data-id="${task.id}">开始做</button>
            </div>
        `).join('');
        
        // 绑定开始按钮
        elements.recommendationList.querySelectorAll('.start-task-btn').forEach(btn => {
            btn.addEventListener('click', () => startTask(btn.dataset.id));
        });
    }
    
    elements.recommendations.classList.remove('hidden');
    elements.recommendations.scrollIntoView({ behavior: 'smooth' });
}

function getCategoryIcon(category) {
    const icons = {
        study: '🎓',
        language: '🌍',
        tech: '💻',
        health: '🏃',
        income: '💰',
        social: '👥',
        growth: '📚',
        other: '📌'
    };
    return icons[category] || '📌';
}


// ============================================
// 任务操作
// ============================================

function startTask(taskId) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.status = 'doing';
        saveTasks(tasks);
        renderTaskList();
        // 滚动到任务列表
        elements.taskList.scrollIntoView({ behavior: 'smooth' });
    }
}

function completeTask(taskId) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== 'done') {
        task.status = 'done';
        task.completedAt = new Date().toISOString();
        saveTasks(tasks);
        
        // 使用新的游戏化系统
        if (window.WebUni && window.WebUni.onTaskComplete) {
            const result = window.WebUni.onTaskComplete(task.xp);
            showCompletionFeedback(task, result);
        } else {
            showCompletionFeedback(task, null);
        }
        
        renderTaskList();
    }
}

function deleteTask(taskId) {
    if (!confirm('确定删除这个任务吗？')) return;
    const tasks = getTasks().filter(t => t.id !== taskId);
    saveTasks(tasks);
    renderTaskList();
}

function showCompletionFeedback(task, result) {
    const feedback = document.createElement('div');
    feedback.className = 'completion-toast';
    
    if (result && result.leveledUp) {
        feedback.innerHTML = `🎉 升级了！Lv.${result.newLevel} ${result.title}<br>+${task.xp}XP`;
        feedback.classList.add('level-up');
    } else {
        feedback.innerHTML = `✨ 完成！+${task.xp}XP`;
    }
    
    document.body.appendChild(feedback);
    
    setTimeout(() => feedback.classList.add('show'), 10);
    setTimeout(() => {
        feedback.classList.remove('show');
        setTimeout(() => feedback.remove(), 300);
    }, result?.leveledUp ? 3000 : 2000);
}

function handleReliefAction(action) {
    const reliefTasks = {
        run: { title: '出门走走/跑步', category: 'health', time: 15, xp: 25 },
        music: { title: '听几首喜欢的歌', category: 'growth', time: 10, xp: 15 },
        meditate: { title: '深呼吸冥想5分钟', category: 'health', time: 5, xp: 20 }
    };
    
    const relief = reliefTasks[action];
    if (relief) {
        // 创建临时任务并标记为进行中
        const tasks = getTasks();
        const newTask = {
            id: 'relief_' + Date.now(),
            ...relief,
            energy: 1,
            urgency: 1,
            status: 'doing',
            createdAt: new Date().toISOString(),
            completedAt: null,
            isRelief: true
        };
        tasks.unshift(newTask);
        saveTasks(tasks);
        renderTaskList();
        
        elements.anxietyMode.classList.add('hidden');
        elements.taskList.scrollIntoView({ behavior: 'smooth' });
    }
}

// ============================================
// 任务列表渲染
// ============================================

let currentFilter = 'all';

function initFilters() {
    elements.filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTaskList();
        });
    });
}

function renderTaskList() {
    const tasks = getTasks();
    let filtered = tasks;
    
    if (currentFilter !== 'all') {
        filtered = tasks.filter(t => t.status === currentFilter);
    }
    
    if (filtered.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.taskList.innerHTML = '';
        elements.taskList.appendChild(elements.emptyState);
        return;
    }
    
    elements.emptyState.classList.add('hidden');
    
    // 按状态分组排序：doing > todo > done
    const statusOrder = { doing: 0, todo: 1, done: 2 };
    filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    
    elements.taskList.innerHTML = filtered.map(task => `
        <div class="task-card ${task.status}" data-id="${task.id}">
            <div class="task-status-indicator"></div>
            <div class="task-content">
                <div class="task-header">
                    <span class="task-category">${getCategoryIcon(task.category)}</span>
                    <span class="task-title">${task.title}</span>
                </div>
                <div class="task-meta">
                    <span>⏱️ ${task.time}分钟</span>
                    <span>⚡ ${getEnergyLabel(task.energy)}</span>
                    <span>✨ ${task.xp}XP</span>
                </div>
            </div>
            <div class="task-actions">
                ${task.status === 'todo' ? `<button class="action-btn start" data-action="start" data-id="${task.id}">▶️</button>` : ''}
                ${task.status === 'doing' ? `<button class="action-btn complete" data-action="complete" data-id="${task.id}">✅</button>` : ''}
                ${task.status !== 'done' ? `<button class="action-btn delete" data-action="delete" data-id="${task.id}">🗑️</button>` : ''}
            </div>
        </div>
    `).join('');
    
    // 绑定操作按钮
    elements.taskList.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            if (action === 'start') startTask(id);
            else if (action === 'complete') completeTask(id);
            else if (action === 'delete') deleteTask(id);
        });
    });
}

function getEnergyLabel(energy) {
    return ['', '低', '中', '高'][energy] || '中';
}


// ============================================
// 任务弹窗
// ============================================

let editingTaskId = null;

function initTaskModal() {
    elements.addTaskBtn.addEventListener('click', () => openModal());
    elements.closeModal.addEventListener('click', closeModal);
    elements.cancelTask.addEventListener('click', closeModal);
    elements.taskModal.addEventListener('click', (e) => {
        if (e.target === elements.taskModal) closeModal();
    });
    elements.taskForm.addEventListener('submit', handleTaskSubmit);
}

function openModal(taskId = null) {
    editingTaskId = taskId;
    const modalTitle = document.getElementById('modalTitle');
    
    if (taskId) {
        const task = getTasks().find(t => t.id === taskId);
        if (task) {
            modalTitle.textContent = '编辑任务';
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskCategory').value = task.category;
            document.getElementById('taskTime').value = task.time;
            document.getElementById('taskEnergy').value = task.energy;
            document.getElementById('taskUrgency').value = task.urgency;
            document.getElementById('taskXP').value = task.xp;
        }
    } else {
        modalTitle.textContent = '添加任务';
        elements.taskForm.reset();
        document.getElementById('taskTime').value = 30;
        document.getElementById('taskXP').value = 20;
    }
    
    elements.taskModal.classList.remove('hidden');
}

function closeModal() {
    elements.taskModal.classList.add('hidden');
    editingTaskId = null;
}

function handleTaskSubmit(e) {
    e.preventDefault();
    
    const taskData = {
        title: document.getElementById('taskTitle').value.trim(),
        category: document.getElementById('taskCategory').value,
        time: parseInt(document.getElementById('taskTime').value),
        energy: parseInt(document.getElementById('taskEnergy').value),
        urgency: parseInt(document.getElementById('taskUrgency').value),
        xp: parseInt(document.getElementById('taskXP').value),
        deadline: document.getElementById('taskDeadline').value || null
    };
    
    if (!taskData.title) return;
    
    const tasks = getTasks();
    
    if (editingTaskId) {
        const index = tasks.findIndex(t => t.id === editingTaskId);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...taskData };
        }
    } else {
        const newTask = {
            id: 'task_' + Date.now(),
            ...taskData,
            status: 'todo',
            createdAt: new Date().toISOString(),
            completedAt: null
        };
        tasks.unshift(newTask);
    }
    
    saveTasks(tasks);
    renderTaskList();
    closeModal();
}

// ============================================
// 导出API
// ============================================

window.Schedule = {
    getTasks,
    saveTasks,
    getRecommendations,
    completeTask,
    addXP: (amount) => window.WebUni?.addXP(amount)
};


// ============================================
// 日历仪表盘功能
// ============================================

let currentCalendarDate = new Date();
let selectedDate = null;

function initCalendar() {
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');
    
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar();
        });
        
        nextBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar();
        });
        
        renderCalendar();
        updateStats();
    }
}

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // 更新月份显示
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    document.getElementById('currentMonth').textContent = `${year}年${monthNames[month]}`;
    
    // 获取当月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    // 获取完成的任务数据
    const completedByDate = getCompletedTasksByDate();
    
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    const today = new Date();
    const todayStr = formatDate(today);
    
    // 上月填充
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        const dayEl = createDayElement(day, true, null);
        calendarDays.appendChild(dayEl);
    }
    
    // 当月日期
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDate(new Date(year, month, day));
        const tasksCount = completedByDate[dateStr] || 0;
        const isToday = dateStr === todayStr;
        const isSelected = selectedDate === dateStr;
        
        const dayEl = createDayElement(day, false, tasksCount, isToday, isSelected, dateStr);
        calendarDays.appendChild(dayEl);
    }
    
    // 下月填充
    const totalCells = calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6行 x 7列
    for (let day = 1; day <= remainingCells && totalCells < 42; day++) {
        const dayEl = createDayElement(day, true, null);
        calendarDays.appendChild(dayEl);
    }
}

function createDayElement(day, isOtherMonth, tasksCount, isToday = false, isSelected = false, dateStr = null) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = day;
    
    if (isOtherMonth) {
        dayEl.classList.add('other-month');
    } else {
        if (isToday) dayEl.classList.add('today');
        if (isSelected) dayEl.classList.add('selected');
        
        if (tasksCount > 0) {
            dayEl.classList.add('has-tasks');
            if (tasksCount >= 5) dayEl.classList.add('level-4');
            else if (tasksCount >= 3) dayEl.classList.add('level-3');
            else if (tasksCount >= 2) dayEl.classList.add('level-2');
            else dayEl.classList.add('level-1');
        }
        
        if (dateStr) {
            dayEl.addEventListener('click', () => selectDate(dateStr));
        }
    }
    
    return dayEl;
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    showDayDetail(dateStr);
}

function showDayDetail(dateStr) {
    const dayDetail = document.getElementById('dayDetail');
    const detailDate = document.getElementById('detailDate');
    const detailTasks = document.getElementById('detailTasks');
    
    const date = new Date(dateStr);
    detailDate.textContent = `${date.getMonth() + 1}月${date.getDate()}日 完成记录`;
    
    const tasks = getTasks().filter(t => {
        if (!t.completedAt) return false;
        return formatDate(new Date(t.completedAt)) === dateStr;
    });
    
    if (tasks.length === 0) {
        detailTasks.innerHTML = '<p class="no-tasks-msg">这天没有完成任务</p>';
    } else {
        detailTasks.innerHTML = tasks.map(t => `
            <div class="detail-task-item">
                <span class="task-icon">${getCategoryIcon(t.category)}</span>
                <span class="task-name">${t.title}</span>
                <span class="task-xp">+${t.xp}XP</span>
            </div>
        `).join('');
    }
    
    dayDetail.classList.remove('hidden');
}

function getCompletedTasksByDate() {
    const tasks = getTasks();
    const byDate = {};
    
    tasks.forEach(t => {
        if (t.completedAt) {
            const dateStr = formatDate(new Date(t.completedAt));
            byDate[dateStr] = (byDate[dateStr] || 0) + 1;
        }
    });
    
    return byDate;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function updateStats() {
    const tasks = getTasks();
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // 本月完成数
    const monthCompleted = tasks.filter(t => {
        if (!t.completedAt) return false;
        const d = new Date(t.completedAt);
        return d.getFullYear() === year && d.getMonth() === month;
    });
    
    document.getElementById('monthCompleted').textContent = monthCompleted.length;
    
    // 本月总时长
    const totalTime = monthCompleted.reduce((sum, t) => sum + (t.time || 0), 0);
    document.getElementById('monthTime').textContent = totalTime;
    
    // 连续天数
    const streak = calculateStreak();
    document.getElementById('currentStreak').textContent = streak;
}

function calculateStreak() {
    const completedByDate = getCompletedTasksByDate();
    const dates = Object.keys(completedByDate).sort().reverse();
    
    if (dates.length === 0) return 0;
    
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    
    // 检查今天或昨天是否有完成任务
    if (dates[0] !== today && dates[0] !== yesterday) return 0;
    
    let streak = 1;
    let currentDate = new Date(dates[0]);
    
    for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        
        if (formatDate(prevDate) === dates[i]) {
            streak++;
            currentDate = prevDate;
        } else {
            break;
        }
    }
    
    return streak;
}

// 在原有的DOMContentLoaded中添加日历初始化
const originalDOMContentLoaded = document.addEventListener;
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initCalendar, 100);
});

// 重写completeTask以更新统计
const originalCompleteTask = completeTask;
completeTask = function(taskId) {
    originalCompleteTask(taskId);
    setTimeout(() => {
        renderCalendar();
        updateStats();
    }, 100);
};
