/* ============================================================
 * solver.js —— 数独核心算法（纯前端，无依赖）
 * 包含：
 *   1. 基础规则校验 isValid
 *   2. 回溯求解 + 唯一解判定 countSolutions
 *   3. 逻辑求解器 createLogicSolver（模式二：逐步、可解释）
 * ============================================================ */
(function (global) {
  'use strict';

  var SIZE = 9;
  var BOX = 3;

  // 判断将 num 填入 board[r][c] 是否符合数独规则
  function isValid(board, r, c, num) {
    for (var i = 0; i < SIZE; i++) {
      if (board[r][i] === num) return false;
      if (board[i][c] === num) return false;
    }
    var br = Math.floor(r / BOX) * BOX;
    var bc = Math.floor(c / BOX) * BOX;
    for (var x = 0; x < BOX; x++) {
      for (var y = 0; y < BOX; y++) {
        if (board[br + x][bc + y] === num) return false;
      }
    }
    return true;
  }

  // 校验初始盘面本身是否冲突
  function isBoardValid(board) {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var num = board[r][c];
        if (num !== 0) {
          board[r][c] = 0;
          var ok = isValid(board, r, c, num);
          board[r][c] = num;
          if (!ok) return false;
        }
      }
    }
    return true;
  }

  // 深拷贝盘面
  function clone(board) {
    return board.map(function (row) { return row.slice(); });
  }

  // 回溯计数，最多数到 limit（用于唯一解判定）
  // 返回 { count, solution }，solution 为找到的第一个解（无解为 null）
  function countSolutions(board, limit) {
    limit = limit || 2;
    var b = clone(board);
    var count = 0;
    var solution = null;

    function findEmpty() {
      for (var i = 0; i < SIZE; i++) {
        for (var j = 0; j < SIZE; j++) {
          if (b[i][j] === 0) return [i, j];
        }
      }
      return null;
    }

    function backtrack() {
      if (count >= limit) return;
      var pos = findEmpty();
      if (!pos) {
        count++;
        if (solution === null) solution = clone(b);
        return;
      }
      var r = pos[0], c = pos[1];
      for (var n = 1; n <= SIZE; n++) {
        if (isValid(b, r, c, n)) {
          b[r][c] = n;
          backtrack();
          b[r][c] = 0;
          if (count >= limit) return;
        }
      }
    }

    backtrack();
    return { count: count, solution: solution };
  }

  // 计算每个空格的候选数集合（非空格为 null，空格为数字数组）
  function computeCandidates(board) {
    var cand = [];
    for (var r = 0; r < SIZE; r++) {
      cand.push([]);
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] !== 0) {
          cand[r].push(null);
        } else {
          var arr = [];
          for (var n = 1; n <= SIZE; n++) {
            if (isValid(board, r, c, n)) arr.push(n);
          }
          cand[r].push(arr);
        }
      }
    }
    return cand;
  }

  // 单元索引：0-8 行，9-17 列，18-26 宫
  function getUnitCells(unitIndex) {
    var cells = [];
    if (unitIndex < 9) {
      for (var c = 0; c < 9; c++) cells.push([unitIndex, c]);
    } else if (unitIndex < 18) {
      var cc = unitIndex - 9;
      for (var r = 0; r < 9; r++) cells.push([r, cc]);
    } else {
      var box = unitIndex - 18;
      var br = Math.floor(box / 3) * 3;
      var bc = (box % 3) * 3;
      for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
          cells.push([br + i, bc + j]);
        }
      }
    }
    return cells;
  }

  function unitName(unitIndex) {
    if (unitIndex < 9) return '第 ' + (unitIndex + 1) + ' 行';
    if (unitIndex < 18) return '第 ' + (unitIndex - 9 + 1) + ' 列';
    return '第 ' + (unitIndex - 18 + 1) + ' 宫';
  }

  function cellName(r, c) {
    return 'r' + (r + 1) + 'c' + (c + 1);
  }

  // ============ 数独生成器 ============

  function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function makeEmptyBoard() {
    var b = [];
    for (var r = 0; r < SIZE; r++) b.push([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    return b;
  }

  // 随机回溯填满一个完整解（从空盘开始，一定成功）
  function fillBoard(board) {
    var r = -1, c = -1;
    for (var i = 0; i < SIZE && r === -1; i++) {
      for (var j = 0; j < SIZE && r === -1; j++) {
        if (board[i][j] === 0) { r = i; c = j; }
      }
    }
    if (r === -1) return true;   // 已填满
    var nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (var k = 0; k < nums.length; k++) {
      if (isValid(board, r, c, nums[k])) {
        board[r][c] = nums[k];
        if (fillBoard(board)) return true;
        board[r][c] = 0;
      }
    }
    return false;
  }

  function generateSolution() {
    var board = makeEmptyBoard();
    fillBoard(board);
    return board;
  }

  // 空白格中「裸单」（候选仅 1 个）占比，用于简单模式抽检难度
  function nakedSingleRatio(board) {
    var cand = computeCandidates(board);
    var empty = 0, singles = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) {
          empty++;
          if (cand[r][c] && cand[r][c].length === 1) singles++;
        }
      }
    }
    return empty === 0 ? 0 : singles / empty;
  }

  // 按难度生成唯一解题目。difficulty: 'easy' | 'medium' | 'hard'
  function generatePuzzle(difficulty) {
    var solution = generateSolution();
    var puzzle = clone(solution);
    var cells = [];
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        cells.push([r, c]);

    if (difficulty === 'hard') {
      // 困难：minimal，循环移除直到每个给定数字都必要（去掉任意一个都会多解）
      var changed = true;
      while (changed) {
        changed = false;
        cells = shuffle(cells);
        for (var i = 0; i < cells.length; i++) {
          var hr = cells[i][0], hc = cells[i][1];
          if (puzzle[hr][hc] === 0) continue;
          var backup = puzzle[hr][hc];
          puzzle[hr][hc] = 0;
          if (countSolutions(puzzle, 2).count === 1) changed = true;
          else puzzle[hr][hc] = backup;
        }
      }
    } else {
      // 简单/中等：按目标给定数挖洞，始终保持唯一解
      var target = difficulty === 'easy' ? randomInt(36, 40) : randomInt(28, 32);
      var toRemove = 81 - target;
      var removed = 0;
      cells = shuffle(cells);
      for (var j = 0; j < cells.length && removed < toRemove; j++) {
        var mr = cells[j][0], mc = cells[j][1];
        var backup2 = puzzle[mr][mc];
        puzzle[mr][mc] = 0;
        if (countSolutions(puzzle, 2).count === 1) removed++;
        else puzzle[mr][mc] = backup2;
      }
      // 简单模式：裸单占比过高说明太轻易，重新生成
      if (difficulty === 'easy' && nakedSingleRatio(puzzle) > 0.6) {
        return generatePuzzle(difficulty);
      }
    }
    return { puzzle: puzzle, solution: solution };
  }

  // ============ 逻辑求解器（模式二） ============
  function createLogicSolver(initialBoard, uniqueAssumption) {
    var initial = clone(initialBoard);
    var board = clone(initialBoard);
    var candidates = computeCandidates(board);
    var history = [];   // 每步执行前的状态快照，用于「上一步」
    var useUnique = !!uniqueAssumption;   // 是否假设唯一解（启用唯一性技巧）

    function snapshot() {
      return {
        board: clone(board),
        candidates: candidates.map(function (row) {
          return row.map(function (cell) { return cell ? cell.slice() : null; });
        })
      };
    }

    function restore(snap) {
      board = snap.board;
      candidates = snap.candidates;
    }

    function isDone() {
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (board[r][c] === 0) return false;
        }
      }
      return true;
    }

    function removeCandidate(r, c, value) {
      if (candidates[r] && candidates[r][c]) {
        var idx = candidates[r][c].indexOf(value);
        if (idx !== -1) candidates[r][c].splice(idx, 1);
      }
    }

    // 填数并传播约束：从该格所在行/列/宫其它空格的候选中移除 value
    function fillCell(r, c, value) {
      board[r][c] = value;
      candidates[r][c] = null;
      for (var cc = 0; cc < 9; cc++) removeCandidate(r, cc, value);
      for (var rr = 0; rr < 9; rr++) removeCandidate(rr, c, value);
      var br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
          removeCandidate(br + i, bc + j, value);
        }
      }
    }

    // 收集某格被排除的数字来源（用于生成解释）
    function unitDigitsFor(r, c) {
      var seen = { row: {}, col: {}, box: {} };
      var i;
      for (i = 0; i < 9; i++) {
        if (i !== c && board[r][i] !== 0) seen.row[board[r][i]] = true;
        if (i !== r && board[i][c] !== 0) seen.col[board[i][c]] = true;
      }
      var br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (var x = 0; x < 3; x++) {
        for (var y = 0; y < 3; y++) {
          var rr = br + x, cc = bc + y;
          if ((rr !== r || cc !== c) && board[rr][cc] !== 0) seen.box[board[rr][cc]] = true;
        }
      }
      return seen;
    }

    function fmtSet(obj) {
      var arr = Object.keys(obj).map(Number).sort(function (a, b) { return a - b; });
      return arr.length ? arr.join('、') : '无';
    }

    // 1. 唯一候选数（Naked Single）：某格候选只剩一个
    function stepNakedSingle() {
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (candidates[r][c] && candidates[r][c].length === 1) {
            var v = candidates[r][c][0];
            var seen = unitDigitsFor(r, c);
            var message =
              '第 ' + (r + 1) + ' 行第 ' + (c + 1) + ' 列：该格候选数只剩 ' + v +
              '。因为同行已有 ' + fmtSet(seen.row) + '，同列已有 ' + fmtSet(seen.col) +
              '，同宫已有 ' + fmtSet(seen.box) + '。';
            fillCell(r, c, v);
            return {
              technique: 'nakedSingle',
              title: '唯一候选数（Naked Single）',
              kind: 'fill',
              message: message,
              fill: { r: r, c: c, value: v },
              eliminations: null,
              highlights: [[r, c]]
            };
          }
        }
      }
      return null;
    }

    // 2. 隐性唯一（Hidden Single）：某数字在某单元只剩唯一可放位置
    function stepHiddenSingle() {
      for (var u = 0; u < 27; u++) {
        var cells = getUnitCells(u);
        for (var n = 1; n <= 9; n++) {
          var filled = false;
          for (var i = 0; i < cells.length; i++) {
            if (board[cells[i][0]][cells[i][1]] === n) { filled = true; break; }
          }
          if (filled) continue;
          var positions = [];
          for (var j = 0; j < cells.length; j++) {
            var r = cells[j][0], c = cells[j][1];
            if (candidates[r][c] && candidates[r][c].indexOf(n) !== -1) positions.push([r, c]);
          }
          if (positions.length === 1) {
            var rr = positions[0][0], cc = positions[0][1];
            var message =
              unitName(u) + '中，数字 ' + n + ' 只能放在 ' + cellName(rr, cc) +
              '（其余空位均被所在行/列/宫的已有数字排除），因此填入 ' + n + '。';
            fillCell(rr, cc, n);
            return {
              technique: 'hiddenSingle',
              title: '隐性唯一（Hidden Single）',
              kind: 'fill',
              message: message,
              fill: { r: rr, c: cc, value: n },
              eliminations: null,
              highlights: [[rr, cc]]
            };
          }
        }
      }
      return null;
    }

    // 3. 显性数对（Naked Pair）：两格候选完全相同且只有两个数字
    function stepNakedPair() {
      for (var u = 0; u < 27; u++) {
        var unitCells = getUnitCells(u);
        var pairCells = [];
        for (var i = 0; i < unitCells.length; i++) {
          var r = unitCells[i][0], c = unitCells[i][1];
          if (candidates[r][c] && candidates[r][c].length === 2) pairCells.push([r, c]);
        }
        for (var p = 0; p < pairCells.length; p++) {
          for (var q = p + 1; q < pairCells.length; q++) {
            var r1 = pairCells[p][0], c1 = pairCells[p][1];
            var r2 = pairCells[q][0], c2 = pairCells[q][1];
            var a = candidates[r1][c1], b = candidates[r2][c2];
            if (a[0] === b[0] && a[1] === b[1]) {
              var eliminations = [];
              for (var k = 0; k < unitCells.length; k++) {
                var rr = unitCells[k][0], cc = unitCells[k][1];
                if ((rr === r1 && cc === c1) || (rr === r2 && cc === c2)) continue;
                if (candidates[rr][cc]) {
                  for (var t = 0; t < a.length; t++) {
                    if (candidates[rr][cc].indexOf(a[t]) !== -1) {
                      eliminations.push({ r: rr, c: cc, value: a[t] });
                    }
                  }
                }
              }
              if (eliminations.length > 0) {
                for (var e = 0; e < eliminations.length; e++) {
                  removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
                }
                var message =
                  unitName(u) + '中，' + cellName(r1, c1) + ' 与 ' + cellName(r2, c2) +
                  ' 的候选数都是 {' + a.join('、') + '}，构成显性数对，因此该单元其它格子的候选排除 ' +
                  a.join(' 和 ') + '（共排除 ' + eliminations.length + ' 处）。';
                return {
                  technique: 'nakedPair',
                  title: '显性数对（Naked Pair）',
                  kind: 'eliminate',
                  message: message,
                  fill: null,
                  eliminations: eliminations,
                  highlights: [[r1, c1], [r2, c2]]
                };
              }
            }
          }
        }
      }
      return null;
    }

    // 4. 区块摒除（Pointing）：某数字在某宫内只能落在同一行/列
    function stepPointing() {
      for (var box = 0; box < 9; box++) {
        var cells = getUnitCells(18 + box);
        var br = Math.floor(box / 3) * 3, bc = (box % 3) * 3;
        for (var n = 1; n <= 9; n++) {
          var filled = false;
          for (var i = 0; i < cells.length; i++) {
            if (board[cells[i][0]][cells[i][1]] === n) { filled = true; break; }
          }
          if (filled) continue;
          var positions = [];
          for (var j = 0; j < cells.length; j++) {
            var r = cells[j][0], c = cells[j][1];
            if (candidates[r][c] && candidates[r][c].indexOf(n) !== -1) positions.push([r, c]);
          }
          if (positions.length === 0) continue;

          var rows = {}, cols = {};
          for (var p = 0; p < positions.length; p++) {
            rows[positions[p][0]] = true;
            cols[positions[p][1]] = true;
          }
          var rowKeys = Object.keys(rows), colKeys = Object.keys(cols);

          if (rowKeys.length === 1) {
            var r0 = Number(rowKeys[0]);
            var eliminations = [];
            for (var cc = 0; cc < 9; cc++) {
              if (cc >= bc && cc < bc + 3) continue; // 宫内跳过
              if (candidates[r0][cc] && candidates[r0][cc].indexOf(n) !== -1) {
                eliminations.push({ r: r0, c: cc, value: n });
              }
            }
            if (eliminations.length > 0) {
              for (var e = 0; e < eliminations.length; e++) {
                removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
              }
              var message1 =
                '第 ' + (box + 1) + ' 宫中，数字 ' + n + ' 只能出现在第 ' + (r0 + 1) + ' 行，' +
                '因此该行其它宫中的候选 ' + n + ' 被排除（共排除 ' + eliminations.length + ' 处）。';
              return {
                technique: 'pointing',
                title: '区块摒除（Pointing）',
                kind: 'eliminate',
                message: message1,
                fill: null,
                eliminations: eliminations,
                highlights: positions
              };
            }
          } else if (colKeys.length === 1) {
            var c0 = Number(colKeys[0]);
            var eliminations2 = [];
            for (var rr = 0; rr < 9; rr++) {
              if (rr >= br && rr < br + 3) continue;
              if (candidates[rr][c0] && candidates[rr][c0].indexOf(n) !== -1) {
                eliminations2.push({ r: rr, c: c0, value: n });
              }
            }
            if (eliminations2.length > 0) {
              for (var e2 = 0; e2 < eliminations2.length; e2++) {
                removeCandidate(eliminations2[e2].r, eliminations2[e2].c, eliminations2[e2].value);
              }
              var message2 =
                '第 ' + (box + 1) + ' 宫中，数字 ' + n + ' 只能出现在第 ' + (c0 + 1) + ' 列，' +
                '因此该列其它宫中的候选 ' + n + ' 被排除（共排除 ' + eliminations2.length + ' 处）。';
              return {
                technique: 'pointing',
                title: '区块摒除（Pointing）',
                kind: 'eliminate',
                message: message2,
                fill: null,
                eliminations: eliminations2,
                highlights: positions
              };
            }
          }
        }
      }
      return null;
    }

    // ---- 辅助：候选位置 / 候选并集 ----
    function candidatePositions(cells, n) {
      var positions = [];
      for (var i = 0; i < cells.length; i++) {
        var r = cells[i][0], c = cells[i][1];
        if (candidates[r][c] && candidates[r][c].indexOf(n) !== -1) positions.push([r, c]);
      }
      return positions;
    }

    function samePositions(a, b) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) {
        if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
      }
      return true;
    }

    function unionCandidates(cellList) {
      var set = {};
      for (var i = 0; i < cellList.length; i++) {
        var cc = candidates[cellList[i][0]][cellList[i][1]];
        if (cc) for (var j = 0; j < cc.length; j++) set[cc[j]] = true;
      }
      return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    }

    function candidateColsInRow(r, n) {
      var cols = [];
      for (var c = 0; c < 9; c++) {
        if (candidates[r][c] && candidates[r][c].indexOf(n) !== -1) cols.push(c);
      }
      return cols;
    }

    function candidateRowsInCol(c, n) {
      var rows = [];
      for (var r = 0; r < 9; r++) {
        if (candidates[r][c] && candidates[r][c].indexOf(n) !== -1) rows.push(r);
      }
      return rows;
    }

    // 5. 隐性数对（Hidden Pair）：两个数字在某单元都只能放在同样两个格子
    function stepHiddenPair() {
      for (var u = 0; u < 27; u++) {
        var cells = getUnitCells(u);
        for (var n1 = 1; n1 <= 9; n1++) {
          var pos1 = candidatePositions(cells, n1);
          if (pos1.length !== 2) continue;
          for (var n2 = n1 + 1; n2 <= 9; n2++) {
            var pos2 = candidatePositions(cells, n2);
            if (pos2.length !== 2 || !samePositions(pos1, pos2)) continue;
            var eliminations = [];
            for (var p = 0; p < pos1.length; p++) {
              var r = pos1[p][0], c = pos1[p][1];
              var cc = candidates[r][c];
              for (var v = 0; v < cc.length; v++) {
                if (cc[v] !== n1 && cc[v] !== n2) eliminations.push({ r: r, c: c, value: cc[v] });
              }
            }
            if (eliminations.length > 0) {
              for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
              var message = unitName(u) + '中，数字 ' + n1 + ' 和 ' + n2 + ' 都只能放在 ' +
                cellName(pos1[0][0], pos1[0][1]) + ' 与 ' + cellName(pos1[1][0], pos1[1][1]) +
                '，构成隐性数对，这两格的其它候选被排除（共 ' + eliminations.length + ' 处）。';
              return {
                technique: 'hiddenPair', title: '隐性数对（Hidden Pair）', kind: 'eliminate',
                message: message, fill: null, eliminations: eliminations,
                highlights: [[pos1[0][0], pos1[0][1]], [pos1[1][0], pos1[1][1]]]
              };
            }
          }
        }
      }
      return null;
    }

    // 6. 显性三数组（Naked Triple）：三格候选并集恰好 3 个数字
    function stepNakedTriple() {
      for (var u = 0; u < 27; u++) {
        var cells = getUnitCells(u);
        var empty = [];
        for (var i = 0; i < cells.length; i++) {
          if (candidates[cells[i][0]][cells[i][1]] && candidates[cells[i][0]][cells[i][1]].length > 0) empty.push(cells[i]);
        }
        for (var a = 0; a < empty.length; a++) {
          for (var b = a + 1; b < empty.length; b++) {
            for (var k = b + 1; k < empty.length; k++) {
              var union = unionCandidates([empty[a], empty[b], empty[k]]);
              if (union.length !== 3) continue;
              var eliminations = [];
              for (var p = 0; p < cells.length; p++) {
                var r = cells[p][0], c = cells[p][1];
                if ((r === empty[a][0] && c === empty[a][1]) ||
                    (r === empty[b][0] && c === empty[b][1]) ||
                    (r === empty[k][0] && c === empty[k][1])) continue;
                if (candidates[r][c]) {
                  for (var v = 0; v < union.length; v++) {
                    if (candidates[r][c].indexOf(union[v]) !== -1) eliminations.push({ r: r, c: c, value: union[v] });
                  }
                }
              }
              if (eliminations.length > 0) {
                for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
                var message = unitName(u) + '中，' +
                  cellName(empty[a][0], empty[a][1]) + '、' + cellName(empty[b][0], empty[b][1]) + '、' + cellName(empty[k][0], empty[k][1]) +
                  ' 的候选都在 {' + union.join('、') + '} 内，构成显性三数组，其它格子的候选 ' + union.join('、') + ' 被排除（共 ' + eliminations.length + ' 处）。';
                return {
                  technique: 'nakedTriple', title: '显性三数组（Naked Triple）', kind: 'eliminate',
                  message: message, fill: null, eliminations: eliminations,
                  highlights: [[empty[a][0], empty[a][1]], [empty[b][0], empty[b][1]], [empty[k][0], empty[k][1]]]
                };
              }
            }
          }
        }
      }
      return null;
    }

    // 7. 区块交互（Claiming）：某行/列的数字只能出现在某宫
    function stepClaiming() {
      for (var n = 1; n <= 9; n++) {
        for (var r = 0; r < 9; r++) {
          var cols = candidateColsInRow(r, n);
          if (cols.length === 0) continue;
          var boxCol = Math.floor(cols[0] / 3);
          var sameBox = true;
          for (var i = 1; i < cols.length; i++) if (Math.floor(cols[i] / 3) !== boxCol) { sameBox = false; break; }
          if (!sameBox) continue;
          var br = Math.floor(r / 3);
          var eliminations = [];
          for (var rr = br * 3; rr < br * 3 + 3; rr++) {
            if (rr === r) continue;
            for (var cc = boxCol * 3; cc < boxCol * 3 + 3; cc++) {
              if (candidates[rr][cc] && candidates[rr][cc].indexOf(n) !== -1) eliminations.push({ r: rr, c: cc, value: n });
            }
          }
          if (eliminations.length > 0) {
            for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
            var message = '第 ' + (r + 1) + ' 行中，数字 ' + n + ' 只能出现在第 ' + (boxCol + 1) + ' 宫，' +
              '因此该宫其它行中的候选 ' + n + ' 被排除（共 ' + eliminations.length + ' 处）。';
            return {
              technique: 'claiming', title: '区块交互（Claiming）', kind: 'eliminate',
              message: message, fill: null, eliminations: eliminations,
              highlights: cols.map(function (c) { return [r, c]; })
            };
          }
        }
        for (var c = 0; c < 9; c++) {
          var rows = candidateRowsInCol(c, n);
          if (rows.length === 0) continue;
          var boxRow = Math.floor(rows[0] / 3);
          var sameBox2 = true;
          for (var i2 = 1; i2 < rows.length; i2++) if (Math.floor(rows[i2] / 3) !== boxRow) { sameBox2 = false; break; }
          if (!sameBox2) continue;
          var bc = Math.floor(c / 3);
          var eliminations2 = [];
          for (var cc = bc * 3; cc < bc * 3 + 3; cc++) {
            if (cc === c) continue;
            for (var rr = boxRow * 3; rr < boxRow * 3 + 3; rr++) {
              if (candidates[rr][cc] && candidates[rr][cc].indexOf(n) !== -1) eliminations2.push({ r: rr, c: cc, value: n });
            }
          }
          if (eliminations2.length > 0) {
            for (var e2 = 0; e2 < eliminations2.length; e2++) removeCandidate(eliminations2[e2].r, eliminations2[e2].c, eliminations2[e2].value);
            var message2 = '第 ' + (c + 1) + ' 列中，数字 ' + n + ' 只能出现在第 ' + (boxRow + 1) + ' 宫，' +
              '因此该宫其它列中的候选 ' + n + ' 被排除（共 ' + eliminations2.length + ' 处）。';
            return {
              technique: 'claiming', title: '区块交互（Claiming）', kind: 'eliminate',
              message: message2, fill: null, eliminations: eliminations2,
              highlights: rows.map(function (r) { return [r, c]; })
            };
          }
        }
      }
      return null;
    }

    // 8. 隐性三数组（Hidden Triple）：三个数字在某单元只能放在同样三个格子
    function stepHiddenTriple() {
      for (var u = 0; u < 27; u++) {
        var cells = getUnitCells(u);
        for (var n1 = 1; n1 <= 9; n1++) {
          var pos1 = candidatePositions(cells, n1);
          if (pos1.length !== 3) continue;
          for (var n2 = n1 + 1; n2 <= 9; n2++) {
            var pos2 = candidatePositions(cells, n2);
            if (pos2.length !== 3 || !samePositions(pos1, pos2)) continue;
            for (var n3 = n2 + 1; n3 <= 9; n3++) {
              var pos3 = candidatePositions(cells, n3);
              if (pos3.length !== 3 || !samePositions(pos1, pos3)) continue;
              var eliminations = [];
              for (var p = 0; p < pos1.length; p++) {
                var r = pos1[p][0], c = pos1[p][1];
                var cc = candidates[r][c];
                for (var v = 0; v < cc.length; v++) {
                  if (cc[v] !== n1 && cc[v] !== n2 && cc[v] !== n3) eliminations.push({ r: r, c: c, value: cc[v] });
                }
              }
              if (eliminations.length > 0) {
                for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
                var message = unitName(u) + '中，数字 ' + n1 + '、' + n2 + '、' + n3 + ' 都只能放在同样的三格，' +
                  '构成隐性三数组，这三格的其它候选被排除（共 ' + eliminations.length + ' 处）。';
                return {
                  technique: 'hiddenTriple', title: '隐性三数组（Hidden Triple）', kind: 'eliminate',
                  message: message, fill: null, eliminations: eliminations, highlights: pos1
                };
              }
            }
          }
        }
      }
      return null;
    }

    // 9. X-Wing：某数字在两行/列中恰好各有两个相同的候选列/行
    function stepXWing() {
      for (var n = 1; n <= 9; n++) {
        for (var r1 = 0; r1 < 9; r1++) {
          var cols1 = candidateColsInRow(r1, n);
          if (cols1.length !== 2) continue;
          for (var r2 = r1 + 1; r2 < 9; r2++) {
            var cols2 = candidateColsInRow(r2, n);
            if (cols2.length !== 2 || cols1[0] !== cols2[0] || cols1[1] !== cols2[1]) continue;
            var eliminations = [];
            for (var ci = 0; ci < 2; ci++) {
              var cc = cols1[ci];
              for (var rr = 0; rr < 9; rr++) {
                if (rr === r1 || rr === r2) continue;
                if (candidates[rr][cc] && candidates[rr][cc].indexOf(n) !== -1) eliminations.push({ r: rr, c: cc, value: n });
              }
            }
            if (eliminations.length > 0) {
              for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
              var message = '数字 ' + n + ' 在第 ' + (r1 + 1) + ' 行和第 ' + (r2 + 1) + ' 行都只能出现在第 ' +
                (cols1[0] + 1) + '、' + (cols1[1] + 1) + ' 列，构成 X-Wing，这两列其它行中的候选 ' + n + ' 被排除（共 ' + eliminations.length + ' 处）。';
              return {
                technique: 'xWing', title: 'X-Wing', kind: 'eliminate',
                message: message, fill: null, eliminations: eliminations,
                highlights: [[r1, cols1[0]], [r1, cols1[1]], [r2, cols2[0]], [r2, cols2[1]]]
              };
            }
          }
        }
        for (var c1 = 0; c1 < 9; c1++) {
          var rows1 = candidateRowsInCol(c1, n);
          if (rows1.length !== 2) continue;
          for (var c2 = c1 + 1; c2 < 9; c2++) {
            var rows2 = candidateRowsInCol(c2, n);
            if (rows2.length !== 2 || rows1[0] !== rows2[0] || rows1[1] !== rows2[1]) continue;
            var eliminations2 = [];
            for (var ri = 0; ri < 2; ri++) {
              var rr = rows1[ri];
              for (var cc = 0; cc < 9; cc++) {
                if (cc === c1 || cc === c2) continue;
                if (candidates[rr][cc] && candidates[rr][cc].indexOf(n) !== -1) eliminations2.push({ r: rr, c: cc, value: n });
              }
            }
            if (eliminations2.length > 0) {
              for (var e2 = 0; e2 < eliminations2.length; e2++) removeCandidate(eliminations2[e2].r, eliminations2[e2].c, eliminations2[e2].value);
              var message2 = '数字 ' + n + ' 在第 ' + (c1 + 1) + ' 列和第 ' + (c2 + 1) + ' 列都只能出现在第 ' +
                (rows1[0] + 1) + '、' + (rows1[1] + 1) + ' 行，构成 X-Wing，这两行其它列中的候选 ' + n + ' 被排除（共 ' + eliminations2.length + ' 处）。';
              return {
                technique: 'xWing', title: 'X-Wing', kind: 'eliminate',
                message: message2, fill: null, eliminations: eliminations2,
                highlights: [[rows1[0], c1], [rows1[1], c1], [rows2[0], c2], [rows2[1], c2]]
              };
            }
          }
        }
      }
      return null;
    }

    // 某格子的所有"同伴"（同一行/列/宫的其它空格）
    function getPeers(r0, c0) {
      var peers = [];
      for (var i = 0; i < 9; i++) {
        if (i !== c0 && candidates[r0][i]) peers.push([r0, i]);
        if (i !== r0 && candidates[i][c0]) peers.push([i, c0]);
      }
      var br = Math.floor(r0 / 3) * 3, bc = Math.floor(c0 / 3) * 3;
      for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
          var rr = br + i, cc = bc + j;
          if ((rr !== r0 || cc !== c0) && candidates[rr][cc]) peers.push([rr, cc]);
        }
      }
      return peers;
    }

    function sees(r1, c1, r2, c2) {
      if (r1 === r2 && c1 === c2) return false;
      return r1 === r2 || c1 === c2 ||
        (Math.floor(r1 / 3) === Math.floor(r2 / 3) && Math.floor(c1 / 3) === Math.floor(c2 / 3));
    }

    function unique(arr) {
      var set = {}, out = [];
      for (var i = 0; i < arr.length; i++) {
        if (!set[arr[i]]) { set[arr[i]] = true; out.push(arr[i]); }
      }
      return out.sort(function (a, b) { return a - b; });
    }

    // 10. XY-Wing：pivot 候选 {X,Y}，两翼 {X,Z} 与 {Y,Z}，排除同时看到两翼的格子的 Z
    function stepXYWing() {
      for (var r0 = 0; r0 < 9; r0++) {
        for (var c0 = 0; c0 < 9; c0++) {
          if (!candidates[r0][c0] || candidates[r0][c0].length !== 2) continue;
          var xy = candidates[r0][c0];
          var peers = getPeers(r0, c0);
          for (var z = 1; z <= 9; z++) {
            if (z === xy[0] || z === xy[1]) continue;
            var wing1 = null, wing2 = null;
            for (var i = 0; i < peers.length; i++) {
              var cc = candidates[peers[i][0]][peers[i][1]];
              if (cc && cc.length === 2 && cc.indexOf(xy[0]) !== -1 && cc.indexOf(z) !== -1) { wing1 = peers[i]; break; }
            }
            if (!wing1) continue;
            for (var j = 0; j < peers.length; j++) {
              var cc2 = candidates[peers[j][0]][peers[j][1]];
              if (cc2 && cc2.length === 2 && cc2.indexOf(xy[1]) !== -1 && cc2.indexOf(z) !== -1) { wing2 = peers[j]; break; }
            }
            if (!wing2) continue;
            var eliminations = [];
            for (var r = 0; r < 9; r++) {
              for (var c = 0; c < 9; c++) {
                if ((r === wing1[0] && c === wing1[1]) || (r === wing2[0] && c === wing2[1])) continue;
                if (candidates[r][c] && candidates[r][c].indexOf(z) !== -1 &&
                    sees(r, c, wing1[0], wing1[1]) && sees(r, c, wing2[0], wing2[1])) {
                  eliminations.push({ r: r, c: c, value: z });
                }
              }
            }
            if (eliminations.length > 0) {
              for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
              var message = '以 ' + cellName(r0, c0) + '（候选 {' + xy.join('、') + '}）为枢纽，' +
                cellName(wing1[0], wing1[1]) + ' 与 ' + cellName(wing2[0], wing2[1]) + ' 为两翼，构成 XY-Wing，' +
                '因此同时看到两翼的格子的候选 ' + z + ' 被排除（共 ' + eliminations.length + ' 处）。';
              return {
                technique: 'xyWing', title: 'XY-Wing', kind: 'eliminate',
                message: message, fill: null, eliminations: eliminations,
                highlights: [[r0, c0], [wing1[0], wing1[1]], [wing2[0], wing2[1]]]
              };
            }
          }
        }
      }
      return null;
    }

    // 11. Swordfish：三行/列中某数字的候选都在同样三列/行
    function stepSwordfish() {
      for (var n = 1; n <= 9; n++) {
        for (var r1 = 0; r1 < 9; r1++) {
          var cols1 = candidateColsInRow(r1, n);
          if (cols1.length < 2 || cols1.length > 3) continue;
          for (var r2 = r1 + 1; r2 < 9; r2++) {
            var cols2 = candidateColsInRow(r2, n);
            if (cols2.length < 2 || cols2.length > 3) continue;
            for (var r3 = r2 + 1; r3 < 9; r3++) {
              var cols3 = candidateColsInRow(r3, n);
              if (cols3.length < 2 || cols3.length > 3) continue;
              var union = unique(cols1.concat(cols2).concat(cols3));
              if (union.length !== 3) continue;
              var eliminations = [];
              for (var ci = 0; ci < 3; ci++) {
                var cc = union[ci];
                for (var rr = 0; rr < 9; rr++) {
                  if (rr === r1 || rr === r2 || rr === r3) continue;
                  if (candidates[rr][cc] && candidates[rr][cc].indexOf(n) !== -1) {
                    eliminations.push({ r: rr, c: cc, value: n });
                  }
                }
              }
              if (eliminations.length > 0) {
                for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
                var message = '数字 ' + n + ' 在第 ' + (r1 + 1) + '、' + (r2 + 1) + '、' + (r3 + 1) + ' 行的候选都在第 ' +
                  (union[0] + 1) + '、' + (union[1] + 1) + '、' + (union[2] + 1) + ' 列，构成 Swordfish，' +
                  '这三列其它行中的候选 ' + n + ' 被排除（共 ' + eliminations.length + ' 处）。';
                return {
                  technique: 'swordfish', title: 'Swordfish', kind: 'eliminate',
                  message: message, fill: null, eliminations: eliminations,
                  highlights: [[r1, union[0]], [r1, union[1]], [r1, union[2]], [r2, union[0]], [r2, union[1]], [r2, union[2]], [r3, union[0]], [r3, union[1]], [r3, union[2]]]
                };
              }
            }
          }
        }
        for (var c1 = 0; c1 < 9; c1++) {
          var rows1 = candidateRowsInCol(c1, n);
          if (rows1.length < 2 || rows1.length > 3) continue;
          for (var c2 = c1 + 1; c2 < 9; c2++) {
            var rows2 = candidateRowsInCol(c2, n);
            if (rows2.length < 2 || rows2.length > 3) continue;
            for (var c3 = c2 + 1; c3 < 9; c3++) {
              var rows3 = candidateRowsInCol(c3, n);
              if (rows3.length < 2 || rows3.length > 3) continue;
              var unionR = unique(rows1.concat(rows2).concat(rows3));
              if (unionR.length !== 3) continue;
              var eliminations2 = [];
              for (var ri = 0; ri < 3; ri++) {
                var rr = unionR[ri];
                for (var cc = 0; cc < 9; cc++) {
                  if (cc === c1 || cc === c2 || cc === c3) continue;
                  if (candidates[rr][cc] && candidates[rr][cc].indexOf(n) !== -1) {
                    eliminations2.push({ r: rr, c: cc, value: n });
                  }
                }
              }
              if (eliminations2.length > 0) {
                for (var e2 = 0; e2 < eliminations2.length; e2++) removeCandidate(eliminations2[e2].r, eliminations2[e2].c, eliminations2[e2].value);
                var message2 = '数字 ' + n + ' 在第 ' + (c1 + 1) + '、' + (c2 + 1) + '、' + (c3 + 1) + ' 列的候选都在第 ' +
                  (unionR[0] + 1) + '、' + (unionR[1] + 1) + '、' + (unionR[2] + 1) + ' 行，构成 Swordfish，' +
                  '这三行其它列中的候选 ' + n + ' 被排除（共 ' + eliminations2.length + ' 处）。';
                return {
                  technique: 'swordfish', title: 'Swordfish', kind: 'eliminate',
                  message: message2, fill: null, eliminations: eliminations2,
                  highlights: [[unionR[0], c1], [unionR[1], c1], [unionR[2], c1], [unionR[0], c2], [unionR[1], c2], [unionR[2], c2], [unionR[0], c3], [unionR[1], c3], [unionR[2], c3]]
                };
              }
            }
          }
        }
      }
      return null;
    }

    // value 是否在 (r1,c1) 与 (r2,c2) 的共享单元中构成强连接（恰好出现 2 次）
    function sharedUnitStrongLink(r1, c1, r2, c2, value) {
      if (r1 === r2) {
        var cnt = 0;
        for (var c = 0; c < 9; c++) if (candidates[r1][c] && candidates[r1][c].indexOf(value) !== -1) cnt++;
        return cnt === 2;
      }
      if (c1 === c2) {
        var cnt2 = 0;
        for (var r = 0; r < 9; r++) if (candidates[r][c1] && candidates[r][c1].indexOf(value) !== -1) cnt2++;
        return cnt2 === 2;
      }
      // 同宫（不同行列）
      if (Math.floor(r1 / 3) !== Math.floor(r2 / 3) || Math.floor(c1 / 3) !== Math.floor(c2 / 3)) return false;
      var br = Math.floor(r1 / 3) * 3, bc = Math.floor(c1 / 3) * 3;
      var cnt3 = 0;
      for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
        if (candidates[br + i][bc + j] && candidates[br + i][bc + j].indexOf(value) !== -1) cnt3++;
      }
      return cnt3 === 2;
    }

    // 12. XY-Chain：双值格沿强连接成链，两端共享候选 Z 时排除同时看到两端的格子的 Z
    function stepXYChain() {
      var biValues = [];
      for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++)
        if (candidates[r][c] && candidates[r][c].length === 2) biValues.push([r, c]);

      function inPath(path, r, c) {
        for (var i = 0; i < path.length; i++) if (path[i][0] === r && path[i][1] === c) return true;
        return false;
      }

      // path：链节点；links：相邻节点的连接候选（links[i] = node_i 与 node_{i+1} 的共享候选）
      function tryExclude(path, links) {
        if (path.length < 4 || path.length % 2 !== 0) return null;
        var start = path[0], end = path[path.length - 1];
        var startCands = candidates[start[0]][start[1]];
        var endCands = candidates[end[0]][end[1]];
        var s1 = links[0];
        var sN = links[links.length - 1];
        // Z 必须是两端的"非连接候选"（起点去掉首连接，终点去掉末连接）
        for (var zi = 0; zi < startCands.length; zi++) {
          var z = startCands[zi];
          if (z === s1) continue;
          if (endCands.indexOf(z) === -1 || z === sN) continue;
          var eliminations = [];
          for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) {
            if ((r === start[0] && c === start[1]) || (r === end[0] && c === end[1])) continue;
            if (candidates[r][c] && candidates[r][c].indexOf(z) !== -1 &&
                sees(r, c, start[0], start[1]) && sees(r, c, end[0], end[1])) {
              eliminations.push({ r: r, c: c, value: z });
            }
          }
          if (eliminations.length > 0) {
            var chainStr = path.map(function (p) { return cellName(p[0], p[1]); }).join(' → ');
            for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
            var message = '双值链 ' + chainStr + ' 的两端必有一个为 ' + z + '，' +
              '因此同时看到两端的格子的候选 ' + z + ' 被排除（共 ' + eliminations.length + ' 处）。';
            return {
              technique: 'xyChain', title: 'XY-Chain（双值链）', kind: 'eliminate',
              message: message, fill: null, eliminations: eliminations, highlights: path
            };
          }
        }
        return null;
      }

      function search(node, path, links) {
        var excl = tryExclude(path, links);
        if (excl) return excl;
        if (path.length >= 10) return null;   // 限制链长，避免组合爆炸

        var nodeCands = candidates[node[0]][node[1]];
        for (var ci = 0; ci < nodeCands.length; ci++) {
          var shared = nodeCands[ci];
          // 中间节点：进入候选与离开候选必须不同，保持强弱交替
          if (links.length > 0 && shared === links[links.length - 1]) continue;
          for (var b = 0; b < biValues.length; b++) {
            var nb = biValues[b];
            if (inPath(path, nb[0], nb[1])) continue;
            var nbCands = candidates[nb[0]][nb[1]];
            if (!nbCands || nbCands.length !== 2 || nbCands.indexOf(shared) === -1) continue;
            if (!sharedUnitStrongLink(node[0], node[1], nb[0], nb[1], shared)) continue;
            var res = search(nb, path.concat([[nb[0], nb[1]]]), links.concat([shared]));
            if (res) return res;
          }
        }
        return null;
      }

      for (var s = 0; s < biValues.length; s++) {
        var start = biValues[s];
        var res = search(start, [start], []);
        if (res) return res;
      }
      return null;
    }

    // 13. X-Chain（简单着色）：单数字沿强连接着色，同色冲突或红绿可见则排除
    function stepXChain() {
      for (var n = 1; n <= 9; n++) {
        var positions = [];
        for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++)
          if (candidates[r][c] && candidates[r][c].indexOf(n) !== -1) positions.push([r, c]);

        var color = {};
        var comp = {};
        var compId = 0;
        var conflict = false;
        function key(r, c) { return r + ',' + c; }

        for (var i = 0; i < positions.length; i++) {
          var k0 = key(positions[i][0], positions[i][1]);
          if (color[k0] !== undefined) continue;
          compId++;
          color[k0] = 1;
          comp[k0] = compId;
          var queue = [positions[i]];
          while (queue.length) {
            var cur = queue.shift();
            var curColor = color[key(cur[0], cur[1])];
            for (var j = 0; j < positions.length; j++) {
              var nb = positions[j];
              var nbKey = key(nb[0], nb[1]);
              if (nbKey === key(cur[0], cur[1])) continue;
              if (!sharedUnitStrongLink(cur[0], cur[1], nb[0], nb[1], n)) continue;
              if (color[nbKey] === undefined) {
                color[nbKey] = -curColor;
                comp[nbKey] = compId;
                queue.push(nb);
              } else if (color[nbKey] === curColor) {
                conflict = true;   // strong link 两端同色 → 奇环，着色失效
              }
            }
          }
        }

        // 结论 1：同色节点同处一个单元 → 该颜色全假
        if (conflict) continue;   // 着色矛盾（奇环）时跳过该数字
        for (var i = 0; i < positions.length; i++) {
          for (var j = i + 1; j < positions.length; j++) {
            var ci = color[key(positions[i][0], positions[i][1])];
            var cj = color[key(positions[j][0], positions[j][1])];
            if (ci === undefined || cj === undefined || ci !== cj) continue;
            if (comp[key(positions[i][0], positions[i][1])] !== comp[key(positions[j][0], positions[j][1])]) continue;
            if (sees(positions[i][0], positions[i][1], positions[j][0], positions[j][1])) {
              var eliminations = [];
              for (var k = 0; k < positions.length; k++) {
                if (color[key(positions[k][0], positions[k][1])] === ci) {
                  eliminations.push({ r: positions[k][0], c: positions[k][1], value: n });
                }
              }
              if (eliminations.length > 0) {
                for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
                var colorName = ci === 1 ? '红色' : '绿色';
                var message = '数字 ' + n + ' 的着色链中，' + colorName + '的两个位置同处一个单元，' +
                  '因此该颜色的所有位置都为假，候选 ' + n + ' 被排除（共 ' + eliminations.length + ' 处）。';
                return {
                  technique: 'xChain', title: 'X-Chain（单数字链）', kind: 'eliminate',
                  message: message, fill: null, eliminations: eliminations,
                  highlights: positions.filter(function (p) { return color[key(p[0], p[1])] === ci; })
                };
              }
            }
          }
        }

        // 结论 2：未着色的位置同时看到红与绿 → 排除其候选 n
        for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) {
          if (!candidates[r][c] || candidates[r][c].indexOf(n) === -1) continue;
          if (color[key(r, c)] !== undefined) continue;   // 跳过着色链上的节点
          var seesRed = false, seesGreen = false;
          for (var i = 0; i < positions.length; i++) {
            var cc = color[key(positions[i][0], positions[i][1])];
            if (cc === 1 && sees(r, c, positions[i][0], positions[i][1])) seesRed = true;
            else if (cc === -1 && sees(r, c, positions[i][0], positions[i][1])) seesGreen = true;
          }
          if (seesRed && seesGreen) {
            removeCandidate(r, c, n);
            var message2 = '数字 ' + n + ' 的着色链中，' + cellName(r, c) + ' 同时看到红色与绿色位置，' +
              '因此其候选 ' + n + ' 被排除。';
            return {
              technique: 'xChain', title: 'X-Chain（单数字链）', kind: 'eliminate',
              message: message2, fill: null,
              eliminations: [{ r: r, c: c, value: n }],
              highlights: positions
            };
          }
        }
      }
      return null;
    }

    // 求解一步：按技巧难度依次尝试，返回步骤对象或 null（卡住）
    // 找候选恰好 {a, b} 的 peer
    function findBiValue(peers, a, b) {
      for (var i = 0; i < peers.length; i++) {
        var cc = candidates[peers[i][0]][peers[i][1]];
        if (cc && cc.length === 2 && cc.indexOf(a) !== -1 && cc.indexOf(b) !== -1) return peers[i];
      }
      return null;
    }

    // 找数字 n 的所有强连接（两个位置，n 在共享单元恰好 2 次）
    function findStrongLinks(n) {
      var positions = [];
      for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++)
        if (candidates[r][c] && candidates[r][c].indexOf(n) !== -1) positions.push([r, c]);
      var links = [];
      for (var i = 0; i < positions.length; i++) {
        for (var j = i + 1; j < positions.length; j++) {
          if (sharedUnitStrongLink(positions[i][0], positions[i][1], positions[j][0], positions[j][1], n)) {
            links.push([positions[i], positions[j]]);
          }
        }
      }
      return links;
    }

    // 14. XYZ-Wing：pivot 候选 {X,Y,Z}，两翼 {X,Z} 与 {Y,Z}，排除同时看到三者的格子的 Z
    function stepXYZWing() {
      for (var r0 = 0; r0 < 9; r0++) for (var c0 = 0; c0 < 9; c0++) {
        var p = candidates[r0][c0];
        if (!p || p.length !== 3) continue;
        var peers = getPeers(r0, c0);
        for (var zi = 0; zi < 3; zi++) {
          var z = p[zi];
          var xy = [p[(zi + 1) % 3], p[(zi + 2) % 3]];
          var w1 = findBiValue(peers, xy[0], z);
          if (!w1) continue;
          var w2 = findBiValue(peers, xy[1], z);
          if (!w2) continue;
          if (w1[0] === w2[0] && w1[1] === w2[1]) continue;
          var eliminations = [];
          for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) {
            if ((r === r0 && c === c0) || (r === w1[0] && c === w1[1]) || (r === w2[0] && c === w2[1])) continue;
            if (candidates[r][c] && candidates[r][c].indexOf(z) !== -1 &&
                sees(r, c, r0, c0) && sees(r, c, w1[0], w1[1]) && sees(r, c, w2[0], w2[1])) {
              eliminations.push({ r: r, c: c, value: z });
            }
          }
          if (eliminations.length > 0) {
            for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
            var message = '以 ' + cellName(r0, c0) + '（候选 {' + p.join('、') + '}）为枢纽，' +
              cellName(w1[0], w1[1]) + ' 与 ' + cellName(w2[0], w2[1]) + ' 为两翼，构成 XYZ-Wing，' +
              '因此同时看到三者的格子的候选 ' + z + ' 被排除（共 ' + eliminations.length + ' 处）。';
            return {
              technique: 'xyzWing', title: 'XYZ-Wing', kind: 'eliminate',
              message: message, fill: null, eliminations: eliminations,
              highlights: [[r0, c0], [w1[0], w1[1]], [w2[0], w2[1]]]
            };
          }
        }
      }
      return null;
    }

    // 15. W-Wing：两个候选 {X,Y} 的格子通过 X 的强连接相连，排除同时看到两者的格子的 Y
    function stepWWing() {
      var biValues = [];
      for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++)
        if (candidates[r][c] && candidates[r][c].length === 2) biValues.push([r, c]);

      for (var i = 0; i < biValues.length; i++) {
        for (var j = i + 1; j < biValues.length; j++) {
          var A = biValues[i], B = biValues[j];
          var ca = candidates[A[0]][A[1]], cb = candidates[B[0]][B[1]];
          if (ca[0] !== cb[0] || ca[1] !== cb[1]) continue;
          var X = ca[0], Y = ca[1];
          if (sees(A[0], A[1], B[0], B[1])) continue;
          var links = findStrongLinks(X);
          for (var k = 0; k < links.length; k++) {
            var p1 = links[k][0], p2 = links[k][1];
            var via1 = sees(A[0], A[1], p1[0], p1[1]) && sees(B[0], B[1], p2[0], p2[1]);
            var via2 = sees(A[0], A[1], p2[0], p2[1]) && sees(B[0], B[1], p1[0], p1[1]);
            if (!via1 && !via2) continue;
            var eliminations = [];
            for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) {
              if ((r === A[0] && c === A[1]) || (r === B[0] && c === B[1])) continue;
              if (candidates[r][c] && candidates[r][c].indexOf(Y) !== -1 &&
                  sees(r, c, A[0], A[1]) && sees(r, c, B[0], B[1])) {
                eliminations.push({ r: r, c: c, value: Y });
              }
            }
            if (eliminations.length > 0) {
              for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
              var message = cellName(A[0], A[1]) + ' 与 ' + cellName(B[0], B[1]) + ' 都是 {' + X + '、' + Y + '}，' +
                '且通过数字 ' + X + ' 的强连接相连，构成 W-Wing，因此同时看到两者的格子的候选 ' + Y + ' 被排除（共 ' + eliminations.length + ' 处）。';
              return {
                technique: 'wWing', title: 'W-Wing', kind: 'eliminate',
                message: message, fill: null, eliminations: eliminations,
                highlights: [[A[0], A[1]], [B[0], B[1]]]
              };
            }
          }
        }
      }
      return null;
    }

    // 16. Remote Pairs：候选 {X,Y} 的格子沿链交替，偶数长度链两端一 X 一 Y，排除看到两端的 X 和 Y
    function stepRemotePairs() {
      for (var X = 1; X <= 9; X++) {
        for (var Y = X + 1; Y <= 9; Y++) {
          var nodes = [];
          for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) {
            if (candidates[r][c] && candidates[r][c].length === 2 &&
                candidates[r][c].indexOf(X) !== -1 && candidates[r][c].indexOf(Y) !== -1) nodes.push([r, c]);
          }
          function inPath(path, r, c) {
            for (var i = 0; i < path.length; i++) if (path[i][0] === r && path[i][1] === c) return true;
            return false;
          }
          function search(node, path) {
            if (path.length >= 4 && path.length % 2 === 0) {
              var start = path[0], end = path[path.length - 1];
              var eliminations = [];
              for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) {
                if ((r === start[0] && c === start[1]) || (r === end[0] && c === end[1])) continue;
                if (candidates[r][c] && sees(r, c, start[0], start[1]) && sees(r, c, end[0], end[1])) {
                  if (candidates[r][c].indexOf(X) !== -1) eliminations.push({ r: r, c: c, value: X });
                  if (candidates[r][c].indexOf(Y) !== -1) eliminations.push({ r: r, c: c, value: Y });
                }
              }
              if (eliminations.length > 0) {
                var chainStr = path.map(function (p) { return cellName(p[0], p[1]); }).join(' → ');
                for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
                var message = '双值对 {' + X + '、' + Y + '} 的链 ' + chainStr + ' 两端一 ' + X + ' 一 ' + Y + '，' +
                  '因此同时看到两端的格子的候选 ' + X + '、' + Y + ' 被排除（共 ' + eliminations.length + ' 处）。';
                return {
                  technique: 'remotePairs', title: 'Remote Pairs（远程数对）', kind: 'eliminate',
                  message: message, fill: null, eliminations: eliminations, highlights: path
                };
              }
            }
            if (path.length >= 10) return null;
            for (var i = 0; i < nodes.length; i++) {
              var nb = nodes[i];
              if (inPath(path, nb[0], nb[1])) continue;
              if (!sees(node[0], node[1], nb[0], nb[1])) continue;
              var res = search(nb, path.concat([[nb[0], nb[1]]]));
              if (res) return res;
            }
            return null;
          }
          for (var s = 0; s < nodes.length; s++) {
            var res = search(nodes[s], [nodes[s]]);
            if (res) return res;
          }
        }
      }
      return null;
    }

    // 17. 唯一矩形（Unique Rectangle 类型1）：依赖唯一解
    function stepUniqueRectangle() {
      for (var X = 1; X <= 9; X++) {
        for (var Y = X + 1; Y <= 9; Y++) {
          for (var r1 = 0; r1 < 9; r1++) {
            for (var r2 = r1 + 1; r2 < 9; r2++) {
              if (Math.floor(r1 / 3) === Math.floor(r2 / 3)) continue;
              for (var c1 = 0; c1 < 9; c1++) {
                for (var c2 = c1 + 1; c2 < 9; c2++) {
                  if (Math.floor(c1 / 3) === Math.floor(c2 / 3)) continue;
                  var cells = [[r1, c1], [r1, c2], [r2, c1], [r2, c2]];
                  var valid = true, biCount = 0, extraCell = null;
                  for (var k = 0; k < 4; k++) {
                    var rr = cells[k][0], cc = cells[k][1];
                    var cand = candidates[rr][cc];
                    if (!cand || cand.indexOf(X) === -1 || cand.indexOf(Y) === -1) { valid = false; break; }
                    if (cand.length === 2) biCount++;
                    else extraCell = cells[k];
                  }
                  if (valid && biCount === 3 && extraCell) {
                    var ec = candidates[extraCell[0]][extraCell[1]];
                    var eliminations = [];
                    if (ec.indexOf(X) !== -1) eliminations.push({ r: extraCell[0], c: extraCell[1], value: X });
                    if (ec.indexOf(Y) !== -1) eliminations.push({ r: extraCell[0], c: extraCell[1], value: Y });
                    if (eliminations.length > 0) {
                      for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
                      var message = cellName(r1, c1) + '、' + cellName(r1, c2) + '、' + cellName(r2, c1) + '、' + cellName(r2, c2) +
                        ' 构成唯一矩形（数字 ' + X + '、' + Y + '），为避免产生多解，' + cellName(extraCell[0], extraCell[1]) + ' 不能是 ' + X + ' 或 ' + Y + '。';
                      return {
                        technique: 'uniqueRectangle', title: '唯一矩形（Unique Rectangle）', kind: 'eliminate',
                        message: message, fill: null, eliminations: eliminations, highlights: cells
                      };
                    }
                  }
                }
              }
            }
          }
        }
      }
      return null;
    }

    // 18. BUG +1：除一格外所有空格都是双值，该格填出现三次的数字（依赖唯一解）
    function stepBug() {
      var nonBi = [];
      for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++)
        if (candidates[r][c] && candidates[r][c].length !== 2) nonBi.push([r, c]);
      if (nonBi.length !== 1) return null;
      var bugCell = nonBi[0];
      var bc = candidates[bugCell[0]][bugCell[1]];
      if (bc.length !== 3) return null;
      var answer = null;
      for (var ci = 0; ci < bc.length; ci++) {
        var n = bc[ci];
        var rowCount = 0, colCount = 0, boxCount = 0;
        for (var c = 0; c < 9; c++) if (candidates[bugCell[0]][c] && candidates[bugCell[0]][c].indexOf(n) !== -1) rowCount++;
        for (var r = 0; r < 9; r++) if (candidates[r][bugCell[1]] && candidates[r][bugCell[1]].indexOf(n) !== -1) colCount++;
        var br = Math.floor(bugCell[0] / 3) * 3, bcc = Math.floor(bugCell[1] / 3) * 3;
        for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++)
          if (candidates[br + i][bcc + j] && candidates[br + i][bcc + j].indexOf(n) !== -1) boxCount++;
        if (rowCount === 3 && colCount === 3 && boxCount === 3) {
          if (answer !== null) return null;   // 多个候选满足，非标准 BUG +1
          answer = n;
        }
      }
      if (answer === null) return null;
      fillCell(bugCell[0], bugCell[1], answer);
      var message = '除 ' + cellName(bugCell[0], bugCell[1]) + ' 外所有空格都是双值，形成 BUG 状态，' +
        '该格必须填 ' + answer + '。';
      return {
        technique: 'bug', title: 'BUG +1', kind: 'fill',
        message: message, fill: { r: bugCell[0], c: bugCell[1], value: answer },
        eliminations: null, highlights: [[bugCell[0], bugCell[1]]]
      };
    }

    // 19. 显性四数组（Naked Quad）：四格候选并集恰好 4 个数字
    function stepNakedQuad() {
      for (var u = 0; u < 27; u++) {
        var cells = getUnitCells(u);
        var empty = [];
        for (var i = 0; i < cells.length; i++) {
          if (candidates[cells[i][0]][cells[i][1]] && candidates[cells[i][0]][cells[i][1]].length > 0) empty.push(cells[i]);
        }
        for (var a = 0; a < empty.length; a++) {
          for (var b = a + 1; b < empty.length; b++) {
            for (var k = b + 1; k < empty.length; k++) {
              for (var d = k + 1; d < empty.length; d++) {
                var union = unionCandidates([empty[a], empty[b], empty[k], empty[d]]);
                if (union.length !== 4) continue;
                var eliminations = [];
                for (var p = 0; p < cells.length; p++) {
                  var r = cells[p][0], c = cells[p][1];
                  if ((r === empty[a][0] && c === empty[a][1]) || (r === empty[b][0] && c === empty[b][1]) ||
                      (r === empty[k][0] && c === empty[k][1]) || (r === empty[d][0] && c === empty[d][1])) continue;
                  if (candidates[r][c]) {
                    for (var v = 0; v < union.length; v++) {
                      if (candidates[r][c].indexOf(union[v]) !== -1) eliminations.push({ r: r, c: c, value: union[v] });
                    }
                  }
                }
                if (eliminations.length > 0) {
                  for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
                  var message = unitName(u) + '中，四格的候选都在 {' + union.join('、') + '} 内，构成显性四数组，其它格子的这些候选被排除（共 ' + eliminations.length + ' 处）。';
                  return {
                    technique: 'nakedQuad', title: '显性四数组（Naked Quad）', kind: 'eliminate',
                    message: message, fill: null, eliminations: eliminations,
                    highlights: [empty[a], empty[b], empty[k], empty[d]]
                  };
                }
              }
            }
          }
        }
      }
      return null;
    }

    // 20. Jellyfish：某数字在四行/列中的候选都在同样四列/行
    function stepJellyfish() {
      for (var n = 1; n <= 9; n++) {
        for (var r1 = 0; r1 < 9; r1++) {
          var cols1 = candidateColsInRow(r1, n);
          if (cols1.length < 2 || cols1.length > 4) continue;
          for (var r2 = r1 + 1; r2 < 9; r2++) {
            var cols2 = candidateColsInRow(r2, n);
            if (cols2.length < 2 || cols2.length > 4) continue;
            for (var r3 = r2 + 1; r3 < 9; r3++) {
              var cols3 = candidateColsInRow(r3, n);
              if (cols3.length < 2 || cols3.length > 4) continue;
              for (var r4 = r3 + 1; r4 < 9; r4++) {
                var cols4 = candidateColsInRow(r4, n);
                if (cols4.length < 2 || cols4.length > 4) continue;
                var union = unique(cols1.concat(cols2).concat(cols3).concat(cols4));
                if (union.length !== 4) continue;
                var eliminations = [];
                for (var ci = 0; ci < 4; ci++) {
                  var cc = union[ci];
                  for (var rr = 0; rr < 9; rr++) {
                    if (rr === r1 || rr === r2 || rr === r3 || rr === r4) continue;
                    if (candidates[rr][cc] && candidates[rr][cc].indexOf(n) !== -1) eliminations.push({ r: rr, c: cc, value: n });
                  }
                }
                if (eliminations.length > 0) {
                  for (var e = 0; e < eliminations.length; e++) removeCandidate(eliminations[e].r, eliminations[e].c, eliminations[e].value);
                  var message = '数字 ' + n + ' 在第 ' + (r1 + 1) + '、' + (r2 + 1) + '、' + (r3 + 1) + '、' + (r4 + 1) + ' 行的候选都在第 ' +
                    (union[0] + 1) + '、' + (union[1] + 1) + '、' + (union[2] + 1) + '、' + (union[3] + 1) + ' 列，构成 Jellyfish，这四列其它行中的候选 ' + n + ' 被排除（共 ' + eliminations.length + ' 处）。';
                  return {
                    technique: 'jellyfish', title: 'Jellyfish（水母）', kind: 'eliminate',
                    message: message, fill: null, eliminations: eliminations,
                    highlights: [[r1, union[0]], [r1, union[1]], [r1, union[2]], [r1, union[3]], [r2, union[0]], [r2, union[1]], [r2, union[2]], [r2, union[3]], [r3, union[0]], [r3, union[1]], [r3, union[2]], [r3, union[3]], [r4, union[0]], [r4, union[1]], [r4, union[2]], [r4, union[3]]]
                  };
                }
              }
            }
          }
        }
        for (var c1 = 0; c1 < 9; c1++) {
          var rows1 = candidateRowsInCol(c1, n);
          if (rows1.length < 2 || rows1.length > 4) continue;
          for (var c2 = c1 + 1; c2 < 9; c2++) {
            var rows2 = candidateRowsInCol(c2, n);
            if (rows2.length < 2 || rows2.length > 4) continue;
            for (var c3 = c2 + 1; c3 < 9; c3++) {
              var rows3 = candidateRowsInCol(c3, n);
              if (rows3.length < 2 || rows3.length > 4) continue;
              for (var c4 = c3 + 1; c4 < 9; c4++) {
                var rows4 = candidateRowsInCol(c4, n);
                if (rows4.length < 2 || rows4.length > 4) continue;
                var unionR = unique(rows1.concat(rows2).concat(rows3).concat(rows4));
                if (unionR.length !== 4) continue;
                var eliminations2 = [];
                for (var ri = 0; ri < 4; ri++) {
                  var rr = unionR[ri];
                  for (var cc = 0; cc < 9; cc++) {
                    if (cc === c1 || cc === c2 || cc === c3 || cc === c4) continue;
                    if (candidates[rr][cc] && candidates[rr][cc].indexOf(n) !== -1) eliminations2.push({ r: rr, c: cc, value: n });
                  }
                }
                if (eliminations2.length > 0) {
                  for (var e2 = 0; e2 < eliminations2.length; e2++) removeCandidate(eliminations2[e2].r, eliminations2[e2].c, eliminations2[e2].value);
                  var message2 = '数字 ' + n + ' 在第 ' + (c1 + 1) + '、' + (c2 + 1) + '、' + (c3 + 1) + '、' + (c4 + 1) + ' 列的候选都在第 ' +
                    (unionR[0] + 1) + '、' + (unionR[1] + 1) + '、' + (unionR[2] + 1) + '、' + (unionR[3] + 1) + ' 行，构成 Jellyfish，这四行其它列中的候选 ' + n + ' 被排除（共 ' + eliminations2.length + ' 处）。';
                  return {
                    technique: 'jellyfish', title: 'Jellyfish（水母）', kind: 'eliminate',
                    message: message2, fill: null, eliminations: eliminations2,
                    highlights: [[unionR[0], c1], [unionR[1], c1], [unionR[2], c1], [unionR[3], c1], [unionR[0], c2], [unionR[1], c2], [unionR[2], c2], [unionR[3], c2], [unionR[0], c3], [unionR[1], c3], [unionR[2], c3], [unionR[3], c3], [unionR[0], c4], [unionR[1], c4], [unionR[2], c4], [unionR[3], c4]]
                  };
                }
              }
            }
          }
        }
      }
      return null;
    }

    function nextStep() {
      if (isDone()) return { done: true };
      history.push(snapshot());   // 保存执行前状态，便于「上一步」回退
      var step = stepNakedSingle() ||
                 stepHiddenSingle() ||
                 stepNakedPair() ||
                 stepHiddenPair() ||
                 stepPointing() ||
                 stepClaiming() ||
                 stepNakedTriple() ||
                 stepNakedQuad() ||
                 stepHiddenTriple() ||
                 stepXWing() ||
                 stepSwordfish() ||
                 stepJellyfish() ||
                 stepXYWing() ||
                 stepXYZWing() ||
                 stepWWing() ||
                 stepRemotePairs() ||
                 stepXYChain() ||
                 stepXChain() ||
                 (useUnique && stepUniqueRectangle()) ||
                 (useUnique && stepBug()) ||
                 null;
      if (!step) history.pop();   // 无步骤可走，撤销多余保存
      return step;
    }

    function undo() {
      if (history.length === 0) return false;
      restore(history.pop());
      return true;
    }

    function reset() {
      board = clone(initial);
      candidates = computeCandidates(board);
      history = [];
    }

    return {
      nextStep: nextStep,
      undo: undo,
      reset: reset,
      canUndo: function () { return history.length > 0; },
      getBoard: function () { return board; },
      getCandidates: function () { return candidates; },
      isDone: isDone
    };
  }

  global.SudokuSolver = {
    isValid: isValid,
    isBoardValid: isBoardValid,
    countSolutions: countSolutions,
    computeCandidates: computeCandidates,
    createLogicSolver: createLogicSolver,
    generatePuzzle: generatePuzzle
  };
})(window);
