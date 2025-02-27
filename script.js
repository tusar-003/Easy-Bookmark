document.addEventListener('DOMContentLoaded', () => {
    const bookmarksContainer = document.getElementById('bookmarksContainer');
    const mostVisitedContainer = document.getElementById('mostVisitedContainer');
    const searchInput = document.getElementById('searchInput');
    const themeToggle = document.getElementById('themeToggle');
    const addBookmarkBtn = document.getElementById('addBookmarkBtn');
    const importBookmarksBtn = document.getElementById('importBookmarksBtn');
    const addBookmarkModal = document.getElementById('addBookmarkModal');
    const importModal = document.getElementById('importModal');
    const addBookmarkForm = document.getElementById('addBookmarkForm');
    const importFile = document.getElementById('importFile');
    const importSubmitBtn = document.getElementById('importSubmitBtn');
    const importStatus = document.getElementById('importStatus');
    
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
        
        // Limit to 12 sites
        const topSites = sites.slice(0, 12);
        
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
          
          // Create tooltip with title
          const tooltip = document.createElement('div');
          tooltip.className = 'bookmark-tooltip';
          tooltip.textContent = site.title || extractDomain(site.url);
          
          siteElement.appendChild(favicon);
          siteElement.appendChild(tooltip);
          
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
  
    // Modal management functions
    function openModal(modal) {
      modal.style.display = 'flex';
    }
  
    function closeModal(modal) {
      modal.style.display = 'none';
    }
  
    // Add bookmark functionality
    addBookmarkBtn.addEventListener('click', () => {
      document.getElementById('bookmarkUrl').value = '';
      document.getElementById('bookmarkTitle').value = '';
      openModal(addBookmarkModal);
    });
  
    // Import bookmarks functionality
    importBookmarksBtn.addEventListener('click', () => {
      importFile.value = '';
      importStatus.textContent = '';
      importStatus.className = 'import-status';
      openModal(importModal);
    });
  
    // Close modals when clicking the X button
    document.querySelectorAll('.close-button').forEach(button => {
      button.addEventListener('click', () => {
        closeModal(addBookmarkModal);
        closeModal(importModal);
      });
    });
  
    // Close modals when clicking outside the modal content
    window.addEventListener('click', (event) => {
      if (event.target === addBookmarkModal) {
        closeModal(addBookmarkModal);
      }
      if (event.target === importModal) {
        closeModal(importModal);
      }
    });
  
    // Process add bookmark form submission
    addBookmarkForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const url = document.getElementById('bookmarkUrl').value;
      let title = document.getElementById('bookmarkTitle').value;
      
      if (!title) {
        title = extractDomain(url);
      }
      
      // Add the bookmark to Chrome's bookmarks
      chrome.bookmarks.create({
        title: title,
        url: url
      }, (newBookmark) => {
        // Add to our local bookmarks array
        allBookmarks.push({
          id: newBookmark.id,
          title: title,
          url: url,
          folder: ''
        });
        
        // Rerender bookmarks
        renderBookmarks(allBookmarks);
        
        // Close the modal
        closeModal(addBookmarkModal);
      });
    });
  
    // Helper to create a bookmark from URL and title
    function createBookmark(url, title) {
      return new Promise((resolve, reject) => {
        chrome.bookmarks.create({
          title: title || extractDomain(url),
          url: url
        }, (newBookmark) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(newBookmark);
          }
        });
      });
    }
  
    // Process HTML bookmark file
    function processBookmarkFile(fileContent) {
      // Extract URLs from the HTML file
      const parser = new DOMParser();
      const doc = parser.parseFromString(fileContent, 'text/html');
      const links = doc.querySelectorAll('a');
      
      const bookmarksToAdd = [];
      links.forEach(link => {
        const url = link.getAttribute('href');
        const title = link.textContent.trim();
        
        if (url && url.startsWith('http')) {
          bookmarksToAdd.push({ url, title });
        }
      });
      
      return bookmarksToAdd;
    }
  
    // Import bookmarks from file
    importSubmitBtn.addEventListener('click', async () => {
      if (!importFile.files.length) {
        importStatus.textContent = 'Please select a file to import';
        importStatus.className = 'import-status status-error';
        return;
      }
      
      const file = importFile.files[0];
      
      try {
        const fileContent = await readFileAsText(file);
        const bookmarksToAdd = processBookmarkFile(fileContent);
        
        if (bookmarksToAdd.length === 0) {
          importStatus.textContent = 'No valid bookmarks found in the file';
          importStatus.className = 'import-status status-error';
          return;
        }
        
        // Add each bookmark
        let addedCount = 0;
        for (const bookmark of bookmarksToAdd) {
          try {
            await createBookmark(bookmark.url, bookmark.title);
            addedCount++;
          } catch (error) {
            console.error('Failed to add bookmark:', bookmark.url, error);
          }
        }
        
        importStatus.textContent = `Successfully imported ${addedCount} bookmarks`;
        importStatus.className = 'import-status status-success';
        
        // Reload the bookmarks display
        loadBookmarks();
        
      } catch (error) {
        importStatus.textContent = 'Error importing bookmarks: ' + error.message;
        importStatus.className = 'import-status status-error';
      }
    });
  
    // Helper to read file content
    function readFileAsText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
      });
    }
  
    // Initial load
    loadMostVisitedSites();
    loadBookmarks();
  });