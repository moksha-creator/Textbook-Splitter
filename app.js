// Central application state
const AppState = {
    pdfFile: null,
    pdfDocument: null, // pdf.js document
    pdfBytes: null, // raw array buffer
    totalPages: 0,
    chapters: [] // Array of { id, name, startPage, endPage }
};

// UI Elements
const els = {
    uploadSection: document.getElementById('upload-section'),
    processingSection: document.getElementById('processing-section'),
    reviewSection: document.getElementById('review-section'),
    exportSection: document.getElementById('export-section'),
    
    fileInput: document.getElementById('file-input'),
    dropZone: document.getElementById('drop-zone'),
    
    chaptersTbody: document.getElementById('chapters-tbody'),
    addChapterBtn: document.getElementById('add-chapter-btn'),
    splitPdfBtn: document.getElementById('split-pdf-btn'),
    
    downloadZipBtn: document.getElementById('download-zip-btn'),
    downloadJsonBtn: document.getElementById('download-json-btn'),
    startOverBtn: document.getElementById('start-over-btn'),
    
    processingText: document.getElementById('processing-text'),
    pageOffsetInput: document.getElementById('page-offset'),
    tocPageInput: document.getElementById('toc-page'),
    
    pasteTocBtn: document.getElementById('paste-toc-btn'),
    pasteTocArea: document.getElementById('paste-toc-area'),
    pasteTocInput: document.getElementById('paste-toc-input'),
    cancelPasteBtn: document.getElementById('cancel-paste-btn'),
    buildPastedBtn: document.getElementById('build-pasted-btn')
};

// Utility to switch screens
function showScreen(sectionId) {
    ['upload-section', 'processing-section', 'review-section', 'export-section'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Upload Handlers
    els.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        els.dropZone.classList.add('dragover');
    });
    
    els.dropZone.addEventListener('dragleave', () => {
        els.dropZone.classList.remove('dragover');
    });
    
    els.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        els.dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });
    
    els.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileUpload(e.target.files[0]);
        }
    });

    // Review Actions
    els.addChapterBtn.addEventListener('click', () => {
        const id = Date.now().toString();
        AppState.chapters.push({
            id,
            name: 'New Chapter',
            startPage: AppState.chapters.length ? AppState.chapters[AppState.chapters.length-1].endPage + 1 : 1,
            endPage: AppState.totalPages
        });
        renderTable();
    });
    
    els.pasteTocBtn.addEventListener('click', () => {
        els.pasteTocArea.classList.remove('hidden');
    });
    
    els.cancelPasteBtn.addEventListener('click', () => {
        els.pasteTocArea.classList.add('hidden');
        els.pasteTocInput.value = '';
    });
    
    els.buildPastedBtn.addEventListener('click', () => {
        const text = els.pasteTocInput.value;
        if (!text.trim()) return;
        
        let chapters = [];
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        
        // Attempt 1: Line by line (Standard format: "Chapter Title 10")
        for (const line of lines) {
            const lineMatch = /(.*?)(?:\.+|\s+|\t+)(\d+)(?:\s*-\s*\d+)?$/.exec(line);
            if (lineMatch) {
                let name = lineMatch[1].trim();
                const pageNum = parseInt(lineMatch[2], 10);
                
                let cleanName = name.replace(/^(?:Chapter|Unit)?\s*[IVX\d]+[\.\-\:]?\s*/i, '').trim();
                if (cleanName.length > 1) {
                    name = cleanName;
                }
                name = name.replace(/[\.\-_]+$/, '').trim();
                
                if (name.length >= 2 && isNaN(name) && pageNum > 0 && pageNum < 1500) {
                    chapters.push({ name, startPage: pageNum });
                }
            }
        }
        
        // Attempt 2: Two lines at a time (Format: "Chapter Title\n10")
        if (chapters.length === 0) {
            for (let i = 0; i < lines.length - 1; i++) {
                const line1 = lines[i];
                const line2 = lines[i+1];
                if (isNaN(line1) && !isNaN(line2)) {
                    let name = line1.trim();
                    const pageNum = parseInt(line2, 10);
                    name = name.replace(/^(?:Chapter|Unit)?\s*\d+[\.\-\:]?\s*/i, '').trim();
                    name = name.replace(/[\.\-_]+$/, '').trim();
                    
                    if (name.length > 2 && pageNum > 0 && pageNum < 1500) {
                        chapters.push({ name, startPage: pageNum });
                    }
                }
            }
        }
        
        // Attempt 3: Regex block scan (Messy format)
        if (chapters.length === 0) {
            const fullText = text.replace(/\n/g, ' ');
            const fallbackRegex = /(?:Chapter\s+\d+|Unit\s+\d+|\b\d+\.)\s*[:\-]?\s*([A-Za-z]+[^0-9]*?)(?:\.+|\s+)\s*(\d+)\b/gi;
            let match;
            while ((match = fallbackRegex.exec(fullText)) !== null) {
                const name = match[1].trim().replace(/[\.\-_]+$/, '').trim();
                const pageNum = parseInt(match[2], 10);
                if (name.length > 2 && isNaN(name) && pageNum > 0 && pageNum < 1500) {
                    if (!chapters.find(c => c.name === name)) {
                        chapters.push({ name, startPage: pageNum });
                    }
                }
            }
        }
        
        if (chapters.length > 0) {
            chapters.sort((a, b) => a.startPage - b.startPage);
            AppState.chapters = RangeCalculator.calculate(chapters, AppState.totalPages);
            AppState.chapters.forEach(c => c.id = Date.now().toString() + Math.random().toString().slice(2));
            renderTable();
            els.pasteTocArea.classList.add('hidden');
            els.pasteTocInput.value = '';
        } else {
            alert('Could not find any chapters in the pasted text. Make sure lines end with page numbers.');
        }
    });

    els.splitPdfBtn.addEventListener('click', async () => {
        // Collect latest data from table before splitting
        updateChaptersFromTable();
        await processSplitting();
    });

    // Export Actions
    els.downloadZipBtn.addEventListener('click', () => {
        ExportManager.downloadZip();
    });
    
    els.downloadJsonBtn.addEventListener('click', () => {
        ExportManager.downloadJson();
    });
    
    els.startOverBtn.addEventListener('click', () => {
        location.reload(); // Simple way to reset state
    });
});

async function handleFileUpload(file) {
    if (file.type !== 'application/pdf') {
        alert('Please upload a valid PDF file.');
        return;
    }
    
    AppState.pdfFile = file;
    showScreen('processing-section');
    els.processingText.textContent = 'Loading PDF...';
    
    try {
        const buffer = await file.arrayBuffer();
        AppState.pdfBytes = buffer;
        
        // Load with PDF.js for text extraction
        // Include cMap settings to support textbooks with complex or custom fonts
        const loadingTask = pdfjsLib.getDocument({ 
            data: buffer,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true
        });
        AppState.pdfDocument = await loadingTask.promise;
        AppState.totalPages = AppState.pdfDocument.numPages;
        
        els.processingText.textContent = 'Analyzing Table of Contents...';
        
        // Extract TOC
        const tocPageStr = els.tocPageInput.value.trim();
        const extractedChapters = await TOCExtractor.extract(AppState.pdfDocument, tocPageStr);
        
        // Calculate Ranges
        AppState.chapters = RangeCalculator.calculate(extractedChapters, AppState.totalPages);
        
        // Add unique IDs
        AppState.chapters.forEach(c => c.id = Date.now().toString() + Math.random().toString().slice(2));
        
        renderTable();
        showScreen('review-section');
        
    } catch (error) {
        console.error(error);
        alert('Error processing PDF: ' + error.message);
        showScreen('upload-section');
    }
}

function renderTable() {
    els.chaptersTbody.innerHTML = '';
    
    AppState.chapters.forEach((chapter, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" value="${chapter.name}" data-id="${chapter.id}" class="chapter-name"></td>
            <td><input type="number" min="1" max="${AppState.totalPages}" value="${chapter.startPage}" data-id="${chapter.id}" class="chapter-start"></td>
            <td><input type="number" min="1" max="${AppState.totalPages}" value="${chapter.endPage}" data-id="${chapter.id}" class="chapter-end"></td>
            <td><button class="btn danger" onclick="deleteChapter('${chapter.id}')">Delete</button></td>
        `;
        els.chaptersTbody.appendChild(tr);
    });
}

function deleteChapter(id) {
    AppState.chapters = AppState.chapters.filter(c => c.id !== id);
    renderTable();
}

function updateChaptersFromTable() {
    const rows = els.chaptersTbody.querySelectorAll('tr');
    AppState.chapters = Array.from(rows).map(row => {
        const nameInput = row.querySelector('.chapter-name');
        const startInput = row.querySelector('.chapter-start');
        const endInput = row.querySelector('.chapter-end');
        return {
            id: nameInput.dataset.id,
            name: nameInput.value,
            startPage: parseInt(startInput.value, 10),
            endPage: parseInt(endInput.value, 10)
        };
    });
}

async function processSplitting() {
    showScreen('processing-section');
    els.processingText.textContent = 'Splitting PDF chapters...';
    
    try {
        const pageOffset = parseInt(els.pageOffsetInput.value, 10) || 0;
        const bufferForSplitting = await AppState.pdfFile.arrayBuffer();
        await PDFSplitter.split(bufferForSplitting, AppState.chapters, AppState.pdfFile.name, pageOffset);
        showScreen('export-section');
    } catch (error) {
        console.error(error);
        alert('Error splitting PDF: ' + error.message);
        showScreen('review-section');
    }
}
