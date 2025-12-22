/**
 * Web大学 - 项目管理系统
 * 支持 VSCode 链接 + GitHub 集成
 */

const PROJECTS_STORAGE_KEY = 'webuni_projects';

const PROJECT_STATUS = {
    active: { icon: '🟢', name: '进行中', class: 'active' },
    paused: { icon: '🟡', name: '暂停', class: 'paused' },
    completed: { icon: '✅', name: '已完成', class: 'completed' }
};

let projects = [];
let currentFilter = 'all';
let currentProjectId = null;
let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    loadProjects();
    initEventListeners();
    renderProjects();
    updateStats();
});

function cacheElements() {
    elements = {
        projectsList: document.getElementById('projectsList'),
        emptyState: document.getElementById('emptyState'),
        searchInput: document.getElementById('searchInput'),
        totalProjects: document.getElementById('totalProjects'),
        activeProjects: document.getElementById('activeProjects'),
        completedProjects: document.getElementById('completedProjects'),
        projectModal: document.getElementById('projectModal'),
        modalTitle: document.getElementById('modalTitle'),
        projectName: document.getElementById('projectName'),
        projectDesc: document.getElementById('projectDesc'),
        projectStatus: document.getElementById('projectStatus'),
        projectTech: document.getElementById('projectTech'),
        projectPath: document.getElementById('projectPath'),
        projectGithub: document.getElementById('projectGithub'),
        projectLink: document.getElementById('projectLink'),
        projectTags: document.getElementById('projectTags'),
        viewModal: document.getElementById('viewModal'),
        viewStatus: document.getElementById('viewStatus'),
        viewDate: document.getElementById('viewDate'),
        viewTitle: document.getElementById('viewTitle'),
        viewDesc: document.getElementById('viewDesc'),
        viewTags: document.getElementById('viewTags'),
        viewTech: document.getElementById('viewTech'),
        viewTechSection: document.getElementById('viewTechSection'),
        vscodeBtn: document.getElementById('vscodeBtn'),
        githubBtn: document.getElementById('githubBtn'),
        otherBtn: document.getElementById('otherBtn')
    };
}

function initEventListeners() {
    // 添加项目
    document.getElementById('addProjectBtn').addEventListener('click', () => openProjectModal());
    
    // 搜索
    elements.searchInput.addEventListener('input', debounce(renderProjects, 300));
    
    // 筛选
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderProjects();
        });
    });
    
    // 编辑弹窗
    document.getElementById('closeEditor').addEventListener('click', closeProjectModal);
    document.getElementById('cancelProject').addEventListener('click', closeProjectModal);
    document.getElementById('saveProject').addEventListener('click', saveProject);
    
    // 查看弹窗
    document.getElementById('closeView').addEventListener('click', closeViewModal);
    document.getElementById('editProject').addEventListener('click', editCurrentProject);
    document.getElementById('deleteProject').addEventListener('click', deleteCurrentProject);
    
    // VSCode 按钮
    elements.vscodeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const project = projects.find(p => p.id === currentProjectId);
        if (project && project.path) {
            openInVSCode(project.path);
        }
    });
    
    // 点击背景关闭
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            closeProjectModal();
            closeViewModal();
        });
    });
}

// ============================================
// 数据管理
// ============================================

function loadProjects() {
    try {
        const saved = localStorage.getItem(PROJECTS_STORAGE_KEY);
        if (saved) projects = JSON.parse(saved);
    } catch (e) {
        projects = [];
    }
}

function saveProjects() {
    try {
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
        console.warn('保存项目失败:', e);
    }
}

function saveProject() {
    const name = elements.projectName.value.trim();
    if (!name) {
        alert('请输入项目名称');
        return;
    }
    
    const projectData = {
        name,
        description: elements.projectDesc.value.trim(),
        status: elements.projectStatus.value,
        tech: elements.projectTech.value.split(',').map(t => t.trim()).filter(t => t),
        path: elements.projectPath.value.trim(),
        github: elements.projectGithub.value.trim(),
        link: elements.projectLink.value.trim(),
        tags: elements.projectTags.value.split(',').map(t => t.trim()).filter(t => t),
        updatedAt: Date.now()
    };
    
    if (currentProjectId) {
        // 更新
        const index = projects.findIndex(p => p.id === currentProjectId);
        if (index !== -1) {
            projects[index] = { ...projects[index], ...projectData };
        }
    } else {
        // 新建
        projects.unshift({
            id: 'proj_' + Date.now(),
            ...projectData,
            createdAt: Date.now()
        });
        // 添加经验值
        if (window.WebUni && window.WebUni.addXP) {
            window.WebUni.addXP(15);
        }
    }
    
    saveProjects();
    renderProjects();
    updateStats();
    closeProjectModal();
}

function deleteCurrentProject() {
    if (!currentProjectId) return;
    if (confirm('确定要删除这个项目吗？')) {
        projects = projects.filter(p => p.id !== currentProjectId);
        saveProjects();
        renderProjects();
        updateStats();
        closeViewModal();
    }
}

function editCurrentProject() {
    const project = projects.find(p => p.id === currentProjectId);
    if (project) {
        closeViewModal();
        openProjectModal(currentProjectId);
    }
}

// ============================================
// 渲染
// ============================================

function renderProjects() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    let filtered = projects;
    
    // 状态筛选
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.status === currentFilter);
    }
    
    // 搜索筛选
    if (searchTerm) {
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            p.description.toLowerCase().includes(searchTerm) ||
            p.tech.some(t => t.toLowerCase().includes(searchTerm)) ||
            p.tags.some(t => t.toLowerCase().includes(searchTerm))
        );
    }
    
    // 显示/隐藏空状态
    elements.emptyState.classList.toggle('hidden', filtered.length > 0);
    
    // 清除旧卡片
    elements.projectsList.querySelectorAll('.project-card').forEach(card => card.remove());
    
    // 渲染卡片
    filtered.forEach(project => {
        elements.projectsList.appendChild(createProjectCard(project));
    });
}

function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.id = project.id;
    
    const status = PROJECT_STATUS[project.status] || PROJECT_STATUS.active;
    const date = formatDate(project.updatedAt || project.createdAt);
    
    card.innerHTML = `
        <div class="project-card-header">
            <span class="project-status-tag ${status.class}">${status.icon} ${status.name}</span>
            <span class="project-date">${date}</span>
        </div>
        <div class="project-card-body">
            <h3 class="project-card-title">${escapeHtml(project.name)}</h3>
            <p class="project-card-desc">${escapeHtml(project.description || '暂无描述')}</p>
            <div class="project-tech-stack">
                ${project.tech.slice(0, 4).map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}
                ${project.tech.length > 4 ? `<span class="tech-tag">+${project.tech.length - 4}</span>` : ''}
            </div>
        </div>
        <div class="project-card-footer">
            <div class="project-tags">
                ${project.tags.slice(0, 2).map(t => `<span class="project-tag">${escapeHtml(t)}</span>`).join('')}
            </div>
            <div class="project-links">
                ${project.path ? '<span class="project-link-icon" title="VSCode">💻</span>' : ''}
                ${project.github ? '<span class="project-link-icon" title="GitHub">🐙</span>' : ''}
                ${project.link ? '<span class="project-link-icon" title="链接">🔗</span>' : ''}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => openViewModal(project.id));
    return card;
}

function updateStats() {
    elements.totalProjects.textContent = projects.length;
    elements.activeProjects.textContent = projects.filter(p => p.status === 'active').length;
    elements.completedProjects.textContent = projects.filter(p => p.status === 'completed').length;
}

// ============================================
// 弹窗管理
// ============================================

function openProjectModal(projectId = null) {
    currentProjectId = projectId;
    
    if (projectId) {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            elements.modalTitle.textContent = '编辑项目';
            elements.projectName.value = project.name;
            elements.projectDesc.value = project.description || '';
            elements.projectStatus.value = project.status;
            elements.projectTech.value = project.tech.join(', ');
            elements.projectPath.value = project.path || '';
            elements.projectGithub.value = project.github || '';
            elements.projectLink.value = project.link || '';
            elements.projectTags.value = project.tags.join(', ');
        }
    } else {
        elements.modalTitle.textContent = '新建项目';
        elements.projectName.value = '';
        elements.projectDesc.value = '';
        elements.projectStatus.value = 'active';
        elements.projectTech.value = '';
        elements.projectPath.value = '';
        elements.projectGithub.value = '';
        elements.projectLink.value = '';
        elements.projectTags.value = '';
    }
    
    elements.projectModal.classList.remove('hidden');
    elements.projectName.focus();
}

function closeProjectModal() {
    elements.projectModal.classList.add('hidden');
    currentProjectId = null;
}

function openViewModal(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    currentProjectId = projectId;
    const status = PROJECT_STATUS[project.status] || PROJECT_STATUS.active;
    
    elements.viewStatus.textContent = `${status.icon} ${status.name}`;
    elements.viewStatus.className = `view-status ${status.class}`;
    elements.viewDate.textContent = formatDate(project.updatedAt || project.createdAt);
    elements.viewTitle.textContent = project.name;
    elements.viewDesc.textContent = project.description || '暂无描述';
    
    // 标签
    elements.viewTags.innerHTML = project.tags.map(t => 
        `<span class="project-tag">${escapeHtml(t)}</span>`
    ).join('');
    
    // 技术栈
    if (project.tech.length > 0) {
        elements.viewTech.textContent = project.tech.join(', ');
        elements.viewTechSection.style.display = 'block';
    } else {
        elements.viewTechSection.style.display = 'none';
    }
    
    // 链接按钮
    if (project.path) {
        elements.vscodeBtn.classList.remove('hidden');
    } else {
        elements.vscodeBtn.classList.add('hidden');
    }
    
    if (project.github) {
        elements.githubBtn.href = project.github;
        elements.githubBtn.classList.remove('hidden');
    } else {
        elements.githubBtn.classList.add('hidden');
    }
    
    if (project.link) {
        elements.otherBtn.href = project.link;
        elements.otherBtn.classList.remove('hidden');
    } else {
        elements.otherBtn.classList.add('hidden');
    }
    
    elements.viewModal.classList.remove('hidden');
}

function closeViewModal() {
    elements.viewModal.classList.add('hidden');
    currentProjectId = null;
}

// ============================================
// VSCode 集成
// ============================================

function openInVSCode(path) {
    // 使用 vscode:// 协议打开文件夹
    // 格式: vscode://file/路径
    let vscodeUrl;
    
    // 处理 Windows 路径
    if (path.match(/^[A-Za-z]:\\/)) {
        // Windows 路径: C:\path\to\project
        vscodeUrl = `vscode://file/${path.replace(/\\/g, '/')}`;
    } else if (path.startsWith('/')) {
        // Unix 路径: /Users/xxx/project
        vscodeUrl = `vscode://file${path}`;
    } else {
        // 相对路径或其他
        vscodeUrl = `vscode://file/${path}`;
    }
    
    // 尝试打开
    window.location.href = vscodeUrl;
    
    // 提示用户
    setTimeout(() => {
        console.log('正在尝试打开 VSCode:', vscodeUrl);
    }, 100);
}

// ============================================
// 工具函数
// ============================================

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// 导出 API
window.Projects = {
    getProjects: () => projects,
    saveProjects,
    openInVSCode
};
