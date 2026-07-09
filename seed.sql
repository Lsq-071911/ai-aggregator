-- ============================================================
-- AI聚合大模型 — 种子数据
-- ============================================================

-- 注意：
-- 1. 管理员设置：在 Supabase Auth 中注册用户后，手动在 members 表中设置 is_admin = true
--    示例：UPDATE members SET is_admin = true WHERE id = 'your-user-uuid';
--
-- 2. 测试会员码在本地模式下可用：
--    VIPMONTH001 - 月卡VIP 30天
--    VIPYEAR001  - 年卡VIP 365天
--    TESTVIP123  - 月卡VIP 30天（测试用）
--
-- 3. 以下插入的会员码仅用于数据库模式。本地模式下请使用 localStorage 中的测试码。

-- 插入测试会员码（未使用状态）
INSERT INTO vip_codes (code, level, duration_days) VALUES
    ('VIPMONTH001', 'vip_month', 30),
    ('VIPYEAR001',  'vip_year',  365),
    ('TESTVIP123',  'vip_month', 30),
    ('TESTVIP456',  'vip_year',  365),
    ('DEMOCODE01',  'vip_month', 30)
ON CONFLICT (code) DO NOTHING;

-- 说明：
-- 要将某个用户设为管理员，请在 Supabase SQL Editor 中执行：
-- UPDATE members SET is_admin = true WHERE id = '你的用户UUID';
-- 用户UUID可以从 auth.users 表查询：SELECT id, email FROM auth.users;
