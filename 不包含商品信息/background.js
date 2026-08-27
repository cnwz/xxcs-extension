// 兼容 Firefox 和 Chrome/Edge 的 API 命名空间
const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.create({
    id: "convert-to-qr",
    title: "将选中文字转为二维码(Q)(&Q)",
    contexts: ["selection"]
  });
});

api.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "convert-to-qr" && info.selectionText) {
    api.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
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