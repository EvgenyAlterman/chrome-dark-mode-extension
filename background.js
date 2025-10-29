// Create simple solid-color icons at runtime (no asset files required)
function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return { r, g, b };
}

function createSolidIconImageData(hexColor, size) {
  const { r, g, b } = hexToRgb(hexColor);
  const imageData = new ImageData(size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return imageData;
}

// Colors are easy to tweak
const ICON_ON = {
  16: createSolidIconImageData('#1e90ff', 16), // blue when ON
  32: createSolidIconImageData('#1e90ff', 32)
};
const ICON_OFF = {
  16: createSolidIconImageData('#9aa0a6', 16), // gray when OFF
  32: createSolidIconImageData('#9aa0a6', 32)
};

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
      chrome.action.setIcon({ tabId, imageData: ICON_OFF });
      chrome.action.setTitle({ tabId, title: 'Toggle Dark Mode' });
      return;
    }

    const hostname = getHostnameFromUrl(tab.url);
    if (!hostname) {
      chrome.action.setIcon({ tabId, imageData: ICON_OFF });
      chrome.action.setTitle({ tabId, title: 'Toggle Dark Mode' });
      return;
    }

    if (typeof explicitState === 'boolean') {
      chrome.action.setIcon({ tabId, imageData: explicitState ? ICON_ON : ICON_OFF });
      chrome.action.setTitle({ tabId, title: explicitState ? 'Dark mode: ON' : 'Dark mode: OFF' });
      return;
    }

    chrome.storage.local.get([hostname], (result) => {
      const isOn = Boolean(result[hostname]);
      chrome.action.setIcon({ tabId, imageData: isOn ? ICON_ON : ICON_OFF });
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
