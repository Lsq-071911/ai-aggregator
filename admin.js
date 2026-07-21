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
    // 全免费模式：所有登录用户均可访问管理后台
    return AuthManager.isLoggedIn();
  }

  function renderAdminPage(container) {
    let html = '<div class="admin-page">';
    html += '<div class="admin-header"><h2>管理后台</h2></div>';

    // Tab 导航
    html += '<div class="admin-tabs">';
    html += '<button class="admin-tab' + (currentTab === 'dashboard' ? ' active' : '') + '" data-tab="dashboard">仪表盘</button>';
    html += '<button class="admin-tab' + (currentTab === 'users' ? ' active' : '') + '" data-tab="users">用户管理</button>';
    html += '<button class="admin-tab' + (currentTab === 'settings' ? ' active' : '') + '" data-tab="settings">系统设置</button>';
    html += '</div>';

    html += '<div class="admin-content" id="admin-content">';

    if (currentTab === 'dashboard') {
      html += renderDashboard();
    } else if (currentTab === 'users') {
      html += renderUsers();    } else if (currentTab === 'settings') {
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
    // 当前无需要加载的数据
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
          <div class="stat-card-title">活跃用户</div>
          <div class="stat-card-value" id="stat-active-users">--</div>
          <div class="stat-card-sub">注册用户</div>
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
    let html = '<div class="settings-page">';
    
    // 账号信息
    html += '<div class="settings-section"><h3>管理员账号信息</h3>';
    html += '<div class="settings-field"><label>邮箱</label><span>' + Utils.escapeHtml(user ? user.email : '-') + '</span></div>';
    html += '<div class="settings-field"><label>角色</label><span style="color:var(--accent);">站长 · 超级管理员（全部AI免费无限使用）</span></div>';
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

  function loadDashboardData() {
    // 本地模式下的统计
    const users = Utils.storage('local_users');
    const totalUsers = users ? Object.keys(users).length : 0;

    // 对话统计
    const conversations = Utils.storage('conversations') || [];

    // 今日调用
    const todayUsage = memberInfo ? memberInfo.dailyUsage || 0 : 0;

    document.getElementById('stat-total-users').textContent = totalUsers || '1';
    document.getElementById('stat-active-users').textContent = vipUsers || '0';
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
      const levelNames = { free: '免费用户' };
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

  function (c) {
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

  function bindAdminEvents(container) {
    // Tab 切换
    container.querySelectorAll('.admin-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        currentTab = tab.getAttribute('data-tab');
        renderAdminPage(container);
      });
    });

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
