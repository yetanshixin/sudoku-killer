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

  // ===== localStorage 封装 =====
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
      try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
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

  function renderList(lib) {
    var panel = lib === 'history' ? historyPanel : favoritesPanel;
    var list = lib === 'history' ? Storage.getHistory() : Storage.getFavorites();
    if (list.length === 0) {
      panel.innerHTML = '<div class="lib-empty">暂无记录</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var nameHtml;
      if (lib === 'favorites') {
        nameHtml = '<input class="lib-name-input" value="' + escapeHtml(it.name) +
                   '" data-idx="' + i + '">';
      } else {
        nameHtml = '<span class="lib-name">' + escapeHtml(it.name) + '</span>';
      }
      html += '<div class="lib-item">' +
              '<div class="lib-item-info">' + nameHtml +
              '<span class="lib-meta">已填 ' + countDigits(it.board) + ' 格</span></div>' +
              '<div class="lib-actions">' +
              '<button class="lib-btn export" data-action="export" data-lib="' + lib + '" data-idx="' + i + '">导出</button>' +
              '<button class="lib-btn apply" data-action="apply" data-lib="' + lib + '" data-idx="' + i + '">应用</button>' +
              '<button class="lib-btn del" data-action="delete" data-lib="' + lib + '" data-idx="' + i + '">删除</button>' +
              '</div></div>';
    }
    panel.innerHTML = html;
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

  // 记录弹窗
  btnLibrary.addEventListener('click', function () {
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

  // 弹窗内：应用 / 删除（事件委托）
  libraryDialog.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var lib = btn.dataset.lib;
    var idx = parseInt(btn.dataset.idx, 10);
    if (action === 'apply') applyItem(lib, idx);
    else if (action === 'delete') deleteItem(lib, idx);
    else if (action === 'export') exportItem(lib, idx);
  });

  // 弹窗内：收藏重命名
  libraryDialog.addEventListener('change', function (e) {
    if (e.target.classList.contains('lib-name-input')) {
      renameFavorite(parseInt(e.target.dataset.idx, 10), e.target.value.trim());
    }
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
})();
