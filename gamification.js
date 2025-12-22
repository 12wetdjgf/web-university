/**
 * Web大学 - 游戏化系统
 * 简化版：连续天数 + 经验值 + 等级
 */

const USER_KEY = 'webuni_user';

// 等级配置
const LEVELS = [
    { level: 1, title: '新生', xpRequired: 0 },
    { level: 2, title: '学员', xpRequired: 100 },
    { level: 3, title: '学徒', xpRequired: 300 },
    { level: 5, title: '进修生', xpRequired: 600 },
    { level: 8, title: '学者', xpRequired: 1200 },
    { level: 12, title: '研究员', xpRequired: 2500 },
    { level: 18, title: '探索者', xpRequired: 5000 },
    { level: 25, title: '专家', xpRequired: 10000 },
    { level: 35, title: '导师', xpRequired: 20000 },
    { level: 50, title: '大师', xpRequired: 50000 }
];

// ============================================
// 初始化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const userData = getUserData();
    updateStreakOnVisit(userData);
    updateDisplay(userData);
});

// ============================================
// 数据操作
// ============================================

function getUserData() {
    const defaults = {
        totalXP: 0,
        level: 1,
        streak: 0,
        lastActiveDate: null,
        lastCompletedDate: null,
        tasksCompleted: 0,
        achievements: []
    };
    try {
        const stored = localStorage.getItem(USER_KEY);
        return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch (e) {
        return defaults;
    }
}

function saveUserData(data) {
    localStorage.setItem(USER_KEY, JSON.stringify(data));
}

// ============================================
// 连续天数逻辑
// ============================================

/**
 * 访问时更新连续天数
 * 规则：基于"完成任务"来计算连续天数，而不是单纯访问
 */
function updateStreakOnVisit(userData) {
    const today = new Date().toDateString();
    
    // 今天已经访问过，不重复处理
    if (userData.lastActiveDate === today) return;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    // 检查昨天是否完成了任务
    if (userData.lastCompletedDate === yesterdayStr) {
        // 昨天完成了，连续天数保持
    } else if (userData.lastCompletedDate !== today) {
        // 昨天没完成任务，检查是否断签
        // 如果上次完成不是昨天也不是今天，重置连续天数
        if (userData.lastCompletedDate && userData.lastCompletedDate !== yesterdayStr) {
            userData.streak = 0;
        }
    }
    
    userData.lastActiveDate = today;
    saveUserData(userData);
}

/**
 * 完成任务时调用
 */
function onTaskComplete(xpAmount) {
    const userData = getUserData();
    const today = new Date().toDateString();
    
    // 增加XP
    userData.totalXP += xpAmount;
    userData.tasksCompleted += 1;
    
    // 更新等级
    const newLevel = calculateLevel(userData.totalXP);
    const leveledUp = newLevel > userData.level;
    userData.level = newLevel;
    
    // 更新连续天数
    if (userData.lastCompletedDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (userData.lastCompletedDate === yesterday.toDateString() || userData.lastCompletedDate === null) {
            userData.streak += 1;
        } else {
            userData.streak = 1; // 断签后重新开始
        }
        userData.lastCompletedDate = today;
    }
    
    saveUserData(userData);
    updateDisplay(userData);
    
    // 返回结果用于显示
    return {
        xpGained: xpAmount,
        newXP: userData.totalXP,
        newLevel: userData.level,
        leveledUp,
        streak: userData.streak,
        title: getLevelTitle(userData.level)
    };
}

// ============================================
// 等级计算
// ============================================

function calculateLevel(xp) {
    let level = 1;
    for (const config of LEVELS) {
        if (xp >= config.xpRequired) {
            level = config.level;
        } else {
            break;
        }
    }
    return level;
}

function getLevelTitle(level) {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (level >= LEVELS[i].level) {
            return LEVELS[i].title;
        }
    }
    return '新生';
}

function getNextLevelXP(currentXP) {
    for (const config of LEVELS) {
        if (currentXP < config.xpRequired) {
            return config.xpRequired;
        }
    }
    return null; // 已满级
}

// ============================================
// UI 更新
// ============================================

function updateDisplay(userData) {
    const levelEl = document.getElementById('user-level');
    const streakEl = document.getElementById('user-streak');
    const xpEl = document.getElementById('user-xp');
    const titleEl = document.querySelector('.stat-item-mini:first-child .stat-label-mini');
    
    if (levelEl) levelEl.textContent = `Lv.${userData.level}`;
    if (streakEl) streakEl.textContent = userData.streak;
    if (xpEl) xpEl.textContent = userData.totalXP;
    if (titleEl) titleEl.textContent = getLevelTitle(userData.level);
    
    // 连续天数高亮
    if (userData.streak > 0) {
        const streakCard = streakEl?.closest('.stat-item-mini');
        if (streakCard) streakCard.classList.add('streak-active');
    }
}

// ============================================
// 导出给其他模块使用
// ============================================

window.WebUni = {
    getUserData,
    saveUserData,
    onTaskComplete,
    getLevelTitle,
    getNextLevelXP,
    LEVELS
};
