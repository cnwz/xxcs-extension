/**
 * @file background.js
 * @description 文本转二维码插件 - 后台服务脚本，创建右键菜单，兼容 Chrome、Edge、Firefox。
 * @author ls_wuzhen20
 * @homepage https://gitee.com/cnwz/text2qr-extension
 * @since 2026-05-05
 * @lastupdate 2026-09-09
 * @version 1.2.0
 */

const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

api.runtime.onInstalled.addListener(() => {
  // 可自定义菜单文字，& 后字母为快捷键（如 &Q 表示按 Q 触发）
  api.contextMenus.create({
    id: "convert-to-qr",
    title: "制码->英文输入法状态下按[&Q]",
    contexts: ["selection"]
  });
});

api.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "convert-to-qr" && info.selectionText) {
    api.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["productMap.js", "content.js"]
    }).then(() => {
      setTimeout(() => {
        api.tabs.sendMessage(tab.id, {
          action: "showQrFromText",
          text: info.selectionText
        }).catch(err => {
          console.error("发送消息失败:", err);
          api.notifications.create({
            type: "basic",
            title: "文本转二维码",
            message: "无法与当前页面通信，请刷新页面后重试。"
          });
        });
      }, 50);
    }).catch(err => {
      console.error("注入脚本失败:", err);
      api.notifications.create({
        type: "basic",
        title: "文本转二维码",
        message: "无法在此页面执行操作（可能是安全页面）。"
      });
    });
  }
});