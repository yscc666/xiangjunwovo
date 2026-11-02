/* MolluscaDB · 前端逻辑（纯静态，无后端依赖） */
(() => {
  'use strict';

  const RANK_ZH = {
    phylum: '门', class: '纲', subclass: '亚纲', order: '目',
    superfamily: '总科', family: '科', genus: '属',
  };

  const state = {
    data: null,
    view: 'home',
    current: null,
    charts: {},
    query: '',
    fSpecies: '',
    fLen: '',
    fSort: 'len-desc',
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n).toLocaleString('en-US');
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

  /* ---------------- 主题 ---------------- */
  function initTheme() {
    const saved = localStorage.getItem('mol_theme');
    if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    syncThemeBtn();
  }
  function syncThemeBtn() {
    $('#themeBtn').textContent = isDark() ? '☀️' : '🌙';
  }
  function toggleTheme() {
    const dark = isDark();
    if (dark) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('mol_theme', dark ? 'light' : 'dark');
    syncThemeBtn();
    Object.keys(state.charts).forEach(k => renderChart(k));
  }

  /* ---------------- 路由 ---------------- */
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || 'home';
    const [view, arg] = h.split('/');
    return { view, arg };
  }

  function route() {
    const { view, arg } = parseHash();
    const known = ['home', 'species', 'sequence', 'taxonomy', 'about'];
    const v = known.includes(view) ? view : 'home';
    state.view = v;

    $$('main > div').forEach(el => { el.hidden = true; });
    const vEl = document.getElementById('view-' + v);
    if (vEl) vEl.hidden = false;

    $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === v));

    if (v === 'species') {
      if (arg && state.data) renderDetail(arg);
      else showIndex();
    }
    if (v === 'sequence') renderSequence();
    if (v === 'taxonomy') { renderLineageTable(); }

    // 延迟到可见后再画图，避免尺寸为 0
    requestAnimationFrame(() => {
      if (v === 'home') renderChart('coi');
      if (v === 'sequence') renderChart('seq');
      if (v === 'taxonomy') renderChart('tree');
    });

    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    const { stats, species } = state.data;
    $('#pCoi').textContent = stats.coiRecords;
    $('#pGenome').textContent = stats.genomes;
    $('#sSpecies').innerHTML = stats.species + '<span>种</span>';
    $('#sCoi').innerHTML = stats.coiRecords + '<span>条</span>';
    $('#sGenome').innerHTML = stats.genomes + '<span>个</span>';
    $('#sProt').innerHTML = num(stats.refseqProtein) + '<span>条</span>';
    $('#homeGrid').innerHTML = species.map(cardHTML).join('');
    bindCards($('#homeGrid'));
  }

  function cardHTML(s) {
    const statusChip = s.nameOk
      ? '<span class="chip ok">接受名</span>'
      : `<span class="chip warn" title="${esc(s.unacceptReason)}">${esc(s.nameStatus)}</span>`;
    const coiText = s.coi.length
      ? `${s.coi.length} 条 COI`
      : `<span style="color:var(--coral)">无公开 COI</span>`;
    return `
      <a class="card" href="#species/${esc(s.id)}" role="button" aria-label="查看 ${esc(s.cn)} 档案">
        <div class="num">${esc(s.id)}</div>
        <div class="cn">${esc(s.cn)}</div>
        <div class="sci">${esc(s.sciLabel)}</div>
        <div class="chips">
          <span class="chip">${esc(s.classZh)}</span>
          <span class="chip">${esc(s.familyZh)}</span>
          ${statusChip}
        </div>
        <div class="bar">
          <span>${coiText}${s.genomes.length ? ` · ${s.genomes.length} 基因组` : ''}</span>
          <span class="go">档案 →</span>
        </div>
      </a>`;
  }

  function bindCards(root) {
    $$('.card', root).forEach(c => c.addEventListener('click', e => {
      e.preventDefault();
      location.hash = c.getAttribute('href').slice(1);
    }));
  }

  /* ---------------- 物种索引 ---------------- */
  function showIndex() {
    $('#speciesIndex').hidden = false;
    $('#speciesDetail').hidden = true;
    $('#speciesDetail').innerHTML = '';
    const q = ($('#speciesFilter')?.value || '').trim().toLowerCase();
    const list = state.data.species.filter(s => !q ||
      [s.cn, s.sciLabel, s.sciAccepted, s.familyZh, s.familyLa, s.classZh].join(' ').toLowerCase().includes(q));
    $('#speciesGrid').innerHTML = list.map(cardHTML).join('') ||
      '<p style="grid-column:1/-1">没有匹配的物种。</p>';
    bindCards($('#speciesGrid'));
  }

  /* ---------------- 物种详情 ---------------- */
  function cleanDef(def, acc) {
    return String(def || '').replace(/^\s*[A-Z]{1,3}_?\d+(\.\d+)?\s*/, '').replace(/\s+/g, ' ').trim();
  }

  function renderDetail(id) {
    const s = state.data.species.find(x => x.id === id);
    if (!s) { showIndex(); return; }
    state.current = s;
    $('#speciesIndex').hidden = true;
    const d = $('#speciesDetail');
    d.hidden = false;

    // 分类谱系以 WoRMS 为权威口径（纲/科），其余阶元取 NCBI
    let lineageNodes = s.lineage.map(n => {
      if (n.rank === 'class') return { rank: n.rank, name: s.classLa };
      if (n.rank === 'family') return { rank: n.rank, name: s.familyLa };
      return n;
    });
    if (!lineageNodes.some(n => n.rank === 'class')) lineageNodes.unshift({ rank: 'class', name: s.classLa });
    if (!lineageNodes.some(n => n.rank === 'family')) lineageNodes.push({ rank: 'family', name: s.familyLa });
    const lineage = lineageNodes.map(n =>
      `<span class="node">${esc(RANK_ZH[n.rank] || n.rank)}：<b>${esc(n.name)}</b></span>`
    ).join('<span class="sep">›</span>');

    const coiRows = s.coi.map((r, i) => `
      <tr>
        <td class="mono nowrap"><a href="https://www.ncbi.nlm.nih.gov/nuccore/${esc(r.acc)}" target="_blank" rel="noopener">${esc(r.acc)}</a></td>
        <td class="mono nowrap">${r.len}</td>
        <td class="mono nowrap">${r.gc}</td>
        <td class="desc">${esc(cleanDef(r.def, r.acc).slice(0, 120))}${cleanDef(r.def, r.acc).length > 120 ? '…' : ''}</td>
        <td class="nowrap" style="text-align:right"><button class="btn" data-seq="${i}">查看序列</button></td>
      </tr>
      <tr class="seqrow" id="seq-${esc(s.id)}-${i}" hidden><td colspan="5">
        <div class="seqbox">
          <pre>${esc(r.seq.replace(/(.{70})/g, '$1\n'))}</pre>
          <div class="btn-row">
            <button class="btn" data-copy="${i}">复制 FASTA</button>
            <button class="btn" data-close="${i}">收起</button>
          </div>
        </div>
      </td></tr>`).join('');

    const microRows = (s.otherSeq || []).map(r => `
      <tr><td class="mono"><a href="https://www.ncbi.nlm.nih.gov/nuccore/${esc(r.acc)}" target="_blank" rel="noopener">${esc(r.acc)}</a></td>
      <td class="mono nowrap">${r.len}</td><td class="nowrap">${esc(r.kind)}</td>
      <td class="desc">${esc(cleanDef(r.def, r.acc).slice(0, 80))}</td></tr>`).join('');

    const genomeRows = s.genomes.map(g => `
      <tr>
        <td class="mono"><a href="https://www.ncbi.nlm.nih.gov/datasets/genome/${esc(g.acc)}/" target="_blank" rel="noopener">${esc(g.acc)}</a></td>
        <td>${esc(g.name || '')}</td>
        <td>${esc(g.level || '')}</td>
        <td class="mono">${g.size ? (g.size / 1e6).toFixed(0) + ' Mb' : '—'}</td>
      </tr>`).join('');

    const statusChip = s.nameOk
      ? '<span class="chip ok">WoRMS 接受名</span>'
      : `<span class="chip warn">${esc(s.nameStatus)}</span>`;

    d.innerHTML = `
      <button class="back" id="backBtn">← 返回物种列表</button>
      <div class="sec-head" style="margin-bottom:18px">
        <div>
          <div class="num mono" style="color:var(--muted);font-size:.8rem">${esc(s.id)}</div>
          <h2 style="margin:.1em 0 4px">${esc(s.cn)}</h2>
          <div class="sci" style="font-style:italic;color:var(--muted);font-size:1rem">${esc(s.sciLabel)}${s.authority ? ` <span style="font-style:normal;font-size:.85rem">${esc(s.authority)}</span>` : ''}</div>
          <div class="chips" style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
            <span class="chip">${esc(s.classZh)}</span>
            <span class="chip">${esc(s.familyZh)}</span>
            <span class="chip">${esc(s.orderZh || s.orderLa)}</span>
            ${statusChip}
          </div>
        </div>
        <a class="btn" href="https://www.marinespecies.org/aphia.php?p=taxdetails&id=${esc(s.aphiaId || '')}" target="_blank" rel="noopener">WoRMS 原始记录 ↗</a>
      </div>

      <div class="detail-grid">
        <div>
          <div class="panel">
            <h3><span class="dot"></span>形态特征</h3>
            <p style="color:var(--text)">${esc(s.morphology)}</p>
            <h3 style="margin-top:18px"><span class="dot"></span>分布与生境</h3>
            <p style="color:var(--text);margin-bottom:0">${esc(s.habitat)}</p>
          </div>

          ${s.note ? `<div class="panel"><h3><span class="dot"></span>数据备注</h3><div class="note" style="border-radius:8px">${esc(s.note)}</div></div>` : ''}

          <div class="panel">
            <h3><span class="dot"></span>COI 条形码 <span class="tag">${s.coi.length} 条已收录 / 公开 ${s.coiCount} 条</span></h3>
            ${s.coi.length ? `
              <table>
                <thead><tr><th>登录号</th><th>长度</th><th>GC%</th><th>描述</th><th></th></tr></thead>
                <tbody>${coiRows}</tbody>
              </table>
              <div class="btn-row"><button class="btn primary" id="dlSpecies">下载本物种 FASTA</button></div>
            ` : `
              <div class="note" style="border-radius:8px">
                <b>该物种在 NCBI 暂无公开 COI 条形码。</b>本站不以近缘种序列替代。
              </div>
              ${microRows ? `<p style="margin:14px 0 6px;font-size:.86rem">该物种现存的其他核酸记录（非条形码）：</p>
              <table><thead><tr><th>登录号</th><th>长度</th><th>类型</th><th>描述</th></tr></thead><tbody>${microRows}</tbody></table>` : ''}
            `}
          </div>
        </div>

        <div>
          <div class="panel">
            <h3><span class="dot"></span>名称核对</h3>
            <div class="namebox">
              <div class="row"><span class="tag">标签学名</span><b class="it">${esc(s.sciLabel)}</b></div>
              <div class="row"><span class="tag">现行接受名</span><b class="it">${esc(s.sciAccepted)}</b></div>
              ${s.synonyms.length ? `<div class="row"><span class="tag">异名</span><span class="it">${s.synonyms.map(esc).join('、')}</span></div>` : ''}
              <div class="row"><span class="tag">状态</span><span>${statusChip}${s.unacceptReason ? ` <span style="font-size:.8rem;color:var(--muted)">${esc(s.unacceptReason)}</span>` : ''}</span></div>
            </div>
          </div>

          <div class="panel">
            <h3><span class="dot"></span>分类谱系</h3>
            <div class="lineage">${lineage}</div>
            <dl class="kv" style="margin-top:16px">
              <dt>NCBI TaxID</dt><dd class="mono"><a href="https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${esc(s.taxidNcbi)}" target="_blank" rel="noopener">${esc(s.taxidNcbi || '—')}</a></dd>
              <dt>WoRMS AphiaID</dt><dd class="mono"><a href="https://www.marinespecies.org/aphia.php?p=taxdetails&id=${esc(s.aphiaId || '')}" target="_blank" rel="noopener">${esc(s.aphiaId || '—')}</a></dd>
              <dt>纲 / 科</dt><dd>${esc(s.classLa)} / ${esc(s.familyLa)}</dd>
            </dl>
          </div>

          <div class="panel">
            <h3><span class="dot"></span>数据统计</h3>
            <dl class="kv">
              <dt>公开 COI</dt><dd><b>${s.coiCount}</b> 条</dd>
              <dt>本站收录</dt><dd>${s.coi.length} 条</dd>
              <dt>RefSeq 蛋白</dt><dd>${num(s.refseqProtein)} 条</dd>
              <dt>核酸记录</dt><dd>${num(s.nucleotide)} 条</dd>
            </dl>
          </div>

          <div class="panel">
            <h3><span class="dot"></span>基因组组装</h3>
            ${s.genomes.length ? `<table><thead><tr><th>登录号</th><th>名称</th><th>水平</th><th>大小</th></tr></thead><tbody>${genomeRows}</tbody></table>`
              : '<p style="font-size:.88rem;margin:0">NCBI 暂无该物种的基因组组装记录。</p>'}
          </div>
        </div>
      </div>`;

    $('#backBtn').addEventListener('click', () => { location.hash = '#species'; });
    $$('[data-seq]', d).forEach(b => b.addEventListener('click', () => {
      const row = document.getElementById(`seq-${s.id}-${b.dataset.seq}`);
      row.hidden = !row.hidden;
      b.textContent = row.hidden ? '查看序列' : '收起';
    }));
    $$('[data-close]', d).forEach(b => b.addEventListener('click', () => {
      document.getElementById(`seq-${s.id}-${b.dataset.close}`).hidden = true;
    }));
    $$('[data-copy]', d).forEach(b => b.addEventListener('click', () => {
      const r = s.coi[+b.dataset.copy];
      copyText(`>${s.cn}|${r.acc}|len=${r.len}|GC=${r.gc}%\n${r.seq.replace(/(.{70})/g, '$1\n')}`, b);
    }));
    const dl = $('#dlSpecies');
    if (dl) dl.addEventListener('click', () => downloadFasta(s, dl));
  }

  /* ---------------- 序列页 ---------------- */
  function allRecords() {
    const out = [];
    for (const s of state.data.species) {
      for (const r of s.coi) out.push({ ...r, s });
    }
    return out;
  }

  function filteredRecords() {
    const q = state.query.toLowerCase();
    let rows = allRecords();
    if (state.fSpecies) rows = rows.filter(r => r.s.id === state.fSpecies);
    if (q) rows = rows.filter(r => (r.acc + ' ' + r.s.cn + ' ' + r.s.sciLabel + ' ' + r.def).toLowerCase().includes(q));
    if (state.fLen) {
      const [lo, hi] = state.fLen.split(':').map(x => x ? +x : null);
      rows = rows.filter(r => (lo === null || r.len >= lo) && (hi === null || r.len <= hi));
    }
    const by = {
      'len-desc': (a, b) => b.len - a.len,
      'len-asc': (a, b) => a.len - b.len,
      'gc-desc': (a, b) => b.gc - a.gc,
      'id': (a, b) => a.s.id.localeCompare(b.s.id) || b.len - a.len,
    }[state.fSort];
    return rows.sort(by);
  }

  function renderSequence() {
    if (!$('#fSpecies').dataset.filled) {
      $('#fSpecies').innerHTML = '<option value="">全部物种</option>' +
        state.data.species.map(s => `<option value="${esc(s.id)}">${esc(s.cn)} · ${esc(s.sciLabel)}</option>`).join('');
      $('#fSpecies').dataset.filled = '1';
    }
    const rows = filteredRecords();
    $('#resCount').textContent = rows.length;
    $('#seqTable').innerHTML = rows.length ? `
      <table>
        <thead><tr><th>登录号</th><th>物种</th><th>长度</th><th>GC%</th><th>描述</th><th></th></tr></thead>
        <tbody>${rows.map((r, i) => `
          <tr>
            <td class="mono"><a href="https://www.ncbi.nlm.nih.gov/nuccore/${esc(r.acc)}" target="_blank" rel="noopener">${esc(r.acc)}</a></td>
            <td>${esc(r.s.cn)}<br><span class="mono" style="color:var(--muted);font-size:.75rem">${esc(r.s.sciLabel)}</span></td>
            <td class="mono nowrap">${r.len}</td>
            <td class="mono nowrap">${r.gc}</td>
            <td class="desc">${esc(cleanDef(r.def, r.acc).slice(0, 110))}${cleanDef(r.def, r.acc).length > 110 ? '…' : ''}</td>
            <td class="nowrap" style="text-align:right">
              <button class="btn" data-show="${i}">序列</button>
              <button class="btn" data-fa="${i}">FASTA</button>
            </td>
          </tr>
          <tr class="seqrow" id="srow-${i}" hidden><td colspan="6">
            <div class="seqbox"><pre>${esc(r.seq.replace(/(.{70})/g, '$1\n'))}</pre></div>
          </td></tr>`).join('')}</tbody>
      </table>` : '<p style="padding:12px">没有符合条件的记录。</p>';

    $$('[data-show]', $('#seqTable')).forEach(b => b.addEventListener('click', () => {
      const row = document.getElementById('srow-' + b.dataset.show);
      row.hidden = !row.hidden;
      b.textContent = row.hidden ? '序列' : '收起';
    }));
    $$('[data-fa]', $('#seqTable')).forEach(b => b.addEventListener('click', () => {
      const r = rows[+b.dataset.fa];
      const fasta = `>${r.acc} ${r.s.cn} ${r.s.sciLabel} len=${r.len} GC=${r.gc}%\n${r.seq.replace(/(.{70})/g, '$1\n')}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([fasta], { type: 'text/plain' }));
      a.download = `${r.acc}.fasta`;
      a.click();
      URL.revokeObjectURL(a.href);
    }));
  }

  /* ---------------- 分类页 ---------------- */
  function buildTree() {
    const root = { name: 'Mollusca\n软体动物门', children: [] };
    const byClass = {};
    for (const s of state.data.species) {
      const cls = s.classLa;
      if (!byClass[cls]) {
        byClass[cls] = { name: `${cls}\n${s.classZh}`, children: [] };
        root.children.push(byClass[cls]);
      }
      const cnode = byClass[cls];
      const ordKey = s.orderLa || '未定';
      let onode = cnode.children.find(c => c.ord === ordKey);
      if (!onode) { onode = { name: `${ordKey}\n${s.orderZh || ''}`, ord: ordKey, children: [] }; cnode.children.push(onode); }
      let fnode = onode.children.find(c => c.fam === s.familyLa);
      if (!fnode) { fnode = { name: `${s.familyLa}\n${s.familyZh}`, fam: s.familyLa, children: [] }; onode.children.push(fnode); }
      fnode.children.push({ name: `${s.cn}\n${s.sciLabel}`, value: Math.max(s.coiCount, 0) + 1 });
    }
    return root;
  }

  function renderLineageTable() {
    $('#lineageTable').innerHTML = `
      <table>
        <thead><tr><th>编号</th><th>中文名</th><th>学名</th><th>纲</th><th>目</th><th>科</th><th>属</th></tr></thead>
        <tbody>${state.data.species.map(s => {
          const g = n => (s.lineage.find(x => x.rank === n) || {}).name || '—';
          return `<tr>
            <td class="mono">${esc(s.id)}</td>
            <td><a href="#species/${esc(s.id)}">${esc(s.cn)}</a></td>
            <td style="font-style:italic">${esc(s.sciLabel)}</td>
            <td>${esc(s.classZh)}</td>
            <td>${esc(s.orderZh || s.orderLa || '—')}</td>
            <td>${esc(s.familyZh)}</td>
            <td style="font-style:italic">${esc(g('genus'))}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  /* ---------------- 图表 ---------------- */
  const palette = () => isDark()
    ? { accent: '#55c2c9', coral: '#e88568', axis: '#93aab2', split: '#22434d', text: '#e8f1f2' }
    : { accent: '#0b6b74', coral: '#c9563a', axis: '#5f7480', split: '#e6e1d6', text: '#14313a' };

  function baseOpt(extra = {}) {
    const p = palette();
    return Object.assign({
      color: [p.accent, p.coral, '#b8935a', '#5b8ea8', '#8a9a5b'],
      textStyle: { fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif', color: p.axis },
      grid: { left: 12, right: 18, top: 28, bottom: 10, containLabel: true },
      tooltip: {
        backgroundColor: isDark() ? '#163038' : '#fff', borderColor: p.split,
        textStyle: { color: p.text, fontSize: 12 },
      },
    }, extra);
  }

  function renderChart(key) {
    const el = { coi: '#chartCoi', seq: '#chartSeq', tree: '#chartTree' }[key];
    const node = document.querySelector(el);
    if (!node || !node.offsetParent) return;
    if (state.charts[key]) { state.charts[key].dispose(); }
    const ch = echarts.init(node, null, { renderer: 'canvas' });
    state.charts[key] = ch;
    if (key === 'coi') ch.setOption(coiChart());
    if (key === 'seq') ch.setOption(seqChart());
    if (key === 'tree') ch.setOption(treeChart());
  }

  function coiChart() {
    const p = palette();
    const rows = [...state.data.species].sort((a, b) => a.coiCount - b.coiCount);
    return baseOpt({
      grid: { left: 12, right: 60, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'value', name: 'COI 记录数', nameTextStyle: { color: p.axis, fontSize: 11 }, splitLine: { lineStyle: { color: p.split } }, axisLabel: { color: p.axis } },
      yAxis: { type: 'category', data: rows.map(r => r.cn), axisLabel: { color: p.text, fontSize: 12 }, axisLine: { lineStyle: { color: p.split } } },
      tooltip: { ...baseOpt().tooltip, formatter: prm => { const r = rows[prm[0].dataIndex]; return `${r.cn} <span style="opacity:.6">${r.sciLabel}</span><br>公开 COI：<b>${r.coiCount}</b> 条`; } },
      series: [{
        type: 'bar', data: rows.map(r => r.coiCount), barWidth: '58%',
        itemStyle: {
          borderRadius: [0, 5, 5, 0],
          color: prm => rows[prm.dataIndex].coiCount === 0 ? p.coral : p.accent,
        },
        label: { show: true, position: 'right', color: p.axis, fontSize: 11, formatter: prm => prm.value === 0 ? '无公开 COI' : prm.value },
      }],
    });
  }

  function seqChart() {
    const p = palette();
    const rows = filteredRecords();
    return baseOpt({
      grid: { left: 12, right: 24, top: 34, bottom: 8, containLabel: true },
      xAxis: { type: 'value', name: '长度 (bp)', nameTextStyle: { color: p.axis, fontSize: 11 }, min: v => Math.floor(v.min / 50) * 50, splitLine: { lineStyle: { color: p.split } }, axisLabel: { color: p.axis } },
      yAxis: { type: 'value', name: 'GC (%)', nameTextStyle: { color: p.axis, fontSize: 11 }, splitLine: { lineStyle: { color: p.split } }, axisLabel: { color: p.axis } },
      tooltip: { ...baseOpt().tooltip, formatter: prm => `${prm.data.name}<br>${prm.data.value[0]} bp · GC ${prm.data.value[1]}%` },
      series: [{
        type: 'scatter', symbolSize: 11,
        data: rows.map(r => ({ name: `${r.acc}（${r.s.cn}）`, value: [r.len, r.gc], itemStyle: { color: r.s.classLa === 'Gastropoda' ? p.accent : p.coral } })),
      }],
    });
  }

  function treeChart() {
    const p = palette();
    return baseOpt({
      tooltip: { ...baseOpt().tooltip, trigger: 'item', formatter: prm => prm.name.replace('\n', ' ') },
      series: [{
        type: 'tree', data: [buildTree()],
        top: 12, bottom: 12, left: 90, right: 150,
        orient: 'LR', symbol: 'circle', symbolSize: 7,
        initialTreeDepth: 4,
        itemStyle: { color: p.accent, borderColor: p.accent },
        lineStyle: { color: p.split, width: 1.2, curveness: .45 },
        label: {
          position: 'left', verticalAlign: 'middle', align: 'right',
          fontSize: 11, color: p.text, lineHeight: 14,
          backgroundColor: isDark() ? '#12282f' : '#fff', padding: [2, 4], borderRadius: 3,
        },
        leaves: { label: { position: 'right', align: 'left', fontSize: 11 } },
        expandAndCollapse: true,
        animationDuration: 500,
      }],
    });
  }

  /* ---------------- 工具 ---------------- */
  function copyText(text, btn) {
    const done = () => { const t = btn.textContent; btn.textContent = '已复制 ✓'; setTimeout(() => btn.textContent = t, 1400); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback);
    else fallback();
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch { }
      document.body.removeChild(ta);
    }
  }

  function fastaOf(list) {
    return list.map(r => `>${r.acc} ${r.s.cn} ${r.s.sciLabel} len=${r.len} GC=${r.gc}%\n${r.seq.replace(/(.{70})/g, '$1\n')}`).join('\n');
  }

  function downloadFasta(s, btn) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([fastaOf(s.coi.map(r => ({ ...r, s })))], { type: 'text/plain' }));
    a.download = `${s.id}_${s.sciLabel.replace(/ /g, '_')}_COI.fasta`;
    a.click(); URL.revokeObjectURL(a.href);
    if (btn) { const t = btn.textContent; btn.textContent = '已下载 ✓'; setTimeout(() => btn.textContent = t, 1400); }
  }

  function renderNameIssues() {
    const bad = state.data.species.filter(s => !s.nameOk);
    $('#nameIssues').innerHTML = bad.map(s =>
      `<li><b>${esc(s.cn)}</b>：标签 <i>${esc(s.sciLabel)}</i> → 接受名 <i>${esc(s.sciAccepted)}</i>（${esc(s.nameStatus)}）</li>`
    ).join('') + '<li>其余 6 种标签学名与 WoRMS 一致；缢蛏归竹蛏科（Pharidae）正确，NCBI 归 Solecurtidae 属库间差异。</li>';
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    window.addEventListener('hashchange', route);
    $('#themeBtn').addEventListener('click', toggleTheme);

    $('#speciesFilter').addEventListener('input', showIndex);

    $('#q').addEventListener('input', e => { state.query = e.target.value; renderSequence(); renderChart('seq'); });
    $('#fSpecies').addEventListener('change', e => { state.fSpecies = e.target.value; renderSequence(); renderChart('seq'); });
    $('#fLen').addEventListener('change', e => { state.fLen = e.target.value; renderSequence(); renderChart('seq'); });
    $('#fSort').addEventListener('change', e => { state.fSort = e.target.value; renderSequence(); });
    $('#reset').addEventListener('click', () => {
      state.query = ''; state.fSpecies = ''; state.fLen = ''; state.fSort = 'len-desc';
      $('#q').value = ''; $('#fSpecies').value = ''; $('#fLen').value = ''; $('#fSort').value = 'len-desc';
      renderSequence(); renderChart('seq');
    });
    $('#dlAll').addEventListener('click', () => {
      const rows = allRecords();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([fastaOf(rows)], { type: 'text/plain' }));
      a.download = 'MolluscaDB_COI_all.fasta';
      a.click(); URL.revokeObjectURL(a.href);
    });

    $('#toTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
      $('#toTop').classList.toggle('on', window.scrollY > 600);
    }, { passive: true });

    window.addEventListener('resize', () => {
      Object.values(state.charts).forEach(c => c && c.resize());
    });

    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .12 });
    $$('.reveal').forEach(el => io.observe(el));
  }

  /* ---------------- 启动 ---------------- */
  async function boot() {
    initTheme();
    try {
      const res = await fetch('data/species.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.data = await res.json();
    } catch (err) {
      document.querySelector('main').innerHTML =
        `<div class="wrap" style="padding:80px 0"><h2>数据加载失败</h2>
         <p>无法读取 <code class="mono">data/species.json</code>（${esc(err.message)}）。</p>
         <p>若在本地直接双击打开 index.html，浏览器会因同源策略阻止 fetch；请用本地服务器打开，例如
         <code class="mono">python -m http.server 8000</code>。</p></div>`;
      return;
    }
    renderHome();
    renderNameIssues();
    bindEvents();
    route();
  }

  boot();
})();
