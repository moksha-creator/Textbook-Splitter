const PDFSplitter = {
    async split(pdfBytes, chapters, originalFileName, pageOffset = 0) {
        // Load the original PDF
        const originalPdf = await PDFLib.PDFDocument.load(pdfBytes);
        const splitPdfs = [];
        const metadata = [];

        for (let index = 0; index < chapters.length; index++) {
            const chapter = chapters[index];
            // Create a new empty PDF
            const newPdf = await PDFLib.PDFDocument.create();
            
            // pdf-lib uses 0-indexed pages. Apply pageOffset.
            const startIdx = Math.max(0, (chapter.startPage + pageOffset) - 1);
            const endIdx = Math.min(originalPdf.getPageCount() - 1, (chapter.endPage + pageOffset) - 1);
            
            const pageIndices = [];
            for (let i = startIdx; i <= endIdx; i++) {
                pageIndices.push(i);
            }
            
            if (pageIndices.length > 0) {
                // Copy pages from original to new
                const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
                copiedPages.forEach(page => newPdf.addPage(page));
                
                const pdfBytes = await newPdf.save();
                
                // Format filename
                const safeName = chapter.name.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
                const filename = `Chapter ${index + 1} - ${safeName}.pdf`;
                
                splitPdfs.push({
                    name: chapter.name,
                    filename: filename,
                    bytes: pdfBytes
                });
                
                metadata.push({
                    chapter: chapter.name,
                    start_page: chapter.startPage,
                    end_page: chapter.endPage,
                    filename: filename
                });
            }
        }
        
        // Pass the generated files to the ExportManager
        ExportManager.setReadyFiles(splitPdfs, metadata, originalFileName);
    }
};
