import { books } from "./catalog.js";

const params = new URLSearchParams(location.search);
const bookId = params.get("book") || books[0].id;
const index = books.findIndex(book => book.id === bookId);
const select = document.querySelector("#book-select");
const frame = document.querySelector("#pdf-viewer");

for (const book of books) {
  const option = document.createElement("option");
  option.value = book.id;
  option.textContent = book.title;
  select.append(option);
}
select.addEventListener("change", () => {
  location.href = `reader.html?book=${encodeURIComponent(select.value)}`;
});

if (index < 0) {
  select.selectedIndex = -1;
  document.querySelector("#invalid-book").hidden = false;
  document.querySelector(".reader-toolbar").hidden = true;
  document.title = "书籍链接无效 · PureMVC";
} else {
  const book = books[index];
  select.value = book.id;
  document.title = `${book.title} · PureMVC PDF 在线阅读`;
  document.querySelector("#book-title").textContent = book.title;
  document.querySelector("#book-meta").textContent = `第 ${index + 1} / ${books.length} 册 · ${book.pages} 页 · ${book.size} · PDF 原版排版`;
  const pdfUrl = new URL(`files/${book.file}`, location.href);
  for (const id of ["original-link", "download-link", "fallback-link"]) {
    const link = document.getElementById(id);
    link.href = pdfUrl.href;
    link.hidden = false;
  }
  document.querySelector("#download-link").download = book.file;
  for (const [id, offset, label] of [["previous-book", -1, "← 上一本"], ["next-book", 1, "下一本 →"]]) {
    const other = books[index + offset];
    if (!other) continue;
    const link = document.getElementById(id);
    link.href = `reader.html?book=${encodeURIComponent(other.id)}`;
    link.title = other.title;
    link.setAttribute("aria-label", `${label}：${other.title}`);
    link.hidden = false;
  }

  // Configure the same-origin PDF.js viewer before it opens the document.
  document.addEventListener("webviewerloaded", event => {
    if (event.detail?.source !== frame.contentWindow) return;
    const viewerWindow = event.detail.source;
    viewerWindow.PDFViewerApplicationOptions.setAll({
      disablePreferences: true,
      localeProperties: { lang: "zh-CN" },
      defaultZoomValue: "page-width",
      disablePageLabels: true,
      sidebarViewOnLoad: 0,
      enableScripting: false,
      annotationEditorMode: -1,
      externalLinkTarget: 2,
    });
    viewerWindow.PDFViewerApplication.initializedPromise.then(() => {
      viewerWindow.PDFViewerApplication.eventBus.on("documenterror", () => {
        document.querySelector("#reader-error").hidden = false;
      });
    });
  });

  const viewerUrl = new URL("../../assets/pdfjs/web/viewer.html", location.href);
  viewerUrl.searchParams.set("file", pdfUrl.href);
  // PDF.js keeps view history per document. A supplied hash supports shareable pages.
  viewerUrl.hash = location.hash;
  frame.title = `${book.title} PDF 阅读器`;
  frame.src = viewerUrl.href;
  frame.hidden = false;
  frame.addEventListener("error", () => {
    document.querySelector("#reader-error").hidden = false;
  });
}
