import { chromium } from "playwright";
import { extractNumber, removeParentheses } from "../utils/utils.js";
import { bookLanguage } from "../utils/configData.js";

let browserPromise;

const getBrowser = () => {
    if (!browserPromise) {
        browserPromise = chromium.launch({
            headless: true
        });
    }
    return browserPromise;
}

export const getPage = async () => {
    const browser = await getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    return { page, context };
}

export const extractMainData = async (url) => {
    const { page, context } = await getPage();

    try {
        const tagName = "button";
        const buttonName = "Specification";
        const specificationTabLocator = page.getByRole(tagName, { name: buttonName });

        await blockExtraResources(page);

        await page.goto(url);
        await specificationTabLocator.waitFor({ state: 'visible' });
        await specificationTabLocator.click();
        // await page.waitForTimeout(800);

        const isbnRow = page.locator("tr")
            .filter({ hasText: "ISBN" });

        await isbnRow.waitFor({
            status: "attached",
            timeout: 3000
        });

        const specification = await page.locator("tr").evaluateAll((rows) => {
            const data = {};

            for (const row of rows) {
                const cells = row.querySelectorAll("td");

                if (cells.length < 2) continue;

                const key = cells[0].textContent?.trim();
                const value = cells[1].textContent?.trim();

                if (key && value) {
                    data[key] = value;
                }
            }

            return data;
        });

        const title = specification["Name"] ?? null;
        const isbn = specification["ISBN"] ?? null;
        const publication = specification["Publisher"] ?? null;
        const author = specification["Author"] ?? null;
        const language = specification["Language"] ?? null;

        const languageEN = bookLanguage[language] || null;
        const cleanTitle = removeParentheses(title);
        const cleanPublication = removeParentheses(publication);

        return {
            title: cleanTitle,
            isbn,
            publication: cleanPublication,
            author,
            language: languageEN
        };
    } finally {
        await context.close();
    }
}

export const browserScraper = async (bookInfo, websiteInfo) => {
    const { page, context } = await getPage();
    const { websiteName, url, selectors, searchURL } = websiteInfo;
    const {
        isbn,
        title,
        author,
        language
    } = bookInfo;

    const {
        bookTypeSelector,
        bookPriceSelector,
        priceCardSelector,
        publisherSelector,
        authorSelector,
        searchSelector
    } = selectors;

    const isbnQuery = language === "bn" ? isbn : `${title} ${isbn}`;
    const searchQuery = !isbn ? `${title} ${author}` : isbnQuery;
    const linkIdentifier = isbn ? isbn : title;

    const searchLocator = page.locator(searchSelector);
    const bookItemLocator = page.locator(
        `//div[@class="a-section"]` +
        `//span[@data-component-type="s-product-image"]` +
        `//a[contains(@href, "${linkIdentifier}")]`
    ).first();

    try {
        await blockExtraResources(page);

        const fullSearchURL = new URL("/s", searchURL);
        fullSearchURL.searchParams.set("k", searchQuery);

        // console.log("URL", fullSearchURL.toString());

        // await page.goto(fullSearchURL.toString(), {
        //     waitUntil: "domcontentloaded"
        // });

        await page.goto(fullSearchURL.toString(), {
            waitUntil: "commit",
            timeout: 15000
        });
        // await searchLocator.fill(searchQuery);

        // await Promise.all([
        //     page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => { }),
        //     searchLocator.press("Enter")

        // ]);

        await bookItemLocator.waitFor({
            state: "attached",
            timeout: 5000
        });

        const bookDetailsPageURL = await bookItemLocator.isVisible() ?
            await bookItemLocator.getAttribute("href") :
            null;

        if (!bookDetailsPageURL) {
            return {
                websiteName,
                title,
                message: `The book is not available on ${websiteName}`
            };
        }

        const fullBookLinkURL = new URL(
            bookDetailsPageURL,
            url
        ).toString();

        await page.goto(fullBookLinkURL, {
            waitUntil: "domcontentloaded"
        });

        const publisherLocator = page.locator(publisherSelector);
        const authorLocator = page.locator(authorSelector);

        const publisher = await publisherLocator.isVisible() ?
            await publisherLocator.textContent() :
            null;
        const author = await authorLocator.first().isVisible() ?
            await authorLocator.first().textContent() :
            null;

        const editionButtons = page.locator(priceCardSelector);
        const count = await editionButtons.count();

        const editions = [];

        for (let i = 0; i < count; i++) {
            const button = editionButtons.nth(i);

            const bookType = await button.locator(bookTypeSelector).textContent();
            const price = await button.locator(bookPriceSelector).textContent();
            const cleanPrice = extractNumber(price);

            if (bookType.includes("Audiobook")) continue;

            editions.push({
                bookType: bookType?.trim(),
                price: cleanPrice
            });
        }

        return {
            websiteName,
            title,
            publisher,
            author,
            bookPrices: editions,
            discountPrice: null,
            link: page.url(),
            message: "Successfully scraped the prices"
        };
    } catch (error) {
        console.error(`Failed to parse data from ${websiteName}`, error);
        return {
            websiteName,
            title,
            message: "Failed to parse data"
        }
    }
    finally {
        await context.close();
    }
}


const blockExtraResources = async (page) => {
    await page.route("**/*", async (route) => {
        const resourceType = route.request().resourceType();

        if (
            resourceType === "image" ||
            resourceType === "font" ||
            resourceType === "media"
        ) {
            await route.abort();
            return;
        }

        await route.continue();
    });
}
