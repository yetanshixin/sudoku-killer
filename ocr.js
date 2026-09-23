/* ============================================================
 * ocr.js —— 数独图片识别（纯前端）
 * 依赖：Tesseract.js（CDN，window.Tesseract）
 * 流程：灰度化 → Otsu 二值化 → 投影找网格线 → 分割 81 格
 *       → 像素密度判断是否有数字 → Tesseract 单格识别
 * ============================================================ */
(function (global) {
  'use strict';

  // 图片加载到 canvas，缩放到合适尺寸（保持宽高比）
  function loadImage(img, maxSize) {
    maxSize = maxSize || 900;
    var nw = img.naturalWidth || img.width;
    var nh = img.naturalHeight || img.height;
    var scale = Math.min(1, maxSize / Math.max(nw, nh));
    var w = Math.max(1, Math.round(nw * scale));
    var h = Math.max(1, Math.round(nh * scale));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, w, h);
    return { canvas: canvas, ctx: ctx, data: data, w: w, h: h };
  }

  // 灰度化
  function toGray(data) {
    var w = data.width, h = data.height, d = data.data;
    var gray = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) {
      gray[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
    }
    return gray;
  }

  // Otsu 自适应阈值
  function otsu(gray) {
    var hist = new Float64Array(256);
    for (var i = 0; i < gray.length; i++) hist[gray[i]]++;
    var total = gray.length, sum = 0;
    for (var t = 0; t < 256; t++) sum += t * hist[t];
    var sumB = 0, wB = 0, maxVar = -1, th = 127;
    for (var t2 = 0; t2 < 256; t2++) {
      wB += hist[t2];
      if (wB === 0) continue;
      var wF = total - wB;
      if (wF === 0) break;
      sumB += t2 * hist[t2];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var v = wB * wF * (mB - mF) * (mB - mF);
      if (v > maxVar) { maxVar = v; th = t2; }
    }
    return th;
  }

  // 二值化（1=暗/前景，0=亮/背景）
  function binarize(gray, th) {
    var bin = new Uint8Array(gray.length);
    for (var i = 0; i < gray.length; i++) bin[i] = gray[i] < th ? 1 : 0;
    return bin;
  }

  // 自适应二值化：对比度增强 + 自动判断浅色/深色背景，宽松阈值捕捉浅灰网格线
  function binarizeAdaptive(gray) {
    var min = 255, max = 0, sum = 0;
    for (var i = 0; i < gray.length; i++) {
      var g = gray[i];
      if (g < min) min = g;
      if (g > max) max = g;
      sum += g;
    }
    var light = (sum / gray.length) > 128;   // true=浅色背景（深色线）
    var range = max - min;
    var bin = new Uint8Array(gray.length);
    for (var j = 0; j < gray.length; j++) {
      var g = range > 10 ? Math.round((gray[j] - min) * 255 / range) : gray[j];
      bin[j] = light ? (g < 235 ? 1 : 0) : (g > 20 ? 1 : 0);
    }
    return bin;
  }

  // 提取格子并二值化，生成白底黑字的清晰数字图（去网格线/去噪，提高识别率）
  function makeCellCanvas(gray, w, x0, y0, x1, y1) {
    var cw = x1 - x0, ch = y1 - y0;
    var canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    var ctx = canvas.getContext('2d');
    var imgData = ctx.createImageData(128, 128);
    for (var i = 0; i < 128 * 128; i++) {
      imgData.data[i * 4] = 255; imgData.data[i * 4 + 1] = 255;
      imgData.data[i * 4 + 2] = 255; imgData.data[i * 4 + 3] = 255;
    }
    var sx = 128 / cw, sy = 128 / ch;
    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        if (gray[y * w + x] < 128) {
          var dx = Math.round((x - x0) * sx);
          var dy = Math.round((y - y0) * sy);
          if (dx >= 0 && dx < 128 && dy >= 0 && dy < 128) {
            var pi = (dy * 128 + dx) * 4;
            imgData.data[pi] = 0; imgData.data[pi + 1] = 0; imgData.data[pi + 2] = 0;
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  // 投影法找网格线位置：网格线须「覆盖率高 且 贯穿整行/列」（连续暗段长），排除数字行的干扰
  function findLines(binary, w, h, axis) {
    var n = axis === 'h' ? h : w;
    var len = axis === 'h' ? w : h;
    var profile = new Array(n);
    for (var i = 0; i < n; i++) {
      var dark = 0, maxRun = 0, run = 0;
      for (var j = 0; j < len; j++) {
        var idx = axis === 'h' ? i * w + j : j * w + i;
        if (binary[idx]) { dark++; run++; if (run > maxRun) maxRun = run; }
        else run = 0;
      }
      // 网格线：暗像素覆盖率 > 20% 且 最长连续段 > 35%（贯穿性，数字不满足）
      profile[i] = (dark > len * 0.2 && maxRun > len * 0.35) ? dark : 0;
    }
    var threshold = len * 0.2;
    var positions = [];
    var cluster = [];
    for (var k = 0; k < n; k++) {
      if (profile[k] > threshold) cluster.push(k);
      else if (cluster.length) {
        positions.push(Math.round(cluster.reduce(function (a, b) { return a + b; }, 0) / cluster.length));
        cluster = [];
      }
    }
    if (cluster.length) positions.push(Math.round(cluster.reduce(function (a, b) { return a + b; }, 0) / cluster.length));
    return positions;
  }

  // 取中间 count 条线（若检测到多余噪声线）
  function pick(positions, count) {
    if (positions.length <= count) return positions;
    var extra = positions.length - count;
    var start = Math.floor(extra / 2);
    return positions.slice(start, start + count);
  }

  // 主识别：返回 81 位字符串（0 代表空格）
  async function recognize(image) {
    if (typeof Tesseract === 'undefined') {
      throw new Error('OCR 组件未加载，请检查网络后重试');
    }
    var loaded = loadImage(image);
    var w = loaded.w, h = loaded.h;
    var gray = toGray(loaded.data);
    var binary = binarizeAdaptive(gray);

    var hLines = findLines(binary, w, h, 'h');
    var vLines = findLines(binary, w, h, 'v');
    console.log('[OCR调试] 图片尺寸:', w, 'x', h, '| 水平线', hLines.length, '条:', hLines.join(','), '| 垂直线', vLines.length, '条:', vLines.join(','));
    if (hLines.length < 10 || vLines.length < 10) {
      throw new Error('未能检测到完整网格，请上传清晰的数独截图（9×9 网格完整可见）');
    }
    var hs = pick(hLines, 10);
    var vs = pick(vLines, 10);

    var worker = await Tesseract.createWorker('eng', 1, {
      workerPath: 'lib/worker.min.js',
      corePath: 'lib/core/',
      langPath: 'lib/lang/'
    });
    await worker.setParameters({ tessedit_pageseg_mode: '10' }); // 单字符模式

    var result = '';
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        var top = hs[r], bottom = hs[r + 1];
        var left = vs[c], right = vs[c + 1];
        // 中心区域（小幅缩进，避开网格线但不截断数字）
        var mx = Math.max(1, Math.round((right - left) * 0.06));
        var my = Math.max(1, Math.round((bottom - top) * 0.06));
        var x0 = left + mx, x1 = right - mx;
        var y0 = top + my, y1 = bottom - my;

        var dark = 0, total = 0;
        for (var y = y0; y < y1; y++) {
          for (var x = x0; x < x1; x++) {
            total++;
            if (gray[y * w + x] < 150) dark++;
          }
        }
        if (total === 0 || dark / total < 0.02) {
          result += '0';  // 空格
        } else {
          var cellCanvas = makeCellCanvas(gray, w, x0, y0, x1, y1);
          try {
            var od = await worker.recognize(cellCanvas);
            var m = (od.data.text || '').replace(/[^1-9]/g, '');
            result += m ? m[m.length - 1] : '0';
          } catch (e) {
            result += '0';
          }
        }
      }
    }
    await worker.terminate();
    console.log('[OCR调试] 识别结果(81位):', result);
    return result;
  }

  global.SudokuOCR = { recognize: recognize };
})(window);
