/**
 * Web大学 - 课程管理系统
 * 学习进度追踪 + 资源链接管理
 */

// ============================================
// 配置与状态
// ============================================

const COURSES_STORAGE_KEY = 'webuni_courses';

// 分类配置
const CATEGORIES = {
    cs: { icon: '💻', name: '计算机', color: '#4A90D9' },
    ai: { icon: '🤖', name: 'AI', color: '#9B59B6' },
    language: { icon: '🌍', name: '语言', color: '#27AE60' },
    tool: { icon: '🔧', name: '工具', color: '#E67E22' },
    other: { icon: '📌', name: '其他', color: '#95A5A6' }
};

// 状态配置
const STATUS_CONFIG = {
    'not-started': { icon: '🕐', name: '未开始' },
    'learning': { icon: '📖', name: '学习中' },
    'completed': { icon: '✅', name: '已完成' }
};

// 预设学习资源
const DEFAULT_RESOURCES = [
    { name: 'CS自学指南', url: 'https://csdiy.wiki/', icon: '📖', desc: '计算机自学路线' },
    { name: 'CS50', url: 'https://cs50.harvard.edu/', icon: '🎓', desc: 'Harvard入门课' },
    { name: 'CS61A', url: 'https://cs61a.org/', icon: '🐍', desc: 'Berkeley Python' },
    { name: 'CS61B', url: 'https://sp24.datastructur.es/', icon: '☕', desc: 'Berkeley Java' },
    { name: '李宏毅ML', url: 'https://speech.ee.ntu.edu.tw/~hylee/ml/2024-spring.php', icon: '🤖', desc: '机器学习课程' },
    { name: 'DeepLearning.AI', url: 'https://www.deeplearning.ai/', icon: '🧠', desc: '吴恩达课程' },
    { name: 'Z-Library', url: 'https://z-lib.io/', icon: '📚', desc: '电子书资源' },
    { name: 'NotebookLM', url: 'https://notebooklm.google/', icon: '📝', desc: 'AI笔记工具' }
];

// 预设课程（基于用户学习路径）
const DEFAULT_COURSES = [
    { 
        id: 'c1', name: 'CS50', source: 'Harvard', category: 'cs',
        totalLessons: 12, completedLessons: 0, status: 'not-started',
        url: 'https://cs50.harvard.edu/', notes: '计算机科学入门课程'
    },
    { 
        id: 'c2', name: 'CS61A', source: 'UC Berkeley', category: 'cs',
        totalLessons: 40, completedLessons: 0, status: 'not-started',
        url: 'https://cs61a.org/', notes: 'Python编程与计算机程序结构'
    },
    { 
        id: 'c3', name: 'CS61B', source: 'UC Berkeley', category: 'cs',
        totalLessons: 40, completedLessons: 0, status: 'not-started',
        url: 'https://sp24.datastructur.es/', notes: '数据结构与算法'
    },
    { 
        id: 'c4', name: '机器学习2024', source: '李宏毅', category: 'ai',
        totalLessons: 25, completedLessons: 0, status: 'not-started',
        url: 'https://speech.ee.ntu.edu.tw/~hylee/ml/2024-spring.php', notes: '深度学习入门'
    },
    { 
        id: 'c5', name: '雅思备考', source: '自学', category: 'language',
        totalLessons: 30, completedLessons: 0, status: 'not-started',
        url: '', notes: '听说读写四项训练'
    }
];

let courses = [];
let currentFilter = 'all';
let currentCategory = 'all';
let currentCourseId = null;

// ============================================
// DOM 元素
// ============================================

let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    loadCourses();
    initEventListeners();
    renderCourses();
    renderResources();
    updateStats();
});

function cacheElements() {
    elements = {
        coursesList: document.getElementById('coursesList'),
        emptyState: document.getElementById('emptyState'),
        resourcesGrid: document.getElementById('resourcesGrid'),
        totalCourses: document.getElementById('totalCourses'),
        learningCount: document.getElementById('learningCount'),
        completedCount: document.getElementById('completedCount'),
        // 弹窗
        courseModal: document.getElementById('courseModal'),
        detailModal: document.getElementById('detailModal'),
        courseForm: document.getElementById('courseForm'),
        // 表单字段
        courseName: document.getElementById('courseName'),
        courseSource: document.getElementById('courseSource'),
        courseCategory: document.getElementById('courseCategory'),
        courseTotalLessons: document.getElementById('courseTotalLessons'),
        courseUrl: document.getElementById('courseUrl'),
        courseNotes: document.getElementById('courseNotes'),
        // 详情字段
        detailHeader: document.getElementById('detailHeader'),
        detailCategory: document.getElementById('detailCategory'),
        detailTitle: document.getElementById('detailTitle'),
        detailSource: document.getElementById('detailSource'),
        progressText: document.getElementById('progressText'),
        progressFill: document.getElementById('progressFill'),
        progressCurrent: document.getElementById('progressCurrent'),
        detailLink: document.getElementById('detailLink'),
        detailLinkSection: document.getElementById('detailLinkSection'),
        detailNotes: document.getElementById('detailNotes'),
        detailNotesSection: document.getElementById('detailNotesSection')
    };
}


// ============================================
// 事件监听
// ============================================

function initEventListeners() {
    // 添加按钮
    document.getElementById('addCourseBtn').addEventListener('click', () => openCourseModal());
    
    // 筛选按钮
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderCourses();
        });
    });
    
    // 分类按钮
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;
            renderCourses();
        });
    });
    
    // 课程弹窗
    document.getElementById('cancelCourse').addEventListener('click', closeCourseModal);
    elements.courseForm.addEventListener('submit', handleCourseSubmit);
    
    // 详情弹窗
    document.getElementById('closeDetail').addEventListener('click', closeDetailModal);
    document.getElementById('deleteCourse').addEventListener('click', deleteCurrentCourse);
    document.getElementById('increaseProgress').addEventListener('click', () => updateProgress(1));
    document.getElementById('decreaseProgress').addEventListener('click', () => updateProgress(-1));
    
    // 状态按钮
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateCourseStatus(currentCourseId, btn.dataset.status);
        });
    });
    
    // 点击背景关闭弹窗
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            closeCourseModal();
            closeDetailModal();
        });
    });
}

// ============================================
// 数据管理
// ============================================

function loadCourses() {
    try {
        const saved = localStorage.getItem(COURSES_STORAGE_KEY);
        if (saved) {
            courses = JSON.parse(saved);
        } else {
            // 首次使用，初始化默认课程
            courses = DEFAULT_COURSES.map(c => ({
                ...c,
                createdAt: Date.now()
            }));
            saveCourses();
        }
    } catch (e) {
        console.warn('Failed to load courses:', e);
        courses = [];
    }
}

function saveCourses() {
    try {
        localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses));
    } catch (e) {
        console.warn('Failed to save courses:', e);
    }
}

// ============================================
// 课程操作
// ============================================

function handleCourseSubmit(e) {
    e.preventDefault();
    
    const name = elements.courseName.value.trim();
    if (!name) {
        alert('请输入课程名称');
        return;
    }
    
    const courseData = {
        name,
        source: elements.courseSource.value.trim() || '自学',
        category: elements.courseCategory.value,
        totalLessons: parseInt(elements.courseTotalLessons.value) || 10,
        url: elements.courseUrl.value.trim(),
        notes: elements.courseNotes.value.trim()
    };
    
    if (currentCourseId) {
        // 编辑模式
        const index = courses.findIndex(c => c.id === currentCourseId);
        if (index !== -1) {
            courses[index] = { ...courses[index], ...courseData };
        }
    } else {
        // 添加模式
        const newCourse = {
            id: 'course_' + Date.now(),
            ...courseData,
            completedLessons: 0,
            status: 'not-started',
            createdAt: Date.now()
        };
        courses.unshift(newCourse);
        
        // 添加XP奖励
        if (window.WebUni && window.WebUni.addXP) {
            window.WebUni.addXP(10);
        }
    }
    
    saveCourses();
    renderCourses();
    updateStats();
    closeCourseModal();
}

function updateCourseStatus(id, status) {
    const course = courses.find(c => c.id === id);
    if (course) {
        const wasCompleted = course.status === 'completed';
        course.status = status;
        
        // 如果标记为完成，自动填满进度
        if (status === 'completed' && course.completedLessons < course.totalLessons) {
            course.completedLessons = course.totalLessons;
            updateDetailProgress(course);
        }
        
        // 完成课程奖励XP
        if (status === 'completed' && !wasCompleted) {
            if (window.WebUni && window.WebUni.addXP) {
                window.WebUni.addXP(50);
            }
            showCompletionToast('🎉 恭喜完成课程！+50XP');
        }
        
        saveCourses();
        renderCourses();
        updateStats();
    }
}

function updateProgress(delta) {
    const course = courses.find(c => c.id === currentCourseId);
    if (!course) return;
    
    const newValue = Math.max(0, Math.min(course.totalLessons, course.completedLessons + delta));
    if (newValue === course.completedLessons) return;
    
    course.completedLessons = newValue;
    
    // 自动更新状态
    if (newValue === 0) {
        course.status = 'not-started';
    } else if (newValue === course.totalLessons) {
        if (course.status !== 'completed') {
            course.status = 'completed';
            if (window.WebUni && window.WebUni.addXP) {
                window.WebUni.addXP(50);
            }
            showCompletionToast('🎉 恭喜完成课程！+50XP');
        }
    } else {
        course.status = 'learning';
    }
    
    // 每完成一节课奖励XP
    if (delta > 0) {
        if (window.WebUni && window.WebUni.addXP) {
            window.WebUni.addXP(5);
        }
    }
    
    updateDetailProgress(course);
    updateStatusButtons(course.status);
    saveCourses();
    renderCourses();
    updateStats();
}

function updateDetailProgress(course) {
    const percent = (course.completedLessons / course.totalLessons) * 100;
    elements.progressText.textContent = `${course.completedLessons}/${course.totalLessons}`;
    elements.progressFill.style.width = `${percent}%`;
    elements.progressCurrent.textContent = course.completedLessons;
}

function updateStatusButtons(status) {
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
    });
}

function deleteCurrentCourse() {
    if (!currentCourseId) return;
    
    if (confirm('确定要删除这门课程吗？')) {
        courses = courses.filter(c => c.id !== currentCourseId);
        saveCourses();
        renderCourses();
        updateStats();
        closeDetailModal();
    }
}

// ============================================
// 渲染
// ============================================

function renderCourses() {
    let filtered = courses;
    
    // 状态筛选
    if (currentFilter !== 'all') {
        filtered = filtered.filter(c => c.status === currentFilter);
    }
    
    // 分类筛选
    if (currentCategory !== 'all') {
        filtered = filtered.filter(c => c.category === currentCategory);
    }
    
    // 显示/隐藏空状态
    elements.emptyState.classList.toggle('hidden', filtered.length > 0);
    
    // 清空现有卡片
    const existingCards = elements.coursesList.querySelectorAll('.course-card');
    existingCards.forEach(card => card.remove());
    
    // 渲染课程卡片
    filtered.forEach(course => {
        const card = createCourseCard(course);
        elements.coursesList.appendChild(card);
    });
}

function createCourseCard(course) {
    const card = document.createElement('div');
    card.className = `course-card ${course.status}`;
    card.dataset.id = course.id;
    
    const category = CATEGORIES[course.category] || CATEGORIES.other;
    const status = STATUS_CONFIG[course.status];
    const percent = Math.round((course.completedLessons / course.totalLessons) * 100);
    
    card.innerHTML = `
        <div class="course-card-header" style="border-left-color: ${category.color}">
            <span class="course-category-tag">${category.icon} ${category.name}</span>
            <span class="course-status-tag">${status.icon}</span>
        </div>
        <div class="course-card-body">
            <h3 class="course-name">${escapeHtml(course.name)}</h3>
            <p class="course-source">${escapeHtml(course.source)}</p>
            <div class="course-progress">
                <div class="progress-bar-mini">
                    <div class="progress-fill-mini" style="width: ${percent}%"></div>
                </div>
                <span class="progress-label">${course.completedLessons}/${course.totalLessons} (${percent}%)</span>
            </div>
        </div>
        <div class="course-card-footer">
            <span class="course-status-text">${status.icon} ${status.name}</span>
            ${course.url ? '<span class="has-link">🔗</span>' : ''}
        </div>
    `;
    
    card.addEventListener('click', () => openDetailModal(course.id));
    
    return card;
}

function renderResources() {
    elements.resourcesGrid.innerHTML = DEFAULT_RESOURCES.map(res => `
        <a href="${res.url}" target="_blank" class="resource-card">
            <span class="resource-icon">${res.icon}</span>
            <div class="resource-info">
                <span class="resource-name">${res.name}</span>
                <span class="resource-desc">${res.desc}</span>
            </div>
            <span class="resource-arrow">→</span>
        </a>
    `).join('');
}

function updateStats() {
    elements.totalCourses.textContent = courses.length;
    elements.learningCount.textContent = courses.filter(c => c.status === 'learning').length;
    elements.completedCount.textContent = courses.filter(c => c.status === 'completed').length;
}

// ============================================
// 弹窗控制
// ============================================

function openCourseModal(courseId = null) {
    currentCourseId = courseId;
    const modalTitle = document.getElementById('modalTitle');
    
    if (courseId) {
        const course = courses.find(c => c.id === courseId);
        if (course) {
            modalTitle.textContent = '📝 编辑课程';
            elements.courseName.value = course.name;
            elements.courseSource.value = course.source;
            elements.courseCategory.value = course.category;
            elements.courseTotalLessons.value = course.totalLessons;
            elements.courseUrl.value = course.url || '';
            elements.courseNotes.value = course.notes || '';
        }
    } else {
        modalTitle.textContent = '📚 添加课程';
        elements.courseForm.reset();
        elements.courseTotalLessons.value = 10;
    }
    
    elements.courseModal.classList.remove('hidden');
}

function closeCourseModal() {
    elements.courseModal.classList.add('hidden');
    currentCourseId = null;
    elements.courseForm.reset();
}

function openDetailModal(courseId) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    currentCourseId = courseId;
    const category = CATEGORIES[course.category] || CATEGORIES.other;
    
    // 填充详情
    elements.detailHeader.style.background = `linear-gradient(135deg, ${category.color}, ${adjustColor(category.color, -30)})`;
    elements.detailCategory.textContent = `${category.icon} ${category.name}`;
    elements.detailTitle.textContent = course.name;
    elements.detailSource.textContent = course.source;
    
    // 进度
    updateDetailProgress(course);
    
    // 状态按钮
    updateStatusButtons(course.status);
    
    // 链接
    if (course.url) {
        elements.detailLink.href = course.url;
        elements.detailLinkSection.classList.remove('hidden');
    } else {
        elements.detailLinkSection.classList.add('hidden');
    }
    
    // 备注
    if (course.notes) {
        elements.detailNotes.textContent = course.notes;
        elements.detailNotesSection.classList.remove('hidden');
    } else {
        elements.detailNotesSection.classList.add('hidden');
    }
    
    elements.detailModal.classList.remove('hidden');
}

function closeDetailModal() {
    elements.detailModal.classList.add('hidden');
    currentCourseId = null;
}

// ============================================
// 工具函数
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function adjustColor(hex, amount) {
    let color = hex.replace('#', '');
    let num = parseInt(color, 16);
    let r = Math.min(255, Math.max(0, (num >> 16) + amount));
    let g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    let b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

function showCompletionToast(message) {
    const toast = document.createElement('div');
    toast.className = 'completion-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ============================================
// 导出API
// ============================================

window.Course = {
    getCourses: () => courses,
    saveCourses,
    updateProgress
};
