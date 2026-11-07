# PDF.js

Vendored from the official Mozilla PDF.js **v6.5.438** modern-browser distribution:

https://github.com/mozilla/pdf.js/releases/tag/v6.5.438

Upstream download: `pdfjs-6.5.438-dist.zip`.

The upstream Apache 2.0 license and notices are retained in `LICENSE` and the distributed files. Source maps and the upstream demonstration PDF are omitted.

Local changes: `web/viewer.html` loads `site-theme.css` for this site's colors and uses a Chinese document title. `web/site-theme.css` is the site's reader skin. All PDF.js JavaScript is unchanged.

The same-origin wrapper at `puremvc/books/reader.html` selects one of the four library PDFs, sets the interface language to Simplified Chinese, opens external links in a separate tab, and disables PDF scripting and annotation editing. Rendering uses local scripts, fonts, CMaps, and WebAssembly resources; it does not depend on a CDN.

When upgrading, replace the distribution files, retain the license, reapply the HTML stylesheet link and title, and verify all four books, Chinese text search, PDF bookmarks, downloads, and the GitHub Pages subdirectory paths.
