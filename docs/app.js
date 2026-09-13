"use strict";

const PDF_WORKER_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

const chapterPattern =
    /^\s*(?:chapter|chap\.?)\s+([0-9]+|[ivxlcdm]+)\b[.: -]*(.*)/i;

const endMatterPattern =
    /^\s*(appendix|appendixes|appendices|index|glossary|references|bibliography)\b/i;

const pdfInput = document.getElementById("pdf-input");
const dropZone = document.getElementById("drop-zone");
const fileNameDisplay = document.getElementById("file-name");
const fileDetails = document.getElementById("file-details");

const selectedFileName = document.getElementById(
    "selected-file-name"
);

const fileSize = document.getElementById("file-size");
const splitButton = document.getElementById("split-button");
const progressArea = document.getElementById("progress-area");
const progressBar = document.getElementById("progress-bar");
const progressValue = document.getElementById("progress-value");
const statusText = document.getElementById("status-text");
const message = document.getElementById("message");
const terminalLog = document.getElementById("terminal-log");
const resultsPanel = document.getElementById("results-panel");
const chapterCount = document.getElementById("chapter-count");
const chapterList = document.getElementById("chapter-list");

const downloadButton = document.getElementById(
    "download-button"
);

let currentFile = null;
let sourcePdfBytes = null;
let detectedChapters = [];
let finalChapterEnd = null;
let previousScrollPosition = window.scrollY;


function formatBytes(bytes) {
    if (bytes === 0) {
        return "0 B";
    }

    const units = ["B", "KB", "MB", "GB"];

    const unitIndex = Math.floor(
        Math.log(bytes) / Math.log(1024)
    );

    const value = bytes / Math.pow(1024, unitIndex);

    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${
        units[unitIndex]
    }`;
}


function safeFilename(name) {
    return name
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[. ]+$/g, "");
}


function removePdfExtension(name) {
    return name.replace(/\.pdf$/i, "");
}


function addLog(text, type = "output") {
    const line = document.createElement("p");

    line.className = type;
    line.textContent = text;

    terminalLog.appendChild(line);
}


function showMessage(text, type = "") {
    message.textContent = text;
    message.className = `message ${type}`.trim();
    message.hidden = false;
}


function clearMessage() {
    message.hidden = true;
    message.textContent = "";
    message.className = "message";
}


function updateProgress(value, text) {
    const safeValue = Math.max(
        0,
        Math.min(100, value)
    );

    progressArea.hidden = false;
    progressBar.value = safeValue;
    progressValue.textContent =
        `${Math.round(safeValue)}%`;

    statusText.textContent = text;
}


function resetResults() {
    document.body.classList.remove("focus-mode");

    sourcePdfBytes = null;
    detectedChapters = [];
    finalChapterEnd = null;

    resultsPanel.hidden = true;
    chapterList.replaceChildren();

    clearMessage();

    progressArea.hidden = true;
    progressBar.value = 0;
    progressValue.textContent = "0%";
}


function selectFile(file) {
    resetResults();

    if (!file) {
        currentFile = null;
        splitButton.disabled = true;
        fileDetails.hidden = true;
        fileNameDisplay.textContent = "No file selected";
        return;
    }

    if (
        file.type !== "application/pdf"
        && !file.name.toLowerCase().endsWith(".pdf")
    ) {
        currentFile = null;
        splitButton.disabled = true;
        fileDetails.hidden = true;

        showMessage(
            "Select a PDF file.",
            "error"
        );

        addLog("> rejected non-PDF input");
        return;
    }

    currentFile = file;

    fileNameDisplay.textContent = file.name;
    selectedFileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileDetails.hidden = false;
    splitButton.disabled = false;

    addLog(`> selected ${file.name}`);
    addLog(`> size ${formatBytes(file.size)}`);

    if (file.size > 250 * 1024 * 1024) {
        showMessage(
            "Large file. The Python version may use memory more efficiently."
        );
    }
}


function flattenOutline(items, output = []) {
    if (!Array.isArray(items)) {
        return output;
    }

    for (const item of items) {
        output.push(item);

        if (Array.isArray(item.items)) {
            flattenOutline(item.items, output);
        }
    }

    return output;
}


async function resolvePageIndex(
    pdfDocument,
    destination
) {
    let resolvedDestination = destination;

    if (typeof destination === "string") {
        resolvedDestination =
            await pdfDocument.getDestination(destination);
    }

    if (
        !Array.isArray(resolvedDestination)
        || !resolvedDestination[0]
    ) {
        return null;
    }

    try {
        return await pdfDocument.getPageIndex(
            resolvedDestination[0]
        );
    } catch {
        return null;
    }
}


async function readOutline(pdfDocument) {
    const outline = await pdfDocument.getOutline();

    if (!outline || outline.length === 0) {
        return {
            chapters: [],
            endPage: null,
        };
    }

    const entries = [];
    const flattenedOutline = flattenOutline(outline);

    for (
        let index = 0;
        index < flattenedOutline.length;
        index += 1
    ) {
        const item = flattenedOutline[index];

        updateProgress(
            20
                + (
                    (index + 1)
                    / flattenedOutline.length
                ) * 45,
            "Reading bookmarks"
        );

        const pageIndex = await resolvePageIndex(
            pdfDocument,
            item.dest
        );

        if (pageIndex !== null) {
            entries.push({
                title: String(item.title || "").trim(),
                pageIndex,
            });
        }
    }

    entries.sort(
        (first, second) =>
            first.pageIndex - second.pageIndex
    );

    const chapters = [];
    const usedPages = new Set();

    for (const entry of entries) {
        if (
            chapterPattern.test(entry.title)
            && !usedPages.has(entry.pageIndex)
        ) {
            chapters.push(entry);
            usedPages.add(entry.pageIndex);
        }
    }

    if (chapters.length === 0) {
        return {
            chapters: [],
            endPage: null,
        };
    }

    const lastChapterPage =
        chapters[chapters.length - 1].pageIndex;

    let endPage = null;

    for (const entry of entries) {
        if (
            entry.pageIndex > lastChapterPage
            && endMatterPattern.test(entry.title)
        ) {
            endPage = entry.pageIndex;
            break;
        }
    }

    return {
        chapters,
        endPage,
    };
}


async function hasSearchableText(pdfDocument) {
    const pagesToCheck = Math.min(
        pdfDocument.numPages,
        8
    );

    for (
        let pageNumber = 1;
        pageNumber <= pagesToCheck;
        pageNumber += 1
    ) {
        const page = await pdfDocument.getPage(pageNumber);
        const textContent = await page.getTextContent();

        const text = textContent.items
            .map((item) => String(item.str || ""))
            .join("")
            .trim();

        page.cleanup();

        if (text.length >= 40) {
            return true;
        }
    }

    return false;
}


async function readPageTextChapters(pdfDocument) {
    const chapters = [];
    const usedChapterNumbers = new Set();

    addLog("> searching page text");

    for (
        let pageNumber = 1;
        pageNumber <= pdfDocument.numPages;
        pageNumber += 1
    ) {
        updateProgress(
            20
                + (
                    pageNumber
                    / pdfDocument.numPages
                ) * 55,
            `Scanning page ${pageNumber} of ${
                pdfDocument.numPages
            }`
        );

        const page = await pdfDocument.getPage(pageNumber);
        const textContent = await page.getTextContent();

        const lines = [];
        let currentLine = [];

        for (const item of textContent.items.slice(0, 100)) {
            const text = String(item.str || "").trim();

            if (text) {
                currentLine.push(text);
            }

            if (
                item.hasEOL
                && currentLine.length > 0
            ) {
                lines.push(currentLine.join(" "));
                currentLine = [];
            }
        }

        if (currentLine.length > 0) {
            lines.push(currentLine.join(" "));
        }

        const pageMatches = [];

        for (
            let index = 0;
            index < lines.length;
            index += 1
        ) {
            const line = lines[index];
            const match = line.match(chapterPattern);

            if (!match) {
                continue;
            }

            let title = line.trim();

            if (
                title.length < 24
                && lines[index + 1]
                && !chapterPattern.test(lines[index + 1])
            ) {
                title =
                    `${title}: ${lines[index + 1].trim()}`;
            }

            pageMatches.push({
                chapterNumber: match[1].toUpperCase(),
                title,
            });
        }

        if (pageMatches.length === 1) {
            const candidate = pageMatches[0];

            if (
                !usedChapterNumbers.has(
                    candidate.chapterNumber
                )
            ) {
                chapters.push({
                    title: candidate.title,
                    pageIndex: pageNumber - 1,
                });

                usedChapterNumbers.add(
                    candidate.chapterNumber
                );

                addLog(
                    `> found ${candidate.title} `
                    + `on page ${pageNumber}`
                );
            }
        }

        page.cleanup();

        if (pageNumber % 10 === 0) {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        }
    }

    chapters.sort(
        (first, second) =>
            first.pageIndex - second.pageIndex
    );

    return chapters;
}


function findOcrChapter(text, chapterNumber) {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const markerIndex = lines.findIndex((line) => {
        return /^chapter\b/i.test(line);
    });

    if (markerIndex === -1) {
        return null;
    }

    const marker = lines[markerIndex];

    const numberedMarker = marker.match(
        /^chapter\s+([0-9]+|[ivxlcdm]+)\b[.: -]*(.*)/i
    );

    if (numberedMarker) {
        const number = numberedMarker[1];
        const sameLineTitle =
            numberedMarker[2].trim();

        if (sameLineTitle) {
            return `Chapter ${number}: ${sameLineTitle}`;
        }

        if (lines[markerIndex + 1]) {
            return (
                `Chapter ${number}: `
                + lines[markerIndex + 1]
            );
        }

        return `Chapter ${number}`;
    }

    if (lines[markerIndex + 1]) {
        return (
            `Chapter ${chapterNumber}: `
            + lines[markerIndex + 1]
        );
    }

    return `Chapter ${chapterNumber}`;
}


function createOcrCanvas(
    sourceCanvas,
    startX,
    width
) {
    const scanHeight = Math.round(
        sourceCanvas.height * 0.58
    );

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = scanHeight;

    const context = canvas.getContext(
        "2d",
        {
            alpha: false,
            willReadFrequently: true,
        }
    );

    context.fillStyle = "#ffffff";

    context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    context.drawImage(
        sourceCanvas,
        startX,
        0,
        width,
        scanHeight,
        0,
        0,
        width,
        scanHeight
    );

    return canvas;
}


async function readScannedChapters(pdfDocument) {
    const chapters = [];

    addLog("> image-only PDF detected");
    addLog("> starting local OCR");

    showMessage(
        "This PDF is image-only. OCR will take longer, "
        + "but the file will remain in your browser."
    );

    const worker = await Tesseract.createWorker(
        "eng",
        1
    );

    try {
        await worker.setParameters({
            tessedit_pageseg_mode:
                Tesseract.PSM.SPARSE_TEXT,
        });

        for (
            let pageNumber = 1;
            pageNumber <= pdfDocument.numPages;
            pageNumber += 1
        ) {
            updateProgress(
                20
                    + (
                        pageNumber
                        / pdfDocument.numPages
                    ) * 55,
                `OCR page ${pageNumber} of ${
                    pdfDocument.numPages
                }`
            );

            const page =
                await pdfDocument.getPage(pageNumber);

            const viewport = page.getViewport({
                scale: 1.35,
            });

            const pageCanvas =
                document.createElement("canvas");

            pageCanvas.width =
                Math.ceil(viewport.width);

            pageCanvas.height =
                Math.ceil(viewport.height);

            const pageContext =
                pageCanvas.getContext(
                    "2d",
                    {
                        alpha: false,
                        willReadFrequently: true,
                    }
                );

            pageContext.fillStyle = "#ffffff";

            pageContext.fillRect(
                0,
                0,
                pageCanvas.width,
                pageCanvas.height
            );

            await page.render({
                canvasContext: pageContext,
                viewport,
            }).promise;

            const isSpread =
                pageCanvas.width
                > pageCanvas.height * 1.15;

            const regions = [];

            if (isSpread) {
                const halfWidth = Math.floor(
                    pageCanvas.width / 2
                );

                regions.push(
                    createOcrCanvas(
                        pageCanvas,
                        0,
                        halfWidth
                    )
                );

                regions.push(
                    createOcrCanvas(
                        pageCanvas,
                        halfWidth,
                        pageCanvas.width - halfWidth
                    )
                );
            } else {
                regions.push(
                    createOcrCanvas(
                        pageCanvas,
                        0,
                        pageCanvas.width
                    )
                );
            }

            let chapterFoundOnPage = false;

            for (const region of regions) {
                const recognition =
                    await worker.recognize(region);

                const title = findOcrChapter(
                    recognition.data.text,
                    chapters.length + 1
                );

                region.width = 1;
                region.height = 1;

                if (
                    title
                    && !chapterFoundOnPage
                ) {
                    chapters.push({
                        title,
                        pageIndex: pageNumber - 1,
                    });

                    chapterFoundOnPage = true;

                    addLog(
                        `> found ${title} on `
                        + `PDF page ${pageNumber}`
                    );
                }
            }

            pageCanvas.width = 1;
            pageCanvas.height = 1;

            page.cleanup();

            if (pageNumber % 5 === 0) {
                await new Promise((resolve) => {
                    setTimeout(resolve, 0);
                });
            }
        }
    } finally {
        await worker.terminate();
    }

    return chapters;
}


function displayChapters(
    chapters,
    totalPages,
    endPage
) {
    chapterList.replaceChildren();

    chapters.forEach((chapter, index) => {
        const nextChapter = chapters[index + 1];

        const stopPage = nextChapter
            ? nextChapter.pageIndex
            : endPage ?? totalPages;

        const listItem =
            document.createElement("li");

        const number =
            document.createElement("span");

        number.className = "chapter-index";
        number.textContent =
            String(index + 1).padStart(2, "0");

        const name =
            document.createElement("span");

        name.className = "chapter-name";
        name.textContent = chapter.title;

        const pages =
            document.createElement("span");

        pages.className = "chapter-page";
        pages.textContent =
            `PDF ${chapter.pageIndex + 1}-${stopPage}`;

        listItem.append(number, name, pages);
        chapterList.appendChild(listItem);
    });

    chapterCount.textContent =
        `${chapters.length} ${
            chapters.length === 1
                ? "chapter"
                : "chapters"
        }`;

    resultsPanel.hidden = false;
}


async function detectChapters() {
    if (!currentFile) {
        return;
    }

    splitButton.disabled = true;
    downloadButton.disabled = true;

    resetResults();

    try {
        updateProgress(5, "Reading local file");
        addLog("> reading local PDF");

        const arrayBuffer =
            await currentFile.arrayBuffer();

        sourcePdfBytes =
            new Uint8Array(arrayBuffer);

        updateProgress(15, "Opening PDF");
        addLog("> opening PDF");

        const pdfDocument =
            await pdfjsLib.getDocument({
                data: new Uint8Array(
                    arrayBuffer.slice(0)
                ),
            }).promise;

        const totalPages = pdfDocument.numPages;

        addLog(`> ${totalPages} pages found`);

        let result =
            await readOutline(pdfDocument);

        if (result.chapters.length === 0) {
            const searchable =
                await hasSearchableText(pdfDocument);

            if (searchable) {
                result = {
                    chapters:
                        await readPageTextChapters(
                            pdfDocument
                        ),
                    endPage: null,
                };
            } else {
                result = {
                    chapters:
                        await readScannedChapters(
                            pdfDocument
                        ),
                    endPage: null,
                };
            }
        }

        detectedChapters = result.chapters;
        finalChapterEnd = result.endPage;

        await pdfDocument.destroy();

        if (detectedChapters.length === 0) {
            sourcePdfBytes = null;

            throw new Error(
                "No chapter headings were detected."
            );
        }

        updateProgress(
            100,
            "Detection complete"
        );

        displayChapters(
            detectedChapters,
            totalPages,
            finalChapterEnd
        );

        addLog(
            `> ${detectedChapters.length} `
            + "chapters detected"
        );

        showMessage(
            `${detectedChapters.length} chapters ready.`,
            "success"
        );

        downloadButton.disabled = false;

        document.body.classList.add("focus-mode");

        resultsPanel.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    } catch (error) {
        sourcePdfBytes = null;
        detectedChapters = [];

        updateProgress(
            0,
            "Detection failed"
        );

        showMessage(
            `Error: ${error.message}`,
            "error"
        );

        addLog(`> error: ${error.message}`);
    } finally {
        splitButton.disabled = false;
    }
}


async function buildZip() {
    if (
        !currentFile
        || !sourcePdfBytes
        || detectedChapters.length === 0
    ) {
        return;
    }

    downloadButton.disabled = true;
    splitButton.disabled = true;

    clearMessage();

    try {
        updateProgress(
            2,
            "Loading source PDF"
        );

        addLog("> building chapter archive");

        const sourceDocument =
            await PDFLib.PDFDocument.load(
                sourcePdfBytes
            );

        const totalPages =
            sourceDocument.getPageCount();

        const zip = new JSZip();

        for (
            let index = 0;
            index < detectedChapters.length;
            index += 1
        ) {
            const chapter =
                detectedChapters[index];

            const nextChapter =
                detectedChapters[index + 1];

            const stopPage = nextChapter
                ? nextChapter.pageIndex
                : finalChapterEnd ?? totalPages;

            const pageIndices = [];

            for (
                let pageIndex = chapter.pageIndex;
                pageIndex < stopPage;
                pageIndex += 1
            ) {
                pageIndices.push(pageIndex);
            }

            updateProgress(
                5
                    + (
                        index
                        / detectedChapters.length
                    ) * 75,
                `Splitting chapter ${index + 1}`
            );

            const chapterDocument =
                await PDFLib.PDFDocument.create();

            const copiedPages =
                await chapterDocument.copyPages(
                    sourceDocument,
                    pageIndices
                );

            for (const page of copiedPages) {
                chapterDocument.addPage(page);
            }

            const chapterBytes =
                await chapterDocument.save({
                    useObjectStreams: true,
                });

            const chapterName =
                safeFilename(chapter.title);

            const numberedName =
                `${String(index + 1).padStart(2, "0")} - `
                + `${chapterName}.pdf`;

            zip.file(
                numberedName,
                chapterBytes
            );
        }

        updateProgress(82, "Packing ZIP");

        const zipBlob =
            await zip.generateAsync(
                {
                    type: "blob",
                    compression: "STORE",
                    streamFiles: true,
                },
                (metadata) => {
                    updateProgress(
                        82
                            + metadata.percent
                            * 0.18,
                        "Packing ZIP"
                    );
                }
            );

        const downloadUrl =
            URL.createObjectURL(zipBlob);

        const downloadLink =
            document.createElement("a");

        downloadLink.href = downloadUrl;

        downloadLink.download =
            `${safeFilename(
                removePdfExtension(
                    currentFile.name
                )
            )} - Chapters.zip`;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();

        setTimeout(() => {
            URL.revokeObjectURL(downloadUrl);
        }, 1000);

        updateProgress(
            100,
            "Download ready"
        );

        addLog("> ZIP download created");

        showMessage(
            "Chapter ZIP created.",
            "success"
        );
    } catch (error) {
        updateProgress(
            0,
            "Build failed"
        );

        showMessage(
            `Error: ${error.message}`,
            "error"
        );

        addLog(`> error: ${error.message}`);
    } finally {
        downloadButton.disabled = false;
        splitButton.disabled = false;
    }
}


window.addEventListener(
    "scroll",
    () => {
        const currentScrollPosition =
            window.scrollY;

        if (
            document.body.classList.contains(
                "focus-mode"
            )
            && currentScrollPosition
                < previousScrollPosition - 2
        ) {
            document.body.classList.remove(
                "focus-mode"
            );
        }

        previousScrollPosition =
            currentScrollPosition;
    },
    {
        passive: true,
    }
);


window.addEventListener(
    "wheel",
    (event) => {
        if (
            event.deltaY < 0
            && document.body.classList.contains(
                "focus-mode"
            )
        ) {
            document.body.classList.remove(
                "focus-mode"
            );
        }
    },
    {
        passive: true,
    }
);


pdfInput.addEventListener("change", () => {
    selectFile(pdfInput.files[0]);
});


dropZone.addEventListener(
    "dragover",
    (event) => {
        event.preventDefault();
        dropZone.classList.add("dragging");
    }
);


dropZone.addEventListener(
    "dragleave",
    () => {
        dropZone.classList.remove("dragging");
    }
);


dropZone.addEventListener(
    "drop",
    (event) => {
        event.preventDefault();

        dropZone.classList.remove("dragging");

        const file =
            event.dataTransfer.files[0];

        selectFile(file);
    }
);


splitButton.addEventListener(
    "click",
    detectChapters
);


downloadButton.addEventListener(
    "click",
    buildZip
);