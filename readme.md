# Easy Bookmarks

A Chrome extension that displays your bookmarks as icons on the new tab page for quick and easy access.


## Features

- **Visual Bookmark Display**: See all your bookmarks as icons for quick access
- **Most Visited Sites**: Quick access to your frequently visited websites
- **Search Functionality**: Easily find bookmarks with the search feature
- **Dark/Light Theme**: Toggle between dark and light modes
- **Bookmark Management**:
  - Add new bookmarks directly from the extension
  - Edit existing bookmarks (URL and title)
  - Delete individual or multiple bookmarks
  - Import bookmarks from HTML files exported from other browsers
- **Context Menu**: Right-click on bookmarks for quick edit/delete options

## Installation

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension will be installed and active

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
- `storage`: To save your theme preference
- `topSites`: To display your most frequently visited websites

## Privacy

This extension:
- Does not collect any personal data
- Does not transmit any information to external servers
- Only accesses the bookmarks and top sites data available in your browser

## Development

### Project Structure
- `manifest.json`: Extension configuration
- `newtab.html`: Main HTML for the new tab page
- `style.css`: Styling for the extension
- `script.js`: Main JavaScript functionality
- `icons/`: Extension icons

## Support

If you encounter any issues or have suggestions for improvements, please:
1. Check the [issues page](https://github.com/tusar-003/easy-bookmarks/issues) to see if it's already reported
2. If not, create a new issue with detailed information about the problem


## Author

LinkedIn: [Tusar mondal](https://www.linkedin.com/in/tusarmondal/)