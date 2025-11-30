// Background service worker for Easy Bookmarks
// Minimal background script - favicon handling is done in the UI using Chrome's internal API

// Listen for extension install/update events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Easy Bookmarks extension installed');
  } else if (details.reason === 'update') {
    console.log('Easy Bookmarks extension updated');
  }
});

// Listen for messages from the UI (for future extensibility)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    sendResponse({ status: 'ok' });
  }
  return true;
});
