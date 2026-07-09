/**
 * verify-code — 验证会员码 Edge Function
 * ============================================================
 * 部署: supabase functions deploy verify-code
 *
 * POST /verify-code
 * body: { code: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    // 验证认证
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: '请先登录' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: '认证失败，请重新登录' }, 401);
    }

    // 解析参数
    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return jsonResponse({ error: '会员码不能为空' }, 400);
    }

    // 查询会员码 — 使用服务角色密钥绕过 RLS
    const { data: vipCode, error: codeError } = await supabase
      .from('vip_codes')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .single();

    if (codeError || !vipCode) {
      return jsonResponse({ error: '会员码无效' }, 404);
    }

    if (vipCode.is_used) {
      return jsonResponse({ error: '该会员码已被使用' }, 400);
    }

    // 计算到期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + vipCode.duration_days);

    // 更新会员码状态
    const { error: updateCodeError } = await supabase
      .from('vip_codes')
      .update({
        is_used: true,
        used_by: user.id,
        used_at: new Date().toISOString(),
      })
      .eq('id', vipCode.id);

    if (updateCodeError) {
      return jsonResponse({ error: '更新会员码失败' }, 500);
    }

    // 更新用户会员信息
    const { data: currentMember } = await supabase
      .from('members')
      .select('activated_codes')
      .eq('id', user.id)
      .single();

    const activatedCodes = (currentMember?.activated_codes || []);
    activatedCodes.push(code.trim().toUpperCase());

    const { error: updateMemberError } = await supabase
      .from('members')
      .update({
        level: vipCode.level,
        expires_at: expiresAt.toISOString(),
        activated_codes: activatedCodes,
        daily_usage: 0, // 重置当日计数
      })
      .eq('id', user.id);

    if (updateMemberError) {
      return jsonResponse({ error: '更新会员信息失败' }, 500);
    }

    const levelNames: Record<string, string> = {
      vip_month: '月卡 VIP',
      vip_year: '年卡 VIP',
    };

    return jsonResponse({
      success: true,
      level: vipCode.level,
      level_name: levelNames[vipCode.level] || vipCode.level,
      expires_at: expiresAt.toISOString(),
      duration_days: vipCode.duration_days,
      message: `激活成功！${levelNames[vipCode.level]}，有效期至 ${expiresAt.toISOString().slice(0, 10)}`,
    });

  } catch (e) {
    console.error('[verify-code] Error:', e);
    return jsonResponse({ error: '服务器错误: ' + (e as Error).message }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
