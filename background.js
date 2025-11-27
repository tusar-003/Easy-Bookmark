// Background service worker for Easy Bookmarks
// This script handles favicon caching using reliable external services

// List of favicon services to try (in order of reliability)
const FAVICON_SERVICES = [
  (hostname) => `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`,
  (hostname) => `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${hostname}&size=128`,
  (hostname) => `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
];

// Fetch and cache favicon for a bookmark
async function cacheFavicon(bookmark) {
  if (!bookmark.url || !bookmark.url.startsWith('http')) {
    return;
  }

  try {
    const url = new URL(bookmark.url);
    const hostname = url.hostname;
    const key = `favicon-${bookmark.id}`;

    // Check if we already have a cached version
    const existing = await chrome.storage.local.get(key);
    if (existing[key]) {
      return; // Already cached
    }

    // Try each favicon service
    for (const getUrl of FAVICON_SERVICES) {
      try {
        const faviconUrl = getUrl(hostname);
        const response = await fetch(faviconUrl);
        
        if (response.ok) {
          const blob = await response.blob();
          
          // Only cache if it's a valid image with content
          if (blob.size > 100) {
            const dataUrl = await blobToDataUrl(blob);
            await chrome.storage.local.set({ [key]: dataUrl });
            return;
          }
        }
      } catch (e) {
        // Continue to next service
      }
    }
  } catch (error) {
    // Silently fail - the UI will use fallback services
  }
}

// Convert blob to data URL
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Refresh favicons for all bookmarks (runs in background)
async function refreshAllFavicons() {
  try {
    chrome.storage.local.set({ favicon_scan_status: 'Scanning...' });
    
    const bookmarkTreeNodes = await chrome.bookmarks.getTree();
    const bookmarks = [];
    
    function extractBookmarks(nodes) {
      for (const node of nodes) {
        if (node.children) {
          extractBookmarks(node.children);
        } else if (node.url && node.url.startsWith('http')) {
          bookmarks.push(node);
        }
      }
    }
    extractBookmarks(bookmarkTreeNodes);

    let processed = 0;
    const total = bookmarks.length;
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < bookmarks.length; i += batchSize) {
      const batch = bookmarks.slice(i, i + batchSize);
      await Promise.all(batch.map(bookmark => cacheFavicon(bookmark)));
      processed += batch.length;
      chrome.storage.local.set({ 
        favicon_scan_status: `Scanned ${processed} of ${total} bookmarks.` 
      });
    }
    
    chrome.storage.local.set({ favicon_scan_status: 'Scan complete.' });
  } catch (error) {
    console.error('Error refreshing favicons:', error);
    chrome.storage.local.set({ favicon_scan_status: 'Scan failed.' });
  }
}

// Listeners for bookmark events
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  cacheFavicon({ ...bookmark, id });
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  if (changeInfo.url) {
    chrome.bookmarks.get(id, (bookmarks) => {
      if (bookmarks && bookmarks.length > 0) {
        // Clear old cache and fetch new
        chrome.storage.local.remove(`favicon-${id}`);
        cacheFavicon(bookmarks[0]);
      }
    });
  }
});

// Run favicon refresh on install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    refreshAllFavicons();
  }
});

// Listen for manual refresh requests from the UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'refreshFavicons') {
    refreshAllFavicons();
    sendResponse({ status: 'started' });
  }
  return true;
});
