document.addEventListener("DOMContentLoaded", () => {
  const bookmarksContainer = document.getElementById("bookmarksContainer")
  const mostVisitedContainer = document.getElementById("mostVisitedContainer")
  const bookmarkGroupsContainer = document.getElementById("bookmarkGroupsContainer")
  const bookmarkGroupsSection = document.getElementById("bookmarkGroupsSection")
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
  const groupContextMenu = document.getElementById("groupContextMenu")
  const editGroupModal = document.getElementById("editGroupModal")
  const editGroupForm = document.getElementById("editGroupForm")

  let allBookmarks = []
  let bookmarkGroups = [] // Array to store groups: { id, name, bookmarkIds: [] }
  let displayItems = [] // Combined array of bookmarks and groups for rendering
  let mostVisitedSites = []
  let isSelectionMode = false
  let isEditMode = false
  const selectedBookmarks = new Set()
  let rightClickedBookmark = null
  let rightClickedMostVisited = null
  let rightClickedGroup = null
  let draggedElement = null
  let draggedBookmarkId = null
  let draggedGroupId = null
  let expandedGroup = null
  let dragOverTimeout = null

  // Load theme preference from storage and apply it
  function applyTheme() {
    chrome.storage.local.get(["theme"], (result) => {
      // Default to dark theme if no preference is set
      const isDark = result.theme !== 'light';
      document.body.classList.toggle("dark-theme", isDark);
      if (themeToggle) {
        // Toggle should be checked (right side) for dark mode
        themeToggle.checked = isDark;
      }
    });
  }

  // Theme toggle functionality
  // When checked (toggle on right/Dark side) = dark mode
  // When unchecked (toggle on left/Light side) = light mode
  themeToggle.addEventListener("change", () => {
    const isDark = themeToggle.checked;
    
    // Disable transitions on all elements during theme switch
    document.body.classList.add("theme-switching");
    
    // Use requestAnimationFrame to let the toggle animation start first
    requestAnimationFrame(() => {
      // Apply theme change after a short delay to let toggle animation complete
      setTimeout(() => {
        document.body.classList.toggle("dark-theme", isDark);
        chrome.storage.local.set({ theme: isDark ? "dark" : "light" });
        
        // Re-enable transitions after theme is applied
        requestAnimationFrame(() => {
          document.body.classList.remove("theme-switching");
        });
      }, 50);
    });
  });
  
  // Initialize theme immediately to sync toggle with body class
  // This ensures toggle position matches the actual theme on page load
  if (document.body.classList.contains("dark-theme")) {
    themeToggle.checked = true;
  }

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
      
      // Load groups
      await loadGroups()
      
      // Clean up groups - remove bookmarks that no longer exist
      cleanupGroups()

      // Render the bookmarks
      renderBookmarks(allBookmarks)
    })
  }
  
  // Clean up groups - remove references to deleted bookmarks
  function cleanupGroups() {
    const bookmarkIds = new Set(allBookmarks.map(b => b.id))
    let changed = false
    
    bookmarkGroups.forEach(group => {
      const validIds = group.bookmarkIds.filter(id => bookmarkIds.has(id))
      if (validIds.length !== group.bookmarkIds.length) {
        group.bookmarkIds = validIds
        changed = true
      }
    })
    
    // Remove groups with less than 2 bookmarks
    const originalLength = bookmarkGroups.length
    bookmarkGroups = bookmarkGroups.filter(g => g.bookmarkIds.length >= 2)
    if (bookmarkGroups.length !== originalLength) {
      changed = true
    }
    
    if (changed) {
      saveGroups()
    }
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

  // Get favicon URL using Chrome's internal favicon API
  // This uses the browser's local favicon cache - no external requests needed
  function getChromeFaviconUrl(url) {
    try {
      const encodedUrl = encodeURIComponent(url);
      return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodedUrl}&size=32`;
    } catch (e) {
      return null;
    }
  }

  // Get favicon URL using Google's favicon service as fallback
  function getGoogleFaviconUrl(url) {
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } catch (e) {
      return null;
    }
  }

  // Load favicon using Chrome's internal API with Google fallback
  function loadFaviconWithFallback(imgElement, url) {
    const chromeFaviconUrl = getChromeFaviconUrl(url);
    const googleFaviconUrl = getGoogleFaviconUrl(url);
    
    // Set up error handler for Chrome API - fallback to Google
    imgElement.onerror = () => {
      if (googleFaviconUrl) {
        // Try Google's favicon service as fallback
        imgElement.onerror = () => {
          imgElement.onerror = null; // Prevent infinite loop
          imgElement.src = "icons/default-favicon.svg";
        };
        imgElement.src = googleFaviconUrl;
      } else {
        imgElement.onerror = null;
        imgElement.src = "icons/default-favicon.svg";
      }
    };
    
    imgElement.src = chromeFaviconUrl || googleFaviconUrl || "icons/default-favicon.svg";
  }

  // Render bookmarks to the page
  function renderBookmarks(bookmarks) {
    // Check if we're filtering (bookmarks array is different from allBookmarks)
    const isFiltering = bookmarks !== allBookmarks && bookmarks.length !== allBookmarks.length
    
    if (isFiltering) {
      // When filtering, hide groups section and show only filtered bookmarks
      bookmarkGroupsSection.style.display = "none"
      
      if (bookmarks.length === 0) {
        bookmarksContainer.innerHTML = '<div class="loading">No bookmarks found</div>'
        return
      }
      
      bookmarksContainer.innerHTML = ""
      bookmarks.forEach((bookmark) => {
        renderBookmarkItem({ ...bookmark, type: 'bookmark' })
      })
    } else {
      // Render groups in their dedicated section
      renderGroups()
      
      // Get ungrouped bookmarks only
      const groupedBookmarkIds = new Set()
      bookmarkGroups.forEach(group => {
        group.bookmarkIds.forEach(id => groupedBookmarkIds.add(id))
      })
      const ungroupedBookmarks = allBookmarks.filter(b => !groupedBookmarkIds.has(b.id))
      
      if (ungroupedBookmarks.length === 0) {
        bookmarksContainer.innerHTML = '<div class="loading">No ungrouped bookmarks</div>'
        return
      }

      bookmarksContainer.innerHTML = ""

      ungroupedBookmarks.forEach((bookmark) => {
        renderBookmarkItem({ ...bookmark, type: 'bookmark' })
      })
    }
  }

  // Render groups in their dedicated section
  function renderGroups() {
    if (bookmarkGroups.length === 0) {
      bookmarkGroupsSection.style.display = "none"
      return
    }
    
    bookmarkGroupsSection.style.display = "block"
    bookmarkGroupsContainer.innerHTML = ""
    
    bookmarkGroups.forEach((group) => {
      renderGroup(group)
    })
  }

  // Build display items array combining groups and ungrouped bookmarks
  function buildDisplayItems() {
    // Get all bookmark IDs that are in groups
    const groupedBookmarkIds = new Set()
    bookmarkGroups.forEach(group => {
      group.bookmarkIds.forEach(id => groupedBookmarkIds.add(id))
    })
    
    // Get ungrouped bookmarks
    const ungroupedBookmarks = allBookmarks.filter(b => !groupedBookmarkIds.has(b.id))
    
    // Combine groups and ungrouped bookmarks
    const allItems = [
      ...bookmarkGroups.map(g => ({ ...g, type: 'group' })),
      ...ungroupedBookmarks.map(b => ({ ...b, type: 'bookmark' }))
    ]
    
    return allItems
  }

  // Render a single bookmark item
  function renderBookmarkItem(bookmark, container = bookmarksContainer) {
    const bookmarkElement = document.createElement("div")
    bookmarkElement.className = "bookmark-item"
    bookmarkElement.dataset.id = bookmark.id
    bookmarkElement.dataset.type = "bookmark"

    const favicon = document.createElement("img")
    favicon.className = "bookmark-icon"
    favicon.alt = bookmark.title
    favicon.src = "icons/default-favicon.svg"
    loadFaviconWithFallback(favicon, bookmark.url)

    const tooltip = document.createElement("div")
    tooltip.className = "bookmark-tooltip"
    tooltip.textContent = bookmark.title

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
      
      bookmarkElement.addEventListener('dragstart', (e) => handleDragStart(e, bookmark, 'bookmark'))
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
        e.preventDefault()
      } else {
        window.location.href = bookmark.url
      }
    })

    // Add context menu on right click
    bookmarkElement.addEventListener("contextmenu", (e) => {
      if (isEditMode) {
        e.preventDefault()
        return
      }
      e.preventDefault()
      rightClickedBookmark = bookmark
      rightClickedMostVisited = null
      rightClickedGroup = null

      contextMenu.style.left = `${e.pageX}px`
      contextMenu.style.top = `${e.pageY}px`
      contextMenu.classList.add("active")
      
      document.getElementById("contextMenuEdit").textContent = "Edit Bookmark"
      document.getElementById("contextMenuDelete").textContent = "Delete Bookmark"
      
      // Show "Remove from Group" option if bookmark is in a group
      const isInGroup = bookmarkGroups.some(g => g.bookmarkIds.includes(bookmark.id))
      document.getElementById("contextMenuRemoveFromGroup").style.display = isInGroup ? "block" : "none"
    })

    container.appendChild(bookmarkElement)
  }

  // Render a group
  function renderGroup(group) {
    const groupElement = document.createElement("div")
    groupElement.className = "bookmark-group"
    groupElement.dataset.id = group.id
    groupElement.dataset.type = "group"

    // Create group icon with preview of bookmarks
    const groupIcon = document.createElement("div")
    groupIcon.className = "bookmark-group-icon"
    
    // Get first 4 bookmarks in group for preview
    const previewBookmarks = group.bookmarkIds.slice(0, 4).map(id => 
      allBookmarks.find(b => b.id === id)
    ).filter(Boolean)
    
    previewBookmarks.forEach(bookmark => {
      const favicon = document.createElement("img")
      favicon.src = "icons/default-favicon.svg"
      loadFaviconWithFallback(favicon, bookmark.url)
      groupIcon.appendChild(favicon)
    })
    
    // Add count badge
    const countBadge = document.createElement("span")
    countBadge.className = "group-count"
    countBadge.textContent = group.bookmarkIds.length
    groupIcon.appendChild(countBadge)

    // Add visible group name label
    const groupName = document.createElement("div")
    groupName.className = "bookmark-group-name"
    groupName.textContent = group.name

    groupElement.appendChild(groupIcon)
    groupElement.appendChild(groupName)

    // Add drag and drop for edit mode
    if (isEditMode) {
      groupElement.setAttribute('draggable', 'true')
      
      groupElement.addEventListener('dragstart', (e) => handleDragStart(e, group, 'group'))
      groupElement.addEventListener('dragend', handleDragEnd)
      groupElement.addEventListener('dragover', handleDragOver)
      groupElement.addEventListener('dragleave', handleDragLeave)
      groupElement.addEventListener('drop', handleDrop)
    }

    // Click to expand group
    groupElement.addEventListener("click", (e) => {
      if (isEditMode) {
        e.preventDefault()
        return
      }
      expandGroup(group)
    })

    // Context menu for group
    groupElement.addEventListener("contextmenu", (e) => {
      if (isEditMode) {
        e.preventDefault()
        return
      }
      e.preventDefault()
      rightClickedGroup = group
      rightClickedBookmark = null
      rightClickedMostVisited = null

      groupContextMenu.style.left = `${e.pageX}px`
      groupContextMenu.style.top = `${e.pageY}px`
      groupContextMenu.classList.add("active")
    })

    bookmarkGroupsContainer.appendChild(groupElement)
  }

  // Expand a group to show its bookmarks
  function expandGroup(group) {
    expandedGroup = group
    
    const overlay = document.createElement("div")
    overlay.className = "group-overlay"
    overlay.id = "groupOverlay"
    
    const expanded = document.createElement("div")
    expanded.className = "group-expanded"
    
    const header = document.createElement("div")
    header.className = "group-expanded-header"
    
    const title = document.createElement("span")
    title.className = "group-expanded-title"
    title.textContent = group.name
    title.addEventListener("click", () => {
      openEditGroupModal(group)
    })
    
    const closeBtn = document.createElement("span")
    closeBtn.className = "group-expanded-close"
    closeBtn.innerHTML = "&times;"
    closeBtn.addEventListener("click", closeGroupOverlay)
    
    header.appendChild(title)
    header.appendChild(closeBtn)
    
    const content = document.createElement("div")
    content.className = "group-expanded-content"
    
    // Render bookmarks in group
    group.bookmarkIds.forEach(bookmarkId => {
      const bookmark = allBookmarks.find(b => b.id === bookmarkId)
      if (bookmark) {
        renderBookmarkItem(bookmark, content)
      }
    })
    
    expanded.appendChild(header)
    expanded.appendChild(content)
    overlay.appendChild(expanded)
    
    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeGroupOverlay()
      }
    })
    
    document.body.appendChild(overlay)
  }

  // Close group overlay
  function closeGroupOverlay() {
    const overlay = document.getElementById("groupOverlay")
    if (overlay) {
      overlay.remove()
    }
    expandedGroup = null
  }

  // Open edit group modal
  function openEditGroupModal(group) {
    document.getElementById("editGroupName").value = group.name
    document.getElementById("editGroupId").value = group.id
    openModal(editGroupModal)
  }

  // Create a new group from two bookmarks
  function createGroup(bookmark1Id, bookmark2Id) {
    const groupId = `group-${Date.now()}`
    const newGroup = {
      id: groupId,
      name: "New Group",
      bookmarkIds: [bookmark1Id, bookmark2Id]
    }
    
    bookmarkGroups.push(newGroup)
    saveGroups()
    renderBookmarks(allBookmarks)
    
    // Open rename modal for the new group
    setTimeout(() => {
      openEditGroupModal(newGroup)
    }, 100)
  }

  // Add bookmark to existing group
  function addToGroup(groupId, bookmarkId) {
    const group = bookmarkGroups.find(g => g.id === groupId)
    if (group && !group.bookmarkIds.includes(bookmarkId)) {
      group.bookmarkIds.push(bookmarkId)
      saveGroups()
      renderBookmarks(allBookmarks)
    }
  }

  // Remove bookmark from group
  function removeFromGroup(bookmarkId) {
    bookmarkGroups.forEach(group => {
      const index = group.bookmarkIds.indexOf(bookmarkId)
      if (index !== -1) {
        group.bookmarkIds.splice(index, 1)
      }
    })
    
    // Remove groups with less than 2 bookmarks (auto-ungroup single items)
    bookmarkGroups = bookmarkGroups.filter(g => g.bookmarkIds.length >= 2)
    
    saveGroups()
    renderBookmarks(allBookmarks)
  }

  // Ungroup - move all bookmarks out of group
  function ungroupBookmarks(groupId) {
    bookmarkGroups = bookmarkGroups.filter(g => g.id !== groupId)
    saveGroups()
    renderBookmarks(allBookmarks)
  }

  // Delete group and optionally its bookmarks
  function deleteGroup(groupId, deleteBookmarks = false) {
    const group = bookmarkGroups.find(g => g.id === groupId)
    if (!group) return
    
    if (deleteBookmarks) {
      // Delete all bookmarks in the group
      group.bookmarkIds.forEach(bookmarkId => {
        chrome.bookmarks.remove(bookmarkId, () => {
          if (chrome.runtime.lastError) {
            console.error("Error deleting bookmark:", chrome.runtime.lastError)
          }
        })
        allBookmarks = allBookmarks.filter(b => b.id !== bookmarkId)
      })
    }
    
    bookmarkGroups = bookmarkGroups.filter(g => g.id !== groupId)
    saveGroups()
    renderBookmarks(allBookmarks)
  }

  // Save groups to storage
  function saveGroups() {
    chrome.storage.local.set({ bookmarkGroups: bookmarkGroups })
  }

  // Load groups from storage
  function loadGroups() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["bookmarkGroups", "groupOrder"], (result) => {
        bookmarkGroups = result.bookmarkGroups || []
        
        // Apply saved group order if available
        if (result.groupOrder && result.groupOrder.length > 0) {
          const orderMap = new Map()
          result.groupOrder.forEach((id, index) => {
            orderMap.set(id, index)
          })
          
          bookmarkGroups.sort((a, b) => {
            const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : Infinity
            const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : Infinity
            return orderA - orderB
          })
        }
        
        resolve()
      })
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
    bookmarkGroupsContainer.classList.add("edit-mode-active")
    
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
    bookmarkGroupsContainer.classList.remove("edit-mode-active")
    
    // Update button visibility
    editModeBtn.style.display = "block"
    doneEditingBtn.style.display = "none"
    deleteBookmarksBtn.style.display = "block"
    addBookmarkBtn.style.display = "block"
    importBookmarksBtn.style.display = "block"
    
    // Save the new order
    saveBookmarkOrder()
    saveGroupOrder()
    
    // Re-render bookmarks without drag handlers
    renderBookmarks(allBookmarks)
  }

  // Save bookmark order to storage
  function saveBookmarkOrder() {
    const bookmarkOrder = allBookmarks.map(b => b.id)
    chrome.storage.local.set({ bookmarkOrder: bookmarkOrder })
  }

  // Save group order to storage
  function saveGroupOrder() {
    const groupOrder = bookmarkGroups.map(g => g.id)
    chrome.storage.local.set({ groupOrder: groupOrder })
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
  let dropAction = 'reorder' // 'reorder' or 'group'
  
  function handleDragStart(e, item, type = 'bookmark') {
    if (!isEditMode) return
    
    draggedElement = e.target.closest('.bookmark-item, .bookmark-group')
    if (type === 'bookmark') {
      draggedBookmarkId = item.id
      draggedGroupId = null
    } else {
      draggedGroupId = item.id
      draggedBookmarkId = null
    }
    
    // Small delay to allow the drag image to be captured before adding dragging class
    setTimeout(() => {
      if (draggedElement) {
        draggedElement.classList.add('dragging')
      }
    }, 0)
    
    // Set drag data
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
    e.dataTransfer.setData('itemType', type)
    
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
    document.querySelectorAll('.bookmark-item, .bookmark-group').forEach(item => {
      item.classList.remove('drag-over-left', 'drag-over-right', 'drag-over-center')
    })
    
    // Clear timeout
    if (dragOverTimeout) {
      clearTimeout(dragOverTimeout)
      dragOverTimeout = null
    }
    
    draggedElement = null
    draggedBookmarkId = null
    draggedGroupId = null
    dropAction = 'reorder'
  }

  function handleDragOver(e) {
    if (!isEditMode) return
    
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const targetElement = e.target.closest('.bookmark-item, .bookmark-group')
    if (!targetElement || targetElement === draggedElement) return
    
    const targetType = targetElement.dataset.type
    const targetId = targetElement.dataset.id
    
    // Calculate mouse position relative to target element
    const rect = targetElement.getBoundingClientRect()
    const mouseX = e.clientX
    const mouseY = e.clientY
    const elementCenterX = rect.left + rect.width / 2
    const elementCenterY = rect.top + rect.height / 2
    
    // Calculate distance from center
    const distanceFromCenterX = Math.abs(mouseX - elementCenterX)
    const distanceFromCenterY = Math.abs(mouseY - elementCenterY)
    const isNearCenter = distanceFromCenterX < rect.width * 0.25 && distanceFromCenterY < rect.height * 0.25
    
    // Remove all indicators from all items first
    document.querySelectorAll('.bookmark-item, .bookmark-group').forEach(item => {
      item.classList.remove('drag-over-left', 'drag-over-right', 'drag-over-center')
    })
    
    // If dragging a bookmark near center of another bookmark, show group indicator
    if (draggedBookmarkId && targetType === 'bookmark' && isNearCenter) {
      targetElement.classList.add('drag-over-center')
      dropAction = 'group'
      dropPosition = 'center'
    }
    // If dragging a bookmark onto a group, add to group
    else if (draggedBookmarkId && targetType === 'group' && isNearCenter) {
      targetElement.classList.add('drag-over-center')
      dropAction = 'addToGroup'
      dropPosition = 'center'
    }
    // Otherwise, show reorder indicator
    else {
      dropAction = 'reorder'
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
    
    const targetElement = e.target.closest('.bookmark-item, .bookmark-group')
    if (targetElement) {
      const relatedTarget = e.relatedTarget
      if (!targetElement.contains(relatedTarget)) {
        targetElement.classList.remove('drag-over-left', 'drag-over-right', 'drag-over-center')
      }
    }
  }

  function handleDrop(e) {
    if (!isEditMode) return
    
    e.preventDefault()
    
    const targetElement = e.target.closest('.bookmark-item, .bookmark-group')
    if (!targetElement || targetElement === draggedElement) {
      return
    }
    
    const targetType = targetElement.dataset.type
    const targetId = targetElement.dataset.id
    
    // Handle different drop actions
    if (dropAction === 'group' && draggedBookmarkId && targetType === 'bookmark') {
      // Create a new group from two bookmarks
      createGroup(targetId, draggedBookmarkId)
    }
    else if (dropAction === 'addToGroup' && draggedBookmarkId && targetType === 'group') {
      // Add bookmark to existing group
      // First remove from any existing group
      removeFromGroup(draggedBookmarkId)
      addToGroup(targetId, draggedBookmarkId)
    }
    else if (dropAction === 'reorder') {
      // Reorder items
      handleReorder(targetId, targetType)
    }
    
    // Remove drag indicator classes
    targetElement.classList.remove('drag-over-left', 'drag-over-right', 'drag-over-center')
    
    dropAction = 'reorder'
  }

  // Handle reordering of items
  function handleReorder(targetId, targetType) {
    // If dragging a group onto another group, reorder groups
    if (draggedGroupId && targetType === 'group') {
      // Build the group order from DOM
      const groupOrder = []
      bookmarkGroupsContainer.querySelectorAll('.bookmark-group').forEach(el => {
        groupOrder.push(el.dataset.id)
      })
      
      const draggedIndex = groupOrder.indexOf(draggedGroupId)
      let targetIndex = groupOrder.indexOf(targetId)
      
      if (draggedIndex === -1 || targetIndex === -1) return
      
      // Remove dragged item
      groupOrder.splice(draggedIndex, 1)
      
      // Recalculate target index
      targetIndex = groupOrder.indexOf(targetId)
      
      // Insert at new position
      if (dropPosition === 'after') {
        groupOrder.splice(targetIndex + 1, 0, draggedGroupId)
      } else {
        groupOrder.splice(targetIndex, 0, draggedGroupId)
      }
      
      // Reorder bookmarkGroups array based on new order
      const newBookmarkGroups = []
      groupOrder.forEach(id => {
        const group = bookmarkGroups.find(g => g.id === id)
        if (group) newBookmarkGroups.push(group)
      })
      bookmarkGroups = newBookmarkGroups
      
      // Save and re-render
      saveGroups()
      renderGroups()
      return
    }
    
    // Handle bookmark reordering
    if (draggedBookmarkId && targetType === 'bookmark') {
      // Build the bookmark order from DOM
      const bookmarkOrder = []
      bookmarksContainer.querySelectorAll('.bookmark-item').forEach(el => {
        bookmarkOrder.push(el.dataset.id)
      })
      
      const draggedIndex = bookmarkOrder.indexOf(draggedBookmarkId)
      let targetIndex = bookmarkOrder.indexOf(targetId)
      
      if (draggedIndex === -1 || targetIndex === -1) return
      
      // Remove dragged item
      bookmarkOrder.splice(draggedIndex, 1)
      
      // Recalculate target index
      targetIndex = bookmarkOrder.indexOf(targetId)
      
      // Insert at new position
      if (dropPosition === 'after') {
        bookmarkOrder.splice(targetIndex + 1, 0, draggedBookmarkId)
      } else {
        bookmarkOrder.splice(targetIndex, 0, draggedBookmarkId)
      }
      
      // Reorder allBookmarks array based on new order for ungrouped bookmarks
      const groupedBookmarkIds = new Set()
      bookmarkGroups.forEach(group => {
        group.bookmarkIds.forEach(id => groupedBookmarkIds.add(id))
      })
      
      const ungroupedBookmarks = []
      bookmarkOrder.forEach(id => {
        const bookmark = allBookmarks.find(b => b.id === id)
        if (bookmark) ungroupedBookmarks.push(bookmark)
      })
      
      // Rebuild allBookmarks: grouped bookmarks first (in their original order), then ungrouped in new order
      const groupedBookmarks = allBookmarks.filter(b => groupedBookmarkIds.has(b.id))
      allBookmarks = [...groupedBookmarks, ...ungroupedBookmarks]
      
      // Save and re-render
      saveBookmarkOrder()
      renderBookmarks(allBookmarks)
    }
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
      
      // Remove from any groups
      bookmarkGroups.forEach(group => {
        const index = group.bookmarkIds.indexOf(bookmarkId)
        if (index !== -1) {
          group.bookmarkIds.splice(index, 1)
        }
      })
      
      // Remove empty groups
      bookmarkGroups = bookmarkGroups.filter(g => g.bookmarkIds.length > 0)
      saveGroups()
      
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

  // Context menu remove from group option
  document.getElementById("contextMenuRemoveFromGroup").addEventListener("click", () => {
    if (rightClickedBookmark) {
      removeFromGroup(rightClickedBookmark.id)
    }
    contextMenu.classList.remove("active")
  })

  // Group context menu - rename
  document.getElementById("groupContextMenuRename").addEventListener("click", () => {
    if (rightClickedGroup) {
      openEditGroupModal(rightClickedGroup)
    }
    groupContextMenu.classList.remove("active")
  })

  // Group context menu - ungroup
  document.getElementById("groupContextMenuUngroup").addEventListener("click", () => {
    if (rightClickedGroup) {
      const confirmUngroup = confirm(`Are you sure you want to ungroup "${rightClickedGroup.name}"? The bookmarks will be kept.`)
      if (confirmUngroup) {
        ungroupBookmarks(rightClickedGroup.id)
      }
    }
    groupContextMenu.classList.remove("active")
  })

  // Group context menu - delete
  document.getElementById("groupContextMenuDelete").addEventListener("click", () => {
    if (rightClickedGroup) {
      const deleteOption = confirm(`Delete group "${rightClickedGroup.name}"?\n\nClick OK to delete the group AND its bookmarks.\nClick Cancel to keep the bookmarks.`)
      if (deleteOption) {
        deleteGroup(rightClickedGroup.id, true) // Delete group and bookmarks
      } else {
        ungroupBookmarks(rightClickedGroup.id) // Just ungroup
      }
    }
    groupContextMenu.classList.remove("active")
  })

  // Edit group form submission
  editGroupForm.addEventListener("submit", (e) => {
    e.preventDefault()
    
    const groupId = document.getElementById("editGroupId").value
    const newName = document.getElementById("editGroupName").value.trim()
    
    if (newName) {
      const group = bookmarkGroups.find(g => g.id === groupId)
      if (group) {
        group.name = newName
        saveGroups()
        renderBookmarks(allBookmarks)
        
        // Update expanded group title if open
        const expandedTitle = document.querySelector(".group-expanded-title")
        if (expandedTitle && expandedGroup && expandedGroup.id === groupId) {
          expandedTitle.textContent = newName
        }
      }
    }
    
    closeModal(editGroupModal)
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
      closeModal(editGroupModal)
      
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
    if (event.target === editGroupModal) {
      closeModal(editGroupModal)
    }

    // Hide context menus when clicking elsewhere
    if (!event.target.closest("#contextMenu")) {
      contextMenu.classList.remove("active")
    }
    if (!event.target.closest("#groupContextMenu")) {
      groupContextMenu.classList.remove("active")
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