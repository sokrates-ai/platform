/**
 * Utility functions for content formatting and conversion
 */

/**
 * Convert plain text with newlines to proper HTML with paragraph tags
 * This ensures that content inserted from image recognition maintains formatting on reload
 */
export function convertPlainTextToHTML(plainText: string): string {
    if (!plainText || !plainText.trim()) {
        return '<p></p>';
    }

    // Split by multiple newlines to separate paragraphs
    const paragraphs = plainText
        .split(/\n\s*\n/) // Split on double newlines (paragraph breaks)
        .map(paragraph => paragraph.trim())
        .filter(paragraph => paragraph.length > 0);

    if (paragraphs.length === 0) {
        return '<p></p>';
    }

    // Convert each paragraph to HTML, handling single line breaks within paragraphs
    const htmlParagraphs = paragraphs.map(paragraph => {
        // Replace single newlines within a paragraph with <br> tags
        const paragraphWithBreaks = paragraph
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('<br />');
        
        return `<p>${paragraphWithBreaks}</p>`;
    });

    return htmlParagraphs.join('');
}

/**
 * Ensure content ends with proper paragraph structure
 */
export function ensureProperParagraphEnding(content: string): string {
    if (!content || !content.trim()) {
        return '<p></p>';
    }

    // If content doesn't end with a paragraph tag, wrap the last part
    if (!content.trim().endsWith('</p>')) {
        // Add a new empty paragraph for continuation
        return content + '<p></p>';
    }

    return content;
}

/**
 * Insert content with proper spacing and paragraph structure
 */
export function prepareContentForInsertion(rawContent: string, isFromImageRecognition: boolean = false): string {
    if (isFromImageRecognition) {
        // For image recognition content, convert plain text to HTML
        const htmlContent = convertPlainTextToHTML(rawContent);
        // Add spacing paragraphs before and after
        return `<p></p>${htmlContent}<p></p>`;
    } else {
        // For other content, assume it's already HTML or simple text
        return rawContent;
    }
} 