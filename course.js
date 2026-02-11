/**
 * Web大学 - 课程模块
 * 两部分：
 * 1) 习惯打卡
 * 2) 课表安排
 */

const HABITS_STORAGE_KEY = 'webuni_habits';
const SCHEDULE_STORAGE_KEY = 'webuni_courses';

const WEEK_DAYS = [
    { key: 1, label: '周一' },
    { key: 2, label: '周二' },
    { key: 3, label: '周三' },
    { key: 4, label: '周四' },
    { key: 5, label: '周五' },
    { key: 6, label: '周六' },
    { key: 0, label: '周日' }
];

const PERIODS = {
    morning: '上午',
    afternoon: '下午',
    evening: '晚上'
};

const DEFAULT_HABITS = [
    { id: 'h1', name: '健身', minutes: 10, createdAt: Date.now() },
    { id: 'h2', name: '背单词', minutes: 20, createdAt: Date.now() }
];

const DEFAULT_SCHEDULE = [
    {
        id: 's1',
        name: '计算机科学',
        dayOfWeek: 1,
        period: 'evening',
        startTime: '19:00',
        endTime: '20:30',
        goal: 'CS50 / CS61A',
        createdAt: Date.now()
    },
    {
        id: 's2',
        name: '英语学习',
        dayOfWeek: 3,
        period: 'evening',
        startTime: '19:30',
        endTime: '20:30',
        goal: '听力+写作',
        createdAt: Date.now()
    }
];

let habits = [];
let scheduleItems = [];
let currentModule = 'habits';
let editingScheduleId = null;

let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    loadData();
    bindEvents();
    renderAll();
});

function cacheElements() {
    elements = {
        addMainBtn: document.getElementById('addMainBtn'),
        switchBtns: document.querySelectorAll('.switch-btn'),
        habitsPanel: document.getElementById('habitsPanel'),
        timetablePanel: document.getElementById('timetablePanel'),
        habitList: document.getElementById('habitList'),
        habitEmpty: document.getElementById('habitEmpty'),
        timetableGrid: document.getElementById('timetableGrid'),
        timetableList: document.getElementById('timetableList'),
        scheduleEmpty: document.getElementById('scheduleEmpty'),
        todayDone: document.getElementById('todayDone'),
        habitCount: document.getElementById('habitCount'),
        bestStreak: document.getElementById('bestStreak'),
        habitModal: document.getElementById('habitModal'),
        habitForm: document.getElementById('habitForm'),
        habitName: document.getElementById('habitName'),
        habitMinutes: document.getElementById('habitMinutes'),
        cancelHabit: document.getElementById('cancelHabit'),
        scheduleModal: document.getElementById('scheduleModal'),
        scheduleModalTitle: document.getElementById('scheduleModalTitle'),
        scheduleForm: document.getElementById('scheduleForm'),
        subjectName: document.getElementById('subjectName'),
        dayOfWeek: document.getElementById('dayOfWeek'),
        timePeriod: document.getElementById('timePeriod'),
        startTime: document.getElementById('startTime'),
        endTime: document.getElementById('endTime'),
        teacherName: document.getElementById('teacherName'),
        cancelSchedule: document.getElementById('cancelSchedule')
    };
}

function bindEvents() {
    elements.addMainBtn.addEventListener('click', () => {
        if (currentModule === 'habits') openHabitModal();
        else openScheduleModal();
    });

    elements.switchBtns.forEach((btn) => {
        btn.addEventListener('click', () => switchModule(btn.dataset.module));
    });

    elements.habitForm.addEventListener('submit', onHabitSubmit);
    elements.cancelHabit.addEventListener('click', closeHabitModal);
    elements.scheduleForm.addEventListener('submit', onScheduleSubmit);
    elements.cancelSchedule.addEventListener('click', closeScheduleModal);

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
        backdrop.addEventListener('click', () => {
            closeHabitModal();
            closeScheduleModal();
        });
    });
}

function switchModule(module) {
    currentModule = module;
    elements.switchBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.module === module));
    elements.habitsPanel.classList.toggle('hidden', module !== 'habits');
    elements.timetablePanel.classList.toggle('hidden', module !== 'timetable');
}

function loadData() {
    habits = loadJson(HABITS_STORAGE_KEY, DEFAULT_HABITS);
    scheduleItems = normalizeSchedule(loadJson(SCHEDULE_STORAGE_KEY, DEFAULT_SCHEDULE));
    saveSchedule();
}

function loadJson(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        if (!value) {
            localStorage.setItem(key, JSON.stringify(fallback));
            return [...fallback];
        }
        return JSON.parse(value);
    } catch (error) {
        console.warn(`Failed to parse storage: ${key}`, error);
        return [...fallback];
    }
}

function normalizeSchedule(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
        id: item.id || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: item.name || item.title || '未命名课程',
        dayOfWeek: Number.isInteger(item.dayOfWeek) ? item.dayOfWeek : 1,
        period: item.period || inferPeriod(item.startTime),
        startTime: item.startTime || '19:00',
        endTime: item.endTime || '20:00',
        goal: item.goal || item.source || '',
        createdAt: item.createdAt || Date.now()
    }));
}

function inferPeriod(time) {
    if (!time || typeof time !== 'string') return 'evening';
    const hour = Number(time.split(':')[0]);
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
}

function saveHabits() {
    localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
}

function saveSchedule() {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(scheduleItems));
}

function renderAll() {
    renderHabits();
    renderScheduleGrid();
    renderScheduleList();
    updateHabitStats();
}

function renderHabits() {
    const today = getTodayKey();
    const cards = habits.map((habit) => {
        const checkedToday = !!(habit.checkins && habit.checkins[today]);
        const streak = calcStreak(habit);
        return `
            <article class="habit-card ${checkedToday ? 'checked' : ''}">
                <div class="habit-main">
                    <h3>${escapeHtml(habit.name)}</h3>
                    <p>目标 ${habit.minutes} 分钟</p>
                </div>
                <div class="habit-meta">
                    <span>连续 ${streak} 天</span>
                    <button class="danger-btn" data-action="delete-habit" data-id="${habit.id}">删除</button>
                </div>
                <button class="check-btn ${checkedToday ? 'done' : ''}" data-action="toggle-checkin" data-id="${habit.id}">
                    ${checkedToday ? '已打卡' : '今日打卡'}
                </button>
            </article>
        `;
    }).join('');

    elements.habitList.innerHTML = cards || '';
    elements.habitEmpty.classList.toggle('hidden', habits.length > 0);
    if (habits.length === 0) {
        elements.habitList.appendChild(elements.habitEmpty);
    }

    elements.habitList.querySelectorAll('[data-action="toggle-checkin"]').forEach((btn) => {
        btn.addEventListener('click', () => toggleCheckin(btn.dataset.id));
    });
    elements.habitList.querySelectorAll('[data-action="delete-habit"]').forEach((btn) => {
        btn.addEventListener('click', () => deleteHabit(btn.dataset.id));
    });
}

function renderScheduleGrid() {
    const header = ['时间段', ...WEEK_DAYS.map((d) => d.label)];
    const rows = ['morning', 'afternoon', 'evening'];

    const html = [
        '<div class="grid-row header-row">',
        ...header.map((name) => `<div class="grid-cell header-cell">${name}</div>`),
        '</div>'
    ];

    rows.forEach((period) => {
        html.push('<div class="grid-row">');
        html.push(`<div class="grid-cell period-cell">${PERIODS[period]}</div>`);
        WEEK_DAYS.forEach((day) => {
            const items = scheduleItems
                .filter((it) => it.dayOfWeek === day.key && it.period === period)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
            html.push(`
                <div class="grid-cell body-cell">
                    ${items.map((it) => `
                        <button class="grid-item" data-id="${it.id}">
                            <strong>${escapeHtml(it.name)}</strong>
                            <span>${it.startTime}-${it.endTime}</span>
                        </button>
                    `).join('')}
                </div>
            `);
        });
        html.push('</div>');
    });

    elements.timetableGrid.innerHTML = html.join('');
    elements.timetableGrid.querySelectorAll('.grid-item').forEach((btn) => {
        btn.addEventListener('click', () => openScheduleModal(btn.dataset.id));
    });
}

function renderScheduleList() {
    const sorted = [...scheduleItems].sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
    });

    if (sorted.length === 0) {
        elements.timetableList.innerHTML = '';
        elements.scheduleEmpty.classList.remove('hidden');
        elements.timetableList.appendChild(elements.scheduleEmpty);
        return;
    }

    elements.scheduleEmpty.classList.add('hidden');
    elements.timetableList.innerHTML = sorted.map((it) => `
        <article class="schedule-card">
            <div>
                <h3>${escapeHtml(it.name)}</h3>
                <p>${WEEK_DAYS.find((d) => d.key === it.dayOfWeek)?.label || '未知'} · ${PERIODS[it.period]} · ${it.startTime}-${it.endTime}</p>
                ${it.goal ? `<small>${escapeHtml(it.goal)}</small>` : ''}
            </div>
            <div class="schedule-actions">
                <button class="action-btn" data-action="edit" data-id="${it.id}">编辑</button>
                <button class="action-btn danger" data-action="delete" data-id="${it.id}">删除</button>
            </div>
        </article>
    `).join('');

    elements.timetableList.querySelectorAll('[data-action="edit"]').forEach((btn) => {
        btn.addEventListener('click', () => openScheduleModal(btn.dataset.id));
    });
    elements.timetableList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', () => deleteScheduleItem(btn.dataset.id));
    });
}

function updateHabitStats() {
    const today = getTodayKey();
    const done = habits.filter((h) => h.checkins && h.checkins[today]).length;
    const best = habits.reduce((max, h) => Math.max(max, calcStreak(h)), 0);
    elements.todayDone.textContent = String(done);
    elements.habitCount.textContent = String(habits.length);
    elements.bestStreak.textContent = String(best);
}

function onHabitSubmit(event) {
    event.preventDefault();
    const name = elements.habitName.value.trim();
    const minutes = Math.max(1, parseInt(elements.habitMinutes.value, 10) || 10);
    if (!name) return;

    habits.unshift({
        id: `habit_${Date.now()}`,
        name,
        minutes,
        checkins: {},
        createdAt: Date.now()
    });

    saveHabits();
    renderHabits();
    updateHabitStats();
    closeHabitModal();

    if (window.WebUni && window.WebUni.addXP) {
        window.WebUni.addXP(5);
    }
}

function onScheduleSubmit(event) {
    event.preventDefault();

    const payload = {
        name: elements.subjectName.value.trim(),
        dayOfWeek: Number(elements.dayOfWeek.value),
        period: elements.timePeriod.value,
        startTime: elements.startTime.value,
        endTime: elements.endTime.value,
        goal: elements.teacherName.value.trim()
    };

    if (!payload.name) return;
    if (payload.endTime <= payload.startTime) {
        alert('结束时间需要晚于开始时间');
        return;
    }

    if (editingScheduleId) {
        scheduleItems = scheduleItems.map((item) => (
            item.id === editingScheduleId ? { ...item, ...payload } : item
        ));
    } else {
        scheduleItems.push({
            id: `schedule_${Date.now()}`,
            ...payload,
            createdAt: Date.now()
        });
    }

    saveSchedule();
    renderScheduleGrid();
    renderScheduleList();
    closeScheduleModal();
}

function toggleCheckin(habitId) {
    const today = getTodayKey();
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;

    if (!habit.checkins) habit.checkins = {};
    const currentlyChecked = !!habit.checkins[today];
    habit.checkins[today] = !currentlyChecked;
    if (!habit.checkins[today]) delete habit.checkins[today];

    saveHabits();
    renderHabits();
    updateHabitStats();

    if (!currentlyChecked && window.WebUni && window.WebUni.addXP) {
        window.WebUni.addXP(10);
    }
}

function deleteHabit(habitId) {
    if (!confirm('确定删除这个习惯吗？')) return;
    habits = habits.filter((h) => h.id !== habitId);
    saveHabits();
    renderHabits();
    updateHabitStats();
}

function deleteScheduleItem(id) {
    if (!confirm('确定删除这个课表安排吗？')) return;
    scheduleItems = scheduleItems.filter((it) => it.id !== id);
    saveSchedule();
    renderScheduleGrid();
    renderScheduleList();
}

function openHabitModal() {
    elements.habitForm.reset();
    elements.habitMinutes.value = '10';
    elements.habitModal.classList.remove('hidden');
}

function closeHabitModal() {
    elements.habitModal.classList.add('hidden');
}

function openScheduleModal(scheduleId = null) {
    editingScheduleId = scheduleId;
    elements.scheduleForm.reset();
    elements.dayOfWeek.value = '1';
    elements.timePeriod.value = 'evening';
    elements.startTime.value = '19:00';
    elements.endTime.value = '20:00';
    elements.teacherName.value = '';

    if (scheduleId) {
        const item = scheduleItems.find((it) => it.id === scheduleId);
        if (item) {
            elements.scheduleModalTitle.textContent = '编辑课表安排';
            elements.subjectName.value = item.name;
            elements.dayOfWeek.value = String(item.dayOfWeek);
            elements.timePeriod.value = item.period;
            elements.startTime.value = item.startTime;
            elements.endTime.value = item.endTime;
            elements.teacherName.value = item.goal || '';
        }
    } else {
        elements.scheduleModalTitle.textContent = '新增课表安排';
    }

    elements.scheduleModal.classList.remove('hidden');
}

function closeScheduleModal() {
    elements.scheduleModal.classList.add('hidden');
    editingScheduleId = null;
}

function calcStreak(habit) {
    if (!habit.checkins) return 0;
    const set = new Set(Object.keys(habit.checkins).filter((k) => habit.checkins[k]));
    if (set.size === 0) return 0;

    let streak = 0;
    const date = new Date();
    while (true) {
        const key = date.toISOString().slice(0, 10);
        if (set.has(key)) {
            streak += 1;
            date.setDate(date.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.Course = {
    getCourses: () => scheduleItems,
    saveCourses: saveSchedule
};
