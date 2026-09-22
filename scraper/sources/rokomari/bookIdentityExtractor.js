import { blockExtraResources } from "../../crawler/browser.js";
import { getPage } from "../../infrastructure/browsers.js";
import { bookLanguage } from "../../utils/configData.js";
import { removeParentheses } from "../../utils/utils.js";

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

        const isbnRow = page.locator("tr")
            .filter({ hasText: "Name" });

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