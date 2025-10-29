function getHostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return null;
  }
}

function refreshIconForTabId(tabId, explicitState) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) {
      chrome.action.setTitle({ tabId, title: 'Toggle Dark Mode' });
      return;
    }

    const hostname = getHostnameFromUrl(tab.url);
    if (!hostname) {
      chrome.action.setTitle({ tabId, title: 'Toggle Dark Mode' });
      return;
    }

    if (typeof explicitState === 'boolean') {
      chrome.action.setTitle({ tabId, title: explicitState ? 'Dark mode: ON' : 'Dark mode: OFF' });
      return;
    }

    chrome.storage.local.get([hostname], (result) => {
      const isOn = Boolean(result[hostname]);
      chrome.action.setTitle({ tabId, title: isOn ? 'Dark mode: ON' : 'Dark mode: OFF' });
    });
  });
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  refreshIconForTabId(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    refreshIconForTabId(tabId);
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((t) => refreshIconForTabId(t.id));
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((t) => refreshIconForTabId(t.id));
  });
});

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
        refreshIconForTabId(tab.id, newState);
      });
    });
  } catch (e) {
    console.error(`Failed to process URL: ${tab.url}`, e);
  }
});
