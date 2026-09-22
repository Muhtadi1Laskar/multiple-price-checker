import { getBookInfo, searchBook } from "./crawler/http.js";
import { extractMainData } from "./sources/rokomari/bookIdentityExtractor.js";

// const URL = "https://www.rokomari.com/book/340423/the-master-and-margarita";
const URL = "https://www.rokomari.com/book/254498/a-room-of-one-s-own";

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

// (async () => {
//     const data = await scrapeMultipleData(URL);
//     console.log(JSON.stringify(data, null, 2));
// })();