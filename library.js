/**
 * Web大学 - 我的书架
 * 图书管理功能
 */

// ============================================
// 配置与状态
// ============================================

const BOOKS_STORAGE_KEY = 'webuni_library_books';

// 预设封面颜色
const COVER_COLORS = [
    '#E2C2B3', '#B3D4E2', '#D4E2B3', '#E2B3D4',
    '#E2D4B3', '#B3E2D4', '#D4B3E2', '#C2E2B3',
    '#E2B3C2', '#B3C2E2', '#C2B3E2', '#E2E2B3'
];

// 状态图标映射
const STATUS_ICONS = {
    'want-to-read': '🕐',
    'reading': '📖',
    'finished': '✅'
};

const STATUS_LABELS = {
    'want-to-read': '想读',
    'reading': '在读',
    'finished': '已读'
};

let books = [];
let currentFilter = 'all';
let currentBookId = null;

// ============================================
// DOM 元素
// ============================================

let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    loadBooks();
    initEventListeners();
    renderBooks();
    updateStats();
});

function cacheElements() {
    elements = {
        booksGrid: document.getElementById('booksGrid'),
        emptyState: document.getElementById('emptyState'),
        totalBooks: document.getElementById('totalBooks'),
        readingCount: document.getElementById('readingCount'),
        finishedCount: document.getElementById('finishedCount'),
        addBookBtn: document.getElementById('addBookBtn'),
        addBookModal: document.getElementById('addBookModal'),
        bookDetailModal: document.getElementById('bookDetailModal'),
        // 单本添加表单
        singleForm: document.getElementById('singleForm'),
        importForm: document.getElementById('importForm'),
        bookTitle: document.getElementById('bookTitle'),
        bookAuthor: document.getElementById('bookAuthor'),
        bookGenre: document.getElementById('bookGenre'),
        bookColor: document.getElementById('bookColor'),
        bookSummary: document.getElementById('bookSummary'),
        // 批量导入
        importText: document.getElementById('importText'),
        // 详情弹窗
        detailHeader: document.getElementById('detailHeader'),
        detailGenre: document.getElementById('detailGenre'),
        detailTitle: document.getElementById('detailTitle'),
        detailAuthor: document.getElementById('detailAuthor'),
        detailSummary: document.getElementById('detailSummary'),
        detailRating: document.getElementById('detailRating')
    };
}

// ============================================
// 事件监听
// ============================================

function initEventListeners() {
    // 添加按钮
    elements.addBookBtn.addEventListener('click', openAddModal);
    
    // 筛选按钮
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderBooks();
        });
    });
    
    // 模式切换
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const mode = tab.dataset.mode;
            elements.singleForm.classList.toggle('hidden', mode !== 'single');
            elements.importForm.classList.toggle('hidden', mode !== 'import');
        });
    });
    
    // 添加弹窗按钮
    document.getElementById('cancelAdd').addEventListener('click', closeAddModal);
    document.getElementById('confirmAdd').addEventListener('click', addSingleBook);
    document.getElementById('cancelImport').addEventListener('click', closeAddModal);
    document.getElementById('confirmImport').addEventListener('click', importBooks);
    
    // 详情弹窗
    document.getElementById('closeDetail').addEventListener('click', closeDetailModal);
    document.getElementById('deleteBook').addEventListener('click', deleteCurrentBook);
    
    // 状态按钮
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateBookStatus(currentBookId, btn.dataset.status);
        });
    });
    
    // 评分星星
    elements.detailRating.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.value);
            updateBookRating(currentBookId, rating);
            updateStarDisplay(rating);
        });
    });
    
    // 点击背景关闭弹窗
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            closeAddModal();
            closeDetailModal();
        });
    });
    
    // 随机颜色
    elements.bookColor.value = getRandomColor();
}

// ============================================
// 数据管理
// ============================================

function loadBooks() {
    try {
        const saved = localStorage.getItem(BOOKS_STORAGE_KEY);
        books = saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.warn('Failed to load books:', e);
        books = [];
    }
}

function saveBooks() {
    try {
        localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(books));
    } catch (e) {
        console.warn('Failed to save books:', e);
    }
}

function getRandomColor() {
    return COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];
}

// ============================================
// 书籍操作
// ============================================

function addSingleBook() {
    const title = elements.bookTitle.value.trim();
    if (!title) {
        alert('请输入书名');
        return;
    }
    
    const book = {
        id: Date.now().toString(),
        title,
        author: elements.bookAuthor.value.trim() || '未知作者',
        genre: elements.bookGenre.value,
        coverColor: elements.bookColor.value,
        summary: elements.bookSummary.value.trim() || '暂无简介',
        status: 'want-to-read',
        rating: 0,
        addedAt: Date.now()
    };
    
    books.unshift(book);
    saveBooks();
    renderBooks();
    updateStats();
    closeAddModal();
    clearAddForm();
    
    // 添加XP奖励
    if (window.WebUni && window.WebUni.addXP) {
        window.WebUni.addXP(5);
    }
}

function importBooks() {
    const text = elements.importText.value.trim();
    if (!text) {
        alert('请输入要导入的书籍');
        return;
    }
    
    const lines = text.split('\n').filter(line => line.trim());
    const newBooks = [];
    
    lines.forEach((line, index) => {
        // 尝试解析 "书名 - 作者" 格式
        let title, author;
        if (line.includes(' - ')) {
            [title, author] = line.split(' - ').map(s => s.trim());
        } else if (line.includes('《') && line.includes('》')) {
            const match = line.match(/《(.+?)》/);
            title = match ? match[1] : line.trim();
            author = line.replace(/《.+?》/, '').trim() || '未知作者';
        } else {
            title = line.replace(/^\d+[\.\、\)]?\s*/, '').trim(); // 去掉序号
            author = '未知作者';
        }
        
        if (title) {
            newBooks.push({
                id: Date.now().toString() + '-' + index,
                title,
                author: author || '未知作者',
                genre: '其他',
                coverColor: getRandomColor(),
                summary: '暂无简介',
                status: 'want-to-read',
                rating: 0,
                addedAt: Date.now()
            });
        }
    });
    
    if (newBooks.length > 0) {
        books = [...newBooks, ...books];
        saveBooks();
        renderBooks();
        updateStats();
        closeAddModal();
        elements.importText.value = '';
        
        // 添加XP奖励
        if (window.WebUni && window.WebUni.addXP) {
            window.WebUni.addXP(newBooks.length * 3);
        }
        
        alert(`成功导入 ${newBooks.length} 本书！`);
    }
}

function updateBookStatus(id, status) {
    const book = books.find(b => b.id === id);
    if (book) {
        const wasFinished = book.status === 'finished';
        book.status = status;
        saveBooks();
        renderBooks();
        updateStats();
        
        // 完成阅读奖励XP
        if (status === 'finished' && !wasFinished) {
            if (window.WebUni && window.WebUni.addXP) {
                window.WebUni.addXP(20);
            }
        }
    }
}

function updateBookRating(id, rating) {
    const book = books.find(b => b.id === id);
    if (book) {
        book.rating = rating;
        saveBooks();
        renderBooks();
    }
}

function deleteCurrentBook() {
    if (!currentBookId) return;
    
    if (confirm('确定要删除这本书吗？')) {
        books = books.filter(b => b.id !== currentBookId);
        saveBooks();
        renderBooks();
        updateStats();
        closeDetailModal();
    }
}

// ============================================
// 渲染
// ============================================

function renderBooks() {
    const filtered = currentFilter === 'all' 
        ? books 
        : books.filter(b => b.status === currentFilter);
    
    // 显示/隐藏空状态
    elements.emptyState.classList.toggle('hidden', filtered.length > 0);
    
    // 清空现有卡片（保留空状态）
    const existingCards = elements.booksGrid.querySelectorAll('.book-card');
    existingCards.forEach(card => card.remove());
    
    // 渲染书籍卡片
    filtered.forEach(book => {
        const card = createBookCard(book);
        elements.booksGrid.appendChild(card);
    });
}

function createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.dataset.id = book.id;
    
    card.innerHTML = `
        <div class="book-cover" style="background: linear-gradient(135deg, ${book.coverColor}, ${adjustColor(book.coverColor, -20)})">
            <span class="book-genre-tag">${book.genre}</span>
            <span class="book-status-icon">${STATUS_ICONS[book.status]}</span>
        </div>
        <div class="book-info">
            <h3 class="book-title">${escapeHtml(book.title)}</h3>
            <p class="book-author">${escapeHtml(book.author)}</p>
            <p class="book-summary">${escapeHtml(book.summary)}</p>
            <div class="book-footer">
                <span class="book-status">${STATUS_ICONS[book.status]} ${STATUS_LABELS[book.status]}</span>
                <div class="book-rating">
                    ${renderStars(book.rating)}
                </div>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => openDetailModal(book.id));
    
    return card;
}

function renderStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`;
    }
    return html;
}

function updateStarDisplay(rating) {
    elements.detailRating.querySelectorAll('.star').forEach((star, index) => {
        star.classList.toggle('filled', index < rating);
    });
}

function updateStats() {
    elements.totalBooks.textContent = books.length;
    elements.readingCount.textContent = books.filter(b => b.status === 'reading').length;
    elements.finishedCount.textContent = books.filter(b => b.status === 'finished').length;
}

// ============================================
// 弹窗控制
// ============================================

function openAddModal() {
    elements.addBookModal.classList.remove('hidden');
    elements.bookColor.value = getRandomColor();
}

function closeAddModal() {
    elements.addBookModal.classList.add('hidden');
    clearAddForm();
}

function clearAddForm() {
    elements.bookTitle.value = '';
    elements.bookAuthor.value = '';
    elements.bookGenre.value = '小说';
    elements.bookSummary.value = '';
    elements.importText.value = '';
    
    // 重置到单本模式
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.mode-tab[data-mode="single"]').classList.add('active');
    elements.singleForm.classList.remove('hidden');
    elements.importForm.classList.add('hidden');
}

function openDetailModal(bookId) {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    
    currentBookId = bookId;
    
    // 填充详情
    elements.detailHeader.style.background = `linear-gradient(135deg, ${book.coverColor}, ${adjustColor(book.coverColor, -20)})`;
    elements.detailGenre.textContent = book.genre;
    elements.detailTitle.textContent = book.title;
    elements.detailAuthor.textContent = book.author;
    elements.detailSummary.textContent = book.summary;
    
    // 更新状态按钮
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === book.status);
    });
    
    // 更新评分
    updateStarDisplay(book.rating);
    
    elements.bookDetailModal.classList.remove('hidden');
}

function closeDetailModal() {
    elements.bookDetailModal.classList.add('hidden');
    currentBookId = null;
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
    // 调整颜色亮度
    let color = hex.replace('#', '');
    let num = parseInt(color, 16);
    let r = Math.min(255, Math.max(0, (num >> 16) + amount));
    let g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    let b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}
