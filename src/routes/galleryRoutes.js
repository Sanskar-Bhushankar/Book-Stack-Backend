import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const query = "Trending"; // Default search query
        const apiUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl);

        // 🔥 Map only specific fields
        const books = response.data.docs.slice(0, 10).map(book => ({
            title: book.title || "N/A",
            author_name: book.author_name ? book.author_name[0] : "N/A",
            first_publish_year: book.first_publish_year || "N/A",
            key: book.key || "N/A", // This is the work key like "/works/OL8894965W"
            cover_image: book.cover_i
                ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                : "https://via.placeholder.com/150x200?text=No+Cover" // Fallback if no cover
        }));

        res.json(books);
    } catch (error) {
        console.error("Error fetching trending books:", error);
        res.status(500).json({ message: "Error fetching trending books" });
    }
});

router.get("/search", async (req, res) => {
    const searchQuery = req.query.q; // Example: ?q=python

    if (!searchQuery) {
        return res.status(400).json({ message: "Query param 'q' is required (e.g. /search?q=python)" });
    }

    try {
        const apiUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}`;
        const response = await axios.get(apiUrl);

        const books = response.data.docs.slice(0, 10).map(book => ({
            title: book.title || "N/A",
            author_name: book.author_name ? book.author_name[0] : "N/A",
            first_publish_year: book.first_publish_year || "N/A",
            key: book.key || "N/A", // This is the work key like "/works/OL8894965W"
            cover_image: book.cover_i
                ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                : "https://via.placeholder.com/150x200?text=No+Cover"
        }));

        res.json(books);
    } catch (error) {
        console.error("Error fetching search results:", error);
        res.status(500).json({ message: "Error fetching search results" });
    }
})

router.get("/works/:workId", async (req, res) => {
    const workKey = `/works/${req.params.workId}`; // Example: /works/OL8894965W

    try {
     
        const workUrl = `https://openlibrary.org${workKey}.json`;
        const workRes = await axios.get(workUrl);
        const workData = workRes.data;

        let authors = [];
        if (workData.authors && workData.authors.length > 0) {
            authors = await Promise.all(
                workData.authors.map(async (authorObj) => {
                    const authorKey = authorObj.author.key; // Example: /authors/OL25931A
                    const authorUrl = `https://openlibrary.org${authorKey}.json`;
                    const authorRes = await axios.get(authorUrl);
                    return {
                        name: authorRes.data.name || "N/A",
                        bio: authorRes.data.bio?.value || authorRes.data.bio || "No bio available",
                        birth_date: authorRes.data.birth_date || "Unknown",
                        death_date: authorRes.data.death_date || "Unknown",
                    };
                })
            );
        }

        const combinedDetails = {
            work: {
                title: workData.title || "N/A",
                description: workData.description?.value || workData.description || "No description available",
                subjects: workData.subjects || [],
                first_publish_date: workData.first_publish_date || "Unknown",
                covers: workData.covers?.map(
                    (id) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`
                ) || [],
            },
            authors: authors
        };

        res.json(combinedDetails);

    } catch (error) {
        console.error("Error fetching book details:", error);
        res.status(500).json({ message: "Error fetching book details" });
    }
});

export default router;
