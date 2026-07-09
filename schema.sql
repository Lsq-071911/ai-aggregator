-- ============================================================
-- AI聚合大模型 — 数据库 Schema
-- Supabase PostgreSQL
-- ============================================================

-- 0. 扩展 & 工具函数
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 自动更新 updated_at 触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 1. members 表 — 用户会员信息
-- ============================================================
CREATE TABLE IF NOT EXISTS members (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    level         TEXT NOT NULL DEFAULT 'free'       CHECK (level IN ('free', 'vip_month', 'vip_year')),
    daily_usage   INTEGER NOT NULL DEFAULT 0,
    daily_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    expires_at    TIMESTAMPTZ,
    activated_codes TEXT[] DEFAULT '{}',
    is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE members IS '用户会员信息';
COMMENT ON COLUMN members.level IS '会员等级: free/vip_month/vip_year';
COMMENT ON COLUMN members.daily_usage IS '今日 API 调用次数';
COMMENT ON COLUMN members.daily_date IS '使用日期（用于每日重置判断）';
COMMENT ON COLUMN members.expires_at IS 'VIP 到期时间';
COMMENT ON COLUMN members.activated_codes IS '已激活的会员码列表';
COMMENT ON COLUMN members.is_admin IS '是否为管理员';

CREATE INDEX idx_members_level ON members(level);
CREATE INDEX idx_members_expires ON members(expires_at);

-- 创建新用户时自动插入 members 记录
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO members (id, level, daily_usage, daily_date)
    VALUES (NEW.id, 'free', 0, CURRENT_DATE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 如果触发器已存在则替换
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER trg_members_updated_at
    BEFORE UPDATE ON members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可读取自己的会员信息"
    ON members FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "用户可更新自己的会员信息"
    ON members FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "管理员可读取所有会员信息"
    ON members FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.is_admin = TRUE));

CREATE POLICY "管理员可更新所有会员信息"
    ON members FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.is_admin = TRUE));


-- ============================================================
-- 2. vip_codes 表 — 会员激活码
-- ============================================================
CREATE TABLE IF NOT EXISTS vip_codes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code          TEXT NOT NULL UNIQUE,
    level         TEXT NOT NULL CHECK (level IN ('vip_month', 'vip_year')),
    duration_days INTEGER NOT NULL DEFAULT 30,
    is_used       BOOLEAN NOT NULL DEFAULT FALSE,
    used_by       UUID REFERENCES auth.users(id),
    used_at       TIMESTAMPTZ,
    created_by    UUID REFERENCES auth.users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE vip_codes IS '会员激活码';
COMMENT ON COLUMN vip_codes.code IS '12位随机码，唯一';
COMMENT ON COLUMN vip_codes.duration_days IS '有效天数';
COMMENT ON COLUMN vip_codes.used_by IS '使用该码的用户ID';

CREATE INDEX idx_vip_codes_code ON vip_codes(code);
CREATE INDEX idx_vip_codes_used ON vip_codes(is_used);

-- RLS
ALTER TABLE vip_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "所有认证用户可查看会员码"
    ON vip_codes FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "管理员可插入会员码"
    ON vip_codes FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.is_admin = TRUE));

CREATE POLICY "管理员可更新会员码"
    ON vip_codes FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.is_admin = TRUE));


-- ============================================================
-- 3. conversations 表 — 对话记录
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title         TEXT NOT NULL DEFAULT '新对话',
    model_id      TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE conversations IS '对话记录';
COMMENT ON COLUMN conversations.model_id IS '使用的 AI 模型 ID';

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可管理自己的对话"
    ON conversations FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 4. messages 表 — 消息记录
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role              TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content           TEXT NOT NULL,
    model_id          TEXT,
    token_count       INTEGER DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE messages IS '消息记录';
COMMENT ON COLUMN messages.token_count IS '该条消息的 token 估算数';

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可管理自己对话的消息"
    ON messages FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
        )
    );


-- ============================================================
-- 5. usage_logs 表 — API调用日志
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_logs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID REFERENCES auth.users(id),
    model_id      TEXT NOT NULL,
    input_tokens  INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    success       BOOLEAN NOT NULL DEFAULT TRUE,
    error_msg     TEXT,
    latency_ms    INTEGER,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE usage_logs IS 'API 调用日志';

CREATE INDEX idx_usage_logs_user ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created ON usage_logs(created_at DESC);
CREATE INDEX idx_usage_logs_model ON usage_logs(model_id);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可查看自己的调用日志"
    ON usage_logs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "管理员可查看所有调用日志"
    ON usage_logs FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.is_admin = TRUE));

CREATE POLICY "系统可插入调用日志"
    ON usage_logs FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);
