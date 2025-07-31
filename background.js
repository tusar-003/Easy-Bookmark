// Function to fetch an image and convert it to a Data URL
async function imageToDataUrl(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    // If the initial fetch fails, try fetching with a no-cors header as a fallback
    // This is less reliable but can sometimes get around CORS issues for public favicons
    const noCorsResponse = await fetch(url, { mode: 'no-cors' });
    if (!noCorsResponse.ok) {
        throw new Error(`Failed to fetch image with no-cors fallback: ${noCorsResponse.status}`);
    }
    const blob = await noCorsResponse.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
  }
}

// Function to find the best favicon URL from a webpage
async function findFaviconUrl(pageUrl) {
  const response = await fetch(pageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status}`);
  }
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const selectors = [
    'link[rel="apple-touch-icon"]',
    'link[rel="icon"][sizes="192x192"]',
    'link[rel="icon"][sizes="128x128"]',
    'link[rel="shortcut icon"]',
    'link[rel="icon"]'
  ];

  for (const selector of selectors) {
    const linkElement = doc.querySelector(selector);
    if (linkElement) {
      return new URL(linkElement.getAttribute('href'), pageUrl).href;
    }
  }

  return new URL('/favicon.ico', pageUrl).href;
}

// Main function to find and store the favicon
async function findAndStoreFavicon(bookmark) {
  if (!bookmark.url || !bookmark.url.startsWith('http')) {
    return;
  }

  try {
    const faviconUrl = await findFaviconUrl(bookmark.url);
    const dataUrl = await imageToDataUrl(faviconUrl);

    const storageItem = {};
    storageItem[`favicon-${bookmark.id}`] = dataUrl;
    chrome.storage.local.set(storageItem);

  } catch (error) {
    // Do not log CORS errors as they are very common and not true failures
    if (!error.message.includes('CORS')) {
        console.warn(`Could not process favicon for ${bookmark.url}:`, error);
    }
  }
}

// Function to refresh favicons for all existing bookmarks
async function refreshAllFavicons() {
  chrome.storage.local.set({ favicon_scan_status: 'Scanning...' });
  chrome.bookmarks.getTree(async (bookmarkTreeNodes) => {
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
    for (const bookmark of bookmarks) {
      const key = `favicon-${bookmark.id}`;
      const result = await chrome.storage.local.get(key);
      if (!result[key]) {
        await findAndStoreFavicon(bookmark);
      }
      processed++;
      chrome.storage.local.set({ favicon_scan_status: `Scanned ${processed} of ${bookmarks.length} bookmarks.` });
    }
    chrome.storage.local.set({ favicon_scan_status: 'Scan complete.' });
  });
}

// Listeners
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  findAndStoreFavicon({ ...bookmark, id });
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  if (changeInfo.url) {
    chrome.bookmarks.get(id, (bookmarks) => {
      if (bookmarks && bookmarks.length > 0) {
        findAndStoreFavicon(bookmarks[0]);
      }
    });
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    refreshAllFavicons();
  }
});
