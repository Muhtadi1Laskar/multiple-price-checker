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

        if (!response.ok) throw new Error(`HTTP status error: ${response.status}: ${url}`);

        const htmlBody = await response.text();
        return htmlBody;
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
            type: "title",
            query: `${bookInfo.title} ${bookInfo.publication}`
        });
    }

    if (bookInfo.author) {
        attempts.push({
            type: "titleAndauthor",
            query: `${bookInfo.title} ${bookInfo.author}`
        });
    }

    return attempts;
}


export const searchBook = async (bookInfo, websiteInfo) => {
    const { baseURL, websiteName, linkSelector, url } = websiteInfo;
    const { title } = bookInfo;
    const attempts = buildAttempts(bookInfo);
    const finalCandidates = [];

    for (const attempt of attempts) {
        const url = buildSearchURL(baseURL, attempt.query);

        const rawHTML = await makeRequest(url);
        const candidates = getDetailsPageLink(rawHTML, linkSelector, url, title);

        if (candidates.length > 0) {
            finalCandidates.push(...candidates);
            return finalCandidates;
        }
    }

    return null;
}

const buildSearchURL = (baseURL, query) => {
    const cleanQuery = !isNumeric(query) ? encodeURIComponent(query).replaceAll('%20', '+') : query;
    return baseURL + cleanQuery;
}

const getDetailsPageLink = (rawHTML, linkSelector, url, bookTitle) => {
    const $ = cheerio.load(rawHTML);

    return $(linkSelector)
    .filter((_, element) => $(element).text().trim() === bookTitle)
        .map((_, element) => {
            const href = $(element).attr("href");

            console.log($(element).text().trim());

            return href
                ? new URL(href, url).toString()
                : null;
        })
        .get()
        .filter(Boolean);
}


export const htmlScraper = async (bookInfo, websiteInfo) => {
    const { websiteName } = websiteInfo;
    const { title } = bookInfo;
    const bookDetailsPageLink = await searchBook(bookInfo, websiteInfo);

    if (!bookDetailsPageLink) {
        return {
            websiteName,
            title,
            message: `The book is not available on ${websiteName}`
        };
    }

    const rawHTML = await makeRequest(bookDetailsPageLink[0]);
    const $ = cheerio.load(rawHTML);
    const prices = $(websiteInfo.priceSelector)
        .map((_, el) => extractNumber($(el).text().trim()))
        .get();

    const [discountPrice, price] = prices;

    return {
        websiteName,
        title,
        discountPrice,
        price,
        link: bookDetailsPageLink[0],
        message: "Successfully scraped the prices"
    }
}

export const getBookInfo = async (bookInfo) => {
    const result = [];

    for (const websiteInfo of websiteConfig) {
        const { scraperType } = websiteInfo;

        if (scraperType === "browserAutomation") {
            const {
                bookPrices,
                link,
                websiteName,
                discountPrice,
                message
            } = await browserScraper(bookInfo, websiteInfo);

            result.push({
                websiteName,
                price: bookPrices,
                discountPrice,
                link,
                message
            })
            continue;
        }

        const {
            websiteName,
            title,
            discountPrice,
            price,
            link,
            message
        } = await htmlScraper(bookInfo, websiteInfo);

        result.push({
            websiteName,
            title,
            discountPrice,
            price,
            link,
            message
        });
    }
    return result;
}



