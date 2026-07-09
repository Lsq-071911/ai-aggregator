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
    // 年卡 VIP 具有管理员权限（简化判断）
    return MemberManager.getLevel() === 'vip_year';
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
    html += '</div>';

    html += '<div class="admin-content" id="admin-content">';

    if (currentTab === 'dashboard') {
      html += renderDashboard();
    } else if (currentTab === 'users') {
      html += renderUsers();
    } else if (currentTab === 'codes') {
      html += renderCodes();
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

  // ============ 数据加载 ============

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
