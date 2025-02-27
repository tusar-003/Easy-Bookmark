document.addEventListener("DOMContentLoaded", () => {
  const bookmarksContainer = document.getElementById("bookmarksContainer")
  const mostVisitedContainer = document.getElementById("mostVisitedContainer")
  const searchInput = document.getElementById("searchInput")
  const themeToggle = document.getElementById("themeToggle")
  const addBookmarkBtn = document.getElementById("addBookmarkBtn")
  const deleteBookmarksBtn = document.getElementById("deleteBookmarksBtn")
  const importBookmarksBtn = document.getElementById("importBookmarksBtn")
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

  let allBookmarks = []
  let isSelectionMode = false
  const selectedBookmarks = new Set()
  let rightClickedBookmark = null

  // Load theme preference from storage and apply it immediately
  function loadAndApplyTheme() {
    chrome.storage.local.get(["theme"], (result) => {
      const isDark = result.theme === "dark"
      document.body.classList.toggle("dark-theme", isDark)
      if (themeToggle) {
        themeToggle.checked = !isDark
      }
    })
  }

  // Theme toggle functionality
  themeToggle.addEventListener("change", () => {
    const isDark = !themeToggle.checked
    document.body.classList.toggle("dark-theme", isDark)
    chrome.storage.local.set({ theme: isDark ? "dark" : "light" })
  })

  // Load most visited sites
  function loadMostVisitedSites() {
    chrome.topSites.get((sites) => {
      mostVisitedContainer.innerHTML = ""

      // Limit to 12 sites
      const topSites = sites.slice(0, 12)

      if (topSites.length === 0) {
        mostVisitedContainer.innerHTML = '<div class="loading-small">No frequently visited sites yet</div>'
        return
      }

      topSites.forEach((site) => {
        const siteElement = document.createElement("div")
        siteElement.className = "most-visited-item"

        const favicon = document.createElement("img")
        favicon.className = "most-visited-icon"
        favicon.src = getFaviconUrl(site.url)
        favicon.alt = site.title
        favicon.onerror = () => {
          favicon.src = "icons/default-favicon.png"
        }

        // Create tooltip with title
        const tooltip = document.createElement("div")
        tooltip.className = "bookmark-tooltip"
        tooltip.textContent = site.title || extractDomain(site.url)

        siteElement.appendChild(favicon)
        siteElement.appendChild(tooltip)

        siteElement.addEventListener("click", () => {
          window.location.href = site.url
        })

        mostVisitedContainer.appendChild(siteElement)
      })
    })
  }

  // Load all bookmarks
  function loadBookmarks() {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      bookmarksContainer.innerHTML = ""
      allBookmarks = []
      selectedBookmarks.clear()

      // Process all bookmark nodes
      processBookmarkNodes(bookmarkTreeNodes[0].children)

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

  // Get favicon for a URL
  function getFaviconUrl(url) {
    try {
      const domain = new URL(url).origin
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    } catch (e) {
      return "icons/default-favicon.png"
    }
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
      favicon.src = getFaviconUrl(bookmark.url)
      favicon.alt = bookmark.title
      favicon.onerror = () => {
        favicon.src = "icons/default-favicon.png"
      }

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

      // Handle click event based on mode
      bookmarkElement.addEventListener("click", (e) => {
        if (isSelectionMode) {
          e.preventDefault()
          toggleBookmarkSelection(bookmark.id, bookmarkElement)
        } else {
          window.location.href = bookmark.url
        }
      })

      // Add context menu on right click
      bookmarkElement.addEventListener("contextmenu", (e) => {
        e.preventDefault()
        rightClickedBookmark = bookmark

        // Position and show context menu
        contextMenu.style.left = `${e.pageX}px`
        contextMenu.style.top = `${e.pageY}px`
        contextMenu.classList.add("active")
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

  // Context menu edit option
  document.getElementById("contextMenuEdit").addEventListener("click", () => {
    if (rightClickedBookmark) {
      // Populate edit form with current bookmark data
      document.getElementById("editBookmarkUrl").value = rightClickedBookmark.url
      document.getElementById("editBookmarkTitle").value = rightClickedBookmark.title
      document.getElementById("editBookmarkId").value = rightClickedBookmark.id

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
    }
    contextMenu.classList.remove("active")
  })

  // Process edit bookmark form submission
  editBookmarkForm.addEventListener("submit", (e) => {
    e.preventDefault()

    const bookmarkId = document.getElementById("editBookmarkId").value
    const newUrl = document.getElementById("editBookmarkUrl").value
    const newTitle = document.getElementById("editBookmarkTitle").value

    // Update the bookmark
    editBookmark(bookmarkId, newTitle, newUrl)

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
    })
  })

  // Close modals when clicking outside the modal content
  window.addEventListener("click", (event) => {
    if (event.target === addBookmarkModal) {
      closeModal(addBookmarkModal)
    }
    if (event.target === editBookmarkModal) {
      closeModal(editBookmarkModal)
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
  loadMostVisitedSites()
  loadBookmarks()
})

// Apply theme immediately before the DOM is fully loaded
function loadAndApplyTheme() {
  chrome.storage.local.get(["theme"], (result) => {
    const isDark = result.theme === "dark"
    document.body.classList.toggle("dark-theme", isDark)
    const themeToggle = document.getElementById("themeToggle")
    if (themeToggle) {
      themeToggle.checked = !isDark
    }
  })
}

// Call this function immediately when the script runs
loadAndApplyTheme()

