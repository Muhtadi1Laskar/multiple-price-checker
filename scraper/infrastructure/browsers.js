import { chromium } from "playwright";

let browserPromise;

export const getBrowser = () => {
    if (!browserPromise) {
        browserPromise = chromium.launch({
            headless: false,
            // args: [
            //     "--window-position=-32000,-32000",
            //     "--window-size=1280,800"
            // ]
        });
    }
    return browserPromise;
}


export const getPage = async () => {
    const browser = await getBrowser();
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    return { page, context };
}
