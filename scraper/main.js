import { extractMainData } from "./crawler/browser.js";
import { getBookInfo, searchBook } from "./crawler/http.js";

const URL = "https://www.rokomari.com/book/340423/the-master-and-margarita";
// const URL = "https://www.rokomari.com/book/150644/complete-adventures-of-feluda-vol-1";

export const scrapeMultipleData = async (URL) => {
    try {
        const bookInfo = await extractMainData(URL);
        const scrapedData = await getBookInfo(bookInfo);
        return scrapedData;
    } catch(error) {
        console.error("Failed to scrape data", error);
        throw error;
    }
}

(async () => {
    const data = await scrapeMultipleData(URL);
    console.log(JSON.stringify(data, null, 2));
})();