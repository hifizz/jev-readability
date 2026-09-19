import { extract, createRemoteClassifier } from '/dist/index.js';
const $ = id => document.getElementById(id);
let result = null;
let tab = 'text';
const config = await fetch('/api/config').then(r => r.json());
$('connection').textContent = config.hasApiKey ? 'JEV 密钥已配置' : '本地模式 · 无需 API Key';
$('connection').classList.toggle('ready', config.hasApiKey);
function updateCount() { $('input-length').textContent = `${$('html').value.length.toLocaleString()} 字符`; }
async function loadSample(name) {
  $('html').value = await fetch(`/fixtures/${name}.html`).then(r => r.text());
  $('mode').value = name === 'documentation' ? 'documentation' : 'article'; updateCount();
}
function renderOutput() {
  if (!result) return;
  $('output').textContent = tab === 'json' ? JSON.stringify(result, null, 2) : result[tab];
  $('output').classList.toggle('reading', tab === 'text');
}
const roleNames = { main_content: '正文', navigation: '导航', related_content: '推荐', comments: '评论', advertising: '推广', metadata: '元信息', boilerplate: '模板文字', other: '其他' };
function renderDecisions() {
  $('decisions').replaceChildren(); $('warnings').replaceChildren();
  for (const warning of result.warnings) { const p = document.createElement('p'); p.textContent = warning; $('warnings').append(p); }
  for (const b of result.blocks) {
    const row = document.createElement('div'); row.className = 'decision' + (!b.keep ? ' rejected' : '') + (b.needsReview ? ' review' : '');
    const id = document.createElement('code'); id.textContent = b.candidate.id;
    const label = document.createElement('span'); label.className = 'label'; label.textContent = b.needsReview ? '待检查' : b.keep ? '保留' : '排除';
    const text = document.createElement('div'); text.className = 'sample'; text.textContent = b.candidate.text.slice(0, 180) + (b.candidate.text.length > 180 ? '…' : '');
    const p = document.createElement('div'); p.className = 'probability'; p.textContent = (b.keepProbability === null ? '本地规则' : `P(保留) ${(b.keepProbability * 100).toFixed(1)}%`) + '\n' + (roleNames[b.role] || '未分类');
    row.append(id, label, text, p); $('decisions').append(row);
  }
}
$('extract').addEventListener('click', async () => {
  const button = $('extract'); button.disabled = true; button.textContent = '正在提取…'; $('error').hidden = true;
  try {
    const modelMode = $('engine').value === 'jev';
    if (modelMode && !config.hasApiKey) throw new Error('请在项目 .env 中配置 TYPESAFE_API_KEY 后重新启动服务；也可以切换到「本地规则 · 非 JEV」。');
    result = await extract($('html').value, {
      url: $('url').value || undefined, mode: $('mode').value,
      strategy: modelMode ? 'jev' : 'heuristic',
      classifier: modelMode ? createRemoteClassifier({ endpoint: '/api/classify', headers: { 'X-Demo-Token': config.sessionToken } }) : undefined,
      fallback: 'error',
    });
    $('empty').hidden = true; $('output').hidden = false; $('copy').disabled = false; $('decisions-panel').hidden = false;
    const s = result.stats;
    $('metric-candidates').textContent = s.candidateBlocks;
    $('metric-kept').textContent = s.keptBlocks;
    $('metric-review').textContent = s.reviewBlocks;
    $('metric-requests').textContent = result.usage.requests;
    $('metric-time').textContent = `${s.totalMs.toFixed(0)} ms`;
    $('result-method').textContent = result.method === 'jev' ? `真实 JEV · ${result.usage.models.join(', ')}` : '本地规则结果 · 未调用 JEV';
    $('notice').textContent = result.method === 'jev' ? '本次调用了真实 JEV。耗时包含请求往返；单页结果不代表普遍准确率。' : '当前是本地规则结果，不是 JEV 的推理结果。代码、表格与正文提取流程可以离线验证。';
    renderOutput(); renderDecisions();
  } catch (error) { $('error').hidden = false; $('error').textContent = error.message; }
  finally { button.disabled = false; button.textContent = '开始提取 ↗'; }
});
for (const btn of document.querySelectorAll('[data-tab]')) btn.addEventListener('click', () => {
  tab = btn.dataset.tab;
  for (const b of document.querySelectorAll('[data-tab]')) { b.classList.toggle('active', b === btn); b.setAttribute('aria-selected', String(b === btn)); }
  renderOutput();
});
$('sample-article').addEventListener('click', () => loadSample('article'));
$('sample-doc').addEventListener('click', () => loadSample('documentation'));
$('html').addEventListener('input', updateCount);
$('file').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 2_000_000) { $('error').hidden = false; $('error').textContent = '演示页只接受不超过 2 MB 的 HTML 文件。'; return; }
  $('html').value = await file.text(); updateCount();
});
$('copy').addEventListener('click', async () => {
  if (!result) return;
  try { await navigator.clipboard.writeText(result.markdown); $('copy').textContent = '已复制'; setTimeout(() => $('copy').textContent = '复制 Markdown', 1600); }
  catch { $('error').hidden = false; $('error').textContent = '浏览器未允许剪贴板访问，请切换到 Markdown 标签手动复制。'; }
});
await loadSample('article');
