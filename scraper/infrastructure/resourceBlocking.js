export const blockExtraResources = async (page) => {
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