/**
 * admin.js — 管理后台模块
 * ============================================================
 */

const AdminManager = (function () {
  'use strict';

  let currentTab = 'dashboard';

  function init() {
    // 无需初始化操作
  }

  function isAdmin() {
    const level = MemberManager.getLevel();
    return level === 'vip_year' || level === 'super_admin' || level === 'vip_user';
  }

  function renderAdminPage(container) {
    if (!isAdmin()) {
      container.innerHTML = `
        <div class="admin-page">
          <div style="text-align:center;padding:80px 20px;">
            <div style="font-size:48px;margin-bottom:16px;">🔒</div>
            <h2>无权访问</h2>
            <p style="color:var(--text-secondary);">需要年卡 VIP 权限才能访问管理后台</p>
            <button class="btn btn-primary" id="admin-go-vip">升级年卡 VIP</button>
          </div>
        </div>
      `;
      container.querySelector('#admin-go-vip').addEventListener('click', function () {
        if (typeof App !== 'undefined' && App.navigate) App.navigate('/member');
      });
      return;
    }

    let html = '<div class="admin-page">';
    html += '<div class="admin-header"><h2>管理后台</h2></div>';

    // Tab 导航
    html += '<div class="admin-tabs">';
    html += '<button class="admin-tab' + (currentTab === 'dashboard' ? ' active' : '') + '" data-tab="dashboard">仪表盘</button>';
    html += '<button class="admin-tab' + (currentTab === 'users' ? ' active' : '') + '" data-tab="users">用户管理</button>';
    html += '<button class="admin-tab' + (currentTab === 'codes' ? ' active' : '') + '" data-tab="codes">会员码管理</button>';
    html += '<button class="admin-tab' + (currentTab === 'vip_control' ? ' active' : '') + '" data-tab="vip_control">VIP控制</button>';
    html += '<button class="admin-tab' + (currentTab === 'settings' ? ' active' : '') + '" data-tab="settings">系统设置</button>';
    html += '</div>';

    html += '<div class="admin-content" id="admin-content">';

    if (currentTab === 'dashboard') {
      html += renderDashboard();
    } else if (currentTab === 'users') {
      html += renderUsers();
    } else if (currentTab === 'codes') {
      html += renderCodes();
    } else if (currentTab === 'vip_control') {
      html += renderVipControl();
    } else if (currentTab === 'settings') {
      html += renderSettings();
    }

    html += '</div>';
    html += '</div>';

    // 返回按钮
    html += '<div style="text-align:center;margin-top:24px;"><button class="btn btn-outline" id="admin-back-chat">← 返回聊天</button></div>';

    container.innerHTML = html;

    bindAdminEvents(container);

    // 加载数据
    if (currentTab === 'dashboard') loadDashboardData();
    if (currentTab === 'users') loadUsersData();
    if (currentTab === 'codes') loadCodesData();
    if (currentTab === 'vip_control') loadVipControlData();
  }

  function renderDashboard() {
    return `
      <div class="dashboard-grid">
        <div class="stat-card blue">
          <div class="stat-card-title">总用户数</div>
          <div class="stat-card-value" id="stat-total-users">--</div>
          <div class="stat-card-sub">所有注册用户</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-card-title">VIP 用户</div>
          <div class="stat-card-value" id="stat-vip-users">--</div>
          <div class="stat-card-sub">月卡 + 年卡用户</div>
        </div>
        <div class="stat-card green">
          <div class="stat-card-title">今日调用</div>
          <div class="stat-card-value" id="stat-today-calls">--</div>
          <div class="stat-card-sub">今日 API 调用次数</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-card-title">活跃对话</div>
          <div class="stat-card-value" id="stat-active-chats">--</div>
          <div class="stat-card-sub">当前存在的对话</div>
        </div>
      </div>
    `;
  }

  function renderUsers() {
    return `
      <div class="table-toolbar">
        <input type="text" id="user-search" placeholder="搜索用户邮箱..." class="form-input" style="max-width:300px;" />
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>邮箱</th>
              <th>等级</th>
              <th>注册时间</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">加载中...</td></tr>
          </tbody>
        </table>
      </div>
      <div class="table-pagination" id="users-pagination"></div>
    `;
  }

  function renderSettings() {
    const config = Utils.storage('app_config') || {};
    const user = AuthManager.getCurrentUser();
    const vipConfig = Utils.storage('vip_system_config') || {};
    let html = '<div class="settings-page">';
    
    // 账号信息
    html += '<div class="settings-section"><h3>管理员账号信息</h3>';
    html += '<div class="settings-field"><label>邮箱</label><span>' + Utils.escapeHtml(user ? user.email : '-') + '</span></div>';
    html += '<div class="settings-field"><label>角色</label><span style="color:var(--accent);">站长 · 超级管理员（全部AI免费无限使用，控制VIP/支付系统）</span></div>';
    html += '</div>';

    // 站点设置
    html += '<div class="settings-section"><h3>站点设置</h3>';
    
    html += '<div class="settings-field"><label>网站名称</label><input type="text" id="set-site-name" class="form-input" value="' + Utils.escapeHtml(config.siteName || 'AI聚合') + '" style="max-width:300px;" /></div>';
    
    html += '<div class="settings-field"><label>主题</label><select id="set-theme" class="form-input" style="max-width:200px;">';
    html += '<option value="dark"' + (config.theme !== 'light' ? ' selected' : '') + '>深色</option>';
    html += '<option value="light"' + (config.theme === 'light' ? ' selected' : '') + '>浅色</option>';
    html += '</select></div>';

    html += '<div class="settings-field"><label>默认模型</label><select id="set-default-model" class="form-input" style="max-width:300px;">';
    const models = ModelRegistry ? ModelRegistry.getAllModels() : [];
    models.forEach(function(m) {
      const sel = (config.defaultModel || 'openai/gpt-4o-mini') === m.id ? ' selected' : '';
      html += '<option value="' + m.id + '"' + sel + '>' + Utils.escapeHtml(m.name) + '</option>';
    });
    html += '</select></div>';

    html += '<div class="settings-field"><label>每日免费调用次数</label><input type="number" id="set-daily-free-limit" class="form-input" value="' + (config.dailyFreeLimit || 20) + '" style="max-width:100px;" min="1" max="999" /></div>';

    html += '<div class="settings-field" style="margin-top:16px;"><button class="btn btn-primary" id="btn-save-settings">保存设置</button></div>';
    html += '</div>';

    // 系统级 OpenRouter API Key（全局配置，所有AI模型依赖此Key工作）
    html += '<div class="settings-section"><h3>OpenRouter API Key（全局配置）</h3>';
    html += '<p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">'
      + '所有 AI 模型通过 OpenRouter 统一调用。配置后全部用户均可使用真实 AI 对话。'
      + '从 <a href="https://openrouter.ai/keys" target="_blank" style="color:var(--accent);">openrouter.ai/keys</a> 免费注册获取 Key。</p>';
    const savedKey = Utils.storage('openrouter_api_key') || '';
    html += '<div class="settings-field"><label>API Key</label><input type="password" id="set-api-key" class="form-input" value="' + Utils.escapeHtml(savedKey) + '" placeholder="sk-or-..." style="max-width:450px;" /></div>';
    html += '<div class="settings-field"><span style="font-size:12px;color:var(--text-muted);">当前状态：' + (savedKey ? '<span style="color:var(--success);">已配置（真实调用模式）</span>' : '<span style="color:var(--warning);">未配置（模拟模式，AI不真实工作）</span>') + '</span></div>';
    html += '<div class="settings-field" style="margin-top:8px;"><button class="btn btn-primary" id="btn-save-api-key">保存 API Key</button><button class="btn btn-outline" id="btn-clear-api-key" style="margin-left:8px;">清除</button></div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderCodes() {
    return `
      <div class="code-generate-panel">
        <h3>生成会员码</h3>
        <div class="code-generate-form">
          <div class="form-group">
            <label class="form-label">会员等级</label>
            <select id="code-level" class="form-input">
              <option value="vip_month">月卡 VIP (30天)</option>
              <option value="vip_year">年卡 VIP (365天)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">生成数量</label>
            <input type="number" id="code-count" class="form-input" value="1" min="1" max="100" />
          </div>
          <div class="form-group">
            <label class="form-label">有效天数</label>
            <input type="number" id="code-days" class="form-input" value="30" min="1" max="3650" />
          </div>
          <button class="btn btn-primary" id="btn-generate-codes">生成会员码</button>
        </div>
        <div id="code-generate-result" style="margin-top:16px;"></div>
      </div>

      <div class="code-list-panel" style="margin-top:24px;">
        <h3>已生成会员码</h3>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>会员码</th>
                <th>等级</th>
                <th>状态</th>
                <th>使用者</th>
                <th>生成时间</th>
              </tr>
            </thead>
            <tbody id="codes-table-body">
              <tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">加载中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ============ VIP 控制面板 ============

  function renderVipControl() {
    const vipConfig = Utils.storage('vip_system_config') || { enabled: true, paymentEnabled: false };
    return `
      <div class="vip-control-panel">
        <div class="settings-section">
          <h3>VIP 系统总开关</h3>
          <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">关闭后所有用户无需付费即可访问全部功能</p>
          <div class="toggle-row">
            <label class="toggle-label">
              <span>VIP 付费系统</span>
              <span id="vip-status-text" style="color:` + (vipConfig.enabled ? 'var(--success)' : 'var(--danger)') + `;font-size:13px;">` + (vipConfig.enabled ? '已启用' : '已关闭') + `</span>
            </label>
            <label class="switch">
              <input type="checkbox" id="vip-system-toggle" ` + (vipConfig.enabled ? 'checked' : '') + ` />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <h3>支付系统状态</h3>
          <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">支付系统目前为本地模式，管理员可直接手动分配VIP</p>
          <div class="toggle-row">
            <label class="toggle-label">
              <span>模拟支付</span>
              <span id="payment-status-text" style="color:` + (vipConfig.paymentEnabled ? 'var(--success)' : 'var(--warning)') + `;font-size:13px;">` + (vipConfig.paymentEnabled ? '已启用' : '未启用') + `</span>
            </label>
            <label class="switch">
              <input type="checkbox" id="payment-system-toggle" ` + (vipConfig.paymentEnabled ? 'checked' : '') + ` />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <h3>手动分配 VIP</h3>
          <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">直接给指定用户开通或取消 VIP 权限</p>
          <div class="vip-assign-form">
            <div class="form-group">
              <label class="form-label">用户邮箱</label>
              <input type="text" id="vip-assign-email" class="form-input" placeholder="输入用户邮箱" style="max-width:320px;" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">VIP 等级</label>
                <select id="vip-assign-level" class="form-input">
                  <option value="free">免费用户（取消VIP）</option>
                  <option value="vip_month">月卡 VIP</option>
                  <option value="vip_year">年卡 VIP</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">有效天数</label>
                <input type="number" id="vip-assign-days" class="form-input" value="30" min="1" max="3650" style="max-width:100px;" />
              </div>
            </div>
            <button class="btn btn-primary" id="btn-assign-vip">分配 VIP</button>
            <span id="vip-assign-result" style="margin-left:12px;font-size:13px;"></span>
          </div>
        </div>

        <div class="settings-section">
          <h3>当前用户 VIP 状态</h3>
          <div id="vip-users-status">
            <p style="color:var(--text-muted);">加载中...</p>
          </div>
        </div>
      </div>
    `;
  }

  function loadDashboardData() {
    // 本地模式下的统计
    const users = Utils.storage('local_users');
    const totalUsers = users ? Object.keys(users).length : 0;

    const memberInfo = Utils.storage('member_info');
    const vipUsers = (memberInfo && memberInfo.level !== 'free') ? 1 : 0;

    // 对话统计
    const conversations = Utils.storage('conversations') || [];

    // 今日调用
    const todayUsage = memberInfo ? memberInfo.dailyUsage || 0 : 0;

    document.getElementById('stat-total-users').textContent = totalUsers || '1';
    document.getElementById('stat-vip-users').textContent = vipUsers;
    document.getElementById('stat-today-calls').textContent = todayUsage;
    document.getElementById('stat-active-chats').textContent = Array.isArray(conversations) ? conversations.length : 0;
  }

  function loadUsersData() {
    const users = Utils.storage('local_users') || {};
    const currentUser = AuthManager.getCurrentUser();
    let userList = [];

    if (currentUser) {
      userList.push({
        email: currentUser.email,
        level: MemberManager.getLevel(),
        created_at: currentUser.created_at || new Date().toISOString(),
        status: 'active'
      });
    }

    Object.keys(users).forEach(function (email) {
      if (!userList.find(function (u) { return u.email === email; })) {
        userList.push({
          email: email,
          level: 'free',
          created_at: users[email].createdAt,
          status: 'active'
        });
      }
    });

    renderUsersTable(userList);
  }

  function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">暂无用户数据</td></tr>';
      return;
    }

    let html = '';
    users.forEach(function (u) {
      const levelNames = { free: '免费用户', vip_month: '月卡 VIP', vip_year: '年卡 VIP' };
      html += '<tr>';
      html += '<td>' + Utils.escapeHtml(u.email || '未知') + '</td>';
      html += '<td><span class="level-badge ' + u.level + '">' + (levelNames[u.level] || u.level) + '</span></td>';
      html += '<td>' + Utils.formatDate(u.created_at) + '</td>';
      html += '<td><span class="status-badge ' + u.status + '">' + (u.status === 'active' ? '正常' : '禁用') + '</span></td>';
      html += '<td>';
      html += '<button class="btn btn-outline btn-xs" disabled title="本地模式不支持">编辑</button>';
      html += '</td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;
  }

  function loadCodesData() {
    const codes = Utils.storage('vip_codes') || [];

    if (codes.length === 0) {
      // 显示一些演示码
      const demos = [
        { code: 'VIPMONTH001', level: 'vip_month', is_used: false, used_by: null, created_at: new Date().toISOString() },
        { code: 'VIPYEAR001', level: 'vip_year', is_used: false, used_by: null, created_at: new Date().toISOString() },
        { code: 'TESTVIP123', level: 'vip_month', is_used: false, used_by: null, created_at: new Date().toISOString() }
      ];
      renderCodesTable(demos);
      return;
    }

    renderCodesTable(codes);
  }

  function renderCodesTable(codes) {
    const tbody = document.getElementById('codes-table-body');
    if (!tbody) return;

    if (codes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">暂无会员码</td></tr>';
      return;
    }

    const levelNames = { vip_month: '月卡 VIP', vip_year: '年卡 VIP' };

    let html = '';
    codes.forEach(function (c) {
      html += '<tr>';
      html += '<td><code style="font-family:monospace;font-size:14px;">' + Utils.escapeHtml(c.code) + '</code></td>';
      html += '<td>' + (levelNames[c.level] || c.level) + '</td>';
      html += '<td>' + (c.is_used ? '<span style="color:var(--text-muted);">已使用</span>' : '<span style="color:var(--success);">未使用</span>') + '</td>';
      html += '<td>' + (c.used_by ? Utils.escapeHtml(c.used_by) : '-') + '</td>';
      html += '<td>' + Utils.formatDate(c.created_at) + '</td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;
  }

  function generateCodes(level, count, durationDays) {
    const codes = Utils.storage('vip_codes') || [];
    const newCodes = [];

    for (let i = 0; i < count; i++) {
      const code = generateCode();
      const entry = {
        code: code,
        level: level,
        is_used: false,
        used_by: null,
        used_at: null,
        duration_days: durationDays,
        created_at: new Date().toISOString()
      };
      codes.unshift(entry);
      newCodes.push(entry);
    }

    Utils.storage('vip_codes', codes);
    return newCodes;
  }

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // ============ VIP 控制面板数据加载 ============

  function loadVipControlData() {
    // 加载 VIP 用户状态
    const users = Utils.storage('local_users') || {};
    const currentUser = AuthManager.getCurrentUser();
    let vipUsers = [];

    // 当前用户
    if (currentUser) {
      vipUsers.push({
        email: currentUser.email,
        level: MemberManager.getLevel(),
        is_vip: MemberManager.isVip(),
        is_super_admin: MemberManager.isSuperAdmin()
      });
    }

    // 其他用户
    Object.keys(users).forEach(function (email) {
      const user = users[email];
      vipUsers.push({
        email: email,
        level: 'free',
        is_vip: false,
        is_super_admin: false,
        created_at: user.createdAt
      });
    });

    // 渲染
    const container = document.getElementById('vip-users-status');
    if (!container) return;

    if (vipUsers.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);">暂无用户数据</p>';
      return;
    }

    let html = '<div class="vip-users-table">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border-color);">邮箱</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border-color);">VIP状态</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border-color);">操作</th></tr></thead>';
    html += '<tbody>';

    vipUsers.forEach(function (u) {
      const levelText = u.level === 'super_admin' ? '站长' : u.level === 'vip_user' ? '免费VIP' : u.level === 'vip_year' ? '年卡VIP' : u.level === 'vip_month' ? '月卡VIP' : '免费用户';
      const levelColor = u.level === 'super_admin' ? 'var(--accent)' : u.is_vip ? 'var(--success)' : 'var(--text-muted)';
      html += '<tr>';
      html += '<td style="padding:8px;border-bottom:1px solid var(--border-color);">' + Utils.escapeHtml(u.email) + '</td>';
      html += '<td style="padding:8px;border-bottom:1px solid var(--border-color);color:' + levelColor + ';">' + levelText + '</td>';
      html += '<td style="padding:8px;border-bottom:1px solid var(--border-color);">';
      if (!u.is_super_admin) {
        html += '<button class="btn btn-outline btn-xs assign-vip-btn" data-email="' + Utils.escapeHtml(u.email) + '">分配VIP</button>';
      } else {
        html += '<span style="color:var(--text-muted);font-size:12px;">站长账号</span>';
      }
      html += '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    // 绑定分配按钮
    container.querySelectorAll('.assign-vip-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const email = btn.getAttribute('data-email');
        document.getElementById('vip-assign-email').value = email;
        // 滚动到分配表单
        const assignSection = document.querySelector('.vip-assign-form');
        if (assignSection) assignSection.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  // ============ 事件绑定 ============

  function bindAdminEvents(container) {
    // Tab 切换
    container.querySelectorAll('.admin-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        currentTab = tab.getAttribute('data-tab');
        renderAdminPage(container);
      });
    });

    // 生成会员码
    const genBtn = container.querySelector('#btn-generate-codes');
    if (genBtn) {
      genBtn.addEventListener('click', function () {
        const level = container.querySelector('#code-level').value;
        const count = parseInt(container.querySelector('#code-count').value, 10) || 1;
        const days = parseInt(container.querySelector('#code-days').value, 10) || 30;

        if (count < 1 || count > 100) {
          Utils.showToast('数量应在 1-100 之间', 'warning');
          return;
        }

        const newCodes = generateCodes(level, count, days);
        const resultEl = container.querySelector('#code-generate-result');
        if (resultEl) {
          let listHtml = '<div class="code-generated-list"><h4>已生成 ' + newCodes.length + ' 个会员码：</h4>';
          newCodes.forEach(function (c) {
            listHtml += '<div class="code-item"><code>' + c.code + '</code> (' + (c.level === 'vip_month' ? '月卡' : '年卡') + ', ' + c.duration_days + '天) <button class="btn btn-ghost btn-xs copy-code-btn" data-code="' + c.code + '">复制</button></div>';
          });
          listHtml += '</div>';
          resultEl.innerHTML = listHtml;

          resultEl.querySelectorAll('.copy-code-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
              const code = btn.getAttribute('data-code');
              Utils.copyToClipboard(code).then(function () {
                btn.textContent = '已复制';
                btn.classList.add('copied');
                setTimeout(function () { btn.textContent = '复制'; btn.classList.remove('copied'); }, 2000);
              });
            });
          });
        }

        // 刷新码列表
        loadCodesData();
      });
    }

    // 保存设置
    const saveSettingsBtn = container.querySelector('#btn-save-settings');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', function() {
        const config = Utils.storage('app_config') || {};
        config.siteName = (container.querySelector('#set-site-name') || {}).value || 'AI聚合';
        config.theme = (container.querySelector('#set-theme') || {}).value || 'dark';
        config.defaultModel = (container.querySelector('#set-default-model') || {}).value || 'openai/gpt-4o-mini';
        config.dailyFreeLimit = parseInt((container.querySelector('#set-daily-free-limit') || {}).value, 10) || 20;
        Utils.storage('app_config', config);
        
        // 应用主题
        document.documentElement.setAttribute('data-theme', config.theme);
        document.body.className = config.theme === 'light' ? 'light-theme' : '';
        
        // 应用默认模型
        if (config.defaultModel) {
          Utils.storage('current_model', config.defaultModel);
        }
        
        // 更新网站标题
        document.title = config.siteName + ' · 智能大模型中转站';
        
        Utils.showToast('设置已保存', 'success');
      });
    }

    // 保存 API Key
    const saveApiBtn = container.querySelector('#btn-save-api-key');
    if (saveApiBtn) {
      saveApiBtn.addEventListener('click', function() {
        const keyInput = container.querySelector('#set-api-key');
        if (keyInput) {
          const key = keyInput.value.trim();
          if (key) {
            ApiService.setUserKey(key);
            Utils.showToast('API Key 已保存', 'success');
          } else {
            Utils.showToast('请输入有效的 API Key', 'warning');
          }
        }
      });
    }

    // 清除 API Key
    const clearApiBtn = container.querySelector('#btn-clear-api-key');
    if (clearApiBtn) {
      clearApiBtn.addEventListener('click', function() {
        ApiService.setUserKey(null);
        const keyInput = container.querySelector('#set-api-key');
        if (keyInput) keyInput.value = '';
        Utils.showToast('API Key 已清除', 'info');
      });
    }

    // 用户搜索
    const userSearch = container.querySelector('#user-search');
    if (userSearch) {
      userSearch.addEventListener('input', function () {
        const q = userSearch.value.toLowerCase();
        const rows = container.querySelectorAll('#users-table-body tr');
        rows.forEach(function (row) {
          const text = row.textContent.toLowerCase();
          row.style.display = q && !text.includes(q) ? 'none' : '';
        });
      });
    }

    // ============ VIP 控制面板事件 ============

    // VIP 系统开关
    const vipToggle = container.querySelector('#vip-system-toggle');
    if (vipToggle) {
      vipToggle.addEventListener('change', function () {
        const config = Utils.storage('vip_system_config') || {};
        config.enabled = vipToggle.checked;
        Utils.storage('vip_system_config', config);
        const statusText = container.querySelector('#vip-status-text');
        if (statusText) {
          statusText.textContent = config.enabled ? '已启用' : '已关闭';
          statusText.style.color = config.enabled ? 'var(--success)' : 'var(--danger)';
        }
        Utils.showToast('VIP 系统已' + (config.enabled ? '启用' : '关闭'), config.enabled ? 'success' : 'warning');
      });
    }

    // 支付系统开关
    const paymentToggle = container.querySelector('#payment-system-toggle');
    if (paymentToggle) {
      paymentToggle.addEventListener('change', function () {
        const config = Utils.storage('vip_system_config') || {};
        config.paymentEnabled = paymentToggle.checked;
        Utils.storage('vip_system_config', config);
        const statusText = container.querySelector('#payment-status-text');
        if (statusText) {
          statusText.textContent = config.paymentEnabled ? '已启用' : '未启用';
          statusText.style.color = config.paymentEnabled ? 'var(--success)' : 'var(--warning)';
        }
        Utils.showToast('支付系统已' + (config.paymentEnabled ? '启用' : '关闭'), 'info');
      });
    }

    // 手动分配 VIP
    const assignBtn = container.querySelector('#btn-assign-vip');
    if (assignBtn) {
      assignBtn.addEventListener('click', function () {
        const email = (container.querySelector('#vip-assign-email') || {}).value;
        const level = (container.querySelector('#vip-assign-level') || {}).value;
        const days = parseInt((container.querySelector('#vip-assign-days') || {}).value, 10) || 30;
        const resultEl = container.querySelector('#vip-assign-result');

        if (!email) {
          if (resultEl) { resultEl.textContent = '请输入用户邮箱'; resultEl.style.color = 'var(--danger)'; }
          return;
        }

        // 查找用户
        const users = Utils.storage('local_users') || {};
        const currentUser = AuthManager.getCurrentUser();

        if (currentUser && currentUser.email === email) {
          // 操作当前用户
          currentUser.vip_level = level;
          currentUser.vip_expires = level === 'free' ? null : new Date(Date.now() + days * 86400000).toISOString();
          Utils.storage('local_current_user', currentUser);
          if (resultEl) { resultEl.textContent = 'VIP 已分配成功: ' + (level === 'free' ? '已取消VIP' : level + ' (' + days + '天)'); resultEl.style.color = 'var(--success)'; }
        } else if (users[email]) {
          users[email].vip_level = level;
          users[email].vip_expires = level === 'free' ? null : new Date(Date.now() + days * 86400000).toISOString();
          Utils.storage('local_users', users);
          if (resultEl) { resultEl.textContent = 'VIP 已分配成功: ' + (level === 'free' ? '已取消VIP' : level + ' (' + days + '天)'); resultEl.style.color = 'var(--success)'; }
        } else {
          if (resultEl) { resultEl.textContent = '未找到该用户'; resultEl.style.color = 'var(--danger)'; }
        }

        // 刷新用户列表
        setTimeout(function () { loadVipControlData(); }, 500);
      });
    }

    // 返回
    const backBtn = container.querySelector('#admin-back-chat');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (typeof App !== 'undefined' && App.navigate) {
          App.navigate('/chat');
        }
      });
    }
  }

  return {
    init,
    isAdmin,
    renderAdminPage,
    generateCodes
  };
})();
