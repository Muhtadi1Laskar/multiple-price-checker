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

        if (!response.ok) {
            throw new Error(`HTTP status error: ${response.status}: ${url}`);
        }

        return response.text();
    } catch (error) {
        console.error("Error loading HTML body: ", error);
        return error;
    }
}