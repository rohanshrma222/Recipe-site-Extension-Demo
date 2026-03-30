# Smart Kitchen Assistant Demo

Chrome extension demo for Canada's Food Guide recipe pages. When you open a matching recipe URL, the extension extracts the ingredient list from the page, searches Open Food Facts Canada for related products, and shows the results in an isolated right-side panel.

## What It Does

- Detects Canada Food Guide recipe pages matching `https://food-guide.canada.ca/en/recipes/*`
- Extracts ingredient text from ingredient list `<li>` elements in the page DOM
- Normalizes ingredient names before search
- Queries the Open Food Facts search API for Canadian products
- Displays up to 3 matching products per ingredient
- Shows Nutri-Score and NOVA badges for each product
- Opens product details on Open Food Facts Canada in a new tab
- Uses Shadow DOM so panel styles do not interfere with the host page

## File Structure

- [manifest.json](E:/recipe-demo-extension/manifest.json) - Manifest V3 config
- [content.js](E:/recipe-demo-extension/content.js) - DOM scraping, API fetches, rendering, toggle behavior
- [styles.css](E:/recipe-demo-extension/styles.css) - Panel UI styles loaded inside Shadow DOM
- [icons/icon.png](E:/recipe-demo-extension/icons/icon.png) - Extension icon

## Load In Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder: [E:/recipe-demo-extension](E:/recipe-demo-extension)
5. Visit `https://food-guide.canada.ca/en/recipes/mushroom-soup/`

## How It Works

1. The content script runs on matching Canada Food Guide recipe URLs.
2. It scans the page for ingredient list items using ingredient-related selectors.
3. Each ingredient string is normalized by:
   - removing leading quantities
   - removing common units
   - removing parenthetical notes
   - removing text after commas
   - trimming and lowercasing the result
4. The extension fetches Open Food Facts Canada search results in parallel.
5. It injects a fixed slide-in panel using a Shadow DOM root attached to `#off-smart-kitchen`.

## API Used

Open Food Facts search endpoint:

```text
https://world.openfoodfacts.org/cgi/search.pl?search_terms={INGREDIENT}&tagtype_0=countries&tag_contains_0=contains&tag_0=canada&action=process&json=1&page_size=3
```

Product detail links use:

```text
https://ca.openfoodfacts.org/product/{barcode}/
```

## Notes

- No build tools, npm, or bundler are required.
- This is a pure vanilla JS/HTML/CSS extension intended to be loaded unpacked.
- The panel is non-destructive and does not modify the host page layout.
- If no products are found for an ingredient, the panel shows `No products found`.

## Permissions

- `host_permissions` for `https://world.openfoodfacts.org/*`
- content script match for `*://food-guide.canada.ca/en/recipes/*`

## Demo Behavior

- The panel is visible by default on matching pages.
- Each ingredient section starts collapsed.
- The right-edge tab toggles the panel open and closed.
