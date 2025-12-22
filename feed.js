/**
 * Web大学 - 信息流系统
 * 博客发布 + 笔记共享 + 未来外部源集成
 */

const FEED_STORAGE_KEY = 'webuni_feed';

const FEED_TYPES = {
    post: { icon: '📝', name: '原创', color: '#4A90D9' },
    share: { icon: '🔗', name: '共享笔记', color: '#27AE60' },
    external: { icon: '📡', name: '外部', color: '#9B59B6' }
};

let feedItems = [];
let currentTab = 'feed';
let currentPostId = null;
let currentPostType = 'post';
let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    loadFeed();
    initEventListeners();
    renderFeed();
    updateStats();
});

function cacheElements() {
    elements = {
        feedList: document.getElementById('feedList'),
        emptyState: document.getElementById('emptyState'),
        totalPosts: document.getElementById('totalPosts'),
        sharedNotes: document.getElementById('sharedNotes'),
        externalFeeds: document.getElementById('externalFeeds'),
        postModal: document.getElementById('postModal'),
        postForm: document.getElementById('postForm'),
        shareForm: document.getElementById('shareForm'),
        postTitle: document.getElementById('postTitle'),
        postContent: document.getElementById('postContent'),
        postTags: document.getElementById('postTags'),
        noteSelector: document.getElementById('noteSelector'),
        sharePreview: document.getElementById('sharePreview'),
        previewTitle: document.getElementById('previewTitle'),
        previewContent: document.getElementById('previewContent'),
        shareComment: document.getElementById('shareComment'),
        viewModal: document.getElementById('viewModal'),
        viewType: document.getElementById('viewType'),
        viewDate: document.getElementById('viewDate'),
        viewTitle: document.getElementById('viewTitle'),
        viewTags: document.getElementById('viewTags'),
        viewContent: document.getElementById('viewContent'),
        viewSource: document.getElementById('viewSource'),
        sourceLink: document.getElementById('sourceLink')
    };
}

function initEventListeners() {
    // 发布按钮
    document.getElementById('addPostBtn').addEventListener('click', () => openPostModal());
    
    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            renderFeed();
        });
    });
    
    // 类型选择器
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPostType = btn.dataset.type;
            togglePostForm();
        });
    });
    
    // 笔记选择器
    elements.noteSelector.addEventListener('change', handleNoteSelect);
    
    // 弹窗操作
    document.getElementById('closeEditor').addEventListener('click', closePostModal);
    document.getElementById('cancelPost').addEventListener('click', closePostModal);
    document.getElementById('publishPost').addEventListener('click', publishPost);
    document.getElementById('closeView').addEventListener('click', closeViewModal);
    document.getElementById('deletePost').addEventListener('click', deleteCurrentPost);
    
    // 背景点击关闭
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            closePostModal();
            closeViewModal();
        });
    });
}

function loadFeed() {
    try {
        const saved = localStorage.getItem(FEED_STORAGE_KEY);
        if (saved) feedItems = JSON.parse(saved);
    } catch (e) {
        feedItems = [];
    }
}

function saveFeed() {
    try {
        localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(feedItems));
    } catch (e) {}
}

function togglePostForm() {
    if (currentPostType === 'post') {
        elements.postForm.classList.remove('hidden');
        elements.shareForm.classList.add('hidden');
    } else {
        elements.postForm.classList.add('hidden');
        elements.shareForm.classList.remove('hidden');
        loadNotesForSharing();
    }
}

function loadNotesForSharing() {
    const notes = JSON.parse(localStorage.getItem('webuni_notes') || '[]');
    elements.noteSelector.innerHTML = '<option value="">-- 选择笔记 --</option>';
    notes.forEach(note => {
        elements.noteSelector.innerHTML += `<option value="${note.id}">${note.title}</option>`;
    });
}

function handleNoteSelect() {
    const noteId = elements.noteSelector.value;
    if (!noteId) {
        elements.sharePreview.classList.add('hidden');
        return;
    }
    
    const notes = JSON.parse(localStorage.getItem('webuni_notes') || '[]');
    const note = notes.find(n => n.id === noteId);
    
    if (note) {
        elements.previewTitle.textContent = note.title;
        elements.previewContent.textContent = note.content || '暂无内容';
        elements.sharePreview.classList.remove('hidden');
    }
}

function openPostModal() {
    currentPostType = 'post';
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.type-btn[data-type="post"]').classList.add('active');
    
    elements.postTitle.value = '';
    elements.postContent.value = '';
    elements.postTags.value = '';
    elements.noteSelector.value = '';
    elements.shareComment.value = '';
    elements.sharePreview.classList.add('hidden');
    
    togglePostForm();
    elements.postModal.classList.remove('hidden');
}

function closePostModal() {
    elements.postModal.classList.add('hidden');
}

function publishPost() {
    let postData;
    
    if (currentPostType === 'post') {
        const content = elements.postContent.value.trim();
        if (!content) {
            alert('请输入内容');
            return;
        }
        
        postData = {
            id: 'feed_' + Date.now(),
            type: 'post',
            title: elements.postTitle.value.trim() || null,
            content: content,
            tags: elements.postTags.value.split(',').map(t => t.trim()).filter(t => t),
            createdAt: Date.now()
        };
    } else {
        const noteId = elements.noteSelector.value;
        if (!noteId) {
            alert('请选择要共享的笔记');
            return;
        }
        
        const notes = JSON.parse(localStorage.getItem('webuni_notes') || '[]');
        const note = notes.find(n => n.id === noteId);
        
        if (!note) {
            alert('笔记不存在');
            return;
        }
        
        postData = {
            id: 'feed_' + Date.now(),
            type: 'share',
            title: note.title,
            content: note.content,
            comment: elements.shareComment.value.trim() || null,
            sourceNoteId: noteId,
            sourceNoteTitle: note.title,
            tags: note.tags || [],
            createdAt: Date.now()
        };
    }
    
    feedItems.unshift(postData);
    saveFeed();
    
    // 添加经验值
    if (window.WebUni && window.WebUni.addXP) {
        window.WebUni.addXP(15);
    }
    
    renderFeed();
    updateStats();
    closePostModal();
}

function deleteCurrentPost() {
    if (!currentPostId) return;
    if (confirm('确定要删除这条内容吗？')) {
        feedItems = feedItems.filter(item => item.id !== currentPostId);
        saveFeed();
        renderFeed();
        updateStats();
        closeViewModal();
    }
}

function renderFeed() {
    let filtered = feedItems;
    
    // 根据标签页筛选
    if (currentTab === 'shared') {
        filtered = filtered.filter(item => item.type === 'share');
    } else if (currentTab === 'my') {
        filtered = filtered.filter(item => item.type === 'post');
    }
    
    elements.emptyState.classList.toggle('hidden', filtered.length > 0);
    elements.feedList.querySelectorAll('.feed-card').forEach(card => card.remove());
    filtered.forEach(item => elements.feedList.appendChild(createFeedCard(item)));
}

function createFeedCard(item) {
    const card = document.createElement('div');
    card.className = 'feed-card';
    card.dataset.id = item.id;
    card.dataset.type = item.type;
    
    const type = FEED_TYPES[item.type] || FEED_TYPES.post;
    const date = formatDate(item.createdAt);
    const title = item.title || (item.content ? item.content.substring(0, 50) : '无标题');
    const preview = item.comment || item.content || '';
    
    card.innerHTML = `
        <div class="feed-card-header">
            <span class="feed-type-tag">${type.icon} ${type.name}</span>
            <span class="feed-date">${date}</span>
        </div>
        <div class="feed-card-body">
            <h3 class="feed-card-title">${escapeHtml(title)}</h3>
            <p class="feed-card-preview">${escapeHtml(preview.substring(0, 150))}</p>
        </div>
        <div class="feed-card-footer">
            <div class="feed-tags">
                ${item.tags.slice(0, 3).map(t => `<span class="feed-tag">${escapeHtml(t)}</span>`).join('')}
            </div>
            ${item.sourceNoteTitle ? `<span class="feed-source-badge">📝 ${escapeHtml(item.sourceNoteTitle)}</span>` : ''}
        </div>
    `;
    
    card.addEventListener('click', () => openViewModal(item.id));
    return card;
}

function openViewModal(itemId) {
    const item = feedItems.find(i => i.id === itemId);
    if (!item) return;
    
    currentPostId = itemId;
    const type = FEED_TYPES[item.type] || FEED_TYPES.post;
    
    elements.viewType.textContent = `${type.icon} ${type.name}`;
    elements.viewDate.textContent = formatDate(item.createdAt);
    elements.viewTitle.textContent = item.title || '无标题';
    elements.viewTags.innerHTML = item.tags.map(t => `<span class="feed-tag">${escapeHtml(t)}</span>`).join('');
    
    let content = item.content || '';
    if (item.comment) {
        content = `💬 ${item.comment}\n\n---\n\n${content}`;
    }
    elements.viewContent.textContent = content;
    
    if (item.sourceNoteId) {
        elements.sourceLink.textContent = item.sourceNoteTitle;
        elements.sourceLink.href = `notes.html#${item.sourceNoteId}`;
        elements.viewSource.classList.remove('hidden');
    } else {
        elements.viewSource.classList.add('hidden');
    }
    
    elements.viewModal.classList.remove('hidden');
}

function closeViewModal() {
    elements.viewModal.classList.add('hidden');
    currentPostId = null;
}

function updateStats() {
    elements.totalPosts.textContent = feedItems.length;
    elements.sharedNotes.textContent = feedItems.filter(i => i.type === 'share').length;
    elements.externalFeeds.textContent = feedItems.filter(i => i.type === 'external').length;
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
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 导出API供其他页面使用
window.Feed = {
    getFeed: () => feedItems,
    addPost: (title, content, tags = []) => {
        const post = {
            id: 'feed_' + Date.now(),
            type: 'post',
            title, content, tags,
            createdAt: Date.now()
        };
        feedItems.unshift(post);
        saveFeed();
        return post;
    },
    shareNote: (noteId) => {
        const notes = JSON.parse(localStorage.getItem('webuni_notes') || '[]');
        const note = notes.find(n => n.id === noteId);
        if (!note) return null;
        
        const share = {
            id: 'feed_' + Date.now(),
            type: 'share',
            title: note.title,
            content: note.content,
            sourceNoteId: noteId,
            sourceNoteTitle: note.title,
            tags: note.tags || [],
            createdAt: Date.now()
        };
        feedItems.unshift(share);
        saveFeed();
        return share;
    }
};
