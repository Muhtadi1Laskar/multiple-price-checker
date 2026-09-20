import * as cheerio from 'cheerio';
import { browserScraper } from './browser.js';
import { extractNumber } from '../utils/utils.js';
import { websiteConfig } from '../utils/configData.js';

export const makeRequest = async (url) => {
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/120.0.0.0 Safari/537.36",
                "Accept":
                    "text/html,application/xhtml+xml,application/xml;q=0.9," +
                    "image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-IN,en;q=0.9"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP status error: ${response.status}: ${url}`);
        }

        return response.text();
    } catch (error) {
        console.error("Error loading HTML body: ", error);
        return error;
    }
}

const isNumeric = str => !isNaN(Number(str));

const buildAttempts = (bookInfo) => {
    const attempts = [];

    if (bookInfo.isbn) {
        attempts.push({
            type: "isbn",
            query: bookInfo.isbn
        });
    }

    if (bookInfo.publication) {
        attempts.push({
            type: "title-author-publication",
            query: `${bookInfo.title} ${bookInfo.author} ${bookInfo.publication}`.trim()
        });
    }

    if (bookInfo.author) {
        attempts.push({
            type: "title-author",
            query: `${bookInfo.title} ${bookInfo.author}`.trim()
        });
    }

    return attempts;
}


const buildSearchURL = (baseURL, query) => {
    const cleanQuery = !isNumeric(query) ?
        encodeURIComponent(query).replaceAll('%20', '+') :
        query;
    return baseURL + cleanQuery;
}

const getDetailsPageLink = ({ rawHTML, linkSelector, url, bookTitle }) => {
    const $ = cheerio.load(rawHTML);

    return $(linkSelector)
        // .filter((_, element) => $(element).text().trim() === bookTitle)
        .map((_, element) => {
            const href = $(element).attr("href");

            return href
                ? new URL(href, url).toString()
                : null;
        })
        .get()
        .filter(Boolean);
}

export const searchBook = async (bookInfo, websiteInfo) => {
    const { baseURL, linkSelector } = websiteInfo;
    const { title } = bookInfo;
    const attempts = buildAttempts(bookInfo);
    const finalCandidates = [];

    for (const attempt of attempts) {
        const url = buildSearchURL(baseURL, attempt.query);

        const rawHTML = await makeRequest(url);
        const paylaod = {
            rawHTML,
            linkSelector,
            url,
            title,
        }
        const candidates = getDetailsPageLink(paylaod);

        if (candidates.length > 0) {
            finalCandidates.push(...candidates);
            return finalCandidates;
        }
    }

    return null;
}


export const htmlScraper = async (bookInfo, websiteInfo) => {
    const { websiteName, selectors } = websiteInfo;
    const { title } = bookInfo;
    const bookDetailsPageLink = await searchBook(bookInfo, websiteInfo);
    const {
        publisherSelector,
        priceSelector,
        authorSelector,
        stockStatusSelector
    } = selectors;

    if (!bookDetailsPageLink) {
        return {
            websiteName,
            title,
            message: `The book is not available on ${websiteName}`
        };
    }

    const rawHTML = await makeRequest(bookDetailsPageLink[0]);

    const $ = cheerio.load(rawHTML);
    const publisher = $(publisherSelector).text().trim();
    const author = $(authorSelector).text().trim();
    const prices = $(priceSelector)
        .map((_, el) => extractNumber($(el).text().trim()))
        .get();

    const stockStatus = {};
    stockStatusSelector.forEach(element => {
        let status = $(`td:contains('${element}') + td`).text().trim();
        stockStatus[element] = status;
    });
    
    const [discountPrice, price] = prices;

    return {
        websiteName,
        title,
        author,
        publisher,
        discountPrice,
        price,
        link: bookDetailsPageLink[0],
        stockStatus,
        message: "Successfully scraped the prices"
    }
}


export const getBookInfo = async (bookInfo) => {
    const results = await Promise.allSettled(
        websiteConfig.map(async (websiteInfo) => {
            if (websiteInfo.scraperType === "browserAutomation") {
                const {
                    bookPrices,
                    title,
                    publisher,
                    author,
                    link,
                    websiteName,
                    discountPrice,
                    message
                } = await browserScraper(bookInfo, websiteInfo);

                return {
                    websiteName,
                    title,
                    author,
                    publisher,
                    price: bookPrices,
                    discountPrice,
                    link,
                    message
                };
            }

            const {
                websiteName,
                title,
                author,
                publisher,
                discountPrice,
                price,
                link,
                message
            } = await htmlScraper(bookInfo, websiteInfo);

            return {
                websiteName,
                title,
                author,
                publisher,
                discountPrice,
                price,
                link,
                message
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



