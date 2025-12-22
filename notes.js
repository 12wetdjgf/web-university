/**
 * Web大学 - 笔记系统
 * Markdown编辑 + 课程/任务关联
 */

const NOTES_STORAGE_KEY = 'webuni_notes';

const NOTE_TYPES = {
    general: { icon: '📌', name: '通用', color: '#95A5A6' },
    course: { icon: '📚', name: '课程', color: '#4A90D9' },
    task: { icon: '📅', name: '任务', color: '#E67E22' },
    study: { icon: '🧘', name: '自习', color: '#27AE60' }
};

let notes = [];
let currentFilter = 'all';
let currentNoteId = null;
let isPreviewMode = false;
let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    loadNotes();
    initEventListeners();
    renderNotes();
    updateStats();
});

function cacheElements() {
    elements = {
        notesList: document.getElementById('notesList'),
        emptyState: document.getElementById('emptyState'),
        searchInput: document.getElementById('searchInput'),
        totalNotes: document.getElementById('totalNotes'),
        courseNotes: document.getElementById('courseNotes'),
        taskNotes: document.getElementById('taskNotes'),
        noteModal: document.getElementById('noteModal'),
        noteTitle: document.getElementById('noteTitle'),
        noteContent: document.getElementById('noteContent'),
        notePreview: document.getElementById('notePreview'),
        noteType: document.getElementById('noteType'),
        noteLink: document.getElementById('noteLink'),
        linkRow: document.getElementById('linkRow'),
        noteTags: document.getElementById('noteTags'),
        viewModal: document.getElementById('viewModal'),
        viewType: document.getElementById('viewType'),
        viewDate: document.getElementById('viewDate'),
        viewTitle: document.getElementById('viewTitle'),
        viewTags: document.getElementById('viewTags'),
        viewLink: document.getElementById('viewLink'),
        viewLinkSection: document.getElementById('viewLinkSection'),
        viewContent: document.getElementById('viewContent')
    };
}

function initEventListeners() {
    document.getElementById('addNoteBtn').addEventListener('click', () => openNoteModal());
    elements.searchInput.addEventListener('input', debounce(renderNotes, 300));
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderNotes();
        });
    });
    
    document.querySelectorAll('.toolbar-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', () => handleToolbarAction(btn.dataset.action));
    });
    
    document.getElementById('togglePreview').addEventListener('click', togglePreview);
    elements.noteType.addEventListener('change', handleTypeChange);
    document.getElementById('closeEditor').addEventListener('click', closeNoteModal);
    document.getElementById('cancelNote').addEventListener('click', closeNoteModal);
    document.getElementById('saveNote').addEventListener('click', saveNote);
    document.getElementById('closeView').addEventListener('click', closeViewModal);
    document.getElementById('editNote').addEventListener('click', editCurrentNote);
    document.getElementById('deleteNote').addEventListener('click', deleteCurrentNote);
    
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            closeNoteModal();
            closeViewModal();
        });
    });
}

function loadNotes() {
    try {
        const saved = localStorage.getItem(NOTES_STORAGE_KEY);
        if (saved) notes = JSON.parse(saved);
    } catch (e) {
        notes = [];
    }
}

function saveNotes() {
    try {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    } catch (e) {}
}


function saveNote() {
    const title = elements.noteTitle.value.trim();
    const content = elements.noteContent.value.trim();
    if (!title) { alert('请输入笔记标题'); return; }
    
    const noteData = {
        title, content,
        type: elements.noteType.value,
        linkId: elements.noteLink.value || null,
        linkName: elements.noteLink.value ? elements.noteLink.options[elements.noteLink.selectedIndex].text : null,
        tags: elements.noteTags.value.split(',').map(t => t.trim()).filter(t => t),
        updatedAt: Date.now()
    };
    
    if (currentNoteId) {
        const index = notes.findIndex(n => n.id === currentNoteId);
        if (index !== -1) notes[index] = { ...notes[index], ...noteData };
    } else {
        notes.unshift({ id: 'note_' + Date.now(), ...noteData, createdAt: Date.now() });
        if (window.WebUni && window.WebUni.addXP) window.WebUni.addXP(10);
    }
    
    saveNotes(); renderNotes(); updateStats(); closeNoteModal();
}

function deleteCurrentNote() {
    if (!currentNoteId) return;
    if (confirm('确定要删除这篇笔记吗？')) {
        notes = notes.filter(n => n.id !== currentNoteId);
        saveNotes(); renderNotes(); updateStats(); closeViewModal();
    }
}

function editCurrentNote() {
    const note = notes.find(n => n.id === currentNoteId);
    if (note) { closeViewModal(); openNoteModal(currentNoteId); }
}

function renderNotes() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    let filtered = notes;
    
    if (currentFilter !== 'all') filtered = filtered.filter(n => n.type === currentFilter);
    if (searchTerm) {
        filtered = filtered.filter(n => 
            n.title.toLowerCase().includes(searchTerm) ||
            n.content.toLowerCase().includes(searchTerm) ||
            n.tags.some(t => t.toLowerCase().includes(searchTerm))
        );
    }
    
    elements.emptyState.classList.toggle('hidden', filtered.length > 0);
    elements.notesList.querySelectorAll('.note-card').forEach(card => card.remove());
    filtered.forEach(note => elements.notesList.appendChild(createNoteCard(note)));
}

function createNoteCard(note) {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.id = note.id;
    card.dataset.type = note.type;
    
    const type = NOTE_TYPES[note.type] || NOTE_TYPES.general;
    const date = formatDate(note.updatedAt || note.createdAt);
    const preview = getContentPreview(note.content);
    
    card.innerHTML = `
        <div class="note-card-header">
            <span class="note-type-tag">${type.icon} ${type.name}</span>
            <span class="note-date">${date}</span>
        </div>
        <div class="note-card-body">
            <h3 class="note-card-title">${escapeHtml(note.title)}</h3>
            <p class="note-card-preview">${escapeHtml(preview)}</p>
        </div>
        <div class="note-card-footer">
            <div class="note-tags">${note.tags.slice(0, 3).map(t => `<span class="note-tag">${escapeHtml(t)}</span>`).join('')}</div>
            ${note.linkName ? `<span class="note-link-badge">🔗 ${escapeHtml(note.linkName)}</span>` : ''}
        </div>
    `;
    card.addEventListener('click', () => openViewModal(note.id));
    return card;
}

function updateStats() {
    elements.totalNotes.textContent = notes.length;
    elements.courseNotes.textContent = notes.filter(n => n.type === 'course').length;
    elements.taskNotes.textContent = notes.filter(n => n.type === 'task').length;
}


function openNoteModal(noteId = null) {
    currentNoteId = noteId;
    isPreviewMode = false;
    elements.notePreview.classList.add('hidden');
    elements.noteContent.style.display = 'block';
    document.getElementById('togglePreview').classList.remove('active');
    
    if (noteId) {
        const note = notes.find(n => n.id === noteId);
        if (note) {
            elements.noteTitle.value = note.title;
            elements.noteContent.value = note.content;
            elements.noteType.value = note.type;
            elements.noteTags.value = note.tags.join(', ');
            handleTypeChange();
            if (note.linkId) setTimeout(() => { elements.noteLink.value = note.linkId; }, 100);
        }
    } else {
        elements.noteTitle.value = '';
        elements.noteContent.value = '';
        elements.noteType.value = 'general';
        elements.noteTags.value = '';
        elements.linkRow.classList.add('hidden');
    }
    elements.noteModal.classList.remove('hidden');
    elements.noteTitle.focus();
}

function closeNoteModal() { elements.noteModal.classList.add('hidden'); currentNoteId = null; }

function openViewModal(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    currentNoteId = noteId;
    const type = NOTE_TYPES[note.type] || NOTE_TYPES.general;
    
    elements.viewType.textContent = `${type.icon} ${type.name}`;
    elements.viewDate.textContent = formatDate(note.updatedAt || note.createdAt);
    elements.viewTitle.textContent = note.title;
    elements.viewTags.innerHTML = note.tags.map(t => `<span class="note-tag">${escapeHtml(t)}</span>`).join('');
    
    if (note.linkName) {
        elements.viewLink.textContent = note.linkName;
        elements.viewLinkSection.classList.remove('hidden');
    } else {
        elements.viewLinkSection.classList.add('hidden');
    }
    
    elements.viewContent.innerHTML = parseMarkdown(note.content);
    elements.viewModal.classList.remove('hidden');
}

function closeViewModal() { elements.viewModal.classList.add('hidden'); currentNoteId = null; }

function handleTypeChange() {
    const type = elements.noteType.value;
    if (type === 'general') {
        elements.linkRow.classList.add('hidden');
        return;
    }
    
    elements.linkRow.classList.remove('hidden');
    elements.noteLink.innerHTML = '<option value="">选择关联...</option>';
    
    if (type === 'course') {
        const courses = JSON.parse(localStorage.getItem('webuni_courses') || '[]');
        courses.forEach(c => {
            elements.noteLink.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    } else if (type === 'task') {
        const tasks = JSON.parse(localStorage.getItem('webuni_tasks') || '[]');
        tasks.forEach(t => {
            elements.noteLink.innerHTML += `<option value="${t.id}">${t.title}</option>`;
        });
    } else if (type === 'study') {
        elements.noteLink.innerHTML += '<option value="pomodoro">番茄钟专注</option>';
    }
}

function togglePreview() {
    isPreviewMode = !isPreviewMode;
    const btn = document.getElementById('togglePreview');
    
    if (isPreviewMode) {
        elements.notePreview.innerHTML = parseMarkdown(elements.noteContent.value);
        elements.notePreview.classList.remove('hidden');
        elements.noteContent.style.display = 'none';
        btn.classList.add('active');
    } else {
        elements.notePreview.classList.add('hidden');
        elements.noteContent.style.display = 'block';
        btn.classList.remove('active');
    }
}

function handleToolbarAction(action) {
    const textarea = elements.noteContent;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    
    let insert = '';
    let cursorOffset = 0;
    
    switch (action) {
        case 'bold': insert = `**${selected || '粗体文字'}**`; cursorOffset = selected ? 0 : -2; break;
        case 'italic': insert = `*${selected || '斜体文字'}*`; cursorOffset = selected ? 0 : -1; break;
        case 'heading': insert = `\n## ${selected || '标题'}\n`; break;
        case 'list': insert = `\n- ${selected || '列表项'}\n`; break;
        case 'code': insert = selected.includes('\n') ? `\n\`\`\`\n${selected || '代码'}\n\`\`\`\n` : `\`${selected || '代码'}\``; break;
        case 'link': insert = `[${selected || '链接文字'}](url)`; break;
    }
    
    textarea.value = text.substring(0, start) + insert + text.substring(end);
    textarea.focus();
    const newPos = start + insert.length + cursorOffset;
    textarea.setSelectionRange(newPos, newPos);
}


// 简单的Markdown解析器
function parseMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/^\- (.+)$/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
        .replace(/\n/g, '<br>');
}

function getContentPreview(content) {
    if (!content) return '暂无内容';
    return content.replace(/[#*`\[\]()-]/g, '').substring(0, 100);
}

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

// 导出API供其他页面使用
window.Notes = {
    getNotes: () => notes,
    saveNotes,
    createQuickNote: (title, content, type = 'general', linkId = null, linkName = null) => {
        const note = {
            id: 'note_' + Date.now(),
            title, content, type, linkId, linkName,
            tags: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        notes.unshift(note);
        saveNotes();
        return note;
    }
};
