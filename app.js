/**
 * app.js — 应用主控制器，SPA 路由管理
 * ============================================================
 */

const App = (function () {
  'use strict';

  // 全局状态
  const AppState = {
    currentUser: null,
    currentPage: 'loading',
    memberInfo: null,
    isOnline: navigator.onLine,
    config: { theme: 'dark' }
  };

  // 路由表
  const routes = {
    '/login': renderLoginPage,
    '/chat': renderChatPageWrapper,
    '/member': renderMemberPageWrapper,
    '/admin': renderAdminPageWrapper,
    '/': defaultRoute
  };

  // ============ 初始化 ============

  async function init() {
    try {
      // 注册全局错误处理
      setupErrorHandling();

      // 初始化 Supabase
      if (window.supabaseHelper) {
        supabaseHelper = window.supabaseHelper;
      }

      // 初始化 Auth
      AuthManager.onAuthStateChange(function (event, session) {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          AppState.currentUser = session ? session.user : null;
          AppState.currentPage = 'chat';
          // 加载会员信息
          MemberManager.init();
          // 如果不是登录中，导航到聊天
          if (event === 'SIGNED_IN') {
            navigate('/chat');
          }
        } else if (event === 'SIGNED_OUT') {
          AppState.currentUser = null;
          AppState.memberInfo = null;
          navigate('/login');
        }
      });

      await AuthManager.init();

      // 初始化会员
      await MemberManager.init();

      // 初始化聊天
      ChatManager.init();

      // 初始化管理后台
      AdminManager.init();

      // 导航到默认页面
      const hash = parseHash();
      navigate(hash || '/');

      // 隐藏预加载动画
      hideGlobalLoading();

    } catch (e) {
      console.error('[App] 初始化失败:', e);
      Utils.showToast('应用初始化失败，请刷新页面', 'error');
      hideGlobalLoading();
    }
  }

  function parseHash() {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      return hash.substring(1);
    }
    return null;
  }

  function defaultRoute() {
    if (AuthManager.isLoggedIn()) {
      return '/chat';
    }
    return '/login';
  }

  // ============ 导航 ============

  function navigate(path) {
    // 解析路由
    let route = path;
    if (!routes[route]) {
      // 处理默认路由
      route = '/';
    }

    const handler = routes[route];
    if (!handler) {
      route = '/';
    }

    // 如果路由是默认，先解析
    if (route === '/') {
      route = defaultRoute();
    }

    // 更新 hash
    if (window.location.hash !== '#' + path) {
      window.history.pushState(null, '', '#' + path);
    }

    // 更新状态
    AppState.currentPage = route;

    // 渲染页面
    renderPage(route);
  }

  function renderPage(pageName) {
    const container = document.getElementById('app-root');
    if (!container) return;

    // 页面切换动画
    container.style.opacity = '0';
    container.style.transform = 'translateY(10px)';

    setTimeout(function () {
      const handler = routes[pageName];
      if (handler) {
        handler();
      }
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
    }, 150);
  }

  // ============ 页面渲染 ============

  function renderLoginPage() {
    const container = document.getElementById('app-root');
    if (!container) return;
    if (AuthManager.isLoggedIn()) {
      navigate('/chat');
      return;
    }
    AuthManager.renderLoginPage(container);
  }

  function renderChatPageWrapper() {
    const container = document.getElementById('app-root');
    if (!container) return;
    if (!AuthManager.isLoggedIn()) {
      navigate('/login');
      return;
    }
    ChatManager.renderChatPage(container);
  }

  function renderMemberPageWrapper() {
    const container = document.getElementById('app-root');
    if (!container) return;
    if (!AuthManager.isLoggedIn()) {
      navigate('/login');
      return;
    }
    MemberManager.renderMemberPage(container);
  }

  function renderAdminPageWrapper() {
    const container = document.getElementById('app-root');
    if (!container) return;
    if (!AuthManager.isLoggedIn()) {
      navigate('/login');
      return;
    }
    AdminManager.renderAdminPage(container);
  }

  // ============ 加载状态 ============

  function showGlobalLoading() {
    const preloader = document.querySelector('.preloader');
    if (preloader) preloader.style.display = 'flex';
  }

  function hideGlobalLoading() {
    const preloader = document.querySelector('.preloader');
    if (preloader) {
      preloader.style.opacity = '0';
      setTimeout(function () {
        preloader.style.display = 'none';
      }, 600);
    }
  }

  // ============ 错误处理 ============

  function setupErrorHandling() {
    // 全局 JS 错误
    window.onerror = function (message, source, lineno, colno, error) {
      console.error('[Global Error]', message, 'at', source, lineno + ':' + colno);
      Utils.errorHandler(error || new Error(message), 'Global');
      return true;
    };

    // Promise 未处理拒绝
    window.addEventListener('unhandledrejection', function (event) {
      console.error('[Unhandled Rejection]', event.reason);
      Utils.errorHandler(event.reason, 'Promise');
    });

    // 网络状态变化
    window.addEventListener('online', function () {
      AppState.isOnline = true;
      Utils.showToast('网络已恢复', 'info');
    });

    window.addEventListener('offline', function () {
      AppState.isOnline = false;
      Utils.showToast('网络已断开', 'warning');
    });

    // 路由变化监听
    window.addEventListener('hashchange', function () {
      const hash = parseHash();
      if (hash && hash !== AppState.currentPage) {
        navigate(hash);
      }
    });

    // 浏览器的前进后退
    window.addEventListener('popstate', function () {
      const hash = parseHash();
      if (hash && hash !== AppState.currentPage) {
        navigate(hash);
      }
    });
  }

  // ============ 公开 API ============
  return {
    init,
    navigate,
    renderPage,
    showGlobalLoading,
    hideGlobalLoading,
    get state() { return AppState; }
  };
})();

// ============ 启动 ============
document.addEventListener('DOMContentLoaded', function () {
  // 等待 Supabase CDN 加载完成
  const checkSupabaseAndStart = function () {
    if (window.supabaseHelper) {
      App.init();
    } else if (window.supabase) {
      // 手动初始化
      try {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        App.init();
      } catch (e) {
        console.warn('Supabase 初始化失败，进入本地模式');
        App.init();
      }
    } else {
      // CDN 未加载，直接本地模式
      console.warn('Supabase CDN 未加载，使用本地模式');
      App.init();
    }
  };

  // 给 CDN 一点加载时间
  setTimeout(checkSupabaseAndStart, 500);
});
