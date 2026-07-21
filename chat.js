/**
 * chat.js — AI 聊天核心模块
 * ============================================================
 */

const ChatManager = (function () {
  'use strict';

  let currentChatId = null;
  let currentModel = null;
  let conversations = [];
  let currentMessages = [];
  let isProcessing = false;
  let domCache = {};

  function init() {
    // 加载对话列表
    loadConversations();

    // 设置默认模型
    if (!currentModel) {
      const saved = Utils.storage('current_model');
      currentModel = saved || 'openai/gpt-4o-mini';
    }
  }

  function loadConversations() {
    const saved = Utils.storage('conversations');
    if (saved && Array.isArray(saved)) {
      conversations = saved;
    } else {
      conversations = [];
    }
  }

  function saveConversations() {
    Utils.storage('conversations', conversations);
  }

  function loadMessages(chatId) {
    const key = 'messages_' + chatId;
    const saved = Utils.storage(key);
    if (saved && Array.isArray(saved)) {
      return saved;
    }
    return [];
  }

  function saveMessages(chatId, messages) {
    const key = 'messages_' + chatId;
    Utils.storage(key, messages);
  }

  function getModel() {
    return ModelRegistry.getModelById(currentModel) || ModelRegistry.getModelById('openai/gpt-4o-mini');
  }

  function selectModel(modelId) {
    currentModel = modelId;
    Utils.storage('current_model', modelId);
    // 更新当前对话的模型
    if (currentChatId) {
      const conv = conversations.find(function (c) { return c.id === currentChatId; });
      if (conv) {
        conv.model_id = modelId;
        saveConversations();
      }
    }
    updateModelDisplay();
  }

  // ============ 对话管理 ============

  function createNewChat() {
    currentChatId = Utils.generateId();
    currentMessages = [];
    const conv = {
      id: currentChatId,
      title: '新对话',
      model_id: currentModel,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    conversations.unshift(conv);
    saveConversations();
    saveMessages(currentChatId, []);
    renderSidebar();
    renderMessages();
    updateModelDisplay();
    focusInput();
    return currentChatId;
  }

  function switchChat(chatId) {
    currentChatId = chatId;
    currentMessages = loadMessages(chatId);
    const conv = conversations.find(function (c) { return c.id === chatId; });
    if (conv) {
      currentModel = conv.model_id || currentModel;
    }
    ApiService.cancelStream();
    isProcessing = false;
    renderMessages();
    renderSidebar();
    updateModelDisplay();
  }

  function deleteChat(chatId) {
    conversations = conversations.filter(function (c) { return c.id !== chatId; });
    saveConversations();
    Utils.storage('messages_' + chatId, null);
    if (currentChatId === chatId) {
      if (conversations.length > 0) {
        switchChat(conversations[0].id);
      } else {
        createNewChat();
      }
    } else {
      renderSidebar();
    }
  }

  function clearCurrentChat() {
    if (!currentChatId) return;
    currentMessages = [];
    saveMessages(currentChatId, []);
    renderMessages();
  }

  // ============ 发送消息 ============

  function sendMessage(content) {
    if (!content || !content.trim() || isProcessing) return;
    content = content.trim();

    // 如果没有当前对话，创建新的
    if (!currentChatId) {
      createNewChat();
    }

    // 权限检查
    const model = getModel();

    // 更新对话标题
    const conv = conversations.find(function (c) { return c.id === currentChatId; });
    if (conv && (!conv.title || conv.title === '新对话')) {
      conv.title = Utils.truncateText(content.replace(/\n/g, ' '), 30);
      saveConversations();
      renderSidebar();
    }

    // 添加用户消息
    const userMsg = {
      id: Utils.generateId(),
      role: 'user',
      content: content,
      created_at: new Date().toISOString()
    };
    currentMessages.push(userMsg);
    saveMessages(currentChatId, currentMessages);
    renderMessages();
    clearInput();
    scrollToBottom();

    // 检查当前模型
    const currentModelId = currentModel;

    // 添加 AI 占位消息
    const aiMsgId = Utils.generateId();
    const aiMsg = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      model_id: currentModelId,
      created_at: new Date().toISOString(),
      streaming: true
    };
    currentMessages.push(aiMsg);
    saveMessages(currentChatId, currentMessages);
    renderMessages();
    scrollToBottom();

    isProcessing = true;
    updateSendButton();

    // 构建上下文
    const contextMessages = buildContext();

    // 检查 API Key
    if (!ApiService.hasKey()) {
      // 没有 Key，使用模拟回复
      simulateReply(aiMsgId, content);
      return;
    }

    // 调用 API
    ApiService.streamChat(contextMessages, currentModelId, {
      onChunk: function (text) {
        const msg = currentMessages.find(function (m) { return m.id === aiMsgId; });
        if (msg) {
          msg.content += text;
          updateMessageContent(aiMsgId, msg.content, true);
        }
      },
      onDone: function (fullText) {
        const msg = currentMessages.find(function (m) { return m.id === aiMsgId; });
        if (msg) {
          msg.content = fullText;
          msg.streaming = false;
          updateMessageContent(aiMsgId, fullText, false);
        }
        finishMessage(aiMsgId, fullText);
      },
      onError: function (msg) {
        const m = currentMessages.find(function (x) { return x.id === aiMsgId; });
        if (m) {
          m.content = '错误: ' + msg;
          m.streaming = false;
        }
        updateMessageContent(aiMsgId, m ? m.content : '错误: ' + msg, false);
        finishMessage(aiMsgId, m ? m.content : '', true);
      }
    });
  }

  function buildContext() {
    const systemMsg = {
      role: 'system',
      content: '你是 AI 聚合平台的智能助手，请用简体中文回答用户问题。回答应专业、准确、有帮助。支持 Markdown 格式，代码块请指定语言。'
    };

    const history = currentMessages
      .filter(function (m) { return m.role !== 'system' && !m.streaming; })
      .map(function (m) { return { role: m.role, content: m.content }; });

    const model = getModel();
    const maxTokens = model ? model.contextWindow : 128000;
    // 粗略裁剪历史消息以避免超出上下文
    let totalTokens = Utils.estimateTokens(systemMsg.content) + 200; // 预留
    const result = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const t = Utils.estimateTokens(history[i].content);
      if (totalTokens + t > maxTokens * 0.8) break;
      totalTokens += t;
      result.unshift(history[i]);
    }

    return [systemMsg].concat(result.slice(-50));
  }

  function simulateReply(aiMsgId, userContent) {
    // 模拟回复（无 API Key 时使用）
    const model = getModel();
    const modelName = model ? model.name : 'AI';
    const responses = [
      '您好！我是 ' + modelName + '。由于尚未配置 OpenRouter API Key，我目前处于模拟模式。\n\n您可以：\n1. 在**设置中心**设置您的 API Key\n2. 访问 openrouter.ai/keys 免费获取 Key\n\n配置后即可使用真实的 AI 对话功能。',
      '这是一个模拟回复。\n\n您的问题是：「' + Utils.truncateText(userContent, 100) + '」\n\n在正式环境中，' + modelName + ' 将会为您提供高质量的回复。请配置 OpenRouter API Key 来启用完整功能。',
      '感谢您的提问！\n\n当前系统运行在模拟模式，真实 AI 对话需要 OpenRouter API Key。\n\n```\n// 配置方法\n1. 访问 openrouter.ai/keys\n2. 创建 API Key\n3. 在设置中心填入 Key\n```\n\n配置完成后即可使用 50+ 大模型。'
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];
    const msg = currentMessages.find(function (m) { return m.id === aiMsgId; });
    if (!msg) return;

    // 模拟逐字输出
    let index = 0;
    const interval = setInterval(function () {
      if (index < response.length) {
        msg.content += response[index];
        updateMessageContent(aiMsgId, msg.content, true);
        index++;
        scrollToBottom();
      } else {
        clearInterval(interval);
        msg.streaming = false;
        updateMessageContent(aiMsgId, msg.content, false);
        finishMessage(aiMsgId, response);
      }
    }, 20);
  }

  function finishMessage(aiMsgId, fullText, isError) {
    isProcessing = false;
    if (!isError) {
      // 更新对话时间和使用统计
      const conv = conversations.find(function (c) { return c.id === currentChatId; });
      if (conv) {
        conv.updated_at = new Date().toISOString();
        saveConversations();
      }
      // 增加使用次数
      MemberManager.incrementUsage();
    }
    saveMessages(currentChatId, currentMessages);
    updateSendButton();
    scrollToBottom();
  }

  // ============ 渲染 ============

  function renderChatPage(container) {
    if (!currentChatId && conversations.length > 0) {
      currentChatId = conversations[0].id;
      currentMessages = loadMessages(currentChatId);
      const conv = conversations[0];
      if (conv) currentModel = conv.model_id || currentModel;
    } else if (!currentChatId) {
      createNewChat();
    }

    const html = `
      <div class="app-layout" id="app-layout">
        <div class="sidebar" id="sidebar">
          <div class="sidebar-header">
            <span class="sidebar-brand">AI聚合</span>
            <button class="sidebar-new-chat" id="sidebar-new-chat" title="新对话">+</button>
          </div>
          <div class="sidebar-history" id="sidebar-history"></div>
          <div class="sidebar-footer">
            <div class="sidebar-user" id="sidebar-user"></div>
          </div>
        </div>
        <button class="sidebar-toggle" id="sidebar-toggle" title="收起侧边栏">◀</button>
        <div class="chat-area" id="chat-area">
          <div class="chat-header">
            <div class="chat-model-selector" id="chat-model-selector">
              <span class="model-select-trigger" id="model-select-trigger"></span>
              <span class="model-select-chevron">▼</span>
            </div>
            <div class="chat-header-actions">
              <button class="btn btn-ghost btn-sm" id="btn-member" title="设置中心">设置</button>
              <button class="btn btn-ghost btn-sm" id="btn-admin" title="管理后台">管理</button>
              <button class="btn btn-ghost btn-sm" id="btn-clear-chat" title="清空对话">清空</button>
            </div>
            <div class="model-dropdown" id="model-dropdown"></div>
          </div>
          <div class="chat-messages" id="chat-messages"></div>
          <div class="chat-input-area">
            <div class="chat-input-wrapper">
              <textarea id="chat-input" placeholder="输入消息，Enter 发送，Shift+Enter 换行..." rows="1"></textarea>
              <button class="send-btn" id="send-btn" title="发送">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
              </button>
            </div>
            <div class="chat-input-footer">
              <span class="chat-input-hint">Shift+Enter 换行</span>
              <span class="chat-input-charcount" id="char-count">0/8000</span>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // 缓存 DOM
    domCache = {};
    ['sidebar', 'sidebar-history', 'sidebar-user', 'sidebar-toggle',
      'chat-model-selector', 'model-select-trigger', 'model-dropdown',
      'chat-messages', 'chat-input', 'send-btn', 'char-count',
      'btn-member', 'btn-admin', 'btn-clear-chat', 'sidebar-new-chat', 'app-layout'
    ].forEach(function (id) {
      domCache[id] = document.getElementById(id);
    });

    // 渲染各组件
    renderSidebar();
    renderModelDropdown();
    updateModelDisplay();
    renderMessages();

    // 绑定事件
    bindChatEvents();

    // 页面首次打开时滚动到底部
    setTimeout(scrollToBottom, 100);
  }

  function renderSidebar() {
    if (!domCache['sidebar-history'] || !domCache['sidebar-user']) return;

    let html = '';
    conversations.forEach(function (conv) {
      const activeClass = conv.id === currentChatId ? ' active' : '';
      html += '<div class="chat-history-item' + activeClass + '" data-chat-id="' + conv.id + '">';
      html += '<span class="chat-history-title">' + Utils.escapeHtml(conv.title || '新对话') + '</span>';
      html += '<span class="chat-history-delete" data-delete-id="' + conv.id + '" title="删除">×</span>';
      html += '</div>';
    });

    if (conversations.length === 0) {
      html = '<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">暂无对话</div></div>';
    }

    domCache['sidebar-history'].innerHTML = html;

    // 绑定侧边栏事件
    domCache['sidebar-history'].querySelectorAll('.chat-history-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        if (e.target.classList.contains('chat-history-delete')) return;
        const chatId = item.getAttribute('data-chat-id');
        switchChat(chatId);
      });
    });

    domCache['sidebar-history'].querySelectorAll('.chat-history-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const chatId = btn.getAttribute('data-delete-id');
        Utils.showModal({
          title: '删除对话',
          content: '确定要删除这个对话吗？此操作不可撤销。',
          confirmText: '删除',
          danger: true,
          onConfirm: function () { deleteChat(chatId); }
        });
      });
    });

    // 用户信息
    const user = AuthManager.getCurrentUser();
    domCache['sidebar-user'].innerHTML = `
      <div class="sidebar-avatar">${user ? (user.email || '?')[0].toUpperCase() : '?'}</div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-name">${Utils.escapeHtml(user ? (user.email || '用户') : '未登录')}</div>
        <div class="sidebar-user-level" style="color:var(--success);">全功能免费</div>
      </div>
      <button class="sidebar-logout" id="sidebar-logout" title="注销">⏻</button>
    `;

    const logoutBtn = document.getElementById('sidebar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        Utils.showModal({
          title: '注销登录',
          content: '确定要退出登录吗？',
          confirmText: '注销',
          danger: true,
          onConfirm: function () {
            AuthManager.logout().then(function () {
              if (typeof App !== 'undefined' && App.navigate) {
                App.navigate('/login');
              }
            });
          }
        });
      });
    }
  }

  function renderModelDropdown() {
    if (!domCache['model-dropdown']) return;
    const providers = ModelRegistry.getModelsByProvider();
    const providerNames = Object.keys(providers).sort();

    let html = '<div class="model-search"><input type="text" id="model-search-input" placeholder="搜索模型..." /></div>';
    html += '<div class="model-list">';

    providerNames.forEach(function (provider) {
      const models = providers[provider];
      html += '<div class="model-group-header" data-provider="' + Utils.escapeHtml(provider) + '">';
      html += '<span>▼</span> ' + Utils.escapeHtml(provider) + ' (' + models.length + ')';
      html += '</div>';
      html += '<div class="model-group-items" data-provider="' + Utils.escapeHtml(provider) + '">';
      models.forEach(function (m) {
        const activeClass = m.id === currentModel ? ' active' : '';
        html += '<div class="model-item' + activeClass + '" data-model-id="' + Utils.escapeHtml(m.id) + '">';
        html += '<span class="model-item-icon">' + (m.icon || '🤖') + '</span>';
        html += '<div class="model-item-info">';
        html += '<div class="model-item-name">' + Utils.escapeHtml(m.name) + '</div>';
        html += '<div class="model-item-desc">' + Utils.escapeHtml(m.desc) + '</div>';
        html += '</div>';
        html += '<span class="model-item-badge">可用</span>';
        html += '</div>';
      });
      html += '</div>';
    });

    html += '</div>';
    domCache['model-dropdown'].innerHTML = html;

    // 搜索
    const searchInput = document.getElementById('model-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        const q = searchInput.value.toLowerCase();
        domCache['model-dropdown'].querySelectorAll('.model-item').forEach(function (item) {
          const text = item.textContent.toLowerCase();
          item.style.display = q && !text.includes(q) ? 'none' : '';
        });
        // 显示/隐藏分组头
        domCache['model-dropdown'].querySelectorAll('.model-group-header').forEach(function (header) {
          const provider = header.getAttribute('data-provider');
          const items = domCache['model-dropdown'].querySelectorAll('.model-group-items[data-provider="' + provider + '"] .model-item');
          let visible = false;
          items.forEach(function (it) { if (it.style.display !== 'none') visible = true; });
          header.style.display = q && !visible ? 'none' : '';
        });
      });
    }

    // 模型选择
    domCache['model-dropdown'].querySelectorAll('.model-item').forEach(function (item) {
      item.addEventListener('click', function () {
        const modelId = item.getAttribute('data-model-id');
        selectModel(modelId);
        domCache['model-dropdown'].classList.remove('open');
      });
    });

    // 分组折叠
    domCache['model-dropdown'].querySelectorAll('.model-group-header').forEach(function (header) {
      header.addEventListener('click', function () {
        const provider = header.getAttribute('data-provider');
        const items = domCache['model-dropdown'].querySelector('.model-group-items[data-provider="' + provider + '"]');
        if (items) {
          items.classList.toggle('collapsed');
          header.querySelector('span').textContent = items.classList.contains('collapsed') ? '▶' : '▼';
        }
      });
    });
  }

  function updateModelDisplay() {
    if (!domCache['model-select-trigger']) return;
    const model = getModel();
    if (model) {
      domCache['model-select-trigger'].innerHTML = (model.icon || '🤖') + ' ' + Utils.escapeHtml(model.name);
    }
  }

  function renderMessages() {
    if (!domCache['chat-messages']) return;

    if (!currentMessages || currentMessages.length === 0) {
      domCache['chat-messages'].innerHTML = `
        <div class="chat-welcome">
          <div class="welcome-icon">✨</div>
          <div class="welcome-title">你好，我是 AI 聚合助手</div>
          <div class="welcome-subtitle">聚合 50+ 大模型，智能回答你的任何问题。<br>支持代码高亮、Markdown 渲染、流式输出。</div>
          <div class="welcome-suggestions">
            <span class="welcome-suggestion" data-prompt="用Python写一个快速排序算法">Python快速排序</span>
            <span class="welcome-suggestion" data-prompt="解释量子计算的基本原理">解释量子计算</span>
            <span class="welcome-suggestion" data-prompt="帮我写一份商业计划书大纲">写商业计划书</span>
            <span class="welcome-suggestion" data-prompt="比较React和Vue的优缺点">React vs Vue</span>
          </div>
        </div>
      `;

      // 建议点击
      domCache['chat-messages'].querySelectorAll('.welcome-suggestion').forEach(function (el) {
        el.addEventListener('click', function () {
          const prompt = el.getAttribute('data-prompt');
          if (domCache['chat-input']) {
            domCache['chat-input'].value = prompt;
            updateCharCount();
            sendMessage(prompt);
          }
        });
      });

      return;
    }

    let html = '';
    currentMessages.forEach(function (msg) {
      if (msg.role === 'system') return;

      const isUser = msg.role === 'user';
      const modelIcon = isUser ? '' : (getModel() ? getModel().icon || '🤖' : '🤖');

      html += '<div class="message-row ' + msg.role + '" data-msg-id="' + msg.id + '">';
      html += '<div class="message-avatar ' + msg.role + '">' + (isUser ? (AuthManager.getCurrentUser() ? (AuthManager.getCurrentUser().email || '?')[0].toUpperCase() : 'U') : modelIcon) + '</div>';
      html += '<div class="message-body">';
      html += '<div class="message-bubble ' + msg.role + '" id="bubble-' + msg.id + '">';

      if (msg.content) {
        html += renderMarkdown(msg.content);
      } else if (msg.streaming) {
        html += '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
      }

      if (msg.streaming) {
        html += '<span class="stream-cursor" id="cursor-' + msg.id + '"></span>';
      }

      html += '</div>';
      html += '<div class="message-time">' + Utils.formatRelativeTime(msg.created_at) + '</div>';
      html += '</div>';
      html += '</div>';
    });

    // 最后一条正在流式输出时显示打字指示器
    if (isProcessing && currentMessages.length > 0) {
      const last = currentMessages[currentMessages.length - 1];
      if (last.role === 'assistant' && !last.content && last.streaming) {
        html += '<div class="message-row assistant">';
        html += '<div class="message-avatar assistant">' + (getModel() ? getModel().icon || '🤖' : '🤖') + '</div>';
        html += '<div class="message-body"><div class="message-bubble assistant">';
        html += '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
        html += '</div></div></div>';
      }
    }

    domCache['chat-messages'].innerHTML = html;

    // 绑定代码复制按钮
    domCache['chat-messages'].querySelectorAll('.code-copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const code = btn.getAttribute('data-code');
        Utils.copyToClipboard(code).then(function () {
          btn.textContent = '已复制';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = '复制';
            btn.classList.remove('copied');
          }, 2000);
        });
      });
    });
  }

  function updateMessageContent(msgId, content, streaming) {
    const bubble = document.getElementById('bubble-' + msgId);
    if (!bubble) return;
    bubble.innerHTML = renderMarkdown(content);
    if (streaming) {
      bubble.innerHTML += '<span class="stream-cursor" id="cursor-' + msgId + '"></span>';
    }

    // 重新绑定代码复制按钮
    bubble.querySelectorAll('.code-copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const code = btn.getAttribute('data-code');
        Utils.copyToClipboard(code).then(function () {
          btn.textContent = '已复制';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = '复制';
            btn.classList.remove('copied');
          }, 2000);
        });
      });
    });
  }

  function renderMarkdown(text) {
    if (!text) return '';
    let html = text;

    // 转义HTML
    html = Utils.escapeHtml(html);

    // 代码块 (```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (match, lang, code) {
      return '<div class="code-block-wrapper">' +
        '<div class="code-block-header"><span class="code-lang">' + (lang || 'code') + '</span>' +
        '<button class="code-copy-btn" data-code="' + Utils.escapeHtml(code).replace(/"/g, '&quot;') + '">复制</button></div>' +
        '<pre><code>' + code + '</code></pre></div>';
    });

    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 粗体
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // 斜体
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // ### 标题
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 引用
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // 无序列表
    html = html.replace(/^[\-*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, function (match) {
      return '<ul>' + match + '</ul>';
    });

    // 有序列表
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // 水平线
    html = html.replace(/^---$/gm, '<hr>');

    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // 换行
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // 包裹段落
    html = '<p>' + html + '</p>';

    return html;
  }

  // ============ 事件绑定 ============

  function bindChatEvents() {
    // 模型选择器开关
    if (domCache['chat-model-selector'] && domCache['model-dropdown']) {
      domCache['chat-model-selector'].addEventListener('click', function (e) {
        e.stopPropagation();
        domCache['model-dropdown'].classList.toggle('open');
      });

      document.addEventListener('click', function () {
        domCache['model-dropdown'].classList.remove('open');
      });

      domCache['model-dropdown'].addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }

    // 侧边栏切换
    if (domCache['sidebar-toggle'] && domCache['app-layout']) {
      domCache['sidebar-toggle'].addEventListener('click', function () {
        const layout = domCache['app-layout'];
        const isCollapsed = layout.classList.contains('sidebar-collapsed');
        if (isCollapsed) {
          layout.classList.remove('sidebar-collapsed');
          domCache['sidebar-toggle'].classList.remove('collapsed');
          domCache['sidebar-toggle'].innerHTML = '◀';
        } else {
          layout.classList.add('sidebar-collapsed');
          domCache['sidebar-toggle'].classList.add('collapsed');
          domCache['sidebar-toggle'].innerHTML = '▶';
        }
      });
    }

    // 新对话
    if (domCache['sidebar-new-chat']) {
      domCache['sidebar-new-chat'].addEventListener('click', function () {
        createNewChat();
      });
    }

    // 发送按钮
    if (domCache['send-btn']) {
      domCache['send-btn'].addEventListener('click', function () {
        const content = domCache['chat-input'] ? domCache['chat-input'].value : '';
        sendMessage(content);
      });
    }

    // 输入框
    if (domCache['chat-input']) {
      domCache['chat-input'].addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const content = domCache['chat-input'].value;
          sendMessage(content);
        }
      });

      domCache['chat-input'].addEventListener('input', function () {
        updateCharCount();
        autoResizeTextarea();
      });
    }

    // 清空对话
    if (domCache['btn-clear-chat']) {
      domCache['btn-clear-chat'].addEventListener('click', function () {
        Utils.showModal({
          title: '清空对话',
          content: '确定要清空当前对话的所有消息吗？',
          confirmText: '清空',
          danger: true,
          onConfirm: function () { clearCurrentChat(); }
        });
      });
    }

    // 设置按钮
    if (domCache['btn-member']) {
      domCache['btn-member'].addEventListener('click', function () {
        if (typeof App !== 'undefined' && App.navigate) {
          App.navigate('/member');
        }
      });
    }

    // 管理按钮
    if (domCache['btn-admin']) {
      domCache['btn-admin'].addEventListener('click', function () {
        if (typeof App !== 'undefined' && App.navigate) {
          App.navigate('/admin');
        }
      });
    }
  }

  function updateCharCount() {
    if (!domCache['chat-input'] || !domCache['char-count']) return;
    const len = domCache['chat-input'].value.length;
    domCache['char-count'].textContent = len + '/8000';
    if (len > 8000) {
      domCache['char-count'].style.color = 'var(--danger)';
    } else {
      domCache['char-count'].style.color = 'var(--text-muted)';
    }
  }

  function autoResizeTextarea() {
    const ta = domCache['chat-input'];
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  function updateSendButton() {
    if (!domCache['send-btn']) return;
    if (isProcessing) {
      domCache['send-btn'].disabled = true;
      domCache['send-btn'].innerHTML = '<span class="btn-spinner"></span>';
    } else {
      domCache['send-btn'].disabled = false;
      domCache['send-btn'].innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>';
    }
  }

  function clearInput() {
    if (domCache['chat-input']) {
      domCache['chat-input'].value = '';
      domCache['chat-input'].style.height = 'auto';
      updateCharCount();
    }
  }

  function focusInput() {
    if (domCache['chat-input']) {
      domCache['chat-input'].focus();
    }
  }

  function scrollToBottom() {
    if (domCache['chat-messages']) {
      setTimeout(function () {
        const el = domCache['chat-messages'];
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    }
  }

  // ============ 公开 API ============
  return {
    init,
    renderChatPage,
    createNewChat,
    switchChat,
    deleteChat,
    sendMessage,
    selectModel,
    clearCurrentChat,
    get currentChatId() { return currentChatId; },
    get currentModel() { return currentModel; },
    get conversations() { return conversations; }
  };
})();
