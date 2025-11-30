// Background script for Easy Bookmarks (Firefox)
// Minimal background script - favicon handling is done in the UI

// Use browser API with chrome fallback for compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Listen for extension install/update events
browserAPI.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Easy Bookmarks extension installed');
  } else if (details.reason === 'update') {
    console.log('Easy Bookmarks extension updated');
  }
});

// Listen for messages from the UI (for future extensibility)
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    sendResponse({ status: 'ok' });
  }
  return true;
});
