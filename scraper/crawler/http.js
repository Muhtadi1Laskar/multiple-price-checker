import * as cheerio from 'cheerio';
import { browserScraper } from './browser.js';

const websiteURLS = {
    baatighar: "https://baatighar.com/shop?search=",
    prothoma: "https://www.prothoma.com/website/search?search=",
    amazon: "https://www.amazon.in/s?k="
};

const websiteConfig = [
    // {
    //     name: "baatighar",
    //     baseURL: "https://baatighar.com/shop?search=",
    //     linkSelector: "a.single_card_image_blk",
    //     priceSelector: "div[class*='product_price'] span[class*='oe_currency_value']",
    //     url: "https://baatighar.com/",
    //     scraperType: "http"
    // },
    {
        name: "amazon india",
        baseURL: "https://www.amazon.in/s?k=",
        linkSelector: "div[data-cy='title-receipe'].nth-child(1)",
        priceSelector: "div.a-section.apex-core-price-identifier .a-price-whole",
        url: "https://www.amazon.in/",
        scraperType: "browserAutomation"
    }
]

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

    return attempts;
}


export const searchBook = async (bookInfo, websiteInfo) => {
    const { baseURL, name, linkSelector, url } = websiteInfo;
    const attempts = buildAttempts(bookInfo);
    const finalCandidates = [];

    for (const attempt of attempts) {
        const url = buildSearchURL(baseURL, attempt.query);

        const rawHTML = await makeRequest(url);
        const candidates = getDetailsPageLink(rawHTML, linkSelector, url);

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

const getDetailsPageLink = (rawHTML, linkSelector, url) => {
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

export const getBookInfo = async (bookInfo) => {
    const result = [];

    for (const websiteInfo of websiteConfig) {
        const { name, scraperType } = websiteInfo;

        if(scraperType === "browserAutomation") {
            const data = await browserScraper(bookInfo, websiteInfo);
        }

        const bookDetailsPageLink = await searchBook(bookInfo, websiteInfo);

        console.log("Link: ", bookDetailsPageLink);

        if (!bookDetailsPageLink) {
            result.push({
                name: name,
                message: `The book is not available on ${name}`
            });
            continue;
        }

        const rawHTML = await makeRequest(bookDetailsPageLink[0]);
        const $ = cheerio.load(rawHTML);
        const prices = $(websiteInfo.priceSelector)
            .map((_, el) => parseFloat($(el).text().trim()))
            .get();

        const [discountPrice, price] = prices;

        result.push({
            name,
            discountPrice,
            price,
            link: bookDetailsPageLink[0]
        });
    }
    return result;
}



