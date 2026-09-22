import * as cheerio from 'cheerio';
import { makeRequest } from "../../infrastructure/httpClient.js";
import { extractNumber, isNumeric } from "../../utils/utils.js";

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

const getDetailsPageLink = ({ rawHTML, linkSelector, url }) => {
    const $ = cheerio.load(rawHTML);

    return $(linkSelector)
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

    const stockStatus = Object.fromEntries(
        Object.entries(stockStatusSelector).map(([key, value]) => {
            const rawStatus = $(`td:contains('${key}') + td`).text().trim();
            const statusText = rawStatus.toLocaleLowerCase() === "available" ?
                "In Stock" :
                "Not available";
            return [value, statusText];
        })
    );

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