const ExportManager = {
    _splitPdfs: [],
    _metadata: [],
    _originalBaseName: "Textbook",

    setReadyFiles(splitPdfs, metadata, originalFileName) {
        this._splitPdfs = splitPdfs;
        this._metadata = metadata;
        
        // Strip .pdf extension if present for the base name
        this._originalBaseName = originalFileName.replace(/\.pdf$/i, '');
    },

    async downloadZip() {
        if (!this._splitPdfs || this._splitPdfs.length === 0) {
            alert('No files available for download.');
            return;
        }

        const zip = new JSZip();

        // Add metadata
        zip.file("Metadata.json", JSON.stringify(this._metadata, null, 2));

        // Add PDFs into the root of the ZIP
        this._splitPdfs.forEach((pdfObj) => {
            zip.file(pdfObj.filename, pdfObj.bytes);
        });

        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `${this._originalBaseName}_Chapters.zip`);
    },

    downloadJson() {
        if (!this._metadata || this._metadata.length === 0) {
            alert('No metadata available.');
            return;
        }

        const blob = new Blob([JSON.stringify(this._metadata, null, 2)], { type: "application/json" });
        saveAs(blob, "Metadata.json");
    }
};
