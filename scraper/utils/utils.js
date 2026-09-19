export const extractNumber = (str) => {
    if (!str) return null;

    // 1. Remove space/comma thousand separators if followed by digits (e.g., "1,200.50" -> "1200.50")
    let cleaned = str.trim().replace(/,(?=\d{3})/g, '');

    // 2. If a comma is used as a decimal separator (e.g., "1200,50"), replace it with a dot
    cleaned = cleaned.replace(/,(\d+)$/, '.$1');

    // 3. Match signed integer or decimal numbers
    const regex = /[+-]?\d+(?:\.\d+)?/;
    const match = cleaned.match(regex);

    if (match) {
        return parseFloat(match[0]);
    }

    return null;
};

export const removeParentheses = (str) => {
    if (!str) return '';
    
    return str
        // Remove '(' and ')' and everything in between
        .replace(/\s*\([^)]*\)/g, '')
        // Clean up any remaining double spaces and trim surrounding whitespace
        .replace(/\s+/g, ' ')
        .trim();
};