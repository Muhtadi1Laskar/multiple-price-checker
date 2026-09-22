import { websiteConfig } from '../utils/configData.js';
import { amazonScraper } from '../seller/amazon/scraper.js';
import { htmlScraper } from '../seller/baatighar/scraper.js';


export const getBookInfo = async (bookInfo) => {
    const results = await Promise.allSettled(
        websiteConfig.map(async (websiteInfo) => {
            if (websiteInfo.scraperType === "browserAutomation") {
                const productData = await amazonScraper(bookInfo, websiteInfo);

                return {
                    websiteName: productData.websiteName,
                    title: productData.title,
                    author: productData.author,
                    publisher: productData.publisher,
                    price: productData.bookPrices,
                    discountPrice: productData.discountPrice,
                    stockStatus: productData.stockStatus,
                    link: productData.link,
                    message: productData.message
                };
            }

            const productData = await htmlScraper(bookInfo, websiteInfo);

            return {
                websiteName: productData.websiteName,
                title: productData.title,
                author: productData.author,
                publisher: productData.publisher,
                price: productData.price,
                discountPrice: productData.discountPrice,
                stockStatus: productData.stockStatus,
                link: productData.link,
                message: productData.message
            };
        })
    );

    return results.map((result, index) => {
        if (result.status === "fulfilled") {
            return result.value;
        }

        const { websiteName } = websiteConfig[index];

        return {
            websiteName,
            title: bookInfo.title,
            message: "Failed to scrape data"
        };
    })
}



