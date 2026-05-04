// 创建右键菜单
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "convert-to-qr",
    title: "将选中文字转为二维码(&Q)",
    contexts: ["selection"]
  });
});

// 点击菜单时向当前标签页发送消息
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "convert-to-qr" && info.selectionText) {
    browser.tabs.sendMessage(tab.id, {
      action: "showQrFromText",
      text: info.selectionText
    }).catch(err => {
      console.error("发送消息失败:", err);
    });
  }
});