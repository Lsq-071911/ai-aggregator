/**
 * api.js — AI API 调用封装（OpenRouter）
 * ============================================================
 * 通过 OpenRouter 统一代理访问所有大模型 API。
 */

const ApiService = (function () {
  'use strict';

  const API_BASE = 'https://openrouter.ai/api/v1';
  const DEFAULT_MODEL = 'openai/gpt-4o-mini';
  const MAX_RETRIES = 3;
  const REQUEST_TIMEOUT = 60000;

  let userApiKey = null;
  let systemApiKey = null;
  let currentController = null;

  // ============ 配置 ============

  function init(apiKey) {
    userApiKey = apiKey || null;
    // 尝试从 localStorage 恢复
    if (!userApiKey) {
      userApiKey = Utils.storage('openrouter_api_key');
    }
  }

  function getKey() {
    return userApiKey || systemApiKey || null;
  }

  function hasKey() {
    return !!getKey();
  }

  function setSystemKey(key) {
    systemApiKey = key;
  }

  function setUserKey(key) {
    userApiKey = key;
    if (key) {
      Utils.storage('openrouter_api_key', key);
    } else {
      Utils.storage('openrouter_api_key', null);
    }
  }

  // ============ 流式聊天 ============

  /**
   * 流式聊天请求
   * @param {Array} messages - [{role:'user'|'assistant'|'system', content:'...'}]
   * @param {String} model - OpenRouter 模型 ID
   * @param {Object} callbacks - { onChunk(text), onDone(fullText, usage), onError(msg), onThinking(content) }
   * @param {Object} options - { temperature, maxTokens, topP }
   */
  function streamChat(messages, model, callbacks, options) {
    model = model || DEFAULT_MODEL;
    options = options || {};

    if (!hasKey()) {
      if (callbacks.onError) callbacks.onError('请先配置 API Key（系统设置中可配置 API Key）');
      return;
    }

    const body = {
      model: model,
      messages: messages.slice(-100), // 最多100条消息
      stream: true,
      temperature: options.temperature !== undefined ? options.temperature : 0.7,
      max_tokens: options.maxTokens || 4096,
      top_p: options.topP !== undefined ? options.topP : 1
    };

    if (options.reasoningEffort) {
      body.reasoning = { effort: options.reasoningEffort };
    }

    // 创建 AbortController
    currentController = new AbortController();

    executeStreamWithRetry(body, callbacks, 0);
  }

  function executeStreamWithRetry(body, callbacks, retryCount) {
    const doRequest = function () {
      const controller = currentController;
      if (!controller || controller.signal.aborted) return;

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getKey(),
        'HTTP-Referer': window.location.origin,
        'X-Title': 'AI聚合'
      };

      fetch(API_BASE + '/chat/completions', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: controller.signal
      })
        .then(function (response) {
          if (!response.ok) {
            return handleApiError(response, body, callbacks, retryCount);
          }
          processStream(response, callbacks);
        })
        .catch(function (err) {
          if (err.name === 'AbortError') {
            // 取消是正常行为，不报错
            return;
          }

          console.error('[API] 请求失败:', err.message);

          if (retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000;
            console.log('[API] 第 ' + (retryCount + 1) + ' 次重试，等待 ' + delay + 'ms...');
            setTimeout(function () {
              if (currentController && !currentController.signal.aborted) {
                executeStreamWithRetry(body, callbacks, retryCount + 1);
              }
            }, delay);
          } else {
            if (callbacks.onError) {
              callbacks.onError('网络请求失败: ' + err.message);
            }
          }
        });
    };

    doRequest();
  }

  function handleApiError(response, body, callbacks, retryCount) {
    response.json().then(function (data) {
      const errorMsg = data.error ? (data.error.message || JSON.stringify(data.error)) : '未知API错误';

      // 429 速率限制 → 等待并重试
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        const delay = Math.max(retryAfter * 1000, Math.pow(2, retryCount) * 2000);
        console.log('[API] 速率限制，等待 ' + delay + 'ms 重试...');
        setTimeout(function () {
          if (currentController && !currentController.signal.aborted) {
            executeStreamWithRetry(body, callbacks, retryCount + 1);
          }
        }, delay);
        return;
      }

      // 401/403 → Token 无效
      if (response.status === 401 || response.status === 403) {
        if (callbacks.onError) callbacks.onError('API Key 无效或已过期，请在系统设置中重新配置');
        return;
      }

      // 402 → 余额不足
      if (response.status === 402) {
        if (callbacks.onError) callbacks.onError('OpenRouter 账户余额不足，请检查API Key余额');
        return;
      }

      // 其他错误
      if (retryCount < MAX_RETRIES && (response.status >= 500 || response.status === 0)) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(function () {
          if (currentController && !currentController.signal.aborted) {
            executeStreamWithRetry(body, callbacks, retryCount + 1);
          }
        }, delay);
      } else {
        if (callbacks.onError) callbacks.onError('API 错误: ' + errorMsg);
      }
    }).catch(function () {
      if (callbacks.onError) callbacks.onError('API 错误 (HTTP ' + response.status + ')');
    });
  }

  function processStream(response, callbacks) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    function read() {
      if (!currentController || currentController.signal.aborted) {
        reader.cancel();
        return;
      }

      reader.read().then(function (result) {
        if (result.done) {
          // 流结束
          if (callbacks.onDone) callbacks.onDone(fullText);
          return;
        }

        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || !line.startsWith('data: ')) continue;

          const data = line.slice(6);
          if (data === '[DONE]') {
            if (callbacks.onDone) callbacks.onDone(fullText);
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices && parsed.choices[0];

            if (choice) {
              // 处理普通内容
              const delta = choice.delta;
              if (delta && delta.content) {
                fullText += delta.content;
                if (callbacks.onChunk) callbacks.onChunk(delta.content);
              }

              // 处理推理内容（DeepSeek R1、o3-mini等）
              if (delta && delta.reasoning_content) {
                if (callbacks.onThinking) callbacks.onThinking(delta.reasoning_content);
              }
            }
          } catch (e) {
            // 忽略解析错误，继续处理
          }
        }

        read();
      }).catch(function (err) {
        if (err.name !== 'AbortError') {
          console.error('[API] 读取流失败:', err.message);
          if (callbacks.onError) callbacks.onError('读取流失败: ' + err.message);
        }
      });
    }

    read();
  }

  function cancelStream() {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }
  }

  function isStreaming() {
    return currentController !== null && !currentController.signal.aborted;
  }

  // ============ 模型测试 ============

  function testModel(modelId) {
    if (!hasKey()) {
      return Promise.reject(new Error('未配置 API Key'));
    }

    return fetch(API_BASE + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getKey(),
        'HTTP-Referer': window.location.origin
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5
      }),
      signal: AbortSignal.timeout(15000)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (data) {
          throw new Error(data.error ? data.error.message : '模型不可用 (HTTP ' + res.status + ')');
        });
      }
      return res.json();
    }).then(function (data) {
      return { ok: true, model: data.model, usage: data.usage };
    });
  }

  // ============ 使用情况 ============

  function getUsage() {
    if (!hasKey()) {
      return Promise.reject(new Error('未配置 API Key'));
    }

    // 尝试获取当前 Key 的额度信息
    return fetch(API_BASE + '/auth/key', {
      headers: {
        'Authorization': 'Bearer ' + getKey()
      },
      signal: AbortSignal.timeout(10000)
    }).then(function (res) {
      if (!res.ok) throw new Error('无法获取使用情况');
      return res.json();
    }).then(function (data) {
      return {
        label: data.label || 'Unknown',
        limit: data.limit || 0,
        usage: data.usage || 0,
        limitRemaining: data.limit_remaining || 0,
        isFreeTier: data.is_free_tier || false
      };
    });
  }

  // 初始化
  init();

  return {
    init,
    getKey,
    hasKey,
    setSystemKey,
    setUserKey,
    streamChat,
    cancelStream,
    isStreaming,
    testModel,
    getUsage
  };
})();
