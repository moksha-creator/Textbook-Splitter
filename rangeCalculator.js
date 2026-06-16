const RangeCalculator = {
    calculate(chapters, totalPages) {
        if (!chapters || chapters.length === 0) return [];
        
        const calculated = [...chapters];
        
        for (let i = 0; i < calculated.length; i++) {
            if (i < calculated.length - 1) {
                // End page is the page before the next chapter starts
                calculated[i].endPage = calculated[i + 1].startPage - 1;
                // Safety check
                if (calculated[i].endPage < calculated[i].startPage) {
                    calculated[i].endPage = calculated[i].startPage;
                }
            } else {
                // Last chapter goes until the end of the book
                calculated[i].endPage = totalPages;
            }
        }
        
        return calculated;
    }
};
