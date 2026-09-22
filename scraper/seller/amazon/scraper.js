import { getPage } from "../../infrastructure/browsers.js";
import { blockExtraResources } from "../../infrastructure/resourceBlocking.js";
import { extractNumber } from "../../utils/utils.js";


export const amazonScraper = async (bookInfo, websiteInfo) => {
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
        stockStatusSelector
    } = selectors;

    const isbnQuery = language === "bn" ? isbn : `${title} ${isbn}`;
    const searchQuery = !isbn ? `${title} ${author}` : isbnQuery;
    const linkIdentifier = isbn ? isbn : title;

    const bookItemLocator = page.locator(
        `//div[@class="a-section"]` +
        `//span[@data-component-type="s-product-image"]` +
        `//a[contains(@href, "${linkIdentifier}")]`
    ).first();

    try {
        await blockExtraResources(page);

        const fullSearchURL = new URL("/s", searchURL);
        fullSearchURL.searchParams.set("k", searchQuery);

        await page.goto(fullSearchURL.toString(), {
            waitUntil: "domcontentloaded"
        });
        // await page.waitForTimeout(700);

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
        const stockStatusLocator = page.locator(stockStatusSelector);

        const publisher = await publisherLocator.isVisible() ?
            await publisherLocator.textContent() :
            null;
        const author = await authorLocator.first().isVisible() ?
            await authorLocator.first().textContent() :
            null;
        const stockStatus = {
            online: await stockStatusLocator.isVisible() ?
                "In stock" :
                "Not available"
        };

        const editionButtons = page.locator(priceCardSelector);
        const count = await editionButtons.count();

        const editions = [];

        for (let i = 0; i < count; i++) {
            const button = editionButtons.nth(i);

            const bookType = await button.locator(bookTypeSelector).textContent();
            const price = await button.locator(bookPriceSelector).textContent();
            let cleanPrice = extractNumber(price);

            if (bookType.includes("Audiobook")) continue;
            if(!cleanPrice) {
                cleanPrice = null;
            }

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
            stockStatus,
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



