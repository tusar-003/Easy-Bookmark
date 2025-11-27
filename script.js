document.addEventListener("DOMContentLoaded", () => {
  const bookmarksContainer = document.getElementById("bookmarksContainer")
  const mostVisitedContainer = document.getElementById("mostVisitedContainer")
  const searchInput = document.getElementById("searchInput")
  const themeToggle = document.getElementById("themeToggle")
  const addBookmarkBtn = document.getElementById("addBookmarkBtn")
  const deleteBookmarksBtn = document.getElementById("deleteBookmarksBtn")
  const importBookmarksBtn = document.getElementById("importBookmarksBtn");
  const addBookmarkModal = document.getElementById("addBookmarkModal")
  const editBookmarkModal = document.getElementById("editBookmarkModal")
  const importModal = document.getElementById("importModal")
  const addBookmarkForm = document.getElementById("addBookmarkForm")
  const editBookmarkForm = document.getElementById("editBookmarkForm")
  const importFile = document.getElementById("importFile")
  const importSubmitBtn = document.getElementById("importSubmitBtn")
  const importStatus = document.getElementById("importStatus")
  const contextMenu = document.getElementById("contextMenu")
  const deleteSelectedBtn = document.getElementById("deleteSelectedBtn")
  const cancelSelectionBtn = document.getElementById("cancelSelectionBtn")
  const editModeBtn = document.getElementById("editModeBtn")
  const doneEditingBtn = document.getElementById("doneEditingBtn")

  let allBookmarks = []
  let mostVisitedSites = []
  let isSelectionMode = false
  let isEditMode = false
  const selectedBookmarks = new Set()
  let rightClickedBookmark = null
  let rightClickedMostVisited = null
  let draggedElement = null
  let draggedBookmarkId = null

  // Load theme preference from storage and apply it
  function applyTheme() {
    chrome.storage.local.get(["theme"], (result) => {
      // Default to dark theme if no preference is set
      const isDark = result.theme !== 'light';
      document.body.classList.toggle("dark-theme", isDark);
      if (themeToggle) {
        themeToggle.checked = isDark;
      }
    });
  }

  // Theme toggle functionality
  themeToggle.addEventListener("change", () => {
    const isDark = themeToggle.checked;
    document.body.classList.toggle("dark-theme", isDark);
    chrome.storage.local.set({ theme: isDark ? "dark" : "light" });
  });

  // Load most visited sites
  function loadMostVisitedSites() {
    chrome.topSites.get((sites) => {
      mostVisitedContainer.innerHTML = ""
      
      // Store in global variable for later use
      mostVisitedSites = sites.slice(0, 12)

      if (mostVisitedSites.length === 0) {
        mostVisitedContainer.innerHTML = '<div class="loading-small">No frequently visited sites yet</div>'
        return
      }

      // Retrieve custom names for most visited sites
      chrome.storage.local.get(["mostVisitedCustomNames"], (result) => {
        const customNames = result.mostVisitedCustomNames || {}
        
        mostVisitedSites.forEach((site, index) => {
          const siteElement = document.createElement("div")
          siteElement.className = "most-visited-item"
          // Store the index for identification
          siteElement.dataset.index = index

          const favicon = document.createElement("img")
          favicon.className = "most-visited-icon"
          favicon.alt = site.title
          favicon.src = "icons/default-favicon.svg" // Start with default
          // Load favicon with fallback system
          loadFaviconWithFallback(favicon, site.url)

          // Use custom name if available, otherwise use original title
          const displayTitle = customNames[site.url] || site.title || extractDomain(site.url)
          
          // Create tooltip with title
          const tooltip = document.createElement("div")
          tooltip.className = "bookmark-tooltip"
          tooltip.textContent = displayTitle

          siteElement.appendChild(favicon)
          siteElement.appendChild(tooltip)

          siteElement.addEventListener("click", () => {
            window.location.href = site.url
          })
          
          // Add context menu on right click
          siteElement.addEventListener("contextmenu", (e) => {
            e.preventDefault()
            rightClickedMostVisited = {
              index: index,
              url: site.url,
              title: displayTitle,
              originalTitle: site.title
            }

            // Position and show context menu
            contextMenu.style.left = `${e.pageX}px`
            contextMenu.style.top = `${e.pageY}px`
            contextMenu.classList.add("active")
            
            // Show appropriate context menu items
            document.getElementById("contextMenuEdit").textContent = "Edit"
            document.getElementById("contextMenuDelete").textContent = "Remove"
          })

          mostVisitedContainer.appendChild(siteElement)
        })
      })
    })
  }

  // Function to remove a site from most visited
  function removeMostVisitedSite(url) {
    // Chrome's topSites API doesn't provide a direct way to remove sites,
    // but we can use chrome.history.deleteUrl to achieve a similar effect
    chrome.history.deleteUrl({ url: url }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error removing site:", chrome.runtime.lastError)
        return
      }
      
      // Remove any custom name for this URL
      chrome.storage.local.get(["mostVisitedCustomNames"], (result) => {
        const customNames = result.mostVisitedCustomNames || {}
        if (customNames[url]) {
          delete customNames[url]
          chrome.storage.local.set({ mostVisitedCustomNames: customNames })
        }
        
        // Reload the most visited sites
        loadMostVisitedSites()
      })
    })
  }
  
  // Function to edit most visited site name
  function editMostVisitedSite(url, newTitle) {
    chrome.storage.local.get(["mostVisitedCustomNames"], (result) => {
      const customNames = result.mostVisitedCustomNames || {}
      customNames[url] = newTitle
      
      chrome.storage.local.set({ mostVisitedCustomNames: customNames }, () => {
        // Reload most visited sites to reflect changes
        loadMostVisitedSites()
      })
    })
  }

  // Load all bookmarks
  function loadBookmarks() {
    chrome.bookmarks.getTree(async (bookmarkTreeNodes) => {
      bookmarksContainer.innerHTML = ""
      allBookmarks = []
      selectedBookmarks.clear()

      // Process all bookmark nodes
      processBookmarkNodes(bookmarkTreeNodes[0].children)

      // Apply saved order
      await applyBookmarkOrder(allBookmarks)

      // Render the bookmarks
      renderBookmarks(allBookmarks)
    })
  }

  // Process bookmark nodes recursively
  function processBookmarkNodes(nodes, folder = "") {
    for (const node of nodes) {
      if (node.children) {
        // This is a folder
        processBookmarkNodes(node.children, node.title)
      } else if (node.url) {
        // This is a bookmark - check for valid URL
        if (node.url.startsWith("http")) {
          allBookmarks.push({
            id: node.id,
            title: node.title || extractDomain(node.url),
            url: node.url,
            folder: folder,
          })
        }
      }
    }
  }

  // Extract domain from URL for display purposes
  function extractDomain(url) {
    try {
      const domain = new URL(url).hostname
      return domain.replace("www.", "")
    } catch (e) {
      return url
    }
  }

  // Cache for favicon URLs that work
  const faviconCache = new Map();

  // Get all possible favicon sources for a URL
  function getAllFaviconSources(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const origin = urlObj.origin;
      const encodedUrl = encodeURIComponent(url);
      
      return [
        // Chrome's internal favicon API (MV3) - same as native bookmarks
        `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodedUrl}&size=64`,
        `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodedUrl}&size=32`,
        // Google's favicon services (very reliable)
        `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`,
        `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
        `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
        // Google's T2 service with full URL support
        `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodedUrl}&size=128`,
        `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodedUrl}&size=64`,
        // DuckDuckGo favicon service
        `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
        // Direct favicon URLs from the website
        `${origin}/favicon.ico`,
        `${origin}/apple-touch-icon.png`,
        `${origin}/apple-touch-icon-precomposed.png`,
        `${origin}/favicon-32x32.png`,
        `${origin}/favicon-16x16.png`,
      ];
    } catch (e) {
      return [];
    }
  }

  // Load favicon by racing all sources - first one to load wins
  async function loadFaviconWithFallback(imgElement, url) {
    // Check memory cache first
    if (faviconCache.has(url)) {
      imgElement.src = faviconCache.get(url);
      return;
    }

    const sources = getAllFaviconSources(url);
    if (sources.length === 0) {
      imgElement.src = "icons/default-favicon.svg";
      return;
    }

    // Race all sources - first valid one wins
    const result = await raceForValidFavicon(sources);
    if (result) {
      imgElement.src = result;
      faviconCache.set(url, result);
    } else {
      imgElement.src = "icons/default-favicon.svg";
    }
  }

  // Race all favicon sources and return the first one that loads successfully
  function raceForValidFavicon(sources) {
    return new Promise((resolve) => {
      let resolved = false;
      let failedCount = 0;
      const total = sources.length;

      // Helper to handle completion
      const handleResult = (success, src) => {
        if (resolved) return;
        
        if (success) {
          resolved = true;
          resolve(src);
        } else {
          failedCount++;
          if (failedCount >= total) {
            resolve(null);
          }
        }
      };

      // Start loading all sources simultaneously
      sources.forEach((src) => {
        const img = new Image();
        
        img.onload = () => {
          // Verify it's a real image, not a 1x1 placeholder
          const isValid = img.naturalWidth > 2 && img.naturalHeight > 2;
          handleResult(isValid, src);
        };
        
        img.onerror = () => handleResult(false, src);
        
        img.src = src;
      });

      // Timeout fallback after 5 seconds
      setTimeout(() => {
        if (!resolved) {
          resolve(null);
        }
      }, 5000);
    });
  }

  // Render bookmarks to the page
  function renderBookmarks(bookmarks) {
    if (bookmarks.length === 0) {
      bookmarksContainer.innerHTML = '<div class="loading">No bookmarks found</div>'
      return
    }

    bookmarksContainer.innerHTML = ""

    bookmarks.forEach((bookmark) => {
      const bookmarkElement = document.createElement("div")
      bookmarkElement.className = "bookmark-item"
      bookmarkElement.dataset.id = bookmark.id

      const favicon = document.createElement("img")
      favicon.className = "bookmark-icon"
      favicon.alt = bookmark.title
      favicon.src = "icons/default-favicon.svg" // Start with default
      // Load favicon with fallback system
      loadFaviconWithFallback(favicon, bookmark.url)

      const tooltip = document.createElement("div")
      tooltip.className = "bookmark-tooltip"
      tooltip.textContent = bookmark.title // Only show the title in tooltip, not URL

      bookmarkElement.appendChild(favicon)
      bookmarkElement.appendChild(tooltip)

      // Add checkbox for selection mode
      if (isSelectionMode) {
        const checkbox = document.createElement("div")
        checkbox.className = "bookmark-checkbox"
        if (selectedBookmarks.has(bookmark.id)) {
          checkbox.classList.add("selected")
          bookmarkElement.classList.add("selected")
        }
        bookmarkElement.appendChild(checkbox)
      }

      // Add drag and drop attributes for edit mode
      if (isEditMode) {
        bookmarkElement.setAttribute('draggable', 'true')
        
        bookmarkElement.addEventListener('dragstart', (e) => handleDragStart(e, bookmark))
        bookmarkElement.addEventListener('dragend', handleDragEnd)
        bookmarkElement.addEventListener('dragover', handleDragOver)
        bookmarkElement.addEventListener('dragleave', handleDragLeave)
        bookmarkElement.addEventListener('drop', handleDrop)
      }

      // Handle click event based on mode
      bookmarkElement.addEventListener("click", (e) => {
        if (isSelectionMode) {
          e.preventDefault()
          toggleBookmarkSelection(bookmark.id, bookmarkElement)
        } else if (isEditMode) {
          // In edit mode, clicking doesn't navigate
          e.preventDefault()
        } else {
          window.location.href = bookmark.url
        }
      })

      // Add context menu on right click (disabled in edit mode)
      bookmarkElement.addEventListener("contextmenu", (e) => {
        if (isEditMode) {
          e.preventDefault()
          return
        }
        e.preventDefault()
        rightClickedBookmark = bookmark
        rightClickedMostVisited = null

        // Position and show context menu
        contextMenu.style.left = `${e.pageX}px`
        contextMenu.style.top = `${e.pageY}px`
        contextMenu.classList.add("active")
        
        // Show appropriate context menu items
        document.getElementById("contextMenuEdit").textContent = "Edit Bookmark"
        document.getElementById("contextMenuDelete").textContent = "Delete Bookmark"
      })

      bookmarksContainer.appendChild(bookmarkElement)
    })
  }

  // Toggle bookmark selection
  function toggleBookmarkSelection(bookmarkId, element) {
    if (selectedBookmarks.has(bookmarkId)) {
      selectedBookmarks.delete(bookmarkId)
      element.classList.remove("selected")
      element.querySelector(".bookmark-checkbox").classList.remove("selected")
    } else {
      selectedBookmarks.add(bookmarkId)
      element.classList.add("selected")
      element.querySelector(".bookmark-checkbox").classList.add("selected")
    }

    // Update delete button state
    updateDeleteButtonState()
  }

  // Update delete button state based on selections
  function updateDeleteButtonState() {
    if (selectedBookmarks.size > 0) {
      deleteSelectedBtn.textContent = `Delete Selected (${selectedBookmarks.size})`
      deleteSelectedBtn.disabled = false
    } else {
      deleteSelectedBtn.textContent = "Delete Selected"
      deleteSelectedBtn.disabled = true
    }
  }

  // Enter selection mode
  function enterSelectionMode() {
    isSelectionMode = true
    selectedBookmarks.clear()
    document.body.classList.add("selection-mode")
    deleteBookmarksBtn.style.display = "none"
    deleteSelectedBtn.style.display = "block"
    cancelSelectionBtn.style.display = "block"
    updateDeleteButtonState()
    renderBookmarks(allBookmarks)
  }

  // Exit selection mode
  function exitSelectionMode() {
    isSelectionMode = false
    selectedBookmarks.clear()
    document.body.classList.remove("selection-mode")
    deleteBookmarksBtn.style.display = "block"
    deleteSelectedBtn.style.display = "none"
    cancelSelectionBtn.style.display = "none"
    renderBookmarks(allBookmarks)
  }

  // Enter edit mode (for drag and drop reordering)
  function enterEditMode() {
    // Exit selection mode if active
    if (isSelectionMode) {
      exitSelectionMode()
    }
    
    isEditMode = true
    document.body.classList.add("edit-mode")
    bookmarksContainer.classList.add("edit-mode-active")
    
    // Update button visibility
    editModeBtn.style.display = "none"
    doneEditingBtn.style.display = "block"
    deleteBookmarksBtn.style.display = "none"
    addBookmarkBtn.style.display = "none"
    importBookmarksBtn.style.display = "none"
    
    // Re-render bookmarks with drag handlers
    renderBookmarks(allBookmarks)
  }

  // Exit edit mode
  function exitEditMode() {
    isEditMode = false
    document.body.classList.remove("edit-mode")
    bookmarksContainer.classList.remove("edit-mode-active")
    
    // Update button visibility
    editModeBtn.style.display = "block"
    doneEditingBtn.style.display = "none"
    deleteBookmarksBtn.style.display = "block"
    addBookmarkBtn.style.display = "block"
    importBookmarksBtn.style.display = "block"
    
    // Save the new order
    saveBookmarkOrder()
    
    // Re-render bookmarks without drag handlers
    renderBookmarks(allBookmarks)
  }

  // Save bookmark order to storage
  function saveBookmarkOrder() {
    const bookmarkOrder = allBookmarks.map(b => b.id)
    chrome.storage.local.set({ bookmarkOrder: bookmarkOrder })
  }

  // Load saved bookmark order and reorder bookmarks accordingly
  function applyBookmarkOrder(bookmarks) {
    return new Promise((resolve) => {
      chrome.storage.local.get(["bookmarkOrder"], (result) => {
        if (result.bookmarkOrder && result.bookmarkOrder.length > 0) {
          const orderMap = new Map()
          result.bookmarkOrder.forEach((id, index) => {
            orderMap.set(id, index)
          })
          
          // Sort bookmarks based on saved order
          // Bookmarks not in the order list will be placed at the end
          bookmarks.sort((a, b) => {
            const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : Infinity
            const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : Infinity
            return orderA - orderB
          })
        }
        resolve(bookmarks)
      })
    })
  }

  // Drag and drop handlers
  let dropPosition = 'after' // Track if dropping before or after target
  
  function handleDragStart(e, bookmark) {
    if (!isEditMode) return
    
    draggedElement = e.target.closest('.bookmark-item')
    draggedBookmarkId = bookmark.id
    
    // Small delay to allow the drag image to be captured before adding dragging class
    setTimeout(() => {
      draggedElement.classList.add('dragging')
    }, 0)
    
    // Set drag data
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', bookmark.id)
    
    // Create a custom drag image
    const dragImage = draggedElement.cloneNode(true)
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    dragImage.classList.remove('dragging')
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 30, 30)
    setTimeout(() => document.body.removeChild(dragImage), 0)
  }

  function handleDragEnd(e) {
    if (!isEditMode) return
    
    if (draggedElement) {
      draggedElement.classList.remove('dragging')
    }
    
    // Remove all drag indicator classes from all items
    document.querySelectorAll('.bookmark-item').forEach(item => {
      item.classList.remove('drag-over-left', 'drag-over-right')
    })
    
    draggedElement = null
    draggedBookmarkId = null
  }

  function handleDragOver(e) {
    if (!isEditMode) return
    
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const targetElement = e.target.closest('.bookmark-item')
    if (targetElement && targetElement !== draggedElement) {
      // Calculate mouse position relative to target element
      const rect = targetElement.getBoundingClientRect()
      const mouseX = e.clientX
      const elementCenterX = rect.left + rect.width / 2
      
      // Remove all indicators from all items first
      document.querySelectorAll('.bookmark-item').forEach(item => {
        item.classList.remove('drag-over-left', 'drag-over-right')
      })
      
      // Add indicator based on mouse position (left or right half)
      if (mouseX < elementCenterX) {
        targetElement.classList.add('drag-over-left')
        dropPosition = 'before'
      } else {
        targetElement.classList.add('drag-over-right')
        dropPosition = 'after'
      }
    }
  }

  function handleDragLeave(e) {
    if (!isEditMode) return
    
    const targetElement = e.target.closest('.bookmark-item')
    if (targetElement) {
      // Only remove if we're actually leaving the element (not entering a child)
      const relatedTarget = e.relatedTarget
      if (!targetElement.contains(relatedTarget)) {
        targetElement.classList.remove('drag-over-left', 'drag-over-right')
      }
    }
  }

  function handleDrop(e) {
    if (!isEditMode) return
    
    e.preventDefault()
    
    const targetElement = e.target.closest('.bookmark-item')
    if (!targetElement || targetElement === draggedElement) {
      return
    }
    
    const targetBookmarkId = targetElement.dataset.id
    
    // Find indices
    const draggedIndex = allBookmarks.findIndex(b => b.id === draggedBookmarkId)
    let targetIndex = allBookmarks.findIndex(b => b.id === targetBookmarkId)
    
    if (draggedIndex === -1 || targetIndex === -1) return
    
    // Remove the dragged item first
    const [draggedBookmark] = allBookmarks.splice(draggedIndex, 1)
    
    // Recalculate target index after removal
    targetIndex = allBookmarks.findIndex(b => b.id === targetBookmarkId)
    
    // Insert at the correct position based on drop indicator
    if (dropPosition === 'after') {
      allBookmarks.splice(targetIndex + 1, 0, draggedBookmark)
    } else {
      allBookmarks.splice(targetIndex, 0, draggedBookmark)
    }
    
    // Remove drag indicator classes
    targetElement.classList.remove('drag-over-left', 'drag-over-right')
    
    // Re-render with new order
    renderBookmarks(allBookmarks)
  }

  // Delete a single bookmark
  function deleteBookmark(bookmarkId) {
    chrome.bookmarks.remove(bookmarkId, () => {
      if (chrome.runtime.lastError) {
        console.error("Error deleting bookmark:", chrome.runtime.lastError)
        return
      }

      // Remove from our local array
      allBookmarks = allBookmarks.filter((bookmark) => bookmark.id !== bookmarkId)
      renderBookmarks(allBookmarks)
    })
  }

  // Edit a bookmark
  function editBookmark(bookmarkId, newTitle, newUrl) {
    chrome.bookmarks.update(
      bookmarkId,
      {
        title: newTitle,
        url: newUrl,
      },
      (updatedBookmark) => {
        if (chrome.runtime.lastError) {
          console.error("Error updating bookmark:", chrome.runtime.lastError)
          return
        }

        // Update in our local array
        const index = allBookmarks.findIndex((bookmark) => bookmark.id === bookmarkId)
        if (index !== -1) {
          allBookmarks[index].title = newTitle
          allBookmarks[index].url = newUrl
        }

        renderBookmarks(allBookmarks)
      },
    )
  }

  // Delete multiple bookmarks
  function deleteSelectedBookmarks() {
    if (selectedBookmarks.size === 0) return

    const confirmDelete = confirm(`Are you sure you want to delete ${selectedBookmarks.size} bookmark(s)?`)
    if (!confirmDelete) return

    const bookmarksToDelete = Array.from(selectedBookmarks)
    let deletedCount = 0

    bookmarksToDelete.forEach((bookmarkId) => {
      chrome.bookmarks.remove(bookmarkId, () => {
        if (chrome.runtime.lastError) {
          console.error("Error deleting bookmark:", chrome.runtime.lastError)
          return
        }

        deletedCount++

        // When all deletions are complete
        if (deletedCount === bookmarksToDelete.length) {
          // Reload bookmarks
          loadBookmarks()
          exitSelectionMode()
        }
      })
    })
  }

  // Filter bookmarks based on search
  function filterBookmarks(query) {
    if (!query) {
      renderBookmarks(allBookmarks)
      return
    }

    const filtered = allBookmarks.filter(
      (bookmark) =>
        bookmark.title.toLowerCase().includes(query.toLowerCase()) ||
        bookmark.url.toLowerCase().includes(query.toLowerCase()),
    )

    renderBookmarks(filtered)
  }

  // Search functionality
  searchInput.addEventListener("input", (e) => {
    filterBookmarks(e.target.value)
  })

  // Modal management functions
  function openModal(modal) {
    modal.style.display = "flex"
  }

  function closeModal(modal) {
    modal.style.display = "none"
  }

  // Add bookmark functionality
  addBookmarkBtn.addEventListener("click", () => {
    document.getElementById("bookmarkUrl").value = ""
    document.getElementById("bookmarkTitle").value = ""
    openModal(addBookmarkModal)
  })

  // Delete bookmarks button (enter selection mode)
  deleteBookmarksBtn.addEventListener("click", () => {
    enterSelectionMode()
  })

  // Delete selected bookmarks
  deleteSelectedBtn.addEventListener("click", () => {
    deleteSelectedBookmarks()
  })

  // Cancel selection mode
  cancelSelectionBtn.addEventListener("click", () => {
    exitSelectionMode()
  })

  // Edit mode button
  editModeBtn.addEventListener("click", () => {
    enterEditMode()
  })

  // Done editing button
  doneEditingBtn.addEventListener("click", () => {
    exitEditMode()
  })

  // Context menu edit option
  document.getElementById("contextMenuEdit").addEventListener("click", () => {
    if (rightClickedBookmark) {
      // Populate edit form with current bookmark data
      document.getElementById("editBookmarkUrl").value = rightClickedBookmark.url
      document.getElementById("editBookmarkTitle").value = rightClickedBookmark.title
      document.getElementById("editBookmarkId").value = rightClickedBookmark.id

      // Open edit modal
      openModal(editBookmarkModal)
    } else if (rightClickedMostVisited) {
      // Create a specific most visited site edit modal
      document.getElementById("editBookmarkUrl").value = rightClickedMostVisited.url
      document.getElementById("editBookmarkUrl").disabled = true // URL cannot be edited for most visited
      document.getElementById("editBookmarkTitle").value = rightClickedMostVisited.title
      document.getElementById("editBookmarkId").value = "most-visited-" + rightClickedMostVisited.index
      
      // Change the title of the modal
      document.querySelector("#editBookmarkModal h2").textContent = "Edit"
      
      // Open edit modal
      openModal(editBookmarkModal)
    }
    contextMenu.classList.remove("active")
  })

  // Context menu delete option
  document.getElementById("contextMenuDelete").addEventListener("click", () => {
    if (rightClickedBookmark) {
      const confirmDelete = confirm(`Are you sure you want to delete "${rightClickedBookmark.title}"?`)
      if (confirmDelete) {
        deleteBookmark(rightClickedBookmark.id)
      }
    } else if (rightClickedMostVisited) {
      const confirmDelete = confirm(`Are you sure you want to remove "${rightClickedMostVisited.title}" from most visited sites?`)
      if (confirmDelete) {
        removeMostVisitedSite(rightClickedMostVisited.url)
      }
    }
    contextMenu.classList.remove("active")
  })

  // Process edit bookmark form submission
  editBookmarkForm.addEventListener("submit", (e) => {
    e.preventDefault()

    const bookmarkId = document.getElementById("editBookmarkId").value
    const newUrl = document.getElementById("editBookmarkUrl").value
    const newTitle = document.getElementById("editBookmarkTitle").value

    // Check if this is a most visited site or regular bookmark
    if (bookmarkId.startsWith("most-visited-")) {
      // This is a most visited site
      const mostVisitedUrl = rightClickedMostVisited.url
      editMostVisitedSite(mostVisitedUrl, newTitle)
      
      // Reset modal title
      document.querySelector("#editBookmarkModal h2").textContent = "Edit Bookmark"
      document.getElementById("editBookmarkUrl").disabled = false
    } else {
      // This is a regular bookmark
      editBookmark(bookmarkId, newTitle, newUrl)
    }

    // Close the modal
    closeModal(editBookmarkModal)
  })

  // Import bookmarks functionality
  importBookmarksBtn.addEventListener("click", () => {
    importFile.value = ""
    importStatus.textContent = ""
    importStatus.className = "import-status"
    openModal(importModal)
  })

  // Close modals when clicking the X button
  document.querySelectorAll(".close-button").forEach((button) => {
    button.addEventListener("click", () => {
      closeModal(addBookmarkModal)
      closeModal(editBookmarkModal)
      closeModal(importModal)
      
      // Reset modal title and URL field when closing
      document.querySelector("#editBookmarkModal h2").textContent = "Edit Bookmark"
      document.getElementById("editBookmarkUrl").disabled = false
    })
  })

  // Close modals when clicking outside the modal content
  window.addEventListener("click", (event) => {
    if (event.target === addBookmarkModal) {
      closeModal(addBookmarkModal)
    }
    if (event.target === editBookmarkModal) {
      closeModal(editBookmarkModal)
      
      // Reset modal title and URL field when closing
      document.querySelector("#editBookmarkModal h2").textContent = "Edit Bookmark"
      document.getElementById("editBookmarkUrl").disabled = false
    }
    if (event.target === importModal) {
      closeModal(importModal)
    }

    // Hide context menu when clicking elsewhere
    if (!event.target.closest("#contextMenu")) {
      contextMenu.classList.remove("active")
    }
  })

  // Process add bookmark form submission
  addBookmarkForm.addEventListener("submit", (e) => {
    e.preventDefault()

    const url = document.getElementById("bookmarkUrl").value
    let title = document.getElementById("bookmarkTitle").value

    if (!title) {
      title = extractDomain(url)
    }

    // Add the bookmark to Chrome's bookmarks
    chrome.bookmarks.create(
      {
        title: title,
        url: url,
      },
      (newBookmark) => {
        // Add to our local bookmarks array
        allBookmarks.push({
          id: newBookmark.id,
          title: title,
          url: url,
          folder: "",
        })

        // Rerender bookmarks
        renderBookmarks(allBookmarks)

        // Close the modal
        closeModal(addBookmarkModal)
      },
    )
  })

  // Helper to create a bookmark from URL and title
  function createBookmark(url, title) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.create(
        {
          title: title || extractDomain(url),
          url: url,
        },
        (newBookmark) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            resolve(newBookmark)
          }
        },
      )
    })
  }

  // Process HTML bookmark file
  function processBookmarkFile(fileContent) {
    // Extract URLs from the HTML file
    const parser = new DOMParser()
    const doc = parser.parseFromString(fileContent, "text/html")
    const links = doc.querySelectorAll("a")

    const bookmarksToAdd = []
    links.forEach((link) => {
      const url = link.getAttribute("href")
      const title = link.textContent.trim()

      if (url && url.startsWith("http")) {
        bookmarksToAdd.push({ url, title })
      }
    })

    return bookmarksToAdd
  }

  // Import bookmarks from file
  importSubmitBtn.addEventListener("click", async () => {
    if (!importFile.files.length) {
      importStatus.textContent = "Please select a file to import"
      importStatus.className = "import-status status-error"
      return
    }

    const file = importFile.files[0]

    try {
      const fileContent = await readFileAsText(file)
      const bookmarksToAdd = processBookmarkFile(fileContent)

      if (bookmarksToAdd.length === 0) {
        importStatus.textContent = "No valid bookmarks found in the file"
        importStatus.className = "import-status status-error"
        return
      }

      // Add each bookmark
      let addedCount = 0
      for (const bookmark of bookmarksToAdd) {
        try {
          await createBookmark(bookmark.url, bookmark.title)
          addedCount++
        } catch (error) {
          console.error("Failed to add bookmark:", bookmark.url, error)
        }
      }

      importStatus.textContent = `Successfully imported ${addedCount} bookmarks`
      importStatus.className = "import-status status-success"

      // Reload the bookmarks display
      loadBookmarks()
    } catch (error) {
      importStatus.textContent = "Error importing bookmarks: " + error.message
      importStatus.className = "import-status status-error"
    }
  })

  // Helper to read file content
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => resolve(event.target.result)
      reader.onerror = (error) => reject(error)
      reader.readAsText(file)
    })
  }

  // Initial load
  applyTheme();
  loadMostVisitedSites();
  loadBookmarks();
});