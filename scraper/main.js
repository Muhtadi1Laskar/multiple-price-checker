import { extractMainData } from "./crawler/browser.js";
import { getBookInfo, searchBook } from "./crawler/http.js";

// const URL = "https://www.rokomari.com/book/340423/the-master-and-margarita";
const URL = "https://www.rokomari.com/book/86047/indigo-selected-stories";

(async () => {
    try {
        const bookInfo = await extractMainData(URL);
        const result = await getBookInfo(bookInfo);
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Failed to fetch data: ", error);
    }
})();