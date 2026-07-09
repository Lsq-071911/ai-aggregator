/**
 * utils.js — 全局工具函数库
 * ============================================================
 * 所有模块通用的辅助函数，无外部依赖。
 */

const Utils = (function () {
  'use strict';

  // ============ 安全 ============

  /**
   * HTML 转义，防止 XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /**
   * 移除 HTML 标签
   */
  function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // ============ 函数工具 ============

  /**
   * 防抖
   */
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * 节流
   */
  function throttle(fn, delay) {
    let last = 0;
    let timer = null;
    return function (...args) {
      const now = Date.now();
      const remaining = delay - (now - last);
      if (remaining <= 0) {
        if (timer) { clearTimeout(timer); timer = null; }
        last = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  }

  // ============ 日期格式化 ============

  /**
   * 格式化日期: "2024-01-15 14:30"
   */
  function formatDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      const pad = (n) => String(n).padStart(2, '0');
      return (
        d.getFullYear() +
        '-' + pad(d.getMonth() + 1) +
        '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) +
        ':' + pad(d.getMinutes())
      );
    } catch (e) {
      return '—';
    }
  }

  /**
   * 相对时间: "3分钟前"、"昨天"等
   */
  function formatRelativeTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      const now = Date.now();
      const diff = now - d.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (seconds < 60) return '刚刚';
      if (minutes < 60) return minutes + '分钟前';
      if (hours < 24) return hours + '小时前';
      if (days === 1) return '昨天';
      if (days < 7) return days + '天前';
      if (days < 30) return Math.floor(days / 7) + '周前';
      if (days < 365) return Math.floor(days / 30) + '个月前';
      return Math.floor(days / 365) + '年前';
    } catch (e) {
      return '—';
    }
  }

  // ============ ID 生成 ============

  /**
   * 生成唯一 ID（简单版 UUID v4）
   */
  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * 短 ID（用于本地模拟）
   */
  function shortId(len) {
    len = len || 8;
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // ============ 剪贴板 ============

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
    function fallbackCopy(t) {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch (e) {
        document.body.removeChild(ta);
        return false;
      }
    }
  }

  // ============ Toast 通知 ============

  function showToast(message, type) {
    type = type || 'info';
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<span class="toast-icon">' + icons[type] + '</span><span class="toast-message">' + escapeHtml(message) + '</span>';
    container.appendChild(toast);

    const remove = () => {
      toast.classList.add('removing');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    };

    setTimeout(remove, 3500);
    toast.addEventListener('click', remove);
  }

  // ============ Modal 弹窗 ============

  function showModal(opts) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    const { title, content, confirmText, cancelText, onConfirm, onCancel, danger } = opts;

    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">${escapeHtml(title || '确认')}</div>
        <div class="modal-content">${typeof content === 'string' ? escapeHtml(content) : ''}</div>
        <div class="modal-actions">
          <button class="btn btn-outline modal-cancel">${escapeHtml(cancelText || '取消')}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} modal-confirm">${escapeHtml(confirmText || '确认')}</button>
        </div>
      </div>
    `;
    overlay.style.display = 'flex';

    const close = () => {
      overlay.style.display = 'none';
      overlay.innerHTML = '';
    };

    overlay.querySelector('.modal-cancel').addEventListener('click', () => {
      close();
      if (onCancel) onCancel();
    });
    overlay.querySelector('.modal-confirm').addEventListener('click', () => {
      close();
      if (onConfirm) onConfirm();
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
  }

  // ============ localStorage 包装 ============

  function storage(key, value) {
    if (arguments.length === 1) {
      // 读取
      try {
        const raw = localStorage.getItem('aihub_' + key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // 检查过期
        if (parsed._expires && parsed._expires < Date.now()) {
          localStorage.removeItem('aihub_' + key);
          return null;
        }
        return parsed._value !== undefined ? parsed._value : parsed;
      } catch (e) {
        return localStorage.getItem('aihub_' + key);
      }
    } else if (value === null) {
      // 删除
      localStorage.removeItem('aihub_' + key);
    } else {
      // 写入（支持第三个参数：过期时间-分钟）
      const expires = arguments[2] ? Date.now() + arguments[2] * 60000 : undefined;
      const toStore = expires ? { _value: value, _expires: expires } : value;
      try {
        localStorage.setItem('aihub_' + key, JSON.stringify(toStore));
      } catch (e) {
        console.warn('[Storage] 写入失败:', e.message);
      }
    }
  }

  // ============ 文本处理 ============

  function truncateText(text, maxLen) {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  }

  // ============ 验证 ============

  function isValidEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidPassword(pw) {
    if (!pw) return false;
    // 至少8位，包含字母和数字
    return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /\d/.test(pw);
  }

  // ============ JWT 解析 ============

  function parseJWT(token) {
    try {
      if (!token) return null;
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  // ============ 错误处理 ============

  const errorLog = [];

  function errorHandler(error, context) {
    const entry = {
      timestamp: new Date().toISOString(),
      context: context || 'unknown',
      message: error ? (error.message || String(error)) : 'Unknown error',
      stack: error && error.stack ? error.stack : ''
    };

    errorLog.push(entry);

    // 只保留最近 100 条
    if (errorLog.length > 100) errorLog.shift();

    // 写入 localStorage
    try {
      storage('error_log', errorLog);
    } catch (e) { /* ignore */ }

    console.error('[AI聚合 Error]', context, entry.message, entry);

    // 向用户显示友好提示
    const userMsg = context ? '[' + context + '] ' + entry.message : entry.message;
    if (entry.message && entry.message.length < 80) {
      showToast(userMsg, 'error');
    } else {
      showToast('操作失败，请稍后重试', 'error');
    }
  }

  /**
   * 获取错误日志
   */
  function getErrorLog() {
    return errorLog;
  }

  // ============ 其他工具 ============

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 估算 token 数量（粗略：4 字符 ≈ 1 token）
   */
  function estimateTokens(text) {
    if (!text) return 0;
    // 中文按 1.5 字符/token，英文按 4 字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  return {
    escapeHtml,
    stripHtml,
    debounce,
    throttle,
    formatDate,
    formatRelativeTime,
    generateId,
    shortId,
    copyToClipboard,
    showToast,
    showModal,
    storage,
    truncateText,
    isValidEmail,
    isValidPassword,
    parseJWT,
    errorHandler,
    errorLog,
    getErrorLog,
    sleep,
    estimateTokens
  };
})();
