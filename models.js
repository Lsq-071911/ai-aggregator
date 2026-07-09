/**
 * models.js — AI 模型配置（OpenRouter 聚合 50+ 模型）
 * ============================================================
 * 所有模型通过 OpenRouter 统一代理访问。
 * 数据来源：https://openrouter.ai/models
 */

const ModelRegistry = (function () {
  'use strict';

  /**
   * 模型原始数据数组
   */
  const MODELS = [
    // ── OpenAI ──
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', category: 'premium', desc: '多模态旗舰模型，支持视觉理解', contextWindow: 128000, maxTokens: 4096, pricing: { input: 2.50, output: 10.00 }, tags: ['multimodal', 'fast', 'vision'], icon: '⚡' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', category: 'premium', desc: '轻量高效，性价比之王', contextWindow: 128000, maxTokens: 16384, pricing: { input: 0.15, output: 0.60 }, tags: ['fast', 'cheap'], icon: '💨' },
    { id: 'openai/o3-mini', name: 'o3 Mini', provider: 'OpenAI', category: 'premium', desc: '推理增强模型，擅长复杂逻辑', contextWindow: 200000, maxTokens: 100000, pricing: { input: 1.10, output: 4.40 }, tags: ['reasoning', 'math'], icon: '🧠' },
    { id: 'openai/gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', category: 'premium', desc: '最新旗舰，全面升级', contextWindow: 1000000, maxTokens: 32768, pricing: { input: 2.00, output: 8.00 }, tags: ['latest', 'coding'], icon: '🌟' },

    // ── Anthropic ──
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', category: 'premium', desc: '编程与长文写作顶尖', contextWindow: 200000, maxTokens: 8192, pricing: { input: 3.00, output: 15.00 }, tags: ['coding', 'writing'], icon: '🧩' },
    { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', category: 'premium', desc: '深度分析，学术研究首选', contextWindow: 200000, maxTokens: 4096, pricing: { input: 15.00, output: 75.00 }, tags: ['analysis', 'research'], icon: '🔬' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', category: 'free', desc: '极速响应，轻量对话', contextWindow: 200000, maxTokens: 4096, pricing: { input: 0.25, output: 1.25 }, tags: ['fast', 'cheap'], icon: '⚡' },

    // ── Google ──
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', category: 'premium', desc: 'Google 最新旗舰，超长上下文', contextWindow: 1000000, maxTokens: 65536, pricing: { input: 1.25, output: 10.00 }, tags: ['long-context', 'multimodal'], icon: '💎' },
    { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', category: 'premium', desc: '极速推理，高吞吐', contextWindow: 1000000, maxTokens: 8192, pricing: { input: 0.10, output: 0.40 }, tags: ['fast', 'cheap'], icon: '⚡' },
    { id: 'google/gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'Google', category: 'free', desc: '免费轻量，日常对话', contextWindow: 1000000, maxTokens: 8192, pricing: { input: 0, output: 0 }, tags: ['free', 'fast'], icon: '🆓' },

    // ── DeepSeek ──
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek', category: 'premium', desc: '国产顶尖通用模型，高性价比', contextWindow: 65536, maxTokens: 8192, pricing: { input: 0.27, output: 1.10 }, tags: ['chinese', 'coding'], icon: '🐋' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', category: 'premium', desc: '推理链增强，数学逻辑王者', contextWindow: 65536, maxTokens: 8192, pricing: { input: 0.55, output: 2.19 }, tags: ['reasoning', 'math'], icon: '🧮' },

    // ── Meta ──
    { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'Meta', category: 'free', desc: 'Meta 开源最强，免费可用', contextWindow: 1000000, maxTokens: 8192, pricing: { input: 0, output: 0 }, tags: ['free', 'open-source'], icon: '🦙' },
    { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout', provider: 'Meta', category: 'free', desc: '轻量开源，快速部署', contextWindow: 1000000, maxTokens: 8192, pricing: { input: 0, output: 0 }, tags: ['free', 'fast'], icon: '🦙' },

    // ── 阿里云 ──
    { id: 'qwen/qwen-max', name: '通义千问 Max', provider: '阿里云', category: 'premium', desc: '阿里旗舰，中文能力顶尖', contextWindow: 32768, maxTokens: 8192, pricing: { input: 2.50, output: 10.00 }, tags: ['chinese', 'writing'], icon: '☁️' },
    { id: 'qwen/qwen-plus', name: '通义千问 Plus', provider: '阿里云', category: 'premium', desc: '能力均衡，性价比高', contextWindow: 131072, maxTokens: 8192, pricing: { input: 0.80, output: 2.00 }, tags: ['chinese', 'balanced'], icon: '☁️' },
    { id: 'qwen/qwq-32b', name: 'QwQ-32B', provider: '阿里云', category: 'free', desc: '推理增强开源模型', contextWindow: 131072, maxTokens: 8192, pricing: { input: 0, output: 0 }, tags: ['free', 'reasoning', 'chinese'], icon: '💭' },

    // ── 智谱 ──
    { id: 'zhipuai/glm-4', name: 'GLM-4', provider: '智谱', category: 'premium', desc: '智谱旗舰，多模态理解', contextWindow: 128000, maxTokens: 4096, pricing: { input: 2.00, output: 8.00 }, tags: ['chinese', 'multimodal'], icon: '🔷' },
    { id: 'zhipuai/glm-4-flash', name: 'GLM-4 Flash', provider: '智谱', category: 'free', desc: '免费高速，日常使用', contextWindow: 128000, maxTokens: 4096, pricing: { input: 0, output: 0 }, tags: ['free', 'fast', 'chinese'], icon: '⏩' },

    // ── Mistral ──
    { id: 'mistral/mistral-large', name: 'Mistral Large', provider: 'Mistral', category: 'premium', desc: '欧洲顶尖，多语言优秀', contextWindow: 128000, maxTokens: 8192, pricing: { input: 2.00, output: 6.00 }, tags: ['multilingual', 'balanced'], icon: '🌪️' },
    { id: 'mistral/mistral-small', name: 'Mistral Small', provider: 'Mistral', category: 'free', desc: '轻量级，快速推理', contextWindow: 32000, maxTokens: 4096, pricing: { input: 0, output: 0 }, tags: ['free', 'fast'], icon: '💨' },

    // ── Cohere ──
    { id: 'cohere/command-r-plus', name: 'Command R+', provider: 'Cohere', category: 'premium', desc: 'RAG 与企业场景优化', contextWindow: 128000, maxTokens: 4096, pricing: { input: 2.50, output: 10.00 }, tags: ['rag', 'enterprise'], icon: '🎯' },
    { id: 'cohere/command-r', name: 'Command R', provider: 'Cohere', category: 'premium', desc: '高效指令遵循', contextWindow: 128000, maxTokens: 4096, pricing: { input: 0.50, output: 1.50 }, tags: ['instruction', 'balanced'], icon: '🎯' },

    // ── xAI ──
    { id: 'x-ai/grok-2', name: 'Grok-2', provider: 'xAI', category: 'premium', desc: 'Elon Musk 旗下，实时信息', contextWindow: 32768, maxTokens: 4096, pricing: { input: 2.00, output: 8.00 }, tags: ['realtime', 'fun'], icon: '🚀' },

    // ── Perplexity ──
    { id: 'perplexity/sonar', name: 'Sonar', provider: 'Perplexity', category: 'premium', desc: '联网搜索增强', contextWindow: 127000, maxTokens: 4096, pricing: { input: 1.00, output: 1.00 }, tags: ['search', 'realtime'], icon: '🔍' },

    // ── 更多免费模型 ──
    { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', provider: 'Google', category: 'free', desc: '开源高效，免费可用', contextWindow: 8192, maxTokens: 4096, pricing: { input: 0, output: 0 }, tags: ['free', 'open-source'], icon: '💡' },
    { id: 'microsoft/phi-4', name: 'Phi-4', provider: 'Microsoft', category: 'free', desc: '微软小模型，推理强', contextWindow: 16384, maxTokens: 4096, pricing: { input: 0, output: 0 }, tags: ['free', 'reasoning'], icon: '🔲' },
    { id: 'nvidia/llama-3.1-nemotron-70b', name: 'Nemotron 70B', provider: 'NVIDIA', category: 'free', desc: 'NVIDIA 优化免费模型', contextWindow: 131072, maxTokens: 4096, pricing: { input: 0, output: 0 }, tags: ['free', 'enterprise'], icon: '🟢' },
    { id: 'sao10k/l3.3-euryale-70b', name: 'Euryale 70B', provider: 'Sao10K', category: 'free', desc: '创意写作免费模型', contextWindow: 131072, maxTokens: 4096, pricing: { input: 0, output: 0 }, tags: ['free', 'creative'], icon: '✍️' },
    { id: 'liquid/lfm-40b', name: 'LFM 40B', provider: 'Liquid AI', category: 'free', desc: '新型架构，高效推理', contextWindow: 32768, maxTokens: 4096, pricing: { input: 0, output: 0 }, tags: ['free', 'efficient'], icon: '💧' },
    { id: 'cognitivecomputations/dolphin3.0-r1-mistral-24b', name: 'Dolphin 3.0 R1', provider: 'Cognitive', category: 'free', desc: '无审查开源模型', contextWindow: 32768, maxTokens: 4096, pricing: { input: 0, output: 0 }, tags: ['free', 'uncensored'], icon: '🐬' },
    { id: 'moonshotai/moonlight-16b-a3b', name: 'Moonlight 16B', provider: '月之暗面', category: 'free', desc: 'MoE架构免费模型', contextWindow: 32768, maxTokens: 4096, pricing: { input: 0, output: 0 }, tags: ['free', 'moe', 'chinese'], icon: '🌙' }
  ];

  // 索引缓存
  let providerIndex = null;
  let categoryIndex = null;

  function buildIndexes() {
    if (providerIndex) return;
    providerIndex = {};
    categoryIndex = {};
    MODELS.forEach(function (m) {
      if (!providerIndex[m.provider]) providerIndex[m.provider] = [];
      providerIndex[m.provider].push(m);
      if (!categoryIndex[m.category]) categoryIndex[m.category] = [];
      categoryIndex[m.category].push(m);
    });
  }

  // ============ 公开 API ============

  function getAllModels() {
    return MODELS.slice();
  }

  function getModelsByProvider() {
    buildIndexes();
    return Object.assign({}, providerIndex);
  }

  function getModelById(id) {
    return MODELS.find(function (m) { return m.id === id; }) || null;
  }

  function getFreeModels() {
    buildIndexes();
    return (categoryIndex.free || []).slice();
  }

  function getPremiumModels() {
    buildIndexes();
    return (categoryIndex.premium || []).slice();
  }

  function getModelsByCategory(category) {
    buildIndexes();
    return (categoryIndex[category] || []).slice();
  }

  function searchModels(query) {
    if (!query) return getAllModels();
    const q = query.toLowerCase();
    return MODELS.filter(function (m) {
      return m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.desc.toLowerCase().includes(q) ||
        m.tags.some(function (t) { return t.toLowerCase().includes(q); });
    });
  }

  function getPopularModels(limit) {
    limit = limit || 8;
    // 热门推荐：高质量 + 常用
    const popularIds = [
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.5-pro',
      'deepseek/deepseek-chat',
      'qwen/qwen-max',
      'google/gemini-2.0-flash',
      'meta-llama/llama-4-maverick',
      'anthropic/claude-3-haiku',
      'deepseek/deepseek-r1',
      'openai/o3-mini',
      'qwen/qwq-32b'
    ];
    const result = [];
    popularIds.forEach(function (id) {
      const m = getModelById(id);
      if (m && result.length < limit) result.push(m);
    });
    // 补齐
    MODELS.forEach(function (m) {
      if (result.length >= limit) return;
      if (result.indexOf(m) === -1) result.push(m);
    });
    return result;
  }

  function getProviders() {
    buildIndexes();
    return Object.keys(providerIndex).sort();
  }

  return {
    getAllModels,
    getModelsByProvider,
    getModelById,
    getFreeModels,
    getPremiumModels,
    getModelsByCategory,
    searchModels,
    getPopularModels,
    getProviders
  };
})();
