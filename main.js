/**
 * Web大学 - JavaScript
 * 首页交互与数据管理
 */

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', () => {
    initUserStats();
    initNavAnimations();
    initCloudSyncControls();
});

/**
 * 初始化用户统计数据
 */
function initUserStats() {
    // 从 localStorage 读取用户数据
    const userData = getUserData();

    // 更新显示
    const levelEl = document.getElementById('user-level');
    const streakEl = document.getElementById('user-streak');
    const xpEl = document.getElementById('user-xp');

    if (levelEl) levelEl.textContent = `Lv.${userData.level}`;
    if (streakEl) streakEl.textContent = userData.streak;
    if (xpEl) xpEl.textContent = userData.totalXP;

    // 更新等级称号
    const levelLabel = document.querySelector('.stat-item-mini:first-child .stat-label-mini');
    if (levelLabel) {
        levelLabel.textContent = getLevelTitle(userData.level);
    }

    // 检查连续天数
    checkStreak(userData);
}

/**
 * 获取用户数据
 */
function getUserData() {
    const defaultData = {
        totalXP: 0,
        level: 1,
        streak: 0,
        lastActiveDate: null,
        achievements: [],
        tasksCompleted: 0,
        focusMinutes: 0
    };

    try {
        const stored = localStorage.getItem('webuni_user');
        if (stored) {
            return { ...defaultData, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn('Failed to load user data:', e);
    }

    return defaultData;
}

/**
 * 保存用户数据
 */
function saveUserData(data) {
    try {
        localStorage.setItem('webuni_user', JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to save user data:', e);
    }
}

/**
 * 获取等级称号
 */
function getLevelTitle(level) {
    if (level >= 50) return '大师';
    if (level >= 20) return '探索者';
    if (level >= 10) return '学者';
    if (level >= 5) return '学徒';
    return '新生';
}

/**
 * 检查并更新连续天数
 */
function checkStreak(userData) {
    const today = new Date().toDateString();
    const lastActive = userData.lastActiveDate;

    if (lastActive !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastActive === yesterday.toDateString()) {
            // 连续登录
            userData.streak += 1;
        } else if (lastActive !== null) {
            // 断签
            userData.streak = 1;
        } else {
            // 首次登录
            userData.streak = 1;
        }

        userData.lastActiveDate = today;
        saveUserData(userData);

        // 更新显示
        const streakEl = document.getElementById('user-streak');
        if (streakEl) streakEl.textContent = userData.streak;
    }
}

/**
 * 添加经验值
 */
function addXP(amount) {
    const userData = getUserData();
    userData.totalXP += amount;

    // 检查升级
    const newLevel = calculateLevel(userData.totalXP);
    if (newLevel > userData.level) {
        userData.level = newLevel;
        showLevelUpNotification(newLevel);
    }

    saveUserData(userData);

    // 更新显示
    const xpEl = document.getElementById('user-xp');
    const levelEl = document.getElementById('user-level');
    if (xpEl) xpEl.textContent = userData.totalXP;
    if (levelEl) levelEl.textContent = `Lv.${userData.level}`;
}

/**
 * 计算等级
 */
function calculateLevel(xp) {
    // 简单的等级公式: level = sqrt(xp / 100) + 1
    return Math.floor(Math.sqrt(xp / 100)) + 1;
}

/**
 * 显示升级通知
 */
function showLevelUpNotification(level) {
    const title = getLevelTitle(level);
    console.log(`🎉 升级了！等级 ${level} - ${title}`);
    // TODO: 添加可视化通知
}

/**
 * 导航动画
 */
function initNavAnimations() {
    const modules = document.querySelectorAll('.nav-module');

    modules.forEach((module, index) => {
        // 添加入场延迟动画
        module.style.opacity = '0';
        module.style.transform = module.style.transform || 'scale(0.8)';

        setTimeout(() => {
            module.style.transition = 'all 0.4s ease';
            module.style.opacity = '1';

            // 恢复原始位置
            const position = module.dataset.position;
            if (position === 'top' || position === 'bottom') {
                module.style.transform = 'translateX(-50%) scale(1)';
            } else {
                module.style.transform = 'scale(1)';
            }
        }, 300 + index * 100);
    });
}

function initCloudSyncControls() {
    const syncBtn = document.getElementById('syncToCloudBtn');
    const showCodeBtn = document.getElementById('showDeviceCodeBtn');
    const restoreBtn = document.getElementById('restoreByCodeBtn');
    const codeInput = document.getElementById('restoreDeviceCodeInput');
    const statusEl = document.getElementById('cloudSyncStatus');

    if (!syncBtn || !showCodeBtn || !restoreBtn || !codeInput || !statusEl) return;

    const setStatus = (msg) => {
        statusEl.textContent = msg;
    };

    syncBtn.addEventListener('click', async () => {
        if (!window.CloudStorage) {
            setStatus('未检测到云同步服务');
            return;
        }
        setStatus('正在同步到云端...');
        try {
            await window.CloudStorage.syncAllData();
            setStatus('同步完成');
        } catch (error) {
            setStatus(`同步失败: ${error.message}`);
        }
    });

    showCodeBtn.addEventListener('click', () => {
        if (!window.CloudStorage) {
            setStatus('未检测到云同步服务');
            return;
        }
        const code = window.CloudStorage.getDeviceCode();
        codeInput.value = code;
        setStatus(`设备码: ${code}`);
    });

    restoreBtn.addEventListener('click', async () => {
        if (!window.CloudStorage) {
            setStatus('未检测到云同步服务');
            return;
        }
        const code = codeInput.value.trim();
        if (!code) {
            setStatus('请先输入设备码');
            return;
        }
        setStatus('正在从云端恢复...');
        try {
            const ok = await window.CloudStorage.restoreByDeviceCode(code);
            if (!ok) {
                setStatus('恢复失败');
                return;
            }
            setStatus('恢复完成，页面即将刷新');
            setTimeout(() => location.reload(), 800);
        } catch (error) {
            setStatus(`恢复失败: ${error.message}`);
        }
    });
}

/**
 * 工具函数 - 节流
 */
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 工具函数 - 防抖
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// 导出给其他模块使用
window.WebUni = {
    getUserData,
    saveUserData,
    addXP,
    getLevelTitle
};
