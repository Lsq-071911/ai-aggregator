/**
 * member.js — 会员 VIP 模块
 * ============================================================
 */

const MemberManager = (function () {
  'use strict';

  // 会员等级定义
  const LEVELS = {
    free: { name: '免费用户', dailyLimit: 20, unlimited: false, canUsePremium: false, canSetApiKey: false },
    vip_month: { name: '月卡 VIP', dailyLimit: -1, unlimited: true, canUsePremium: true, canSetApiKey: false, price: '99元/月' },
    vip_year: { name: '年卡 VIP', dailyLimit: -1, unlimited: true, canUsePremium: true, canSetApiKey: true, price: '699元/年' }
  };

  let currentMemberInfo = null;
  let isLocal = false;

  function checkLocal() {
    return window.supabaseHelper ? window.supabaseHelper.isLocal() : true;
  }

  async function init() {
    isLocal = checkLocal();

    // 尝试从本地加载
    const cached = Utils.storage('member_info');
    if (cached) {
      currentMemberInfo = cached;
    }

    // 尝试从 Supabase 加载
    if (!isLocal) {
      await fetchFromSupabase();
    }

    // 确保本地有初始数据
    if (!currentMemberInfo) {
      initLocalMember();
    }

    // 每日重置检查
    checkDailyReset();
  }

  function initLocalMember() {
    const today = new Date().toISOString().slice(0, 10);
    currentMemberInfo = {
      level: 'free',
      dailyUsage: 0,
      dailyDate: today,
      dailyLimit: 20,
      unlimited: false,
      expiresAt: null,
      activatedAt: null,
      activatedCodes: []
    };
    saveInfo();
  }

  function fetchFromSupabase() {
    const client = window.supabaseHelper ? window.supabaseHelper.getClient() : null;
    if (!client) return;

    return client
      .from('members')
      .select('*')
      .single()
      .then(function (result) {
        if (result.data && !result.error) {
          currentMemberInfo = {
            level: result.data.level || 'free',
            dailyUsage: result.data.daily_usage || 0,
            dailyDate: result.data.daily_date || new Date().toISOString().slice(0, 10),
            dailyLimit: (LEVELS[result.data.level] || LEVELS.free).dailyLimit,
            unlimited: (LEVELS[result.data.level] || LEVELS.free).unlimited,
            canUsePremium: (LEVELS[result.data.level] || LEVELS.free).canUsePremium,
            canSetApiKey: (LEVELS[result.data.level] || LEVELS.free).canSetApiKey,
            expiresAt: result.data.expires_at || null,
            activatedAt: result.data.activated_at || null,
            activatedCodes: result.data.activated_codes || []
          };
          saveInfo();
        }
      })
      .catch(function (e) {
        console.warn('[Member] Supabase 查询失败，使用本地数据:', e.message);
      });
  }

  function saveInfo() {
    if (currentMemberInfo) {
      Utils.storage('member_info', currentMemberInfo);
    }

    // 同步到 Supabase
    if (!isLocal) {
      syncToSupabase();
    }
  }

  function syncToSupabase() {
    const client = window.supabaseHelper ? window.supabaseHelper.getClient() : null;
    if (!client || !AuthManager.isLoggedIn()) return;

    const user = AuthManager.getCurrentUser();
    client
      .from('members')
      .upsert({
        id: user.id,
        level: currentMemberInfo.level,
        daily_usage: currentMemberInfo.dailyUsage,
        daily_date: currentMemberInfo.dailyDate,
        expires_at: currentMemberInfo.expiresAt
      })
      .then(function (result) {
        if (result.error) console.warn('[Member] 同步失败:', result.error.message);
      });
  }

  function checkDailyReset() {
    if (!currentMemberInfo) return;
    const today = new Date().toISOString().slice(0, 10);
    if (currentMemberInfo.dailyDate !== today) {
      currentMemberInfo.dailyDate = today;
      currentMemberInfo.dailyUsage = 0;
      saveInfo();
    }
  }

  // ============ 查询 ============

  function getMemberInfo() {
    checkDailyReset();
    return currentMemberInfo;
  }

  function getLevel() {
    return currentMemberInfo ? currentMemberInfo.level : 'free';
  }

  function isVip() {
    return getLevel() !== 'free';
  }

  function canUseModel(model) {
    if (!model) return true;
    const memberInfo = getMemberInfo();
    if (!memberInfo) return model.category === 'free';
    if (memberInfo.level !== 'free') return true; // VIP 可用全部
    return model.category === 'free';
  }

  function checkDailyLimit() {
    const memberInfo = getMemberInfo();
    if (!memberInfo) return { allowed: false, reason: '无法获取会员信息' };
    if (memberInfo.unlimited) return { allowed: true };
    if (memberInfo.dailyUsage >= memberInfo.dailyLimit) {
      return { allowed: false, reason: '今日调用次数已用完（' + memberInfo.dailyLimit + '次），请升级VIP' };
    }
    return { allowed: true };
  }

  function incrementUsage() {
    if (!currentMemberInfo) return;
    currentMemberInfo.dailyUsage = (currentMemberInfo.dailyUsage || 0) + 1;
    saveInfo();
  }

  // ============ 会员码激活 ============

  async function activateCode(code) {
    if (!code || code.trim().length < 4) {
      return { success: false, message: '请输入有效的会员码' };
    }
    code = code.trim().toUpperCase();

    if (isLocal) {
      return localActivate(code);
    }

    // 调用 Supabase Edge Function
    const client = window.supabaseHelper ? window.supabaseHelper.getClient() : null;
    if (!client) return { success: false, message: 'Supabase 未连接' };

    try {
      const session = AuthManager.getSession();
      const { data, error } = await client.functions.invoke('verify-code', {
        body: { code: code }
      });

      if (error) return { success: false, message: error.message || '激活失败' };
      if (!data || !data.success) return { success: false, message: (data && data.message) || '会员码无效' };

      // 更新本地信息
      currentMemberInfo.level = data.level || 'vip_month';
      currentMemberInfo.dailyLimit = -1;
      currentMemberInfo.unlimited = true;
      currentMemberInfo.canUsePremium = true;
      currentMemberInfo.canSetApiKey = data.level === 'vip_year';
      currentMemberInfo.expiresAt = data.expires_at;
      currentMemberInfo.activatedAt = new Date().toISOString();
      if (!currentMemberInfo.activatedCodes) currentMemberInfo.activatedCodes = [];
      currentMemberInfo.activatedCodes.push(code);
      saveInfo();

      return { success: true, message: '激活成功！会员有效期至 ' + Utils.formatDate(data.expires_at) };
    } catch (e) {
      return { success: false, message: '网络错误: ' + e.message };
    }
  }

  function localActivate(code) {
    // 本地模式的模拟会员码（用于测试）
    const testCodes = {
      'VIPMONTH001': { level: 'vip_month', days: 30 },
      'VIPYEAR001': { level: 'vip_year', days: 365 },
      'TESTVIP123': { level: 'vip_month', days: 30 }
    };

    const match = testCodes[code];
    if (!match) {
      return { success: false, message: '会员码无效（本地模式下可尝试: VIPMONTH001, VIPYEAR001, TESTVIP123）' };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + match.days);

    currentMemberInfo.level = match.level;
    currentMemberInfo.dailyLimit = -1;
    currentMemberInfo.unlimited = true;
    currentMemberInfo.canUsePremium = true;
    currentMemberInfo.canSetApiKey = match.level === 'vip_year';
    currentMemberInfo.expiresAt = expiresAt.toISOString();
    currentMemberInfo.activatedAt = new Date().toISOString();
    if (!currentMemberInfo.activatedCodes) currentMemberInfo.activatedCodes = [];
    currentMemberInfo.activatedCodes.push(code);
    saveInfo();

    return { success: true, message: '激活成功！会员有效期至 ' + Utils.formatDate(expiresAt.toISOString()) };
  }

  // ============ 页面渲染 ============

  function renderMemberPage(container) {
    const info = getMemberInfo();
    const level = info ? info.level : 'free';
    const levelDef = LEVELS[level] || LEVELS.free;

    let html = '<div class="member-page">';

    // Header
    html += '<div class="member-header">';
    html += '<h2>会员中心</h2>';
    html += '<p>升级VIP，解锁全部AI模型和无限调用</p>';
    html += '</div>';

    // 使用统计
    html += '<div class="member-stats">';
    html += '<div class="member-stat-card">';
    html += '<div class="member-stat-label">当前等级</div>';
    html += '<div class="member-stat-value"><span class="level-badge ' + level + '">' + levelDef.name + '</span></div>';
    html += '</div>';

    html += '<div class="member-stat-card">';
    html += '<div class="member-stat-label">今日调用</div>';
    html += '<div class="member-stat-value">' + (info ? info.dailyUsage : 0) + '</div>';
    if (!info || !info.unlimited) {
      html += '<div class="member-stat-sub">剩余 ' + ((info ? info.dailyLimit : 20) - (info ? info.dailyUsage : 0)) + ' 次</div>';
      const pct = info ? Math.min(100, (info.dailyUsage / info.dailyLimit) * 100) : 0;
      html += '<div class="usage-progress-bar"><div class="usage-progress-fill" style="width:' + pct + '%;"></div></div>';
    } else {
      html += '<div class="member-stat-sub" style="color:var(--success);">无限制</div>';
    }
    html += '</div>';

    // VIP 到期时间
    html += '<div class="member-stat-card">';
    html += '<div class="member-stat-label">' + (level !== 'free' ? '到期时间' : '加入时间') + '</div>';
    const displayDate = level !== 'free' && info && info.expiresAt ? info.expiresAt : (info && info.activatedAt ? info.activatedAt : new Date().toISOString());
    html += '<div class="member-stat-value" style="font-size:18px;">' + Utils.formatDate(displayDate) + '</div>';
    if (level !== 'free' && info && info.expiresAt) {
      const daysLeft = Math.max(0, Math.ceil((new Date(info.expiresAt) - new Date()) / 86400000));
      html += '<div class="member-stat-sub">剩余 ' + daysLeft + ' 天</div>';
    }
    html += '</div>';

    // API Key 设置（年卡VIP）
    if (levelDef.canSetApiKey) {
      html += '<div class="member-stat-card">';
      html += '<div class="member-stat-label">自定义 API Key</div>';
      html += '<div class="member-stat-value" style="font-size:14px;">';
      const savedKey = Utils.storage('openrouter_api_key');
      html += savedKey ? '已设置 (' + savedKey.slice(0, 12) + '...)' : '<span style="color:var(--text-muted);">未设置</span>';
      html += '</div>';
      html += '<button class="btn btn-outline btn-sm" style="margin-top:8px;" id="set-api-key-btn">设置 Key</button>';
      html += '</div>';
    }

    html += '</div>'; // member-stats

    // 套餐对比
    html += '<h3 style="margin-bottom:16px;">套餐对比</h3>';
    html += '<div class="plan-cards">';

    // 免费
    html += renderPlanCard({
      name: '免费版',
      price: '0',
      period: '永久',
      features: ['每日 20 次调用', '仅限免费模型', '基础对话', '对话历史保存'],
      disabledFeatures: ['无限制调用', '付费模型', '优先模型', '自定义 API Key'],
      isCurrent: level === 'free',
      isFree: true
    });

    // 月卡
    html += renderPlanCard({
      name: '月卡 VIP',
      price: '99',
      period: '元/月',
      features: ['无限次调用', '全部 50+ 模型', '优先响应', '对话历史同步', '专属客服'],
      disabledFeatures: ['自定义 API Key'],
      isCurrent: level === 'vip_month',
      isFeatured: true
    });

    // 年卡
    html += renderPlanCard({
      name: '年卡 VIP',
      price: '699',
      period: '元/年',
      features: ['无限次调用', '全部 50+ 模型', '优先响应', '对话历史同步', '自定义 API Key', '专属客服', '提前体验新功能'],
      disabledFeatures: [],
      isCurrent: level === 'vip_year'
    });

    html += '</div>';

    // 激活码区域
    html += '<div class="activate-section">';
    html += '<h3>' + (level === 'free' ? '输入会员码激活 VIP' : '续费 / 升级') + '</h3>';
    html += '<div class="activate-input-group">';
    html += '<input type="text" id="member-code-input" placeholder="请输入12位会员码" maxlength="20" autocomplete="off" />';
    html += '<button class="btn btn-primary" id="member-code-activate">激活</button>';
    html += '</div>';
    html += '<div id="member-code-result" style="margin-top:8px;font-size:13px;min-height:20px;"></div>';
    html += '<p style="color:var(--text-muted);font-size:13px;margin-top:12px;">扫码支付后联系管理员获取会员码</p>';
    html += '</div>';

    // 返回按钮
    html += '<div style="text-align:center;margin-top:32px;"><button class="btn btn-outline" id="member-back-chat">← 返回聊天</button></div>';

    html += '</div>';

    container.innerHTML = html;

    // 绑定事件
    bindMemberEvents(container);
  }

  function renderPlanCard(opts) {
    let html = '<div class="plan-card';
    if (opts.isFeatured) html += ' featured';
    if (opts.isCurrent) html += ' current';
    html += '">';

    if (opts.isCurrent) {
      html += '<div class="plan-badge current">当前</div>';
    } else if (opts.isFeatured) {
      html += '<div class="plan-badge">推荐</div>';
    }

    html += '<div class="plan-name">' + Utils.escapeHtml(opts.name) + '</div>';
    html += '<div class="plan-price">';
    html += '<span class="plan-price-amount">' + Utils.escapeHtml(opts.price) + '</span>';
    html += '<span class="plan-price-period">' + Utils.escapeHtml(opts.period) + '</span>';
    html += '</div>';

    html += '<ul class="plan-features">';
    (opts.features || []).forEach(function (f) {
      html += '<li>' + Utils.escapeHtml(f) + '</li>';
    });
    (opts.disabledFeatures || []).forEach(function (f) {
      html += '<li class="disabled">' + Utils.escapeHtml(f) + '</li>';
    });
    html += '</ul>';

    html += '<div class="plan-cta">';
    if (opts.isCurrent) {
      html += '<span class="btn btn-outline btn-block current-label" style="pointer-events:none;">当前方案</span>';
    } else if (opts.isFree) {
      html += '<span class="btn btn-outline btn-block" style="pointer-events:none;">默认方案</span>';
    } else {
      html += '<span class="btn btn-primary btn-block" style="pointer-events:none;">需会员码激活</span>';
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  function bindMemberEvents(container) {
    // 激活会员码
    const activateBtn = container.querySelector('#member-code-activate');
    const codeInput = container.querySelector('#member-code-input');
    const resultEl = container.querySelector('#member-code-result');

    if (activateBtn && codeInput) {
      activateBtn.addEventListener('click', function () {
        const code = codeInput.value.trim();
        if (!code) {
          resultEl.style.color = 'var(--danger)';
          resultEl.textContent = '请输入会员码';
          return;
        }

        activateBtn.disabled = true;
        activateBtn.innerHTML = '<span class="btn-spinner"></span> 验证中...';
        resultEl.textContent = '';

        activateCode(code).then(function (result) {
          activateBtn.disabled = false;
          activateBtn.innerHTML = '激活';
          if (result.success) {
            resultEl.style.color = 'var(--success)';
            resultEl.textContent = result.message;
            // 延迟刷新页面
            setTimeout(function () {
              renderMemberPage(container);
            }, 1500);
          } else {
            resultEl.style.color = 'var(--danger)';
            resultEl.textContent = result.message;
          }
        });
      });

      // Enter 键激活
      codeInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') activateBtn.click();
      });
    }

    // 返回聊天
    const backBtn = container.querySelector('#member-back-chat');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (typeof App !== 'undefined' && App.navigate) {
          App.navigate('/chat');
        }
      });
    }

    // API Key 设置
    const apiKeyBtn = container.querySelector('#set-api-key-btn');
    if (apiKeyBtn) {
      apiKeyBtn.addEventListener('click', function () {
        const currentKey = Utils.storage('openrouter_api_key') || '';
        Utils.showModal({
          title: '设置 OpenRouter API Key',
          content: '请输入你的 OpenRouter API Key（从 <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a> 获取）<br><br><input id="api-key-input" type="password" style="width:100%;padding:8px;background:var(--bg-dark);border:1px solid var(--border-color);border-radius:8px;color:white;" placeholder="sk-or-..." value="' + Utils.escapeHtml(currentKey) + '" />',
          confirmText: '保存',
          onConfirm: function () {
            const input = document.getElementById('api-key-input');
            if (input) {
              const key = input.value.trim();
              ApiService.setUserKey(key || null);
              if (key) {
                Utils.showToast('API Key 已保存', 'success');
              } else {
                Utils.showToast('API Key 已清除', 'info');
              }
              // 刷新会员页
              setTimeout(function () { renderMemberPage(container); }, 300);
            }
          }
        });
      });
    }
  }

  return {
    init,
    getMemberInfo,
    getLevel,
    isVip,
    canUseModel,
    checkDailyLimit,
    incrementUsage,
    activateCode,
    renderMemberPage
  };
})();
