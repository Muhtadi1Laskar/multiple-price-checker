import { chromium } from "playwright";
import { extractNumber } from "../utils/utils.js";
import { bookLanguage } from "../utils/configData.js";

export const getPage = async () => {
    const browser = await chromium.launch({
        headless: true
    });
    const page = await browser.newPage();

    return { browser, page };
}

export const extractMainData = async (url) => {
    const { browser, page } = await getPage();

    try {
        const tagName = "button";
        const buttonName = "Specification";
        const bookTitleSelector = "h1[class='bookTitle_bookName__B4CEH ']";
        const specificationTabLocator = page.getByRole(tagName, { name: buttonName });

        await page.goto(url);
        await specificationTabLocator.waitFor({ state: 'visible' });
        await specificationTabLocator.click();
        await page.waitForTimeout(1000);

        const title = await page.locator(bookTitleSelector).evaluate(node => {
            return Array.from(node.childNodes)
                .filter(child => child.nodeType === 3)
                .map(child => child.textContent.trim())
                .join('');
        });
        const isbnLocator = page.locator("tr")
            .filter({ hasText: "ISBN" })
            .locator("td")
            .nth(1);
        const publicationLocator = page.locator("tr")
            .filter({ hasText: "Publisher" })
            .locator("td")
            .nth(1);
        const authorLocator = page.locator("tr")
            .filter({ hasText: "Author" })
            .locator("td")
            .nth(1);
        const languageLocator = page.locator("tr")
            .filter({ hasText: "Language" })
            .locator("td")
            .nth(1);

        const isbn = await isbnLocator.isVisible() ?
            await isbnLocator.textContent() :
            null;
        const publication = await publicationLocator.isVisible() ?
            await publicationLocator.textContent() :
            null;
        const author = await authorLocator.isVisible() ?
            await authorLocator.textContent() :
            null;
        const language = await languageLocator.isVisible() ?
            await languageLocator.textContent() :
            null;

        const languageEN = bookLanguage[language] || null;

        return {
            title,
            isbn,
            publication,
            author,
            language: languageEN
        };
    } finally {
        await browser.close();
    }
}

export const browserScraper = async (bookInfo, websiteInfo) => {
    const { browser, page } = await getPage();
    const { websiteName, url, selectors } = websiteInfo;
    const { isbn, title, publication, author, language } = bookInfo;
    const { 
        bookTypeSelector, 
        bookPriceSelector, 
        searchSelector, 
        priceCardSelector, 
        publisherSelector,
        authorSelector
    } = selectors;

    const isbnQuery = language === "bn" ? isbn : `${title} ${isbn}`;
    const searchQuery = !isbn ? `${title} ${author}` : isbnQuery;
    const linkIdentifier = isbn ? isbn : title;


    const bookItemSelector = `//div[@class="a-section"]//span[@data-component-type="s-product-image"]//a[contains(@href, "${linkIdentifier}")]`;
    const searchLocator = page.locator(searchSelector);
    const bookItemLocator = page.locator(bookItemSelector).first();

    try {
        await page.goto(url);
        await page.waitForLoadState("domcontentloaded");
        await searchLocator.fill(searchQuery);
        await searchLocator.press("Enter");
        await bookItemLocator.waitFor({ state: "visible" });

        if (!await bookItemLocator.isVisible()) {
            return {
                websiteName,
                title,
                message: `The book is not available on ${websiteName}`
            };
        }

        const [productPage] = await Promise.all([
            page.waitForEvent("popup"),
            bookItemLocator.click()
        ]);

        await productPage.waitForLoadState("domcontentloaded");

        const publisherLocator = productPage.locator(publisherSelector);
        const authorLocator = productPage.locator(authorSelector);

        const publisher = await publisherLocator.isVisible() ? 
            await publisherLocator.textContent() : 
            null;
        const author = await authorLocator.first().isVisible() ?
            await authorLocator.first().textContent() :
            null;

        const editionButtons = productPage.locator(priceCardSelector);
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
            link: productPage.url(),
            message: "Successfully scraped the prices"
        };
    } finally {
        await browser.close();
    }
}




