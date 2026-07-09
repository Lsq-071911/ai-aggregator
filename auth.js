/**
 * auth.js — 用户认证模块（Supabase Auth + 本地降级）
 * ============================================================
 */

const AuthManager = (function () {
  'use strict';

  let currentUser = null;
  let currentSession = null;
  let authListeners = [];

  // ============ 本地降级模式 ============

  function localRegister(email, password) {
    const users = Utils.storage('local_users') || {};
    if (users[email]) {
      return { error: '该邮箱已注册' };
    }
    users[email] = {
      email: email,
      password: password, // 仅本地模式使用明文
      createdAt: new Date().toISOString()
    };
    if (email === 'admin@admin.com') {
      return { error: '系统保留账号，请直接登录（默认密码: admin123）' };
    }
    Utils.storage('local_users', users);

    // 自动登录
    const user = { id: 'local_' + Utils.shortId(12), email: email, created_at: new Date().toISOString() };
    Utils.storage('local_current_user', user);
    currentUser = user;
    currentSession = { user: user };
    notifyListeners('SIGNED_IN', currentSession);
    return { data: { user: user }, error: null };
  }

  function localLogin(email, password) {
    const users = Utils.storage('local_users') || {};

    // === 站长管理员账号（最高权限，控制支付/VIP系统） ===
    if (email === 'asd07194631@qq.com' && password === 'Lsq071911') {
      const user = { id: 'admin_001', email: 'asd07194631@qq.com', created_at: new Date().toISOString(), role: 'super_admin' };
      Utils.storage('local_current_user', user);
      currentUser = user;
      currentSession = { user: user };
      notifyListeners('SIGNED_IN', currentSession);
      return { data: { user: user }, error: null };
    }
    // === 免费 VIP 高级账号（全部AI免费无限使用） ===
    const freeVipAccounts = {
      'vip@ai.com': 'Vip123456',
      'pro@ai.com': 'Pro123456',
      'admin@ai.com': 'Admin123456'
    };
    if (freeVipAccounts[email] && freeVipAccounts[email] === password) {
      const user = { id: 'vip_' + Utils.shortId(12), email: email, created_at: new Date().toISOString(), role: 'vip_user' };
      Utils.storage('local_current_user', user);
      currentUser = user;
      currentSession = { user: user };
      notifyListeners('SIGNED_IN', currentSession);
      return { data: { user: user }, error: null };
    }

    const userData = users[email];
    if (!userData) {
      return { error: '账号不存在，请先注册' };
    }
    if (userData.password !== password) {
      return { error: '密码错误' };
    }
    const user = { id: 'local_' + Utils.shortId(12), email: email, created_at: userData.createdAt };
    Utils.storage('local_current_user', user);
    currentUser = user;
    currentSession = { user: user };
    notifyListeners('SIGNED_IN', currentSession);
    return { data: { user: user }, error: null };
  }

  function localLogout() {
    Utils.storage('local_current_user', null);
    currentUser = null;
    currentSession = null;
    notifyListeners('SIGNED_OUT', null);
  }

  // ============ Supabase 模式 ============

  function getClient() {
    return window.supabaseHelper ? window.supabaseHelper.getClient() : null;
  }

  function isLocal() {
    return window.supabaseHelper ? window.supabaseHelper.isLocal() : true;
  }

  async function init() {
    if (isLocal()) {
      // 本地模式：从 localStorage 恢复会话
      const saved = Utils.storage('local_current_user');
      if (saved) {
        currentUser = saved;
        currentSession = { user: saved };
        notifyListeners('INITIAL_SESSION', currentSession);
      }
      return;
    }

    const client = getClient();
    if (!client) return;

    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data && data.session) {
        currentSession = data.session;
        currentUser = data.session.user;
        notifyListeners('INITIAL_SESSION', currentSession);
      }
    } catch (e) {
      console.error('[Auth] 初始化失败:', e.message);
    }
  }

  async function login(email, password) {
    if (isLocal()) return localLogin(email, password);

    const client = getClient();
    if (!client) return { error: 'Supabase 未连接' };

    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return { error: translateError(error.message) };
      currentSession = data.session;
      currentUser = data.user;
      notifyListeners('SIGNED_IN', currentSession);
      return { data: data, error: null };
    } catch (e) {
      return { error: e.message };
    }
  }

  async function register(email, password) {
    if (isLocal()) return localRegister(email, password);

    const client = getClient();
    if (!client) return { error: 'Supabase 未连接' };

    try {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) return { error: translateError(error.message) };

      // 如果邮箱确认未开启，直接登录
      if (data.user && data.session) {
        currentSession = data.session;
        currentUser = data.user;
        notifyListeners('SIGNED_IN', currentSession);
      }

      return { data: data, error: null };
    } catch (e) {
      return { error: e.message };
    }
  }

  async function logout() {
    if (isLocal()) {
      localLogout();
      return;
    }

    const client = getClient();
    if (!client) return;

    try {
      await client.auth.signOut();
    } catch (e) {
      console.error('[Auth] 注销失败:', e.message);
    }

    currentUser = null;
    currentSession = null;
    notifyListeners('SIGNED_OUT', null);
  }

  async function resetPassword(email) {
    if (!Utils.isValidEmail(email)) {
      return { error: '请输入有效的邮箱地址' };
    }

    if (isLocal()) {
      return { error: '本地模式下不支持密码重置' };
    }

    const client = getClient();
    if (!client) return { error: 'Supabase 未连接' };

    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/index.html'
      });
      if (error) return { error: translateError(error.message) };
      return { error: null };
    } catch (e) {
      return { error: e.message };
    }
  }

  function getCurrentUser() {
    return currentUser;
  }

  function isLoggedIn() {
    return !!currentUser;
  }

  function getSession() {
    return currentSession;
  }

  function onAuthStateChange(callback) {
    authListeners.push(callback);
    // 返回取消监听函数
    return function () {
      authListeners = authListeners.filter(function (l) { return l !== callback; });
    };
  }

  function notifyListeners(event, session) {
    authListeners.forEach(function (cb) {
      try { cb(event, session); } catch (e) { /* ignore */ }
    });
  }

  function translateError(msg) {
    if (!msg) return '未知错误';
    const map = {
      'Invalid login credentials': '邮箱或密码错误',
      'Email not confirmed': '邮箱尚未验证，请检查收件箱',
      'User already registered': '该邮箱已注册',
      'Password should be at least 6 characters': '密码至少需要6个字符',
      'Email rate limit exceeded': '请求过于频繁，请稍后再试'
    };
    for (var key in map) {
      if (msg.toLowerCase().indexOf(key.toLowerCase()) !== -1) return map[key];
    }
    return msg;
  }

  // ============ 页面渲染 ============

  let currentTab = 'login'; // 'login' | 'register' | 'forgot'

  function renderLoginPage(container) {
    currentTab = 'login';
    renderAuthForm(container);
  }

  function switchTab(tab, container) {
    currentTab = tab;
    renderAuthForm(container);
  }

  function renderAuthForm(container) {
    const isForgot = currentTab === 'forgot';

    let html = '<div class="auth-page"><div class="auth-card">';
    html += '<div class="auth-logo"><div class="auth-logo-icon">AI</div><h2>AI聚合</h2></div>';

    if (isLocal()) {
      html += '<div class="local-mode-banner">本地模式运行中（Supabase 未连接）</div>';
    }

    // Tab 切换
    if (!isForgot) {
      html += '<div class="auth-tabs">';
      html += '<button class="auth-tab' + (currentTab === 'login' ? ' active' : '') + '" id="auth-tab-login">登录</button>';
      html += '<button class="auth-tab' + (currentTab === 'register' ? ' active' : '') + '" id="auth-tab-register">注册</button>';
      html += '</div>';
    } else {
      html += '<h3 style="text-align:center;margin-bottom:20px;color:var(--text-secondary);">重置密码</h3>';
    }

    // 表单
    html += '<form id="auth-form" autocomplete="on">';
    html += '<div class="form-group"><label class="form-label">邮箱地址</label>';
    html += '<input type="email" class="form-input" id="auth-email" placeholder="your@email.com" required autocomplete="email" /></div>';

    if (!isForgot) {
      html += '<div class="form-group"><label class="form-label">密码</label>';
      html += '<input type="password" class="form-input" id="auth-password" placeholder="至少8位，含字母+数字" required autocomplete="' + (currentTab === 'login' ? 'current-password' : 'new-password') + '" /></div>';

      if (currentTab === 'register') {
        html += '<div class="form-group"><label class="form-label">确认密码</label>';
        html += '<input type="password" class="form-input" id="auth-password-confirm" placeholder="再次输入密码" required /></div>';
      }
    }

    html += '<div class="form-error" id="auth-error"></div>';

    html += '<button type="submit" class="btn btn-primary btn-block btn-lg" id="auth-submit">';
    if (isForgot) html += '发送重置链接';
    else if (currentTab === 'register') html += '创建账号';
    else html += '登录';
    html += '</button>';
    html += '</form>';

    // 底部链接
    html += '<div style="text-align:center;margin-top:var(--space-5);font-size:13px;">';
    if (isForgot) {
      html += '<a href="javascript:void(0)" id="auth-back-login">← 返回登录</a>';
    } else if (currentTab === 'login') {
      html += '<a href="javascript:void(0)" id="auth-forgot">忘记密码？</a>';
      html += '<div style="margin-top:8px;color:var(--text-muted);">还没有账号？<a href="javascript:void(0)" id="auth-go-register">立即注册</a></div>';
    } else {
      html += '<div style="color:var(--text-muted);">已有账号？<a href="javascript:void(0)" id="auth-go-login">立即登录</a></div>';
    }
    html += '</div>';

    // 社交登录（占位）
    html += '<div style="margin-top:var(--space-6);"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
    html += '<div style="flex:1;height:1px;background:var(--border-color);"></div>';
    html += '<span style="font-size:12px;color:var(--text-muted);">其他登录方式</span>';
    html += '<div style="flex:1;height:1px;background:var(--border-color);"></div></div>';
    html += '<div style="display:flex;gap:10px;">';
    html += '<button class="btn btn-outline" style="flex:1;" disabled title="即将支持">Google</button>';
    html += '<button class="btn btn-outline" style="flex:1;" disabled title="即将支持">GitHub</button>';
    html += '</div></div>';

    html += '</div></div>';

    container.innerHTML = html;

    // 绑定事件
    bindAuthEvents(container);
  }

  function bindAuthEvents(container) {
    const form = container.querySelector('#auth-form');
    const errorEl = container.querySelector('#auth-error');

    // Tab 切换
    const tabLogin = container.querySelector('#auth-tab-login');
    const tabRegister = container.querySelector('#auth-tab-register');
    if (tabLogin) tabLogin.addEventListener('click', function () { switchTab('login', container); });
    if (tabRegister) tabRegister.addEventListener('click', function () { switchTab('register', container); });

    // 忘记密码
    const forgotLink = container.querySelector('#auth-forgot');
    if (forgotLink) forgotLink.addEventListener('click', function () { switchTab('forgot', container); });

    // 返回登录
    const backLogin = container.querySelector('#auth-back-login');
    if (backLogin) backLogin.addEventListener('click', function () { switchTab('login', container); });

    // 去注册/登录
    const goRegister = container.querySelector('#auth-go-register');
    if (goRegister) goRegister.addEventListener('click', function () { switchTab('register', container); });
    const goLogin = container.querySelector('#auth-go-login');
    if (goLogin) goLogin.addEventListener('click', function () { switchTab('login', container); });

    // 表单提交
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const email = container.querySelector('#auth-email').value.trim();
        const password = container.querySelector('#auth-password') ? container.querySelector('#auth-password').value : '';
        const submitBtn = container.querySelector('#auth-submit');

        // 验证
        if (!Utils.isValidEmail(email)) {
          errorEl.textContent = '请输入有效的邮箱地址';
          return;
        }

        const isForgot = currentTab === 'forgot';
        if (!isForgot) {
          if (!password) { errorEl.textContent = '请输入密码'; return; }
          if (!Utils.isValidPassword(password)) {
            errorEl.textContent = '密码至少8位，需包含字母和数字';
            return;
          }
          if (currentTab === 'register') {
            const confirm = container.querySelector('#auth-password-confirm');
            if (confirm && confirm.value !== password) {
              errorEl.textContent = '两次密码不一致';
              return;
            }
          }
        }

        // 设置 loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner"></span> 处理中...';
        errorEl.textContent = '';

        // 执行操作
        const doAction = isForgot ? resetPassword(email) :
          currentTab === 'register' ? register(email, password) :
          login(email, password);

        Promise.resolve(doAction).then(function (result) {
          if (result.error) {
            errorEl.textContent = result.error;
            submitBtn.disabled = false;
            submitBtn.innerHTML = isForgot ? '发送重置链接' : (currentTab === 'register' ? '创建账号' : '登录');
            return;
          }

          if (isForgot) {
            errorEl.style.color = 'var(--success)';
            errorEl.textContent = '重置链接已发送，请检查邮箱';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '发送重置链接';
          }
          // 登录/注册成功由 onAuthStateChange 回调处理导航
        }).catch(function (err) {
          errorEl.textContent = err.message || '操作失败';
          submitBtn.disabled = false;
          submitBtn.innerHTML = isForgot ? '发送重置链接' : (currentTab === 'register' ? '创建账号' : '登录');
        });
      });
    }

    // 实时密码强度提示
    const pwInput = container.querySelector('#auth-password');
    if (pwInput) {
      pwInput.addEventListener('input', function () {
        const pw = pwInput.value;
        if (pw && !Utils.isValidPassword(pw)) {
          pwInput.classList.add('error');
        } else if (pw) {
          pwInput.classList.remove('error');
        }
      });
    }
  }

  return {
    init,
    login,
    register,
    logout,
    resetPassword,
    getCurrentUser,
    isLoggedIn,
    getSession,
    onAuthStateChange,
    renderLoginPage
  };
})();
