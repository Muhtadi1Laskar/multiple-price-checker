import express from "express";
import cors from "cors";
import helmet from "helmet";
import { scrapeMultipleData } from "../scraper/main.js";

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.post("/api/compare", async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                message: "Rokomari URL is required"
            });
        }
        const result = await scrapeMultipleData(url);

        res.json(result);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to compare prices"
        });
    }
});

export default app;