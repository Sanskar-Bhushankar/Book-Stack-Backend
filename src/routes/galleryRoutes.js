import express from "express";
import axios from "axios";
import { getTrendingBooks, searchBooks, getBookDetails } from "../controllers/routesController.js";

const router = express.Router();

// 🔥 Trending Books
router.get("/", getTrendingBooks);

router.get("/search", searchBooks);

router.get("/works/:workId", getBookDetails);

export default router;
