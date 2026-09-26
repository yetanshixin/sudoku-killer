/* ============================================================
 * app.js —— 界面交互逻辑
 * ============================================================ */
(function () {
  'use strict';

  var SIZE = 9;

  // ===== 状态 =====
  var board = emptyBoard();
  var givens = new Set();      // 用户/示例输入的格子 "r,c"
  var editable = true;         // 盘面是否处于输入态
  var stepActive = false;      // 逐步求解器是否活跃
  var stepSolver = null;
  var stepHistory = [];        // 已执行的逐步步骤，用于「上一步」恢复说明/高亮
  var candidates = null;
  var statusTimer = null;
  var showPencil = false;      // 是否显示候选小数字（默认关闭）

  // ===== 经典数独模式状态 =====
  var mode = 'classic';         // 'classic' | 'solver'
  var classicBoard = emptyBoard();
  var classicSolution = null;
  var classicGivens = new Set();
  var classicNotes = [];        // 9x9，每格为 Set 或 null
  var classicHistory = [];      // 撤销栈：单格 {r,c,prevVal,prevNote} 或全部擦除 {type:'clearAll', cells}
  var classicDifficulty = 'medium';
  var classicSelected = null;   // {r, c}
  var classicNoteMode = false;
  var classicShowNotes = false;
  var classicTimerId = null;
  var classicSeconds = 0;
  var classicDone = false;
  var classicGenerated = false;
  var classicStatusTimer = null;
  var prevClassicCheckKind = null;   // 上次唯一解检测结果，用于判断填错
  var libraryMode = 'solver';   // libraryDialog 当前数据源

  function emptyBoard() {
    var b = [];
    for (var r = 0; r < SIZE; r++) b.push(new Array(SIZE).fill(0));
    return b;
  }

  // ===== DOM =====
  var boardEl = document.getElementById('board');
  var fillCount = document.getElementById('fillCount');
  var statusCard = document.getElementById('statusCard');
  var statusIcon = document.getElementById('statusIcon');
  var statusText = document.getElementById('statusText');
  var explanation = document.getElementById('explanation');
  var explBadge = document.getElementById('explBadge');
  var explTitle = document.getElementById('explTitle');
  var explText = document.getElementById('explText');
  var pasteInput = document.getElementById('pasteInput');
  var pasteBtn = document.getElementById('pasteBtn');
  var exportBtn = document.getElementById('exportBtn');
  var btnSolve = document.getElementById('btnSolve');
  var btnStep = document.getElementById('btnStep');
  var btnUndo = document.getElementById('btnUndo');
  var btnReset = document.getElementById('btnReset');
  var btnFav = document.getElementById('btnFav');
  var btnCheck = document.getElementById('btnCheck');
  var btnTogglePencil = document.getElementById('btnTogglePencil');
  var btnEdit = document.getElementById('btnEdit');
  var btnLibrary = document.getElementById('btnLibrary');
  var btnOCR = document.getElementById('btnOCR');
  var ocrFileInput = document.getElementById('ocrFileInput');
  var btnClear = document.getElementById('btnClear');
  var libraryDialog = document.getElementById('libraryDialog');
  var btnHelp = document.getElementById('btnHelp');
  var helpDialog = document.getElementById('helpDialog');
  var helpDialogClose = document.getElementById('helpDialogClose');
  var dialogClose = document.getElementById('dialogClose');
  var historyPanel = document.getElementById('historyPanel');
  var favoritesPanel = document.getElementById('favoritesPanel');
  var dialogTabs = document.querySelectorAll('.dialog-tab');

  // 经典模式 DOM
  var modeSlider = document.getElementById('modeSlider');
  var modeTabs = document.querySelectorAll('.mode-tab');
  var classicBoardEl = document.getElementById('classicBoard');
  var classicDifficultyEl = document.getElementById('classicDifficulty');
  var classicFilledEl = document.getElementById('classicFilled');
  var classicTimerEl = document.getElementById('classicTimer');
  var btnClassicCheck = document.getElementById('btnClassicCheck');
  var btnClassicNotes = document.getElementById('btnClassicNotes');
  var btnClassicFav = document.getElementById('btnClassicFav');
  var btnClassicUndo = document.getElementById('btnClassicUndo');
  var btnClassicErase = document.getElementById('btnClassicErase');
  var btnClassicEraseAll = document.getElementById('btnClassicEraseAll');
  var btnClassicNote = document.getElementById('btnClassicNote');
  var btnClassicLibrary = document.getElementById('btnClassicLibrary');
  var btnClassicSmart = document.getElementById('btnClassicSmart');
  var numPad = document.getElementById('numPad');
  var classicStatusCard = document.getElementById('classicStatusCard');
  var classicStatusIcon = document.getElementById('classicStatusIcon');
  var classicStatusText = document.getElementById('classicStatusText');
  var difficultyDialog = document.getElementById('difficultyDialog');
  var difficultyClose = document.getElementById('difficultyClose');
  var difficultyOptions = document.querySelectorAll('.difficulty-option');
  var statEasy = document.getElementById('statEasy');
  var statMedium = document.getElementById('statMedium');
  var statHard = document.getElementById('statHard');

  // ===== localStorage 封装 =====
  var MAX_RECORDS = 50;   // 历史/收藏记录上限，超出裁剪最旧

  var Storage = {
    historyKey: 'sudoku_history',
    favKey: 'sudoku_favorites',
    get: function (key) {
      try {
        var raw = localStorage.getItem(key);
        if (!raw) return [];
        var arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    },
    set: function (key, arr) {
      try {
        if (arr.length > MAX_RECORDS) arr = arr.slice(0, MAX_RECORDS);
        localStorage.setItem(key, JSON.stringify(arr));
      } catch (e) {}
    },
    getHistory: function () { return this.get(this.historyKey); },
    setHistory: function (arr) { this.set(this.historyKey, arr); },
    getFavorites: function () { return this.get(this.favKey); },
    setFavorites: function (arr) { this.set(this.favKey, arr); }
  };

  // 经典记录裁剪：超出上限时优先保留皇冠（已通关）记录，先去掉非皇冠（未通关）
  function trimClassicRecords(arr) {
    var sorted = arr.slice().sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    var cleared = sorted.filter(function (it) { return it.cleared; });
    var uncleared = sorted.filter(function (it) { return !it.cleared; });
    var keepCleared = Math.min(cleared.length, MAX_RECORDS);
    var keepUncleared = Math.max(0, MAX_RECORDS - keepCleared);
    var result = cleared.slice(0, keepCleared).concat(uncleared.slice(0, keepUncleared));
    result.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    return result;
  }

  // 经典模式记录（含难度/通关/耗时）
  var ClassicStorage = {
    historyKey: 'sudoku_classic_history',
    favKey: 'sudoku_classic_favorites',
    get: function (key) {
      try {
        var raw = localStorage.getItem(key);
        if (!raw) return [];
        var arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    },
    set: function (key, arr) {
      try {
        if (arr.length > MAX_RECORDS) arr = trimClassicRecords(arr);
        localStorage.setItem(key, JSON.stringify(arr));
      } catch (e) {}
    },
    getHistory: function () { return this.get(this.historyKey); },
    setHistory: function (arr) { this.set(this.historyKey, arr); },
    getFavorites: function () { return this.get(this.favKey); },
    setFavorites: function (arr) { this.set(this.favKey, arr); }
  };

  // ===== 工具 =====
  function serializeBoard(b) {
    var s = '';
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) s += b[r][c];
    return s;
  }

  // 当前「题目」字符串：只含用户给定的数字（givens），不含求解填入的
  function puzzleString() {
    var s = '';
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        s += givens.has(r + ',' + c) ? board[r][c] : 0;
      }
    }
    return s;
  }
  function countDigits(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) if (s[i] !== '0') n++;
    return n;
  }
  function isEmptyBoard() {
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (board[r][c] !== 0) return false;
    return true;
  }
  function nowName() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
           p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // 复制到剪贴板（含降级方案）
  function copyText(text) {
    function ok() { showStatus('ok', '已复制 81 位数字到剪贴板。'); }
    function fail() { showStatus('warn', '复制失败，请手动复制：' + text); }
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text); });
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (ok) showStatus('ok', '已复制 81 位数字到剪贴板。');
    else showStatus('warn', '复制失败，请手动复制：' + text);
  }

  // ===== 音效与飘带 =====
  var AudioFX = {
    ctx: null,
    ensure: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone: function (freq, dur, type, vol, delay) {
      var ctx = this.ensure();
      if (!ctx) return;
      var t0 = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    },
    key: function () {
      this.tone(620, 0.06, 'triangle', 0.15);
    },
    clear: function () {
      var seq = [523.25, 659.25, 783.99, 1046.50];
      for (var i = 0; i < seq.length; i++) {
        this.tone(seq[i], 0.18, 'triangle', 0.22, i * 0.12);
      }
      this.tone(130.81, 0.5, 'sine', 0.18, seq.length * 0.12);
    },
    error: function () {
      this.tone(200, 0.16, 'sawtooth', 0.12);
      this.tone(150, 0.22, 'sawtooth', 0.12, 0.12);
    }
  };

  function confetti() {
    var c = document.getElementById('confetti');
    if (!c) return;
    c.innerHTML = '';
    c.hidden = false;
    var colors = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#facc15', '#ec4899'];
    for (var i = 0; i < 60; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.6) + 's';
      p.style.animationDuration = (2 + Math.random() * 1.5) + 's';
      p.style.width = (6 + Math.random() * 6) + 'px';
      p.style.height = (10 + Math.random() * 8) + 'px';
      p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      c.appendChild(p);
    }
    setTimeout(function () {
      c.innerHTML = '';
      c.hidden = true;
    }, 4000);
  }

  // ===== 收藏状态 =====
  function isFavorited() {
    var s = puzzleString();
    return Storage.getFavorites().some(function (it) { return it.board === s; });
  }
  function updateFavButton() {
    btnFav.classList.toggle('active', isFavorited());
  }
  function autoCheck() {
    if (isEmptyBoard()) { btnCheck.className = 'icon-btn'; return; }
    var status = getStatusResult();
    btnCheck.className = 'icon-btn ' + status.kind;
  }

  function updatePencilButton() {
    btnTogglePencil.classList.toggle('active', showPencil);
    boardEl.classList.toggle('hide-pencil', !showPencil);
  }
  function setShowPencil(value) {
    showPencil = value;
    updatePencilButton();
  }
  function togglePencil() {
    showPencil = !showPencil;
    updatePencilButton();
  }

  function updateEditButton() {
    btnEdit.disabled = editable;
  }

  // 从逐步/展示态切换到输入态：以当前盘面为起点继续手动输入
  function enterEditMode() {
    if (editable) return;
    givens = new Set();
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (board[r][c] !== 0) givens.add(r + ',' + c);
    resetSolveState();
    editable = true;
    setShowPencil(false);
    hideExplanation();
    renderBoard();
    updateStepButtons();
    showStatus('ok', '已切换到手动输入，可继续编辑。');
  }

  // ===== 历史 / 收藏 =====
  function addHistory() {
    var s = serializeBoard(board);
    if (!/[1-9]/.test(s)) return;
    var list = Storage.getHistory().filter(function (it) { return it.board !== s; });
    list.unshift({ name: nowName(), board: s, savedAt: Date.now() });
    Storage.setHistory(list);
    renderLibrary();
  }

  function toggleFavorite() {
    if (isEmptyBoard()) { showStatus('warn', '盘面为空，无法收藏。'); return; }
    var s = puzzleString();
    var list = Storage.getFavorites();
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].board === s) { idx = i; break; }
    if (idx !== -1) {
      list.splice(idx, 1);
      Storage.setFavorites(list);
      showStatus('warn', '已取消收藏。');
    } else {
      list.unshift({ name: nowName(), board: s, savedAt: Date.now() });
      Storage.setFavorites(list);
      showStatus('ok', '已收藏。');
    }
    renderLibrary();
    updateFavButton();
  }

  function applyItem(lib, idx) {
    var list = lib === 'history' ? Storage.getHistory() : Storage.getFavorites();
    var item = list[idx];
    if (!item) return;
    if (loadFromString(item.board)) {
      hideExplanation();
      libraryDialog.close();
    }
  }

  function deleteItem(lib, idx) {
    var list = lib === 'history' ? Storage.getHistory() : Storage.getFavorites();
    list.splice(idx, 1);
    if (lib === 'history') Storage.setHistory(list); else Storage.setFavorites(list);
    renderLibrary();
    updateFavButton();
  }

  function handleExport() {
    if (isEmptyBoard()) { showStatus('warn', '盘面为空，无法导出。'); return; }
    copyText(serializeBoard(board));
  }

  function exportItem(lib, idx) {
    var list = lib === 'history' ? Storage.getHistory() : Storage.getFavorites();
    var item = list[idx];
    if (!item) return;
    copyText(item.board);
  }

  function renameFavorite(idx, name) {
    var list = Storage.getFavorites();
    if (list[idx]) {
      list[idx].name = name || nowName();
      Storage.setFavorites(list);
    }
  }

  function restoreLastHistory() {
    var list = Storage.getHistory();
    if (list.length > 0) loadFromString(list[0].board);
  }

  // ===== 渲染盘面 =====
  function getCandidatesForRender() {
    if (isEmptyBoard()) return null;   // 空盘不显示候选
    if (stepActive && candidates) return candidates;
    return SudokuSolver.computeCandidates(board);
  }

  // 更新「已填格数」：只统计用户/题目给定数字（givens），不含推理/求解高亮数字
  function updateFillCount() {
    fillCount.textContent = '已填 ' + givens.size + '/81';
  }

  function renderBoard() {
    var cands = getCandidatesForRender();
    var html = '';
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var val = board[r][c];
        var cls = ['cell'];
        if (r % 3 === 2 && r !== 8) cls.push('row-border');
        if (c % 3 === 2 && c !== 8) cls.push('col-border');

        var inner = '';
        if (val !== 0) {
          if (editable) {
            cls.push('given');
            inner = '<input class="cell-input" inputmode="numeric" maxlength="1" ' +
                    'autocomplete="off" data-r="' + r + '" data-c="' + c + '" ' +
                    'value="' + val + '">';
          } else {
            cls.push(givens.has(r + ',' + c) ? 'given' : 'solved');
            inner = '<span class="cell-value">' + val + '</span>';
          }
        } else {
          cls.push('empty');
          inner = renderPencil(r, c, cands);
          if (editable) {
            inner += '<input class="cell-input" inputmode="numeric" maxlength="1" ' +
                     'autocomplete="off" data-r="' + r + '" data-c="' + c + '" value="">';
          }
        }
        html += '<div class="' + cls.join(' ') + '" data-r="' + r + '" data-c="' + c + '">' +
                inner + '</div>';
      }
    }
    boardEl.innerHTML = html;
    updateFavButton();
    autoCheck();
    updateEditButton();
    updateFillCount();
  }

  function renderPencil(r, c, cands) {
    var cellCands = null;
    if (cands && cands[r] && cands[r][c]) cellCands = cands[r][c];
    var html = '<div class="pencil">';
    for (var n = 1; n <= 9; n++) {
      var show = cellCands && cellCands.indexOf(n) !== -1;
      html += '<span class="' + (show ? '' : 'off') + '">' + (show ? n : '') + '</span>';
    }
    html += '</div>';
    return html;
  }

  function clearHighlights() {
    boardEl.querySelectorAll('.highlight').forEach(function (el) { el.classList.remove('highlight'); });
    boardEl.querySelectorAll('.highlight-elim').forEach(function (el) { el.classList.remove('highlight-elim'); });
  }

  function highlightCell(r, c, cls) {
    var el = boardEl.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
    if (el) el.classList.add(cls);
  }

  function applyStepHighlights(step) {
    clearHighlights();
    if (step.kind === 'fill') highlightCell(step.fill.r, step.fill.c, 'highlight');
    if (step.eliminations) {
      step.eliminations.forEach(function (e) { highlightCell(e.r, e.c, 'highlight-elim'); });
    }
  }

  // ===== 历史/收藏列表渲染 =====
  function renderLibrary() {
    renderList('history');
    renderList('favorites');
  }

  // 经典记录排序：皇冠置顶，组内按时间降序
  function sortClassicList(list) {
    return list.slice().sort(function (a, b) {
      var ca = a.cleared ? 1 : 0, cb = b.cleared ? 1 : 0;
      if (ca !== cb) return cb - ca;
      return (b.savedAt || 0) - (a.savedAt || 0);
    });
  }

  function renderList(lib) {
    var panel = lib === 'history' ? historyPanel : favoritesPanel;
    var list;
    if (libraryMode === 'classic') {
      list = sortClassicList(lib === 'history' ? ClassicStorage.getHistory() : ClassicStorage.getFavorites());
    } else {
      list = lib === 'history' ? Storage.getHistory() : Storage.getFavorites();
    }
    if (list.length === 0) {
      panel.innerHTML = '<div class="lib-empty">暂无记录</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      html += libraryMode === 'classic'
        ? renderClassicLibItem(lib, it, i)
        : renderSolverLibItem(lib, it, i);
    }
    panel.innerHTML = html;
  }

  function renderSolverLibItem(lib, it, i) {
    var nameHtml = lib === 'favorites'
      ? '<input class="lib-name-input" value="' + escapeHtml(it.name) + '" data-idx="' + i + '">'
      : '<span class="lib-name">' + escapeHtml(it.name) + '</span>';
    return '<div class="lib-item">' +
           '<div class="lib-item-info">' + nameHtml +
           '<span class="lib-meta">已填 ' + countDigits(it.board) + ' 格</span></div>' +
           '<div class="lib-actions">' +
           '<button class="lib-btn export" data-action="export" data-lib="' + lib + '" data-idx="' + i + '">导出</button>' +
           '<button class="lib-btn apply" data-action="apply" data-lib="' + lib + '" data-idx="' + i + '">应用</button>' +
           '<button class="lib-btn del" data-action="delete" data-lib="' + lib + '" data-idx="' + i + '">删除</button>' +
           '</div></div>';
  }

  function renderClassicLibItem(lib, it, i) {
    var diff = it.difficulty || 'medium';
    var nameHtml = lib === 'favorites'
      ? '<input class="lib-name-input" value="' + escapeHtml(it.name) + '" data-idx="' + i + '">'
      : '<span class="lib-name">' + escapeHtml(it.name) + '</span>';
    var crown = it.cleared ? '<span class="lib-crown" title="已通关">👑</span>' : '';
    var meta;
    if (it.cleared) {
      meta = '耗时 ' + formatTime(it.bestTime);
    } else {
      var filled = it.progress ? countDigits(it.progress) - countDigits(it.board) : countDigits(it.board);
      meta = '已填 ' + filled + ' 格';
      if (it.elapsed != null) meta += ' · 用时 ' + formatTime(it.elapsed);
    }
    return '<div class="lib-item">' +
           '<div class="lib-item-info">' +
           '<div class="lib-name-row">' + nameHtml +
           '<span class="lib-diff-tag ' + diff + '">' + difficultyLabel(diff) + '</span>' + crown + '</div>' +
           '<span class="lib-meta">' + meta + '</span></div>' +
           '<div class="lib-actions">' +
           '<button class="lib-btn export" data-action="export" data-lib="' + lib + '" data-idx="' + i + '">导出</button>' +
           '<button class="lib-btn apply" data-action="apply" data-lib="' + lib + '" data-idx="' + i + '">应用</button>' +
           '<button class="lib-btn del" data-action="delete" data-lib="' + lib + '" data-idx="' + i + '">删除</button>' +
           '</div></div>';
  }

  // ===== 提示（临时，自动消失） =====
  function showStatus(kind, text) {
    statusCard.hidden = false;
    statusCard.className = 'status-card ' + kind;
    statusIcon.textContent = kind === 'ok' ? '✓' : (kind === 'warn' ? '⚠' : '✗');
    statusText.textContent = text;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(hideStatus, 3000);
  }
  function hideStatus() {
    statusCard.hidden = true;
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
  }

  function showExplanation(badge, title, text) {
    explanation.hidden = false;
    explBadge.textContent = badge;
    explTitle.textContent = title;
    explText.textContent = text;
  }
  function hideExplanation() { explanation.hidden = true; }

  // ===== 校验与唯一解 =====
  function getStatusResult() {
    if (!SudokuSolver.isBoardValid(board)) {
      return { kind: 'error', text: '题目本身存在数字冲突，该数独无解。' };
    }
    var res = SudokuSolver.countSolutions(board, 2);
    if (res.count === 0) return { kind: 'error', text: '该数独无解。' };
    if (res.count === 1) return { kind: 'ok', text: '该数独存在唯一解。' };
    return { kind: 'warn', text: '该数独有多个解（不唯一）。' };
  }

  // ===== 状态与按钮联动 =====
  // 当前盘面是否只有给定数字（没有求解/逐步填入的数字）
  function isPuzzleOnly() {
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (board[r][c] !== 0 && !givens.has(r + ',' + c)) return false;
    return true;
  }

  function resetSolveState() {
    stepActive = false;
    stepSolver = null;
    stepHistory = [];
    candidates = null;
  }

  // 回到初始题目（输入态）：只保留给定数字，清除求解/逐步填入的内容
  function backToPuzzle() {
    var b = emptyBoard();
    givens.forEach(function (key) {
      var p = key.split(',');
      var r = parseInt(p[0], 10), c = parseInt(p[1], 10);
      b[r][c] = board[r][c];
    });
    board = b;
    resetSolveState();
    editable = true;
    setShowPencil(false);   // 回到输入态自动关闭小数字
    hideExplanation();
    renderBoard();
    updateStepButtons();
  }

  function updateStepButtons() {
    var active = stepActive && stepSolver;
    btnReset.disabled = editable;   // 输入态时禁用；求解/逐步展示态可「返回初始」
    btnUndo.disabled = !(active && stepSolver.canUndo());
  }

  function syncAndRender() {
    board = stepSolver.getBoard();
    candidates = stepSolver.getCandidates();
    renderBoard();
  }

  // ===== 载入字符串 =====
  function loadFromString(s) {
    s = s.replace(/\s+/g, '');
    if (s.length !== 81 || !/^\d{81}$/.test(s)) {
      showStatus('warn', '请粘贴恰好 81 位数字（0 代表空格）。');
      return false;
    }
    board = emptyBoard();
    givens = new Set();
    for (var i = 0; i < 81; i++) {
      var n = parseInt(s[i], 10);
      var r = Math.floor(i / 9), c = i % 9;
      board[r][c] = n;
      if (n !== 0) givens.add(r + ',' + c);
    }
    resetSolveState();
    editable = true;
    setShowPencil(false);   // 输入态自动关闭小数字
    hideStatus();
    hideExplanation();
    renderBoard();
    updateStepButtons();
    return true;
  }

  // ===== 按钮逻辑 =====
  function handleSolve() {
    hideExplanation();
    if (isEmptyBoard()) { showStatus('warn', '请先输入或载入数独题目。'); return; }
    if (editable) addHistory();

    var status = getStatusResult();
    if (status.kind === 'error') { showStatus(status.kind, status.text); return; }

    var res = SudokuSolver.countSolutions(board, 2);
    board = res.solution;
    resetSolveState();
    editable = false;
    renderBoard();
    updateStepButtons();

    if (res.count === 1) showStatus('ok', '唯一解，已填入全部数字。');
    else showStatus('warn', '该题有多个解，以下展示其中一种。');
  }

  function handleCheck() {
    if (isEmptyBoard()) { showStatus('warn', '请先输入或载入数独题目。'); return; }
    var status = getStatusResult();
    showStatus(status.kind, status.text);
    btnCheck.className = 'icon-btn ' + status.kind;
  }

  function handleStep() {
    if (!stepActive || !stepSolver) {
      if (isEmptyBoard()) { showStatus('warn', '请先输入或载入数独题目。'); return; }
      if (editable) addHistory();

      var status = getStatusResult();
      if (status.kind === 'error') { showStatus(status.kind, status.text); return; }

      stepSolver = SudokuSolver.createLogicSolver(board, status.kind === 'ok');
      stepActive = true;
      editable = false;
      setShowPencil(true);   // 进入逐步模式自动打开小数字
      // 「唯一解」状态已由顶部按钮颜色表示，不再弹文字提示
    }

    var step = stepSolver.nextStep();

    if (step && step.done) {
      showStatus('ok', '已完成，盘面已填满。');
      hideExplanation();
      syncAndRender();
      updateStepButtons();
      return;
    }
    if (!step) {
      showExplanation('提示', '无法继续',
        '当前局面已无法用基础逻辑技巧（唯一候选、隐性唯一、显性数对、区块摒除）继续推进，' +
        '需要试错或更高级技巧。');
      syncAndRender();
      updateStepButtons();
      return;
    }

    stepHistory.push(step);
    syncAndRender();
    applyStepHighlights(step);
    showExplanation(step.title, step.title, step.message);
    if (stepSolver.isDone()) showStatus('ok', '已完成，盘面已填满。');
    updateStepButtons();
  }

  function handleUndo() {
    if (!stepSolver || !stepSolver.canUndo()) return;
    stepSolver.undo();
    stepHistory.pop();

    if (!stepSolver.canUndo()) {
      // 退到底：回到输入态
      backToPuzzle();
    } else {
      // 撤销一步：恢复上一步的说明与高亮
      syncAndRender();
      var prev = stepHistory[stepHistory.length - 1];
      showExplanation(prev.title, prev.title, prev.message);
      applyStepHighlights(prev);
    }
    updateStepButtons();
  }

  function handleReset() {
    if (editable) return;
    backToPuzzle();
    showStatus('ok', '已返回初始盘面，可重新开始。');
  }

  function handleClear() {
    board = emptyBoard();
    givens = new Set();
    resetSolveState();
    editable = true;
    setShowPencil(false);   // 输入态自动关闭小数字
    pasteInput.value = '';
    hideStatus();
    hideExplanation();
    renderBoard();
    updateStepButtons();
  }

  function handleOcrFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var img = new Image();
    img.onload = function () {
      showStatus('warn', '正在识别图片，请稍候...');
      SudokuOCR.recognize(img).then(function (result) {
        if (loadFromString(result)) {
          showStatus('ok', '识别完成，请核对数字。');
        } else {
          showStatus('error', '识别结果无效，请重试。');
        }
      }).catch(function (err) {
        showStatus('error', '识别失败：' + (err && err.message ? err.message : err));
      });
    };
    img.onerror = function () {
      showStatus('error', '图片加载失败。');
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  }

  // ===== 经典数独模式 =====
  function difficultyLabel(d) {
    return d === 'easy' ? '简单' : (d === 'hard' ? '困难' : '中等');
  }

  function formatTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function toBoardArray(s) {
    var b = emptyBoard();
    for (var i = 0; i < 81; i++) {
      b[Math.floor(i / 9)][i % 9] = parseInt(s[i], 10);
    }
    return b;
  }

  function classicPuzzleString() {
    var s = '';
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        s += classicGivens.has(r + ',' + c) ? classicBoard[r][c] : 0;
    return s;
  }

  function switchMode(m) {
    mode = m;
    modeSlider.classList.toggle('classic', m === 'classic');
    modeTabs.forEach(function (t) { t.classList.toggle('active', t.dataset.mode === m); });
    if (m === 'classic') {
      if (!classicGenerated) {
        if (!difficultyDialog.open) difficultyDialog.showModal();
      } else {
        startClassicTimer();
      }
    } else {
      pauseClassicTimer();
    }
  }

  function generateClassic(difficulty) {
    showClassicStatus('warn', '正在生成' + difficultyLabel(difficulty) + '题目，请稍候...');
    setTimeout(function () {
      var res = SudokuSolver.generatePuzzle(difficulty);
      classicDifficulty = difficulty;
      classicBoard = res.puzzle;
      classicSolution = res.solution;
      classicGivens = new Set();
      for (var r = 0; r < SIZE; r++)
        for (var c = 0; c < SIZE; c++)
          if (classicBoard[r][c] !== 0) classicGivens.add(r + ',' + c);
      classicNotes = [];
      for (var r2 = 0; r2 < SIZE; r2++) classicNotes.push(new Array(SIZE).fill(null));
      classicHistory = [];
      classicSelected = null;
      classicNoteMode = false;
      classicShowNotes = false;
      classicSeconds = 0;
      classicDone = false;
      classicGenerated = true;
      updateClassicDifficultyLabel();
      renderClassicBoard();
      startClassicTimer();
      showClassicStatus('ok', '已生成' + difficultyLabel(difficulty) + '题目，开始计时。');
    }, 50);
  }

  function updateClassicDifficultyLabel() {
    classicDifficultyEl.textContent = difficultyLabel(classicDifficulty);
    classicDifficultyEl.className = 'difficulty-tag ' + classicDifficulty;
  }

  function updateClassicMeta() {
    var filled = 0;
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (classicBoard[r][c] !== 0) filled++;
    classicFilledEl.textContent = filled;
    classicTimerEl.textContent = formatTime(classicSeconds);
  }

  // 统计各难度通关次数
  function updateClassicStats() {
    var hist = ClassicStorage.getHistory();
    var stats = { easy: 0, medium: 0, hard: 0 };
    for (var i = 0; i < hist.length; i++) {
      var d = hist[i].difficulty;
      if (hist[i].cleared && (d === 'easy' || d === 'medium' || d === 'hard')) stats[d]++;
    }
    statEasy.textContent = stats.easy;
    statMedium.textContent = stats.medium;
    statHard.textContent = stats.hard;
  }

  function buildNumPad() {
    var html = '';
    for (var n = 1; n <= 9; n++) {
      html += '<button class="num-key" data-n="' + n + '">' +
              '<span class="num-big">' + n + '</span>' +
              '<span class="num-left">9</span></button>';
    }
    numPad.innerHTML = html;
  }

  function updateNumPad() {
    var counts = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++) {
        var v = classicBoard[r][c];
        if (v >= 1 && v <= 9) counts[v - 1]++;
      }
    numPad.querySelectorAll('.num-key').forEach(function (key) {
      var n = parseInt(key.dataset.n, 10);
      var left = 9 - counts[n - 1];
      key.querySelector('.num-left').textContent = left;
      key.classList.toggle('disabled', left <= 0);
    });
  }

  function renderClassicPencil(vals) {
    var html = '<div class="pencil">';
    for (var n = 1; n <= 9; n++) {
      var show = vals && vals.indexOf(n) !== -1;
      html += '<span class="' + (show ? '' : 'off') + '">' + (show ? n : '') + '</span>';
    }
    html += '</div>';
    return html;
  }

  function renderClassicBoard() {
    var cands = classicShowNotes ? SudokuSolver.computeCandidates(classicBoard) : null;
    var sel = classicSelected;
    var selVal = sel ? classicBoard[sel.r][sel.c] : 0;
    var html = '';
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var val = classicBoard[r][c];
        var cls = ['cell'];
        if (r % 3 === 2 && r !== 8) cls.push('row-border');
        if (c % 3 === 2 && c !== 8) cls.push('col-border');

        if (sel) {
          if (r === sel.r && c === sel.c) {
            cls.push('selected');
          } else {
            var sameBox = Math.floor(r / 3) === Math.floor(sel.r / 3) &&
                          Math.floor(c / 3) === Math.floor(sel.c / 3);
            if (r === sel.r || c === sel.c || sameBox) cls.push('peer');
            if (selVal !== 0 && val === selVal) cls.push('same-num');
          }
        }

        var inner = '';
        if (val !== 0) {
          cls.push(classicGivens.has(r + ',' + c) ? 'given' : 'filled');
          inner = '<span class="cell-value">' + val + '</span>';
        } else {
          var note = classicNotes[r][c];
          var vals = null;
          if (note && note.size > 0) vals = Array.from(note);
          else if (cands && cands[r] && cands[r][c]) vals = cands[r][c];
          inner = renderClassicPencil(vals);
        }
        html += '<div class="' + cls.join(' ') + '" data-r="' + r + '" data-c="' + c + '">' + inner + '</div>';
      }
    }
    classicBoardEl.innerHTML = html;
    updateClassicMeta();
    updateNumPad();
    updateClassicFavButton();
    updateClassicNotesButton();
    updateClassicNoteModeButton();
    updateClassicCheckButton();
    updateClassicStats();
  }

  function selectClassicCell(r, c) {
    classicSelected = { r: r, c: c };
    renderClassicBoard();
  }

  function handleClassicNum(n) {
    if (classicDone) return;
    if (!classicSelected) { showClassicStatus('warn', '请先选中一个空白格。'); return; }
    var r = classicSelected.r, c = classicSelected.c;
    if (classicGivens.has(r + ',' + c)) { showClassicStatus('warn', '题目格不可修改。'); return; }

    if (classicNoteMode) {
      if (classicBoard[r][c] !== 0) { showClassicStatus('warn', '该格已有数字，无法备注。'); return; }
      var note = classicNotes[r][c] || (classicNotes[r][c] = new Set());
      if (note.has(n)) note.delete(n); else note.add(n);
    } else {
      if (classicBoard[r][c] !== n) {
        classicHistory.push({ r: r, c: c, prevVal: classicBoard[r][c], prevNote: classicNotes[r][c] });
        classicBoard[r][c] = n;
        classicNotes[r][c] = null;
        saveClassicProgress();
        checkClassicDone();
      }
    }
    renderClassicBoard();
  }

  function undoClassic() {
    if (classicDone) return;
    if (classicHistory.length === 0) { showClassicStatus('warn', '没有可撤销的操作。'); return; }
    var op = classicHistory.pop();
    if (op.type === 'clearAll') {
      for (var i = 0; i < op.cells.length; i++) {
        var cell = op.cells[i];
        classicBoard[cell.r][cell.c] = cell.val;
        classicNotes[cell.r][cell.c] = cell.note;
      }
    } else {
      classicBoard[op.r][op.c] = op.prevVal;
      classicNotes[op.r][op.c] = op.prevNote;
    }
    saveClassicProgress();
    renderClassicBoard();
  }

  function eraseClassic() {
    if (classicDone) return;
    if (!classicSelected) { showClassicStatus('warn', '请先选中一个格子。'); return; }
    var r = classicSelected.r, c = classicSelected.c;
    if (classicGivens.has(r + ',' + c)) { showClassicStatus('warn', '题目格不可修改。'); return; }
    if (classicBoard[r][c] !== 0 || classicNotes[r][c]) {
      classicHistory.push({ r: r, c: c, prevVal: classicBoard[r][c], prevNote: classicNotes[r][c] });
    }
    classicBoard[r][c] = 0;
    classicNotes[r][c] = null;
    saveClassicProgress();
    renderClassicBoard();
  }

  // 擦除所有用户填入的数字，还原到只剩题目
  function clearClassicFilled() {
    if (!classicGenerated || classicDone) return;
    var cells = [];
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++) {
        if (classicGivens.has(r + ',' + c)) continue;
        if (classicBoard[r][c] !== 0 || classicNotes[r][c]) {
          cells.push({ r: r, c: c, val: classicBoard[r][c], note: classicNotes[r][c] });
        }
        classicBoard[r][c] = 0;
        classicNotes[r][c] = null;
      }
    if (cells.length > 0) {
      classicHistory.push({ type: 'clearAll', cells: cells });
    }
    saveClassicProgress();
    renderClassicBoard();
    showClassicStatus('ok', '已清除所有填入数字。');
  }

  function toggleClassicNoteMode() {
    classicNoteMode = !classicNoteMode;
    updateClassicNoteModeButton();
  }

  function updateClassicNoteModeButton() {
    btnClassicNote.classList.toggle('active', classicNoteMode);
  }

  function toggleClassicNotes() {
    classicShowNotes = !classicShowNotes;
    updateClassicNotesButton();
    renderClassicBoard();
  }

  function updateClassicNotesButton() {
    btnClassicNotes.classList.toggle('active', classicShowNotes);
  }

  function smartSolve() {
    if (!classicGenerated) return;
    switchMode('solver');
    loadFromString(serializeBoard(classicBoard));
  }

  function getClassicCheckResult() {
    if (!SudokuSolver.isBoardValid(classicBoard)) {
      return { kind: 'error', text: '当前盘面存在数字冲突。' };
    }
    var res = SudokuSolver.countSolutions(classicBoard, 2);
    if (res.count === 0) return { kind: 'error', text: '当前盘面无解。' };
    if (res.count === 1) return { kind: 'ok', text: '当前盘面存在唯一解。' };
    return { kind: 'warn', text: '当前盘面有多个解。' };
  }

  function updateClassicCheckButton() {
    if (!classicGenerated) { btnClassicCheck.className = 'icon-btn'; return; }
    var kind = getClassicCheckResult().kind;
    btnClassicCheck.className = 'icon-btn ' + kind;
    // 从唯一解变为无解 = 填错，播放填错音效
    if (prevClassicCheckKind === 'ok' && kind === 'error') AudioFX.error();
    prevClassicCheckKind = kind;
  }

  function handleClassicCheck() {
    if (!classicGenerated) return;
    var r = getClassicCheckResult();
    btnClassicCheck.className = 'icon-btn ' + r.kind;
    showClassicStatus(r.kind, r.text);
  }

  function isClassicFavorited() {
    var s = classicPuzzleString();
    return ClassicStorage.getFavorites().some(function (it) { return it.board === s; });
  }

  function updateClassicFavButton() {
    btnClassicFav.classList.toggle('active', isClassicFavorited());
  }

  function toggleClassicFavorite() {
    if (!classicGenerated) return;
    var s = classicPuzzleString();
    var list = ClassicStorage.getFavorites();
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].board === s) { idx = i; break; }
    if (idx !== -1) {
      list.splice(idx, 1);
      ClassicStorage.setFavorites(list);
      showClassicStatus('warn', '已取消收藏。');
    } else {
      list.unshift({
        name: nowName(), board: s,
        progress: classicDone ? null : serializeBoard(classicBoard),
        elapsed: classicDone ? null : classicSeconds,
        difficulty: classicDifficulty,
        cleared: classicDone, bestTime: classicDone ? classicSeconds : null, savedAt: Date.now()
      });
      ClassicStorage.setFavorites(list);
      showClassicStatus('ok', '已收藏。');
    }
    updateClassicFavButton();
  }

  function checkClassicDone() {
    if (classicDone) return;
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (classicBoard[r][c] !== classicSolution[r][c]) return;
    classicDone = true;
    pauseClassicTimer();
    recordClassicCleared();
    AudioFX.clear();   // 通关音效
    confetti();        // 通关飘带
    showClassicStatus('ok', '恭喜通关！用时 ' + formatTime(classicSeconds) + '，点击左上角难度标签即可继续挑战。', true);
  }

  function recordClassicCleared() {
    var s = classicPuzzleString();
    var hist = ClassicStorage.getHistory();
    var idx = -1;
    for (var i = 0; i < hist.length; i++) if (hist[i].board === s) { idx = i; break; }
    if (idx !== -1) {
      hist[idx].cleared = true;
      hist[idx].difficulty = classicDifficulty;
      hist[idx].bestTime = (hist[idx].bestTime == null) ? classicSeconds : Math.min(hist[idx].bestTime, classicSeconds);
      hist[idx].progress = null;
      hist[idx].elapsed = null;
      hist[idx].savedAt = Date.now();
    } else {
      hist.unshift({
        name: nowName(), board: s, difficulty: classicDifficulty,
        cleared: true, bestTime: classicSeconds, savedAt: Date.now()
      });
    }
    ClassicStorage.setHistory(hist);

    var favs = ClassicStorage.getFavorites();
    var fidx = -1;
    for (var j = 0; j < favs.length; j++) if (favs[j].board === s) { fidx = j; break; }
    if (fidx !== -1) {
      favs[fidx].cleared = true;
      favs[fidx].bestTime = (favs[fidx].bestTime == null) ? classicSeconds : Math.min(favs[fidx].bestTime, classicSeconds);
      favs[fidx].progress = null;
      favs[fidx].elapsed = null;
      ClassicStorage.setFavorites(favs);
    }
    updateClassicFavButton();
  }

  function startClassicTimer() {
    if (classicTimerId || classicDone || !classicGenerated) return;
    classicTimerId = setInterval(function () {
      classicSeconds++;
      updateClassicMeta();
    }, 1000);
  }

  function pauseClassicTimer() {
    if (classicTimerId) { clearInterval(classicTimerId); classicTimerId = null; }
  }

  function showClassicStatus(kind, text, sticky) {
    classicStatusCard.hidden = false;
    classicStatusCard.className = 'status-card ' + kind;
    classicStatusIcon.textContent = kind === 'ok' ? '✓' : (kind === 'warn' ? '⚠' : '✗');
    classicStatusText.textContent = text;
    if (classicStatusTimer) { clearTimeout(classicStatusTimer); classicStatusTimer = null; }
    if (!sticky) {
      classicStatusTimer = setTimeout(function () { classicStatusCard.hidden = true; }, 3000);
    }
  }

  function hasClassicFilled() {
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (classicBoard[r][c] !== 0 && !classicGivens.has(r + ',' + c)) return true;
    return false;
  }

  // 保存进行中的进度（未通关），用于断点续玩
  function saveClassicProgress() {
    if (!classicGenerated || classicDone) return;
    var s = classicPuzzleString();
    var hist = ClassicStorage.getHistory();
    var idx = -1;
    for (var i = 0; i < hist.length; i++) {
      if (hist[i].board === s && !hist[i].cleared) { idx = i; break; }
    }
    if (!hasClassicFilled()) {
      if (idx !== -1) { hist.splice(idx, 1); ClassicStorage.setHistory(hist); }
      return;
    }
    if (idx !== -1) hist.splice(idx, 1);
    hist.unshift({
      name: nowName(), board: s, progress: serializeBoard(classicBoard),
      elapsed: classicSeconds, difficulty: classicDifficulty,
      cleared: false, bestTime: null, savedAt: Date.now()
    });
    ClassicStorage.setHistory(hist);
  }

  // 页面打开时恢复最新未通关进度
  function restoreClassicProgress() {
    var hist = ClassicStorage.getHistory();
    var best = null;
    for (var i = 0; i < hist.length; i++) {
      if (hist[i].cleared) continue;
      if (!best || (hist[i].savedAt || 0) > (best.savedAt || 0)) best = hist[i];
    }
    if (!best) return false;
    var puzzleArr = toBoardArray(best.board);
    var res = SudokuSolver.countSolutions(puzzleArr, 2);
    if (res.count === 0) return false;
    classicDifficulty = best.difficulty || 'medium';
    classicBoard = toBoardArray(best.progress || best.board);
    classicSolution = res.solution;
    classicGivens = new Set();
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (puzzleArr[r][c] !== 0) classicGivens.add(r + ',' + c);
    classicNotes = [];
    for (var r2 = 0; r2 < SIZE; r2++) classicNotes.push(new Array(SIZE).fill(null));
    classicHistory = [];
    classicSelected = null;
    classicNoteMode = false;
    classicShowNotes = false;
    classicSeconds = best.elapsed || 0;
    classicDone = false;
    classicGenerated = true;
    updateClassicDifficultyLabel();
    renderClassicBoard();
    return true;
  }

  function moveClassicSelection(dr, dc) {
    if (!classicGenerated) return;
    if (!classicSelected) { selectClassicCell(0, 0); return; }
    var nr = Math.min(8, Math.max(0, classicSelected.r + dr));
    var nc = Math.min(8, Math.max(0, classicSelected.c + dc));
    if (nr !== classicSelected.r || nc !== classicSelected.c) selectClassicCell(nr, nc);
  }

  function classicApplyItem(lib, idx) {
    var list = lib === 'history' ? ClassicStorage.getHistory() : ClassicStorage.getFavorites();
    var item = list[idx];
    if (!item) return;
    var puzzleArr = toBoardArray(item.board);
    var res = SudokuSolver.countSolutions(puzzleArr, 2);
    if (res.count === 0) { showClassicStatus('error', '该题目无解，无法载入。'); return; }
    classicDifficulty = item.difficulty || 'medium';
    classicBoard = item.progress ? toBoardArray(item.progress) : puzzleArr;
    classicSolution = res.solution;
    classicGivens = new Set();
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (puzzleArr[r][c] !== 0) classicGivens.add(r + ',' + c);
    classicNotes = [];
    for (var r2 = 0; r2 < SIZE; r2++) classicNotes.push(new Array(SIZE).fill(null));
    classicHistory = [];
    classicSelected = null;
    classicNoteMode = false;
    classicShowNotes = false;
    classicSeconds = item.elapsed || 0;
    classicDone = false;
    classicGenerated = true;
    updateClassicDifficultyLabel();
    renderClassicBoard();
    libraryDialog.close();
    switchMode('classic');
  }

  function classicDeleteItem(lib, idx) {
    var list = lib === 'history' ? ClassicStorage.getHistory() : ClassicStorage.getFavorites();
    list.splice(idx, 1);
    if (lib === 'history') ClassicStorage.setHistory(list); else ClassicStorage.setFavorites(list);
    renderLibrary();
    updateClassicFavButton();
  }

  function classicExportItem(lib, idx) {
    var list = lib === 'history' ? ClassicStorage.getHistory() : ClassicStorage.getFavorites();
    var item = list[idx];
    if (!item) return;
    copyText(item.board);
  }

  function classicRenameFavorite(idx, name) {
    var list = ClassicStorage.getFavorites();
    if (list[idx]) {
      list[idx].name = name || nowName();
      ClassicStorage.setFavorites(list);
    }
  }

  // ===== 事件绑定 =====
  btnSolve.addEventListener('click', handleSolve);
  btnStep.addEventListener('click', handleStep);
  btnUndo.addEventListener('click', handleUndo);
  btnReset.addEventListener('click', handleReset);
  btnFav.addEventListener('click', toggleFavorite);
  btnCheck.addEventListener('click', handleCheck);
  btnTogglePencil.addEventListener('click', togglePencil);
  btnEdit.addEventListener('click', enterEditMode);
  btnOCR.addEventListener('click', function () { ocrFileInput.click(); });
  ocrFileInput.addEventListener('change', handleOcrFile);
  btnClear.addEventListener('click', handleClear);

  pasteBtn.addEventListener('click', function () { loadFromString(pasteInput.value); });
  exportBtn.addEventListener('click', handleExport);
  pasteInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') loadFromString(pasteInput.value);
  });

  // 记录弹窗（求解器）
  btnLibrary.addEventListener('click', function () {
    libraryMode = 'solver';
    renderLibrary();
    libraryDialog.showModal();
  });
  dialogClose.addEventListener('click', function () { libraryDialog.close(); });
  libraryDialog.addEventListener('click', function (e) {
    if (e.target === libraryDialog) libraryDialog.close();
  });

  // 帮助弹窗
  btnHelp.addEventListener('click', function () { helpDialog.showModal(); });
  helpDialogClose.addEventListener('click', function () { helpDialog.close(); });
  helpDialog.addEventListener('click', function (e) {
    if (e.target === helpDialog) helpDialog.close();
  });

  // 弹窗内 tab 切换
  dialogTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var lib = this.dataset.lib;
      dialogTabs.forEach(function (t) { t.classList.toggle('active', t === this); }, this);
      historyPanel.hidden = (lib !== 'history');
      favoritesPanel.hidden = (lib !== 'favorites');
    });
  });

  // 弹窗内：应用 / 删除（事件委托，分模式）
  libraryDialog.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var lib = btn.dataset.lib;
    var idx = parseInt(btn.dataset.idx, 10);
    if (libraryMode === 'classic') {
      if (action === 'apply') classicApplyItem(lib, idx);
      else if (action === 'delete') classicDeleteItem(lib, idx);
      else if (action === 'export') classicExportItem(lib, idx);
    } else {
      if (action === 'apply') applyItem(lib, idx);
      else if (action === 'delete') deleteItem(lib, idx);
      else if (action === 'export') exportItem(lib, idx);
    }
  });

  // 弹窗内：收藏重命名（分模式）
  libraryDialog.addEventListener('change', function (e) {
    if (e.target.classList.contains('lib-name-input')) {
      if (libraryMode === 'classic') {
        classicRenameFavorite(parseInt(e.target.dataset.idx, 10), e.target.value.trim());
      } else {
        renameFavorite(parseInt(e.target.dataset.idx, 10), e.target.value.trim());
      }
    }
  });

  // ===== 经典模式事件绑定 =====
  modeTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchMode(this.dataset.mode);
    });
  });

  // 按键音效：所有按钮点击
  document.addEventListener('click', function (e) {
    if (e.target.closest('button')) AudioFX.key();
  });

  classicBoardEl.addEventListener('click', function (e) {
    var cell = e.target.closest('.cell');
    if (!cell) return;
    selectClassicCell(parseInt(cell.dataset.r, 10), parseInt(cell.dataset.c, 10));
  });

  numPad.addEventListener('click', function (e) {
    var key = e.target.closest('.num-key');
    if (!key || key.classList.contains('disabled')) return;
    handleClassicNum(parseInt(key.dataset.n, 10));
  });

  btnClassicUndo.addEventListener('click', undoClassic);
  btnClassicErase.addEventListener('click', eraseClassic);
  btnClassicEraseAll.addEventListener('click', clearClassicFilled);
  btnClassicNote.addEventListener('click', toggleClassicNoteMode);
  btnClassicNotes.addEventListener('click', toggleClassicNotes);
  btnClassicCheck.addEventListener('click', handleClassicCheck);
  btnClassicFav.addEventListener('click', toggleClassicFavorite);
  btnClassicSmart.addEventListener('click', smartSolve);

  btnClassicLibrary.addEventListener('click', function () {
    libraryMode = 'classic';
    renderLibrary();
    libraryDialog.showModal();
  });

  classicDifficultyEl.addEventListener('click', function () {
    if (!difficultyDialog.open) difficultyDialog.showModal();
  });

  difficultyOptions.forEach(function (opt) {
    opt.addEventListener('click', function () {
      difficultyDialog.close();
      generateClassic(opt.dataset.diff);
    });
  });

  difficultyClose.addEventListener('click', function () {
    difficultyDialog.close();
    if (!classicGenerated) generateClassic('medium');
  });

  // Esc 关闭难度弹窗时兜底生成中等
  difficultyDialog.addEventListener('cancel', function () {
    if (!classicGenerated) generateClassic('medium');
  });

  // 电脑键盘：数字键输入、方向键移动选中、退格擦除
  document.addEventListener('keydown', function (e) {
    if (mode !== 'classic' || !classicGenerated) return;
    if (difficultyDialog.open) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    var key = e.key;
    if (key >= '1' && key <= '9') {
      e.preventDefault();
      handleClassicNum(parseInt(key, 10));
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      eraseClassic();
      return;
    }
    var dr = 0, dc = 0;
    if (key === 'ArrowUp') dr = -1;
    else if (key === 'ArrowDown') dr = 1;
    else if (key === 'ArrowLeft') dc = -1;
    else if (key === 'ArrowRight') dc = 1;
    else return;
    e.preventDefault();
    moveClassicSelection(dr, dc);
  });

  // 输入数字后，光标自动跳到下一个空白格
  function moveToNextEmpty(r, c) {
    var nr = r, nc = c + 1;
    while (nr < 9) {
      while (nc < 9) {
        if (board[nr][nc] === 0) {
          var next = boardEl.querySelector('.cell-input[data-r="' + nr + '"][data-c="' + nc + '"]');
          if (next) next.focus();
          return;
        }
        nc++;
      }
      nr++;
      nc = 0;
    }
  }

  // 输入格子（事件委托）
  // 聚焦输入框时自动全选，便于直接输入覆盖旧数字
  boardEl.addEventListener('focus', function (e) {
    var input = e.target;
    if (input.classList.contains('cell-input')) input.select();
  }, true);

  boardEl.addEventListener('input', function (e) {
    var input = e.target;
    if (!input.classList.contains('cell-input')) return;
    var r = parseInt(input.dataset.r, 10);
    var c = parseInt(input.dataset.c, 10);

    var last = input.value.replace(/\D/g, '').slice(-1);
    var jump = false;
    if (last >= '1' && last <= '9') {
      board[r][c] = parseInt(last, 10);
      givens.add(r + ',' + c);
      jump = true;
    } else if (last === '0') {
      // 输入 0：与空格一样，置空并跳到下一个空白格
      board[r][c] = 0;
      givens.delete(r + ',' + c);
      jump = true;
    } else {
      board[r][c] = 0;
      givens.delete(r + ',' + c);
    }

    renderBoard();
    updateConflicts();
    hideStatus();
    hideExplanation();

    if (jump) {
      moveToNextEmpty(r, c);
    } else {
      var cur = boardEl.querySelector('.cell-input[data-r="' + r + '"][data-c="' + c + '"]');
      if (cur) cur.focus();
    }
  });

  // 空格键置空当前格并跳到下一个空白格；方向键移动光标
  boardEl.addEventListener('keydown', function (e) {
    var target = e.target;
    if (!target.classList.contains('cell-input')) return;

    if (e.key === ' ' || e.code === 'Space') {
      var r0 = parseInt(target.dataset.r, 10);
      var c0 = parseInt(target.dataset.c, 10);
      e.preventDefault();
      board[r0][c0] = 0;
      givens.delete(r0 + ',' + c0);
      renderBoard();
      updateConflicts();
      hideStatus();
      hideExplanation();
      moveToNextEmpty(r0, c0);
      return;
    }

    var keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (keys.indexOf(e.key) === -1) return;
    var r = parseInt(target.dataset.r, 10);
    var c = parseInt(target.dataset.c, 10);
    if (e.key === 'ArrowUp') r--;
    else if (e.key === 'ArrowDown') r++;
    else if (e.key === 'ArrowLeft') c--;
    else if (e.key === 'ArrowRight') c++;
    if (r < 0 || r > 8 || c < 0 || c > 8) return;
    e.preventDefault();
    var next = boardEl.querySelector('.cell-input[data-r="' + r + '"][data-c="' + c + '"]');
    if (next) next.focus();
  });

  // 即时冲突提示（红框标记重复数字）
  function updateConflicts() {
    boardEl.querySelectorAll('.cell').forEach(function (el) { el.classList.remove('conflict'); });
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) continue;
        var n = board[r][c];
        board[r][c] = 0;
        var ok = SudokuSolver.isValid(board, r, c, n);
        board[r][c] = n;
        if (!ok) {
          var el = boardEl.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
          if (el) el.classList.add('conflict');
        }
      }
    }
  }

  // ===== 初始化 =====
  renderBoard();
  updatePencilButton();
  updateStepButtons();
  renderLibrary();
  restoreLastHistory();

  // 经典模式初始化
  buildNumPad();
  restoreClassicProgress();
  updateClassicStats();
  switchMode('classic');   // 默认进入经典数独模式
})();
