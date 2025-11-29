# Easy Bookmarks

A browser extension that displays your bookmarks as icons on the new tab page for quick and easy access. Available for both **Chrome/Chromium-based browsers** and **Firefox**.

## Supported Browsers

- **Chrome** (and Chromium-based browsers like Edge, Brave, Opera, Vivaldi)
- **Firefox** (and Firefox-based browsers)

## Features

- **Visual Bookmark Display**: See all your bookmarks as icons for quick access
- **Most Visited Sites**: Quick access to your frequently visited websites with editable names
- **Bookmark Groups**: Organize bookmarks into groups with custom names
  - Drag bookmarks onto each other to create groups
  - Groups display with a 4-icon preview and bookmark count
  - Dedicated "Bookmark Groups" section with visible group names
  - Click to expand and view all bookmarks in a group
- **Search Functionality**: Easily find bookmarks with the search feature
- **Dark/Light Theme**: Toggle between dark and light modes
- **Drag & Drop Reordering**: 
  - Enter Edit mode to rearrange bookmarks and groups
  - Reorder individual bookmarks within the All Bookmarks section
  - Reorder groups within the Bookmark Groups section
- **Bookmark Management**:
  - Add new bookmarks directly from the extension
  - Edit existing bookmarks (URL and title)
  - Delete individual or multiple bookmarks
  - Import bookmarks from HTML files exported from other browsers
- **Context Menu**: Right-click on bookmarks, groups, or most visited sites for quick actions

## Installation

### Chrome / Chromium-based Browsers (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the **`Chrome`** folder
5. The extension will be installed and active

### Firefox (Developer Mode)
1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Navigate to the **`Firefox`** folder and select the `manifest.json` file
5. The extension will be installed (note: temporary add-ons are removed when Firefox closes)

### Firefox (Permanent Installation)
To install permanently in Firefox:
1. Package the Firefox folder contents into a `.zip` file
2. Rename the `.zip` to `.xpi`
3. Go to `about:addons` and drag the `.xpi` file into Firefox
4. Or submit to [Firefox Add-ons](https://addons.mozilla.org/) for official distribution

## Usage

### Accessing Your Bookmarks
- Open a new tab in Chrome to see your bookmarks displayed as icons
- Click on any bookmark to navigate to that website

### Adding Bookmarks
1. Click the "Add Bookmark" button in the header
2. Enter the URL and an optional title
3. Click "Add Bookmark" to save

### Searching Bookmarks
- Use the search box to filter bookmarks by title or URL
- Search results show matching bookmarks across all groups

### Creating Bookmark Groups
1. Click the "Edit" button to enter edit mode
2. Drag one bookmark onto another bookmark to create a group
3. A modal will appear to name your new group
4. Click "Save" to create the group

### Managing Groups
- **Expand Group**: Click on a group to see all bookmarks inside
- **Rename Group**: Right-click on a group and select "Rename Group", or click the group name when expanded
- **Ungroup**: Right-click on a group and select "Ungroup" to dissolve the group (keeps bookmarks)
- **Delete Group**: Right-click and select "Delete Group" to remove the group and optionally its bookmarks
- **Remove from Group**: Right-click a bookmark inside a group and select "Remove from Group"

### Reordering Bookmarks and Groups
1. Click the "Edit" button to enter edit mode
2. Drag and drop bookmarks to reorder them
3. Drag and drop groups to reorder them in the Bookmark Groups section
4. Click "Done" to save the new arrangement

### Editing Bookmarks
1. Right-click on a bookmark
2. Select "Edit Bookmark" from the context menu
3. Modify the URL or title
4. Click "Save Changes"

### Deleting Bookmarks
#### Delete a Single Bookmark
1. Right-click on a bookmark
2. Select "Delete Bookmark" from the context menu
3. Confirm deletion

#### Delete Multiple Bookmarks
1. Click the "Delete Bookmarks" button
2. Select the bookmarks you want to delete by clicking on them
3. Click "Delete Selected" to remove them
4. Confirm deletion

### Importing Bookmarks
1. Click the "Import Bookmarks" button
2. Select an HTML bookmarks file exported from another browser
3. Click "Import" to add the bookmarks to your collection

### Changing Theme
- Use the toggle switch in the top right to switch between light and dark themes

## Permissions

The extension requires the following permissions:
- `bookmarks`: To access and manage your Chrome bookmarks
- `storage`: To save your theme preference, bookmark groups, and custom arrangements
- `topSites`: To display your most frequently visited websites
- `history`: To allow removal of sites from the Most Visited section
- `favicon`: To display website favicons for bookmarks

## Privacy

This extension:
- Does not collect any personal data
- Does not transmit any information to external servers
- Only accesses the bookmarks and top sites data available in your browser

## Development

### Project Structure
```
Easy Bookmark/
├── Chrome/                 # Chrome/Chromium version
│   ├── manifest.json       # Chrome Manifest V3
│   ├── newtab.html
│   ├── style.css
│   ├── script.js
│   ├── background.js
│   └── icons/
│
├── Firefox/                # Firefox version
│   ├── manifest.json       # Firefox Manifest V2 with gecko settings
│   ├── newtab.html
│   ├── style.css
│   ├── script.js           # Uses browser API instead of chrome API
│   ├── background.js
│   └── icons/
│
└── README.md
```

### Key Differences Between Versions

| Feature | Chrome | Firefox |
|---------|--------|---------|
| Manifest Version | V3 | V2 |
| API Namespace | `chrome.*` | `browser.*` |
| Background Script | Service Worker | Background Script |
| Favicon API | Chrome internal `_favicon` | External services only |
| Permissions | Includes `favicon` | No `favicon` permission |

### Key Components
- **Most Visited Section**: Displays top 12 frequently visited sites
- **Bookmark Groups Section**: Dedicated section for organized bookmark groups
- **All Bookmarks Section**: Grid display of ungrouped bookmarks
- **Modals**: For adding/editing bookmarks and groups
- **Context Menus**: Right-click menus for bookmarks, groups, and most visited sites

## Author

LinkedIn: [Tusar mondal](https://www.linkedin.com/in/tusarmondal/)