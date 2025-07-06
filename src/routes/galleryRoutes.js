import express from "express";
import { getTrendingBooks, searchBooks, getBookDetails } from "../controllers/routesController.js";

const router = express.Router();

// Gallery Routes
router.get("/", getTrendingBooks);
router.get("/search", searchBooks);
router.get("/works/:workId", getBookDetails);

export default router;
