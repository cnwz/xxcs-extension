/**
 * @file background.js
 * @description 文本转二维码插件 - 后台服务脚本，创建右键菜单，兼容 Chrome、Edge、Firefox。
 * @author ls_wuzhen20
 * @homepage https://gitee.com/cnwz/xxcs-extension
 * @since 2026-05-05
 * @lastupdate 2026-10-08
 * @version 2.0.0
 */

const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

// ==================== 常量 ====================

const UPDATE_REPO = 'cnwz/xxcs-extension';
const UPDATE_BRANCH = 'main'; // 默认分支是 master 就改这里
const CDN_BASE = `https://cdn.jsdelivr.net/gh/${UPDATE_REPO}@${UPDATE_BRANCH}/`;
const PING_URL = `${CDN_BASE}ping.txt`;
const VERSION_URL = `${CDN_BASE}version.json`;
const RELEASE_URL = `https://gitee.com/${UPDATE_REPO}/releases/latest`;
const PING_TIMEOUT = 3000;
const FETCH_TIMEOUT = 8000;

// ==================== 右键菜单 ====================

api.runtime.onInstalled.addListener(() => {
    // 可自定义菜单文字，& 后字母为快捷键（如 &Q 表示按 Q 触发）
    api.contextMenus.create({
        id: 'convert-to-qr',
        title: '制码->英文输入法状态下按[&Q]',// 快捷键改这里的 &Q
        contexts: ['selection']
    });
});

api.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'convert-to-qr' || !info.selectionText) return;

    api.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['productMap.js', 'qrcode.min.js', 'content.js']
    }).then(() => {
        setTimeout(() => {
            api.tabs.sendMessage(tab.id, {
                action: 'showQrFromText',
                text: info.selectionText
            }).catch(err => {
                console.error('发送消息失败:', err);
                api.notifications.create({
                    type: 'basic',
                    title: '文本转二维码',
                    message: '无法与当前页面通信，请刷新页面后重试。'
                });
            });
        }, 50);
    }).catch(err => {
        console.error('注入脚本失败:', err);
        api.notifications.create({
            type: 'basic',
            title: '文本转二维码',
            message: '无法在此页面执行操作（可能是安全页面）。'
        });
    });
});

// ==================== 版本检查 ====================

/**
 * 逐段比较版本号
 * @param {string} a
 * @param {string} b
 * @returns {number} a>b 正数，a<b 负数，相等 0
 */
function _compareVersions(a, b) {
    const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length, 3);
    for (let i = 0; i < len; i++) {
        const x = pa[i] || 0, y = pb[i] || 0;
        if (x !== y) return x - y;
    }
    return 0;
}

/**
 * 带超时的 fetch
 * @param {string} url
 * @param {number} timeout
 * @returns {Promise<Response>}
 */
async function _fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        return await fetch(url, { signal: controller.signal, cache: 'no-store' });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 检查更新
 * 1) ping.txt 握手，判断网络
 * 2) 拉 version.json
 * 3) 与 manifest 里的 version 比较
 * @returns {Promise<Object>}
 */
async function _checkUpdate() {
    const localVersion = api.runtime.getManifest().version;

    // 握手
    try {
        const res = await _fetchWithTimeout(`${PING_URL}?t=${Date.now()}`, PING_TIMEOUT);
        if (!res.ok) return { status: 'network_error', localVersion };
    } catch (e) {
        return { status: 'network_error', localVersion };
    }

    // 拉版本文件
    let remote;
    try {
        const res = await _fetchWithTimeout(`${VERSION_URL}?t=${Date.now()}`, FETCH_TIMEOUT);
        if (!res.ok) return { status: 'fetch_error', localVersion };
        remote = await res.json();
    } catch (e) {
        return { status: 'fetch_error', localVersion };
    }

    if (!remote || typeof remote.version !== 'string' || !remote.version) {
        return { status: 'fetch_error', localVersion };
    }

    // 比较
    if (_compareVersions(remote.version, localVersion) > 0) {
        return {
            status: 'update_available',
            localVersion,
            latestVersion: remote.version,
            date: remote.date || '',
            changelog: Array.isArray(remote.changelog) ? remote.changelog : [],
            download: RELEASE_URL,
        };
    }
    return { status: 'up_to_date', localVersion, latestVersion: remote.version };
}

// ==================== 消息监听 ====================

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.action === 'checkUpdate') {
        _checkUpdate()
            .then(sendResponse)
            .catch(err => {
                console.error('[t2qr] 检查更新失败:', err);
                sendResponse({
                    status: 'fetch_error',
                    localVersion: api.runtime.getManifest().version,
                });
            });
        return true; // 异步 sendResponse
    }
});