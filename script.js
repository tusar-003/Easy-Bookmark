document.addEventListener('DOMContentLoaded', () => {
    const bookmarksContainer = document.getElementById('bookmarksContainer');
    const mostVisitedContainer = document.getElementById('mostVisitedContainer');
    const searchInput = document.getElementById('searchInput');
    const themeToggle = document.getElementById('themeToggle');
    let allBookmarks = [];
  
    // Load theme preference from storage
    chrome.storage.local.get(['theme'], (result) => {
      if (result.theme === 'light') {
        document.body.classList.remove('dark-theme');
        themeToggle.checked = true;
      }
    });
  
    // Theme toggle functionality
    themeToggle.addEventListener('change', () => {
      const isDark = !document.body.classList.toggle('dark-theme');
      chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
    });
  
    // Load most visited sites
    function loadMostVisitedSites() {
      chrome.topSites.get((sites) => {
        mostVisitedContainer.innerHTML = '';
        
        // Limit to 6 sites
        const topSites = sites.slice(0, 6);
        
        if (topSites.length === 0) {
          mostVisitedContainer.innerHTML = '<div class="loading-small">No frequently visited sites yet</div>';
          return;
        }
        
        topSites.forEach((site) => {
          const siteElement = document.createElement('div');
          siteElement.className = 'most-visited-item';
          
          const favicon = document.createElement('img');
          favicon.className = 'most-visited-icon';
          favicon.src = getFaviconUrl(site.url);
          favicon.alt = site.title;
          favicon.onerror = () => { favicon.src = 'icons/default-favicon.png'; };
          
          const title = document.createElement('div');
          title.className = 'most-visited-title';
          title.textContent = site.title || extractDomain(site.url);
          
          siteElement.appendChild(favicon);
          siteElement.appendChild(title);
          
          siteElement.addEventListener('click', () => {
            window.location.href = site.url;
          });
          
          mostVisitedContainer.appendChild(siteElement);
        });
      });
    }
  
    // Load all bookmarks
    function loadBookmarks() {
      chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        bookmarksContainer.innerHTML = '';
        allBookmarks = [];
        
        // Process all bookmark nodes
        processBookmarkNodes(bookmarkTreeNodes[0].children);
        
        // Render the bookmarks
        renderBookmarks(allBookmarks);
      });
    }
  
    // Process bookmark nodes recursively
    function processBookmarkNodes(nodes, folder = '') {
      for (const node of nodes) {
        if (node.children) {
          // This is a folder
          processBookmarkNodes(node.children, node.title);
        } else if (node.url) {
          // This is a bookmark - check for valid URL
          if (node.url.startsWith('http')) {
            allBookmarks.push({
              id: node.id,
              title: node.title || extractDomain(node.url),
              url: node.url,
              folder: folder
            });
          }
        }
      }
    }
  
    // Extract domain from URL for display purposes
    function extractDomain(url) {
      try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
      } catch (e) {
        return url;
      }
    }
  
    // Get favicon for a URL
    function getFaviconUrl(url) {
      try {
        const domain = new URL(url).origin;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      } catch (e) {
        return 'icons/default-favicon.png';
      }
    }
  
    // Render bookmarks to the page
    function renderBookmarks(bookmarks) {
      if (bookmarks.length === 0) {
        bookmarksContainer.innerHTML = '<div class="loading">No bookmarks found</div>';
        return;
      }
  
      bookmarksContainer.innerHTML = '';
      
      bookmarks.forEach(bookmark => {
        const bookmarkElement = document.createElement('div');
        bookmarkElement.className = 'bookmark-item';
        
        const favicon = document.createElement('img');
        favicon.className = 'bookmark-icon';
        favicon.src = getFaviconUrl(bookmark.url);
        favicon.alt = bookmark.title;
        favicon.onerror = () => { favicon.src = 'icons/default-favicon.png'; };
        
        const tooltip = document.createElement('div');
        tooltip.className = 'bookmark-tooltip';
        tooltip.textContent = bookmark.title;
        
        bookmarkElement.appendChild(favicon);
        bookmarkElement.appendChild(tooltip);
        
        bookmarkElement.addEventListener('click', () => {
          window.location.href = bookmark.url;
        });
        
        bookmarksContainer.appendChild(bookmarkElement);
      });
    }
  
    // Filter bookmarks based on search
    function filterBookmarks(query) {
      if (!query) {
        renderBookmarks(allBookmarks);
        return;
      }
      
      const filtered = allBookmarks.filter(bookmark => 
        bookmark.title.toLowerCase().includes(query.toLowerCase()) || 
        bookmark.url.toLowerCase().includes(query.toLowerCase())
      );
      
      renderBookmarks(filtered);
    }
  
    // Search functionality
    searchInput.addEventListener('input', (e) => {
      filterBookmarks(e.target.value);
    });
  
    // Initial load
    loadMostVisitedSites();
    loadBookmarks();
  });