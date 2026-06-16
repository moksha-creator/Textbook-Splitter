const TOCExtractor = {
    async extract(pdfDocument, tocPageStr = '') {
        const chapters = [];
        
        let startPage = 1;
        let endPage = Math.min(20, pdfDocument.numPages);
        
        if (tocPageStr) {
            if (tocPageStr.includes('-')) {
                const parts = tocPageStr.split('-');
                const s = parseInt(parts[0], 10);
                const e = parseInt(parts[1], 10);
                if (!isNaN(s) && !isNaN(e) && s >= 1 && e <= pdfDocument.numPages && s <= e) {
                    startPage = s;
                    endPage = e;
                }
            } else {
                const p = parseInt(tocPageStr, 10);
                if (!isNaN(p) && p >= 1 && p <= pdfDocument.numPages) {
                    startPage = p;
                    endPage = p;
                }
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            try {
                const page = await pdfDocument.getPage(i);
                const textContent = await page.getTextContent();
                
                // Group text items by Y coordinate to form proper lines
                const lines = {};
                textContent.items.forEach(item => {
                    // Safety check for weird PDF.js items
                    if (!item || typeof item.str !== 'string' || !item.transform || !item.transform[5]) return;
                    
                    // Round Y coordinate to handle vertical misalignments. 
                    // Using 5 or 6 points of tolerance handles text on the same visual line
                    const y = Math.round(item.transform[5] / 6) * 6; 
                    if (!lines[y]) lines[y] = [];
                    lines[y].push(item);
                });

                // Sort lines from top to bottom (PDF coordinates have Y=0 at bottom usually)
                const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
                
                let foundOnThisPage = 0;

                for (const y of sortedY) {
                    // Sort items left to right
                    lines[y].sort((a, b) => (a.transform && b.transform) ? a.transform[4] - b.transform[4] : 0);
                    
                    // Join items, replace multiple spaces
                    let lineText = lines[y].map(item => item.str).join(' ').replace(/\s{2,}/g, ' ').trim();
                    
                    // Look for any text ending with dots/spaces and a number (or number range like 1-10)
                    const lineMatch = /(.*?)(?:\.+|\s+)(\d+)(?:\s*-\s*\d+)?$/.exec(lineText);
                    
                    if (lineMatch) {
                        let name = lineMatch[1].trim();
                        const pageNum = parseInt(lineMatch[2], 10);
                        
                        // Clean up leading numbers/units like "1." or "Chapter 1:"
                        let cleanName = name.replace(/^(?:Chapter|Unit)?\s*[IVX\d]+[\.\-\:]?\s*/i, '').trim();
                        // Only apply cleaning if it leaves us with a valid title. 
                        // Otherwise (e.g. if name was just "Unit I"), keep the original name.
                        if (cleanName.length > 1) {
                            name = cleanName;
                        }
                        
                        // Clean up trailing dots or strange chars
                        name = name.replace(/[\.\-_]+$/, '').trim();
                        
                        // Validations: Name must not be just a number, and pageNum must make sense
                        if (name.length >= 2 && isNaN(name) && pageNum > 0 && pageNum < 1500) {
                            // Prevent duplicates
                            if (!chapters.find(c => c.name === name)) {
                                chapters.push({ name, startPage: pageNum });
                                foundOnThisPage++;
                            }
                        }
                    }
                }
                
                // FALLBACK: If the line-by-line scan found nothing on this page, try a broad whole-page scan
                if (foundOnThisPage === 0) {
                    const fullText = textContent.items.map(item => item.str).join(' ');
                    const fallbackRegex = /(?:Chapter|Unit)?\s*[IVX\d]+\.?\s*([A-Za-z]+[^0-9]*?)(?:\.+|\s+)\s*(\d+)(?:\s*-\s*\d+)?\b/gi;
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
            } catch (err) {
                console.warn(`Could not extract text from page ${i}:`, err);
            }
        }
        
        if (chapters.length === 0) {
            chapters.push({ name: "Chapter 1", startPage: 1 });
        }
        
        chapters.sort((a, b) => a.startPage - b.startPage);
        return chapters;
    }
};
