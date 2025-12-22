-- ============================================
-- Web大学 - Supabase 数据库表结构
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 创建用户数据表
CREATE TABLE IF NOT EXISTS user_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL,
    data_type TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_user_data_device_id ON user_data(device_id);
CREATE INDEX IF NOT EXISTS idx_user_data_type ON user_data(data_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_data_unique ON user_data(device_id, data_type);

-- 启用 RLS (Row Level Security) - 可选，用于更安全的访问控制
-- ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- 创建策略允许匿名用户读写自己的数据
-- CREATE POLICY "Users can read own data" ON user_data
--     FOR SELECT USING (true);

-- CREATE POLICY "Users can insert own data" ON user_data
--     FOR INSERT WITH CHECK (true);

-- CREATE POLICY "Users can update own data" ON user_data
--     FOR UPDATE USING (true);

-- CREATE POLICY "Users can delete own data" ON user_data
--     FOR DELETE USING (true);

-- 为了简单起见，我们允许匿名访问（anon key 已有限制）
-- 如果你想要更严格的安全性，可以启用上面的 RLS 策略

-- 查看表是否创建成功
SELECT * FROM user_data LIMIT 1;
