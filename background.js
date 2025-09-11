chrome.action.onClicked.addListener((tab) => {
  if (tab.url.startsWith("chrome://")) {
    return;
  }
  
  try {
    const url = new URL(tab.url);
    const hostname = url.hostname;

    chrome.storage.local.get([hostname], (result) => {
      const newState = !result[hostname];
      chrome.storage.local.set({ [hostname]: newState }, () => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      });
    });
  } catch (e) {
    console.error(`Failed to process URL: ${tab.url}`, e);
  }
});
