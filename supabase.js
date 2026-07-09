/**
 * supabase.js — Supabase 客户端初始化 & 降级处理
 * ============================================================
 * 用户需要替换自己的 SUPABASE_URL 和 SUPABASE_ANON_KEY。
 *
 * 获取方式：
 * 1. 注册 https://supabase.com
 * 2. 创建项目
 * 3. Settings → API → 复制 URL 和 anon key
 */

// ============ 配置区域（用户需修改） ============
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // 替换为你的 anon key
// ===============================================

const SupabaseHelper = (function () {
  'use strict';

  let client = null;
  let isLocalMode = false;
  let initError = null;

  /**
   * 初始化 Supabase 客户端
   */
  function init() {
    // 检查是否使用占位符
    if (
      SUPABASE_URL.includes('your-project-id') ||
      SUPABASE_ANON_KEY.includes('...')
    ) {
      console.warn(
        '%c[Supabase] 检测到占位配置，降级为本地模式。%c请替换 js/supabase.js 中的 SUPABASE_URL 和 SUPABASE_ANON_KEY。',
        'color: #F39C12; font-weight: bold;',
        'color: #A0A0B8;'
      );
      isLocalMode = true;
      return null;
    }

    // 检查 supabase-js CDN 是否加载
    if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
      console.warn(
        '%c[Supabase] Supabase JS SDK 未加载（CDN 失败），降级为本地模式。',
        'color: #F39C12; font-weight: bold;'
      );
      isLocalMode = true;
      return null;
    }

    try {
      client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        },
        global: {
          fetch: (url, options) => {
            const timeout = 30000;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            options = options || {};
            options.signal = controller.signal;
            return fetch(url, options).finally(() => clearTimeout(timeoutId));
          }
        }
      });

      console.log('%c[Supabase] 客户端初始化成功', 'color: #2ECC71; font-weight: bold;');
      return client;
    } catch (e) {
      console.error('[Supabase] 初始化失败:', e.message);
      initError = e;
      isLocalMode = true;
      return null;
    }
  }

  /**
   * 获取 Supabase 客户端实例
   */
  function getClient() {
    if (!client && !isLocalMode) {
      init();
    }
    return client;
  }

  /**
   * 检查 Supabase 是否就绪
   */
  function isReady() {
    return !isLocalMode && client !== null;
  }

  /**
   * 是否为本地降级模式
   */
  function isLocal() {
    return isLocalMode;
  }

  /**
   * 获取初始化错误信息
   */
  function getError() {
    return initError;
  }

  return {
    init,
    getClient,
    isReady,
    isLocal,
    getError
  };
})();

// 自动初始化
window.supabaseClient = SupabaseHelper.getClient();
window.supabaseHelper = SupabaseHelper;
