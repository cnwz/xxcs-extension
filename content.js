/**
 * @file content.js
 * @description 文本转二维码插件
 * @author ls_wuzhen20
 * @homepage https://gitee.com/cnwz/xxcs-extension
 * @since 2026-05-05
 * @lastupdate 2026-10-08
 * @version 2.0.0
 */

(function() {
    // 幂等：content.js 可能被 background 多次注入，只在首次执行完整初始化
    if (window.__t2qr_loaded__) return;
    window.__t2qr_loaded__ = true;

    // ==================== 状态 ====================

    let win = null;
    let productMap = new Map();
    let _productMapLoadFailed = false;
    let _updateChecking = false;
    let _updateBarTimer = null;
    let _currentQrSize = 110;
    let _zoomDirection = 0;
    let _zoomRafId = null;
    let _btnGroupEl = null;
    let _zoomGroupTopOffset = null;

    // ==================== 常量 ====================

    const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
    const SUFFIX = Math.random().toString(36).substring(2, 6);
    const HELP_URL = 'https://gitee.com/cnwz/xxcs-extension';
    const SHARE_URL = 'https://gitee.com/cnwz/xxcs-extension';

    const QR_MIN = 110;
    const QR_CANVAS_SIZE = 400;
    const QR_BORDER = 8;
    const ZOOM_SPEED = 1.5;
    const ZOOM_BTN_SIZE = 32;
    const ZOOM_GAP = 12;
    const ZOOM_BTN_GAP = 6;

    const classes = {
        container: `qr-${SUFFIX}`,
        header: `qr-header-${SUFFIX}`,
        headerActions: `qr-header-actions-${SUFFIX}`,
        shareBtn: `qr-share-${SUFFIX}`,
        closeBtn: `qr-close-${SUFFIX}`,
        helpBtn: `qr-help-${SUFFIX}`,
        updateBtn: `qr-update-${SUFFIX}`,
        updateBar: `qr-updatebar-${SUFFIX}`,
        list: `qr-list-${SUFFIX}`,
        toolbar: `qr-toolbar-${SUFFIX}`,
        toggleBtn: `qr-toggle-${SUFFIX}`,
        optionsPanel: `qr-options-${SUFFIX}`,
        checkboxLabel: `qr-check-${SUFFIX}`,
        textareaWrapper: `qr-textwrap-${SUFFIX}`,
        textarea: `qr-textarea-${SUFFIX}`,
        qrItem: `qr-item-${SUFFIX}`,
        qrCanvasWrapper: `qr-canvaswrap-${SUFFIX}`,
        qrCanvas: `qr-canvas-${SUFFIX}`,
        qrText: `qr-text-${SUFFIX}`,
        extraInfo: `qr-extra-${SUFFIX}`,
        errorItem: `qr-error-${SUFFIX}`,
        zoomGroup: `qr-zoom-${SUFFIX}`,
        zoomBtn: `qr-zoombtn-${SUFFIX}`,
    };

    const ids = {
        autoUppercase: `autoUp-${SUFFIX}`,
        autoFormat: `autoFmt-${SUFFIX}`,
        showProductInfo: `showProd-${SUFFIX}`,
        textarea: `qrTextarea-${SUFFIX}`,
        toggleOptionsBtn: `qrToggleBtn-${SUFFIX}`,
        optionsPanel: `qrOptionsPanel-${SUFFIX}`,
        basicTag: `basicTag-${SUFFIX}`,
        showProductInfoLabel: `showProdLabel-${SUFFIX}`,
    };

    const STYLES = (classes) => `
        .${classes.container} *{margin:0;padding:0;box-sizing:border-box;line-height:1.4}
        .${classes.container}{all:initial;position:fixed;top:30px;right:30px;width:360px;max-width:90vw;max-height:85vh;background:#fff;border-radius:16px;box-shadow:0 20px 35px -10px rgba(0,0,0,0.25),0 0 0 1px rgba(0,0,0,0.05);font-family:system-ui,sans-serif;z-index:2147483647;display:flex;flex-direction:column;overflow:hidden}
        .${classes.header}{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f8f9fc;border-bottom:1px solid #e9ecef;font-weight:600;font-size:15px;color:#1e293b;cursor:move;user-select:none;touch-action:none}
        .${classes.headerActions}{display:flex;align-items:center;gap:4px}
        .${classes.shareBtn}{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:20px;color:#64748b;text-decoration:none;transition:background .2s;cursor:pointer}
        .${classes.shareBtn}:hover{background:#eef2ff;color:#0f172a}
        .${classes.shareBtn} svg{display:block}
        .${classes.helpBtn}{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:20px;color:#64748b;text-decoration:none;transition:background .2s;cursor:pointer}
        .${classes.helpBtn}:hover{background:#eef2ff;color:#0f172a}
        .${classes.helpBtn} svg{display:block}
        .${classes.updateBtn}{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:20px;color:#64748b;background:transparent;border:none;cursor:pointer;padding:0;transition:background .2s}
        .${classes.updateBtn}:hover{background:#eef2ff;color:#0f172a}
        .${classes.updateBtn}:disabled{cursor:default;opacity:.7}
        .${classes.updateBtn} svg{display:block}
        .${classes.updateBtn}.checking svg{animation:qr-spin-${SUFFIX} 1s linear infinite}
        @keyframes qr-spin-${SUFFIX}{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .${classes.closeBtn}{border:none;font-size:20px;cursor:pointer;color:#64748b;width:28px;height:28px;border-radius:20px;display:flex;align-items:center;justify-content:center;transition:background .2s;background:transparent}
        .${classes.closeBtn}:hover{background:#eef2ff;color:#0f172a}
        .${classes.closeBtn} svg{display:block}
        .${classes.updateBar}{max-height:0;opacity:0;overflow:hidden;background:#f8f9fc;border-bottom:1px solid #e9ecef;font-size:12px;color:#1e293b;padding:0 16px;transition:max-height .25s ease,opacity .2s ease,padding .25s ease}
        .${classes.updateBar}.show{max-height:420px;opacity:1;padding:10px 16px}
        .${classes.updateBar} .update-bar-inner{display:flex;align-items:flex-start;gap:8px}
        .${classes.updateBar} .update-bar-body{flex:1;min-width:0;line-height:1.5}
        .${classes.updateBar} .update-close{flex-shrink:0;cursor:pointer;color:#64748b;font-size:18px;line-height:1;padding:0 4px}
        .${classes.updateBar} .update-close:hover{color:#0f172a}
        .${classes.updateBar} .update-actions{margin-top:6px}
        .${classes.updateBar} .update-actions a{color:#3b82f6;text-decoration:none;margin-right:14px;cursor:pointer}
        .${classes.updateBar} .update-actions a:hover{text-decoration:underline}
        .${classes.updateBar} .update-changelog{margin:6px 0 0;padding-left:20px;max-height:0;overflow:hidden;transition:max-height .25s ease}
        .${classes.updateBar} .update-changelog.open{max-height:300px}
        .${classes.list}{overflow-y:auto;padding:12px;flex:1;display:flex;flex-direction:column;gap:20px}
        .${classes.qrItem}{display:flex;flex-direction:column;align-items:center;gap:6px}
        .${classes.qrCanvasWrapper}{display:flex;justify-content:center;padding:6px}
        .${classes.qrCanvas}{display:block;width:var(--qr-size,110px);height:var(--qr-size,110px);box-shadow:0 2px 6px rgba(0,0,0,0.1)}
        .${classes.qrText}{font-size:13px;color:#1e293b;word-break:break-all;white-space:pre-wrap;padding:4px 8px;font-family:monospace;text-align:center}
        .${classes.extraInfo}{font-size:12px;color:#555;padding:6px 10px;border-radius:6px;margin-top:2px;width:100%;text-align:center;word-break:break-word}
        .${classes.errorItem} .${classes.qrText}{color:#b91c1c}
        .${classes.toolbar}{padding:8px 12px;border-top:1px solid #eef2f5;border-bottom:1px solid #eef2f5}
        .${classes.toggleBtn}{border:1px solid #cbd5e1;border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer;color:#1e293b;background:#fff}
        .${classes.toggleBtn}:hover{background:#f1f5f9}
        .${classes.optionsPanel}{display:flex;gap:20px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px dashed #e2e8f0}
        .${classes.checkboxLabel}{display:flex;align-items:center;gap:6px;font-size:13px;color:#1e293b;cursor:pointer}
        .${classes.textareaWrapper}{padding:12px;border-top:1px solid #eef2f5}
        .${classes.textarea}{width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:8px;font-family:monospace;font-size:13px;line-height:1.5;resize:vertical}
        .${classes.textarea}:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,0.2)}
        .${classes.zoomGroup}{position:fixed;display:flex;flex-direction:column;gap:${ZOOM_BTN_GAP}px;z-index:2147483647;pointer-events:auto}
        .${classes.zoomBtn}{display:flex;align-items:center;justify-content:center;width:${ZOOM_BTN_SIZE}px;height:${ZOOM_BTN_SIZE}px;border-radius:20px;color:#3b82f6;background:#fff;border:1px solid #e9ecef;cursor:pointer;padding:0;transition:background .2s,color .2s;box-shadow:0 2px 6px rgba(0,0,0,0.08)}
        .${classes.zoomBtn}:hover{background:#eff6ff;color:#1d4ed8}
        .${classes.zoomBtn}.active{background:#eff6ff;color:#1d4ed8}
        .${classes.zoomBtn} svg{display:block;pointer-events:none}
    `;

    // ==================== 工具方法 ====================

    /**
     * HTML 转义
     * @param {*} str
     * @returns {string}
     */
    function _escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 当前允许的最大二维码尺寸
     * @returns {number}
     */
    function _getMaxQrSize() {
        if (!win) return 320;
        const w = win.getBoundingClientRect().width;
        return Math.max(QR_MIN, Math.floor(w - 24 - 12));
    }

    // ==================== 数据加载 ====================

    /**
     * 解析三列数组为商品 Map
     * @param {Array} arr
     */
    function _parseArrayProductMap(arr) {
        const map = new Map();
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            if (!Array.isArray(item) || item.length < 3) {
                throw new Error(`商品库第 ${i + 1} 行格式错误：需要三列 [条码, 商品名, 当日鲜]`);
            }
            const code = String(item[0]).trim();
            const name = String(item[1]).trim();
            if (!code || !name) continue;
            const flag = String(item[2]).trim().toLowerCase();
            const needFresh = (flag === '是' || flag === 'true');
            map.set(code, { name, needFresh });
        }
        productMap = map;
    }

    // ==================== 商品识别 ====================

    /**
     * 解析件码，拆出商品码 / 日期 / 时间 / 重量
     * @param {string} numericStr
     * @returns {Object|null}
     */
    function _parseNumberSegments(numericStr) {
        if (!/^\d+$/.test(numericStr)) return null;
        const len = numericStr.length;
        if (len < 20) return null;
        const prefix = numericStr.substring(0, 2);
        const baseLengthMap = { '26': 20, '28': 23, '29': 23, '31': 27 };
        const baseLen = baseLengthMap[prefix];
        if (baseLen === undefined) return null;
        const codeLen = len - baseLen;
        if (codeLen !== 5 && codeLen !== 7) return null;
        const productCode = numericStr.substring(2, 2 + codeLen);
        const dateStart = 2 + codeLen;
        const dateStr = numericStr.substring(dateStart, dateStart + 6);
        let formattedDate = null;
        if (/^\d{6}$/.test(dateStr)) {
            const yy = dateStr.substring(0, 2);
            const mm = dateStr.substring(2, 4);
            const dd = dateStr.substring(4, 6);
            formattedDate = `${yy}年${mm}月${dd}日`;
        }
        let time = null;
        const timeStart = dateStart + 6;
        if (timeStart + 2 <= len) {
            const timeStr = numericStr.substring(timeStart, timeStart + 2);
            if (/^\d{2}$/.test(timeStr) && (timeStr === '00' || timeStr === '12')) {
                time = timeStr;
            }
        }
        let weightGrams = null;
        if (!numericStr.startsWith('26')) {
            const weightStr = numericStr.substring(len - 5, len - 1);
            if (/^\d{4}$/.test(weightStr)) weightGrams = parseInt(weightStr, 10);
        }
        return { productCode, formattedDate, weightGrams, usedLen: codeLen, dateStr, time };
    }

    /**
     * 判断是否当日鲜
     * @param {string} dateStr
     * @param {string} time
     * @param {Date} [now]
     * @returns {boolean}
     */
    function _isFresh(dateStr, time, now = new Date()) {
        if (!dateStr || !time || !/^\d{6}$/.test(dateStr)) return false;
        const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
        const month = parseInt(dateStr.substring(2, 4), 10) - 1;
        const day = parseInt(dateStr.substring(4, 6), 10);
        const hour = parseInt(time, 10);
        const prodDay = new Date(year, month, day);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.round((today - prodDay) / 86400000);
        if (diffDays === 0) return true;
        if (diffDays === 1 && hour === 12) return true;
        return false;
    }

    /**
     * 获取商品名称和当日鲜标记
     * @param {string} code
     * @returns {{name:string|null,needFresh:boolean}}
     */
    function _getProductInfo(code) {
        const entry = productMap.get(code);
        if (entry === undefined) return { name: null, needFresh: false };
        if (typeof entry === 'object' && entry !== null && typeof entry.name === 'string') {
            return { name: entry.name, needFresh: entry.needFresh === true };
        }
        return { name: null, needFresh: false };
    }

    /**
     * 格式化库位码：9/10 位无连字符字符串按位置插入连字符
     * @param {string} code
     * @returns {string}
     */
    function _formatLocationCode(code) {
        if (!code) return code;
        const withoutHyphens = code.replace(/-/g, '');
        if (!/^[a-zA-Z0-9]+$/.test(withoutHyphens)) return code;
        const len = withoutHyphens.length;
        if (len === 10) {
            const parts = withoutHyphens.match(/.{1,2}/g);
            return parts.join('-');
        } else if (len === 9) {
            const parts = withoutHyphens.match(/^(.{1})(.{2})(.{2})(.{2})(.{2})$/);
            return parts ? parts.slice(1).join('-') : withoutHyphens;
        }
        return code;
    }

    /**
     * 构建商品额外信息 HTML
     * @param {Object} segments
     * @param {Date} now
     * @returns {string}
     */
    function _buildExtraInfoHTML(segments, now) {
        if (!segments) return '';
        const parts = [];
        const info = _getProductInfo(segments.productCode);
        const productName = info.name;
        const needFresh = info.needFresh;

        let nameDisplay;
        if (productName) {
            let safeName = _escapeHtml(productName);
            if (needFresh && segments.time && _isFresh(segments.dateStr, segments.time, now)) {
                safeName = safeName + ' <span style="font-weight:bold;color:#ee6aa7;">当日鲜</span>';
            }
            nameDisplay = safeName;
        } else {
            nameDisplay = `[商品码] ${_escapeHtml(segments.productCode)} (未录入)`;
        }
        parts.push(`[商品] ${nameDisplay}`);

        if (segments.formattedDate) {
            parts.push(`<br>[日期] 20${segments.formattedDate}${segments.time ? ' ' + segments.time + ':00' : ''}`);
        }
        if (segments.weightGrams !== null && !isNaN(segments.weightGrams) && segments.weightGrams !== 0) {
            parts.push(`[重量] ${segments.weightGrams} g`);
        }
        if (parts.length === 0) return '';
        return `<div class="${classes.extraInfo}">${parts.join(' ')}</div>`;
    }

    /**
     * 对二维码下方文字按段染色
     * @param {string} display
     * @param {string} rawContent
     * @param {number} usedLen
     * @returns {string|DocumentFragment}
     */
    function _colorizeDisplayText(display, rawContent, usedLen) {
        if (!/^\d{20,}$/.test(rawContent)) return display;
        const digits = display.match(/\d/g);
        if (!digits || digits.length < 14) return display;
        const totalDigits = digits.length;
        const weightStart = totalDigits - 5;
        const weightEnd = totalDigits - 2;
        const rawNumeric = rawContent.replace(/\D/g, '');
        const shouldHighlightWeight = rawNumeric.length >= 20 && !rawNumeric.startsWith('26');
        let skipWeightHighlight = false;
        if (shouldHighlightWeight && weightStart >= 0 && weightEnd < totalDigits) {
            const rangeDigits = digits.slice(weightStart, weightEnd + 1);
            if (rangeDigits.length === 4 && rangeDigits.every(d => d === '0')) {
                skipWeightHighlight = true;
            }
        }
        const prodStart = 2;
        const prodEnd = 2 + usedLen;
        const dateStart = 2 + usedLen;
        const dateEnd = dateStart + 6;
        let idx = 0;
        const frag = document.createDocumentFragment();
        for (const ch of display) {
            if (/\d/.test(ch)) {
                let color = null;
                if (idx >= prodStart && idx < prodEnd) color = '#FFBD00';
                else if (idx >= dateStart && idx < dateEnd) color = '#00c63d';
                else if (shouldHighlightWeight && !skipWeightHighlight && idx >= weightStart && idx <= weightEnd) color = '#2b5799';
                if (color) {
                    const span = document.createElement('span');
                    span.textContent = ch;
                    span.style.color = color;
                    frag.appendChild(span);
                } else {
                    frag.appendChild(document.createTextNode(ch));
                }
                idx++;
            } else {
                frag.appendChild(document.createTextNode(ch));
            }
        }
        return frag;
    }

    // ==================== 输入处理 ====================

    /**
     * 处理单行输入为多个二维码条目
     * @param {string} line
     * @param {boolean} autoUppercase
     * @param {boolean} formatLocation
     * @returns {Array<{content:string,display:string}>}
     */
    function _processLine(line, autoUppercase, formatLocation) {
        const trimmed = line.trim();
        if (trimmed === '') return [];
        const semicolonIndex = trimmed.indexOf(';');
        let rawContent, displayPart;
        if (semicolonIndex !== -1) {
            rawContent = trimmed.substring(0, semicolonIndex).trim();
            displayPart = trimmed.substring(semicolonIndex + 1).trim();
        } else {
            rawContent = trimmed;
            displayPart = '';
        }
        if (semicolonIndex === -1 && /\s/.test(rawContent)) {
            const tokens = rawContent.split(/\s+/).filter(t => t.length > 0);
            if (tokens.length === 0) return [];
            return tokens.map(token => {
                let c = token;
                if (autoUppercase) c = c.toUpperCase();
                const isNum = /^\d+$/.test(c);
                const inMap = isNum && productMap.has(c);
                if (formatLocation && (!isNum || !inMap)) c = _formatLocationCode(c);
                return { content: c, display: c };
            });
        } else {
            let content = rawContent;
            if (autoUppercase) content = content.toUpperCase();
            const isPureNumber = /^\d+$/.test(content);
            const inProductMap = isPureNumber && productMap.has(content);
            if (formatLocation && (!isPureNumber || !inProductMap)) {
                content = _formatLocationCode(content);
            }
            const display = displayPart || content;
            return [{ content, display }];
        }
    }

    // ==================== 渲染 ====================

    /**
     * 生成单个二维码预览项
     *
     * canvas 内部固定为 QR_CANVAS_SIZE × QR_CANVAS_SIZE，CSS 负责把这张高清
     * 位图缩放到实际显示尺寸，避免缩放过程中的位图与 CSS 双重重采样抖动。
     *
     * @param {string} content
     * @param {string} display
     * @param {HTMLElement} container
     * @param {Date} now
     * @param {boolean} showProductInfo
     */
    function _generateQRItem(content, display, container, now, showProductInfo) {
        const item = document.createElement('div');
        item.className = classes.qrItem;
        try {
            const qr = window.qrcode(0, 'L');
            qr.addData(content);
            qr.make();
            const moduleCount = qr.getModuleCount();

            const totalSize = QR_CANVAS_SIZE;
            const border = QR_BORDER;
            const qrSize = totalSize - border * 2;
            const cellSize = Math.max(1, Math.floor(qrSize / moduleCount));
            const actualQrSize = cellSize * moduleCount;
            const offsetX = border + (qrSize - actualQrSize) / 2;
            const offsetY = border + (qrSize - actualQrSize) / 2;

            const canvas = document.createElement('canvas');
            canvas.width = totalSize;
            canvas.height = totalSize;
            canvas.className = classes.qrCanvas;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, totalSize, totalSize);
            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    if (qr.isDark(row, col)) {
                        ctx.fillStyle = '#000000';
                        ctx.fillRect(offsetX + col * cellSize, offsetY + row * cellSize, cellSize, cellSize);
                    }
                }
            }

            const canvasWrap = document.createElement('div');
            canvasWrap.className = classes.qrCanvasWrapper;
            canvasWrap.appendChild(canvas);

            const textDiv = document.createElement('div');
            textDiv.className = classes.qrText;

            let coloredContent;
            if (showProductInfo) {
                const rawNumeric = content.replace(/\D/g, '');
                let usedLen = 7;
                let segments = null;
                if (rawNumeric.length >= 20) {
                    segments = _parseNumberSegments(rawNumeric);
                    if (segments) usedLen = segments.usedLen;
                }
                if (segments) coloredContent = _colorizeDisplayText(display, rawNumeric, usedLen);
                else coloredContent = display;
            } else {
                coloredContent = display;
            }

            if (typeof coloredContent === 'string') textDiv.textContent = coloredContent;
            else textDiv.appendChild(coloredContent);
            textDiv.title = content;

            item.appendChild(canvasWrap);
            item.appendChild(textDiv);

            if (showProductInfo) {
                const rawNumeric = content.replace(/\D/g, '');
                if (rawNumeric.length >= 20) {
                    const segments = _parseNumberSegments(rawNumeric);
                    if (segments) {
                        const extraDiv = document.createElement('div');
                        extraDiv.innerHTML = _buildExtraInfoHTML(segments, now);
                        item.appendChild(extraDiv);
                    }
                } else if (rawNumeric.length === 13 && productMap.has(rawNumeric)) {
                    const extraDiv = document.createElement('div');
                    const info = _getProductInfo(rawNumeric);
                    const name = _escapeHtml(info.name || rawNumeric);
                    extraDiv.innerHTML = `<div class="${classes.extraInfo}">[商品] ${name}</div>`;
                    item.appendChild(extraDiv);
                } else if (/^\d+$/.test(rawNumeric) && productMap.has(rawNumeric)) {
                    const extraDiv = document.createElement('div');
                    const info = _getProductInfo(rawNumeric);
                    const name = _escapeHtml(info.name || rawNumeric);
                    extraDiv.innerHTML = `<div class="${classes.extraInfo}">[商品] ${name}</div>`;
                    item.appendChild(extraDiv);
                }
            }

            container.appendChild(item);
        } catch (error) {
            console.error('生成二维码失败:', error, content);
            const errorDiv = document.createElement('div');
            errorDiv.className = classes.qrItem + ' ' + classes.errorItem;
            errorDiv.innerHTML = `<div class="${classes.qrText}" style="color:#f44336;">生成失败: ${_escapeHtml(content)}</div>`;
            container.appendChild(errorDiv);
        }
    }

    /**
     * 渲染二维码预览列表
     * @param {HTMLTextAreaElement} ta
     * @param {HTMLInputElement} upCheck
     * @param {HTMLInputElement} fmtCheck
     * @param {HTMLInputElement} showCheck
     */
    function _renderPreviews(ta, upCheck, fmtCheck, showCheck) {
        const rawText = ta.value;
        const lines = rawText.split(/\r?\n/);
        const allItems = [];
        for (const line of lines) {
            const items = _processLine(line, upCheck.checked, fmtCheck.checked);
            for (const item of items) {
                if (!item.content) continue;
                allItems.push(item);
            }
        }
        const listDiv = win?.querySelector(`.${classes.list}`);
        if (!listDiv) return;

        const savedScroll = listDiv.scrollTop;
        listDiv.innerHTML = '';
        if (allItems.length > 0) {
            const now = new Date();
            const showProductInfo = showCheck ? showCheck.checked : !_productMapLoadFailed;
            for (const item of allItems) {
                _generateQRItem(item.content, item.display, listDiv, now, showProductInfo);
            }
        }
        listDiv.scrollTop = savedScroll;

        _updateZoomGroupPosition();
    }

    // ==================== 缩放 ====================

    /**
     * 应用当前尺寸到所有 canvas（只改 CSS 变量，位图不变）
     */
    function _applyZoom() {
        if (!win) return;
        win.style.setProperty('--qr-size', _currentQrSize + 'px');
    }

    /**
     * 每帧更新尺寸
     */
    function _zoomTick() {
        if (!_zoomDirection) return;
        const maxSize = _getMaxQrSize();
        const next = Math.max(QR_MIN, Math.min(maxSize, _currentQrSize + _zoomDirection * ZOOM_SPEED));
        if (next === _currentQrSize) {
            _zoomRafId = null;
            return;
        }
        _currentQrSize = next;
        _applyZoom();
        _zoomRafId = requestAnimationFrame(_zoomTick);
    }

    /**
     * 开始缩放
     * @param {number} dir  1 放大，-1 缩小
     * @param {HTMLButtonElement} btn
     */
    function _startZoom(dir, btn) {
        btn.classList.add('active');
        _zoomDirection = dir;
        if (_zoomRafId) return;
        _zoomRafId = requestAnimationFrame(_zoomTick);
    }

    /**
     * 停止缩放，清理状态
     */
    function _stopZoom() {
        if (!_zoomDirection && !_zoomRafId) return;
        _zoomDirection = 0;
        if (_zoomRafId) {
            cancelAnimationFrame(_zoomRafId);
            _zoomRafId = null;
        }
        if (_btnGroupEl) {
            _btnGroupEl.querySelectorAll(`.${classes.zoomBtn}`).forEach(b => b.classList.remove('active'));
        }
    }

    // ==================== 检查更新 ====================

    /**
     * 点击"检查更新"：置忙 → 发消息 → 渲染结果
     * @param {HTMLButtonElement} btn
     */
    async function _onCheckUpdateClick(btn) {
        if (_updateChecking) return;
        _updateChecking = true;
        btn.disabled = true;
        btn.classList.add('checking');
        _renderUpdateBar('正在检查更新…', { closable: false });
        try {
            const res = await api.runtime.sendMessage({ action: 'checkUpdate' });
            _renderUpdateResult(res);
        } catch (e) {
            console.error('[t2qr] 检查更新失败:', e);
            _renderUpdateBar('检查失败，请稍后重试', { autoHide: 2500 });
        } finally {
            _updateChecking = false;
            btn.disabled = false;
            btn.classList.remove('checking');
        }
    }

    /**
     * 根据 background 返回结果渲染状态条
     * @param {Object} res
     */
    function _renderUpdateResult(res) {
        if (!res || !res.status) {
            _renderUpdateBar('检查失败，请稍后重试', { autoHide: 2500 });
            return;
        }
        const esc = _escapeHtml;
        switch (res.status) {
            case 'network_error':
                _renderUpdateBar('暂时连不上更新服务器，请检查网络', { autoHide: 2500 });
                return;
            case 'fetch_error':
                _renderUpdateBar('检查失败，请稍后重试', { autoHide: 2500 });
                return;
            case 'up_to_date':
                _renderUpdateBar(`已是最新版本 v${esc(res.localVersion || '')}`, { autoHide: 2500 });
                return;
            case 'update_available': {
                const changelog = Array.isArray(res.changelog) ? res.changelog : [];
                const MAX = 5;
                let changelogHtml = '';
                if (changelog.length > 0) {
                    const shown = changelog.slice(0, MAX);
                    const more = changelog.length - MAX;
                    changelogHtml = '<ul class="update-changelog">'
                        + shown.map(line => `<li>${esc(line)}</li>`).join('')
                        + (more > 0 ? `<li style="color:#888;">…另有 ${more} 条</li>` : '')
                        + '</ul>';
                }
                const html = `
                    <div><strong>发现新版本 v${esc(res.latestVersion)}</strong>（当前 v${esc(res.localVersion)}）</div>
                    <div class="update-actions">
                        <a href="${esc(res.download || '')}" target="_blank" rel="noopener noreferrer">前往 Gitee 下载</a>
                        ${changelogHtml ? '<a href="javascript:void(0)" class="update-toggle-changelog">查看更新内容</a>' : ''}
                    </div>
                    ${changelogHtml}
                `;
                _renderUpdateBar(html, { closable: true });
                const toggle = win?.querySelector('.update-toggle-changelog');
                const cl = win?.querySelector('.update-changelog');
                if (toggle && cl) {
                    toggle.addEventListener('click', () => {
                        const open = cl.classList.toggle('open');
                        toggle.textContent = open ? '收起更新内容' : '查看更新内容';
                    });
                }
                return;
            }
            default:
                _renderUpdateBar('检查失败，请稍后重试', { autoHide: 2500 });
        }
    }

    /**
     * 渲染状态条
     * @param {string} html
     * @param {Object} [opts]
     * @param {boolean} [opts.closable]
     * @param {number}  [opts.autoHide]
     */
    function _renderUpdateBar(html, opts = {}) {
        if (!win) return;
        const bar = win.querySelector(`.${classes.updateBar}`);
        if (!bar) return;
        clearTimeout(_updateBarTimer);
        _updateBarTimer = null;
        bar.innerHTML = `
            <div class="update-bar-inner">
                <div class="update-bar-body">${html}</div>
                ${opts.closable ? '<span class="update-close" title="关闭">×</span>' : ''}
            </div>
        `;
        if (opts.closable) {
            const close = bar.querySelector('.update-close');
            if (close) close.addEventListener('click', _hideUpdateBar);
        }
        void bar.offsetHeight;
        bar.classList.add('show');
        if (opts.autoHide) {
            _updateBarTimer = setTimeout(_hideUpdateBar, opts.autoHide);
        }
        _updateZoomGroupPosition();
    }

    /**
     * 收起状态条
     */
    function _hideUpdateBar() {
        if (!win) return;
        const bar = win.querySelector(`.${classes.updateBar}`);
        if (!bar) return;
        bar.classList.remove('show');
        clearTimeout(_updateBarTimer);
        _updateBarTimer = null;
        setTimeout(() => {
            if (bar && !bar.classList.contains('show')) bar.innerHTML = '';
            _updateZoomGroupPosition();
        }, 300);
    }

    // ==================== UI ====================

    /**
     * 关闭悬浮窗
     */
    function closeWin() {
        _stopZoom();
        _removeZoomButtons();
        _zoomGroupTopOffset = null;
        if (win) { win.remove(); win = null; }
    }

    /**
     * 计算缩放按钮组位置：水平贴浮窗一侧，垂直锚定在首次计算时的位置
     */
    function _updateZoomGroupPosition() {
        if (!_btnGroupEl || !win) return;
        const rect = win.getBoundingClientRect();
        const btnW = ZOOM_BTN_SIZE;

        let groupLeft;
        if (rect.left - ZOOM_GAP - btnW >= 8) {
            groupLeft = rect.left - ZOOM_GAP - btnW;
        } else {
            groupLeft = rect.right + ZOOM_GAP;
            if (groupLeft + btnW > window.innerWidth - 8) {
                groupLeft = window.innerWidth - btnW - 8;
            }
        }

        if (_zoomGroupTopOffset === null) {
            const groupH = ZOOM_BTN_SIZE * 2 + ZOOM_BTN_GAP;
            _zoomGroupTopOffset = rect.height / 2 - groupH / 2;
        }

        _btnGroupEl.style.left = groupLeft + 'px';
        _btnGroupEl.style.top = (rect.top + _zoomGroupTopOffset) + 'px';
    }

    /**
     * 创建缩放按钮组
     * @returns {HTMLElement}
     */
    function _createZoomButtons() {
        const el = document.createElement('div');
        el.className = classes.zoomGroup;
        el.innerHTML = `
            <button class="${classes.zoomBtn}" data-dir="1" title="放大">
                <svg width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11M13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0"/>
                    <path d="M10.344 11.742q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1 6.5 6.5 0 0 1-1.398 1.4z"/>
                    <path d="M6.5 3a.5.5 0 0 1 .5.5V6h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-1 0V7H3.5a.5.5 0 0 1 0-1H6V3.5a.5.5 0 0 1 .5-.5"/>
                </svg>
            </button>
            <button class="${classes.zoomBtn}" data-dir="-1" title="缩小">
                <svg width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11M13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0"/>
                    <path d="M10.344 11.742q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1 6.5 6.5 0 0 1-1.398 1.4z"/>
                    <path d="M3 6.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5"/>
                </svg>
            </button>
        `;
        for (const btn of el.querySelectorAll(`.${classes.zoomBtn}`)) {
            const dir = parseInt(btn.dataset.dir, 10);
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                _startZoom(dir, btn);
            });
        }
        document.body.appendChild(el);
        return el;
    }

    /**
     * 移除缩放按钮组
     */
    function _removeZoomButtons() {
        if (_btnGroupEl) {
            _btnGroupEl.remove();
            _btnGroupEl = null;
        }
    }

    /**
     * 绑定浮窗拖拽：Pointer Events + setPointerCapture，限制在视口内
     * @param {HTMLElement} container
     */
    function _bindDrag(container) {
        const header = container.querySelector(`.${classes.header}`);
        if (!header) return;

        let drag = null;

        const endDrag = (e) => {
            if (!drag) return;
            if (e && e.pointerId !== undefined && e.pointerId !== drag.pointerId) return;
            try {
                if (header.hasPointerCapture && header.hasPointerCapture(drag.pointerId)) {
                    header.releasePointerCapture(drag.pointerId);
                }
            } catch (_) { /* ignore */ }
            drag = null;
            document.body.style.userSelect = '';
        };

        header.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button, a')) return;
            if (e.button !== undefined && e.button !== 0) return;
            const rect = container.getBoundingClientRect();
            drag = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                startLeft: rect.left,
                startTop: rect.top,
                width: rect.width,
                height: rect.height,
            };
            container.style.right = 'auto';
            container.style.left = rect.left + 'px';
            container.style.top = rect.top + 'px';
            document.body.style.userSelect = 'none';
            try { header.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            e.preventDefault();
        });

        header.addEventListener('pointermove', (e) => {
            if (!drag || e.pointerId !== drag.pointerId) return;
            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            const maxLeft = Math.max(0, window.innerWidth - drag.width);
            const maxTop = Math.max(0, window.innerHeight - drag.height);
            const nextLeft = Math.min(Math.max(drag.startLeft + dx, 0), maxLeft);
            const nextTop = Math.min(Math.max(drag.startTop + dy, 0), maxTop);
            container.style.left = nextLeft + 'px';
            container.style.top = nextTop + 'px';
            _updateZoomGroupPosition();
        });

        header.addEventListener('pointerup', endDrag);
        header.addEventListener('pointercancel', endDrag);
    }

    /**
     * ESC 关闭浮窗
     * @param {KeyboardEvent} e
     */
    function _onKeyDown(e) {
        if (e.key === 'Escape') closeWin();
    }

    /**
     * 窗口尺寸变化：钳制当前尺寸不超过新的最大值，并重算按钮位置
     */
    function _onResize() {
        const maxSize = _getMaxQrSize();
        if (_currentQrSize > maxSize) {
            _currentQrSize = maxSize;
            _applyZoom();
        }
        _updateZoomGroupPosition();
    }

    /**
     * 创建悬浮窗
     * @returns {HTMLElement}
     */
    function _createFloatingWindow() {
        closeWin();
        _currentQrSize = QR_MIN;

        const container = document.createElement('div');
        container.className = classes.container;
        container.style.setProperty('--qr-size', _currentQrSize + 'px');
        const showBasicTag = _productMapLoadFailed;
        const showProductInfo = !_productMapLoadFailed;
        container.innerHTML = `
            <div class="${classes.header}">
                <span>二维码 <span id="${ids.basicTag}" style="color:red;display:${showBasicTag ? 'inline' : 'none'};">基础版</span></span>
                <div class="${classes.headerActions}">
                    <a class="${classes.helpBtn}" href="${HELP_URL}" target="_blank" rel="noopener noreferrer" title="帮助">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path fill-rule="evenodd" d="M4.475 5.458c-.284 0-.514-.237-.47-.517C4.28 3.24 5.576 2 7.825 2c2.25 0 3.767 1.36 3.767 3.215 0 1.344-.665 2.288-1.79 2.973-1.1.659-1.414 1.118-1.414 2.01v.03a.5.5 0 0 1-.5.5h-.77a.5.5 0 0 1-.5-.495l-.003-.2c-.043-1.221.477-2.001 1.645-2.712 1.03-.632 1.397-1.135 1.397-2.028 0-.979-.758-1.698-1.926-1.698-1.009 0-1.71.529-1.938 1.402-.066.254-.278.461-.54.461h-.777ZM7.496 14c.622 0 1.095-.474 1.095-1.09 0-.618-.473-1.092-1.095-1.092-.606 0-1.087.474-1.087 1.091S6.89 14 7.496 14"/>
                        </svg>
                    </a>
                    <button class="${classes.updateBtn}" title="检查更新">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                        </svg>
                    </button>
                    <a class="${classes.shareBtn}" href="${SHARE_URL}" target="_blank" rel="noopener noreferrer" title="分享">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.5 2.5 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5m-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"/>
                        </svg>
                    </a>
                    <button class="${classes.closeBtn}">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="${classes.updateBar}"></div>
            <div class="${classes.list}"></div>
            <div class="${classes.toolbar}">
                <button id="${ids.toggleOptionsBtn}" class="${classes.toggleBtn}">更多 ▼</button>
                <div id="${ids.optionsPanel}" class="${classes.optionsPanel}" style="display:none">
                    <label class="${classes.checkboxLabel}"><input type="checkbox" id="${ids.autoUppercase}" checked> 自动大写</label>
                    <label class="${classes.checkboxLabel}"><input type="checkbox" id="${ids.autoFormat}" checked> 自动格式化库位码</label>
                    <label class="${classes.checkboxLabel}" id="${ids.showProductInfoLabel}" style="display:${showProductInfo ? '' : 'none'}">
                        <input type="checkbox" id="${ids.showProductInfo}" checked> 显示商品信息
                    </label>
                </div>
            </div>
            <div class="${classes.textareaWrapper}"><textarea id="${ids.textarea}" class="${classes.textarea}" rows="3"></textarea></div>
        `;
        document.body.appendChild(container);
        win = container;

        _updateChecking = false;
        clearTimeout(_updateBarTimer);
        _updateBarTimer = null;

        container.querySelector(`.${classes.closeBtn}`).addEventListener('click', closeWin);
        const updateBtn = container.querySelector(`.${classes.updateBtn}`);
        if (updateBtn) updateBtn.addEventListener('click', () => _onCheckUpdateClick(updateBtn));
        _bindDrag(container);

        const toggleBtn = container.querySelector(`#${ids.toggleOptionsBtn}`);
        const optionsPanel = container.querySelector(`#${ids.optionsPanel}`);
        let expanded = false;
        toggleBtn.addEventListener('click', () => {
            expanded = !expanded;
            optionsPanel.style.display = expanded ? 'flex' : 'none';
            toggleBtn.textContent = expanded ? '更多 ▲' : '更多 ▼';
            _updateZoomGroupPosition();
        });

        _btnGroupEl = _createZoomButtons();
        _updateZoomGroupPosition();

        return container;
    }

    /**
     * 从文本初始化插件
     * @param {string} originalText
     */
    function _initFromText(originalText) {
        if (!originalText) {
            alert('没有有效的文本片段');
            return;
        }
        const container = _createFloatingWindow();
        const textarea = container.querySelector(`#${ids.textarea}`);
        const autoUppercaseCheck = container.querySelector(`#${ids.autoUppercase}`);
        const autoFormatCheck = container.querySelector(`#${ids.autoFormat}`);
        const showProductInfoCheck = container.querySelector(`#${ids.showProductInfo}`);

        const updateLinkage = (changed) => {
            if (changed === autoUppercaseCheck) {
                if (!autoUppercaseCheck.checked && autoFormatCheck.checked) autoFormatCheck.checked = false;
            } else if (changed === autoFormatCheck) {
                if (autoFormatCheck.checked && !autoUppercaseCheck.checked) autoUppercaseCheck.checked = true;
            }
        };

        autoUppercaseCheck.addEventListener('change', () => {
            updateLinkage(autoUppercaseCheck);
            _renderPreviews(textarea, autoUppercaseCheck, autoFormatCheck, showProductInfoCheck);
        });
        autoFormatCheck.addEventListener('change', () => {
            updateLinkage(autoFormatCheck);
            _renderPreviews(textarea, autoUppercaseCheck, autoFormatCheck, showProductInfoCheck);
        });
        if (showProductInfoCheck) {
            showProductInfoCheck.addEventListener('change', () => {
                _renderPreviews(textarea, autoUppercaseCheck, autoFormatCheck, showProductInfoCheck);
            });
        }

        textarea.value = originalText;
        autoUppercaseCheck.checked = true;
        autoFormatCheck.checked = true;
        if (showProductInfoCheck) showProductInfoCheck.checked = true;
        _renderPreviews(textarea, autoUppercaseCheck, autoFormatCheck, showProductInfoCheck);

        textarea.addEventListener('input', () => {
            _renderPreviews(textarea, autoUppercaseCheck, autoFormatCheck, showProductInfoCheck);
        });
    }

    /**
     * 消息监听：接收 showQrFromText 请求
     * @param {Object} request
     * @param {Object} sender
     * @param {Function} sendResponse
     */
    function _onMessage(request, sender, sendResponse) {
        if (request.action === 'showQrFromText' && request.text) {
            _initFromText(request.text);
            sendResponse({ status: 'ok' });
        }
    }

    // ==================== 启动 ====================

    if (Array.isArray(window.productMapData)) {
        try {
            _parseArrayProductMap(window.productMapData);
            _productMapLoadFailed = false;
        } catch (e) {
            console.error('[content] productMap 解析失败：', e.message);
            _productMapLoadFailed = true;
            productMap = new Map();
        }
    } else {
        _productMapLoadFailed = true;
        productMap = new Map();
    }

    api.runtime.onMessage.addListener(_onMessage);
    document.addEventListener('keydown', _onKeyDown);
    document.addEventListener('pointerup', _stopZoom);
    window.addEventListener('resize', _onResize);

    const styleEl = document.createElement('style');
    styleEl.textContent = STYLES(classes);
    document.head.appendChild(styleEl);
})();