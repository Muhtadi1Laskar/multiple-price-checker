import { chromium } from "playwright";
import { extractNumber } from "../utils/utils.js";

export const getPage = async () => {
    const browser = await chromium.launch({
        headless: false
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

        const isbn = await isbnLocator.isVisible() ?
            await isbnLocator.textContent() :
            null;
        const publication = await publicationLocator.isVisible() ?
            await publicationLocator.textContent() :
            null;

        return {
            title,
            isbn,
            publication
        };
    } finally {
        await browser.close();
    }
}

export const browserScraper = async (bookInfo, websiteInfo) => {
    const { browser, page } = await getPage();
    const { baseURL, name, linkSelector, url } = websiteInfo;
    const { isbn, title, publication } = bookInfo;

    // const bookItemSelector = `//span[@data-component-type="s-product-image"]//a[contains(@href, "/dp/${isbn.slice(3)}")]`;
    const bookItemSelector = `//div[@class="a-section"]//span[@data-component-type="s-product-image"]//a[contains(@href, "${isbn}")]`;
    const bookTypeSelector = ".slot-title";
    const bookPriceSelector = ".slot-price";

    const searchLocator = page.getByRole("searchbox", { name: "Search Amazon.in" });
    const bookItemLocator = page.locator(bookItemSelector).first();

    try {
        await page.goto(url);
        await searchLocator.waitFor({ state: "visible" });
        await searchLocator.fill(isbn);
        await searchLocator.press("Enter");

        await bookItemLocator.waitFor({ state: "visible" });

        const [productPage] = await Promise.all([
            page.waitForEvent("popup"),
            bookItemLocator.click()
        ]);

        await productPage.waitForLoadState("domcontentloaded");

        const editionButtons = productPage.locator("#buybox-top-container span.a-button-inner");
        const count = await editionButtons.count();

        const editions = [];

        for (let i = 0; i < count; i++) {
            const button = editionButtons.nth(i);

            const bookType = await button.locator(".slot-title").textContent();
            const price = await button.locator(".slot-price").textContent();
            const cleanPrice = extractNumber(price);

            if (bookType.includes("Audiobook")) continue;

            editions.push({
                bookType: bookType?.trim(),
                price: cleanPrice
            });
        }

        return {
            bookPrices: editions,
            link: productPage.url()
        };
    } finally {
        await browser.close();
    }
}




