export const websiteConfig = [
    {
        websiteName: "baatighar",
        baseURL: "https://baatighar.com/shop?search=",
        linkSelector: "p.card_title a",
        url: "https://baatighar.com/",
        scraperType: "http",
        selectors: {
            publisherSelector: "h6:contains('Publication'):eq(0) + a span",
            priceSelector: "div[class*='product_price'] span[class*='oe_currency_value']",
            authorSelector: "a[class*='single_product_author_name'] span"
        }
    },
    {
        websiteName: "amazon.in",
        baseURL: "https://www.amazon.in/s?k=",
        linkSelector: "div[data-cy='title-receipe'].nth-child(1)",
        priceSelector: "div.a-section.apex-core-price-identifier .a-price-whole",
        url: "https://www.amazon.in/",
        scraperType: "browserAutomation",
        selectors: {
            bookTypeSelector: ".slot-title",
            bookPriceSelector: ".slot-price",
            searchSelector: "div.nav-search-field input",
            priceCardSelector: "#buybox-top-container span.a-button-inner",
            publisherSelector: "(//span[contains(text(), 'Publisher')])[2]//following-sibling::span",
            authorSelector: "span[class='author notFaded'] a"
        }
    }
];

export const bookLanguage = {
    "ইংরেজি": "en",
    "বাংলা": "bn"
};