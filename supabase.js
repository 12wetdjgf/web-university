/**
 * Supabase 数据同步服务
 * Web大学 - 云端数据存储
 */

// Supabase 配置
const SUPABASE_URL = 'https://vbevhdctcefubcmeyura.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZXZoZGN0Y2VmdWJjbWV5dXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MTA1MzksImV4cCI6MjA4MTk4NjUzOX0.ChnehmhyzmvJfP6960kdGrKjkmg-n5GoFzKxkt69cr8';

// 设备唯一ID（用于标识用户）
const DEVICE_ID_KEY = 'webuni_device_id';

/**
 * 获取或创建设备ID
 */
function getDeviceId() {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}

/**
 * Supabase API 请求封装
 */
async function supabaseRequest(endpoint, method = 'GET', body = null) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
    };

    const options = {
        method,
        headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    } catch (error) {
        console.error('Supabase request error:', error);
        throw error;
    }
}

/**
 * 云端数据服务
 */
const CloudStorage = {
    deviceId: getDeviceId(),
    isOnline: navigator.onLine,
    syncQueue: [],

    /**
     * 初始化 - 监听网络状态
     */
    init() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('📶 网络已连接，开始同步...');
            this.processSyncQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📴 网络已断开，使用离线模式');
        });

        // 页面加载时同步数据
        if (this.isOnline) {
            this.syncAllData();
        }
    },

    /**
     * 保存数据到云端
     */
    async saveToCloud(dataType, data) {
        if (!this.isOnline) {
            this.syncQueue.push({ dataType, data, action: 'save' });
            console.log(`💾 已加入同步队列: ${dataType}`);
            return false;
        }

        try {
            // 检查是否已存在
            const existing = await supabaseRequest(
                `user_data?device_id=eq.${this.deviceId}&data_type=eq.${dataType}&select=id`,
                'GET'
            );

            if (existing && existing.length > 0) {
                // 更新现有记录
                await supabaseRequest(
                    `user_data?device_id=eq.${this.deviceId}&data_type=eq.${dataType}`,
                    'PATCH',
                    {
                        data: data,
                        updated_at: new Date().toISOString()
                    }
                );
            } else {
                // 创建新记录
                await supabaseRequest('user_data', 'POST', {
                    device_id: this.deviceId,
                    data_type: dataType,
                    data: data,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }

            console.log(`☁️ 已同步到云端: ${dataType}`);
            return true;
        } catch (error) {
            console.error(`❌ 同步失败: ${dataType}`, error);
            this.syncQueue.push({ dataType, data, action: 'save' });
            return false;
        }
    },

    /**
     * 从云端加载数据
     */
    async loadFromCloud(dataType) {
        if (!this.isOnline) {
            console.log(`📴 离线模式，使用本地数据: ${dataType}`);
            return null;
        }

        try {
            const result = await supabaseRequest(
                `user_data?device_id=eq.${this.deviceId}&data_type=eq.${dataType}&select=data`,
                'GET'
            );

            if (result && result.length > 0) {
                console.log(`☁️ 已从云端加载: ${dataType}`);
                return result[0].data;
            }
            return null;
        } catch (error) {
            console.error(`❌ 加载失败: ${dataType}`, error);
            return null;
        }
    },

    /**
     * 处理同步队列
     */
    async processSyncQueue() {
        while (this.syncQueue.length > 0 && this.isOnline) {
            const item = this.syncQueue.shift();
            if (item.action === 'save') {
                await this.saveToCloud(item.dataType, item.data);
            }
        }
    },

    /**
     * 同步所有数据到云端
     */
    async syncAllData() {
        const dataKeys = [
            { key: 'webuni_user', type: 'user' },
            { key: 'webuni_notes', type: 'notes' },
            { key: 'webuni_tasks', type: 'tasks' },
            { key: 'webuni_feed', type: 'feed' },
            { key: 'webuni_projects', type: 'projects' },
            { key: 'webuni_courses', type: 'courses' },
            { key: 'webuni_books', type: 'books' },
            { key: 'webuni_focus', type: 'focus' },
            { key: 'webuni_teacher_chat', type: 'chat' },
            { key: 'webuni_teacher_settings', type: 'teacher_settings' }
        ];

        console.log('🔄 开始同步所有数据...');

        for (const { key, type } of dataKeys) {
            const localData = localStorage.getItem(key);
            if (localData) {
                try {
                    const data = JSON.parse(localData);
                    await this.saveToCloud(type, data);
                } catch (e) {
                    console.error(`解析本地数据失败: ${key}`, e);
                }
            }
        }

        console.log('✅ 数据同步完成');
    },

    /**
     * 从云端恢复所有数据
     */
    async restoreAllData() {
        const dataKeys = [
            { key: 'webuni_user', type: 'user' },
            { key: 'webuni_notes', type: 'notes' },
            { key: 'webuni_tasks', type: 'tasks' },
            { key: 'webuni_feed', type: 'feed' },
            { key: 'webuni_projects', type: 'projects' },
            { key: 'webuni_courses', type: 'courses' },
            { key: 'webuni_books', type: 'books' },
            { key: 'webuni_focus', type: 'focus' },
            { key: 'webuni_teacher_chat', type: 'chat' },
            { key: 'webuni_teacher_settings', type: 'teacher_settings' }
        ];

        console.log('🔄 开始从云端恢复数据...');

        for (const { key, type } of dataKeys) {
            const cloudData = await this.loadFromCloud(type);
            if (cloudData) {
                localStorage.setItem(key, JSON.stringify(cloudData));
                console.log(`✅ 已恢复: ${key}`);
            }
        }

        console.log('✅ 数据恢复完成，请刷新页面');
    },

    /**
     * 获取设备ID（用于跨设备同步）
     */
    getDeviceCode() {
        return this.deviceId;
    },

    /**
     * 使用设备码恢复数据
     */
    async restoreByDeviceCode(code) {
        const originalDeviceId = this.deviceId;
        this.deviceId = code;

        try {
            await this.restoreAllData();
            localStorage.setItem(DEVICE_ID_KEY, code);
            return true;
        } catch (error) {
            this.deviceId = originalDeviceId;
            console.error('恢复失败:', error);
            return false;
        }
    }
};

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    CloudStorage.init();
});

// 导出供其他模块使用
window.CloudStorage = CloudStorage;
