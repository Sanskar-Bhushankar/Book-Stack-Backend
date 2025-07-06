import axios from "axios";

//  Trending Books
export const getTrendingBooks=async (req, res) => {
    try {
        const query = "Trending"; // Default search query
        const apiUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl);

        const books = response.data.docs.slice(0, 10).map(book => ({
            title: book.title || "N/A",
            author_name: book.author_name ? book.author_name[0] : "N/A",
            first_publish_year: book.first_publish_year || "N/A",
            open_library_key: book.key || "N/A", // Consistent naming
            image_url: book.cover_i
                ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                : "https://via.placeholder.com/150x200?text=No+Cover" // Fallback if no cover
        }));

        res.json(books);
    } catch (error) {
        console.error("Error fetching trending books:", error);
        res.status(500).json({ message: "Error fetching trending books" });
    }
}


//  Search Books
export const searchBooks=async (req, res) => {
    const searchQuery = req.query.q; // Example: ?q=python

    if (!searchQuery) {
        return res.status(400).json({ message: "Query param 'q' is required (e.g. /search?q=python)" });
    }

    try {
        const apiUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}`;
        const response = await axios.get(apiUrl);

        const books = response.data.docs.map(book => ({
            title: book.title || "N/A",
            author_name: book.author_name ? book.author_name[0] : "N/A",
            first_publish_year: book.first_publish_year || "N/A",
            open_library_key: book.key || "N/A", // Consistent naming
            image_url: book.cover_i
                ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                : "https://via.placeholder.com/150x200?text=No+Cover"
        }));

        res.json(books);
    } catch (error) {
        console.error("Error fetching search results:", error);
        res.status(500).json({ message: "Error fetching search results" });
    }
}


//  Get Book Details
export const getBookDetails=async (req, res) => {
    const workId = req.params.workId; // Get workId from params (e.g., OL12204W)
    const open_library_key = `/works/${workId}`; // Construct the full key

    try {
        const workUrl = `https://openlibrary.org${open_library_key}.json`;
        const workRes = await axios.get(workUrl); // Fetch work details first
        const workData = workRes.data;

        let authors = [];
        if (workData.authors && workData.authors.length > 0) {
            authors = await Promise.all(
                workData.authors.map(async (authorObj) => {
                    const authorKey = authorObj.author.key; // Example: /authors/OL25931A
                    const authorUrl = `https://openlibrary.org${authorKey}.json`;
                    try {
                        const authorRes = await axios.get(authorUrl);
                        return {
                            name: authorRes.data.name || "N/A",
                            bio: authorRes.data.bio?.value || authorRes.data.bio || "No bio available",
                            birth_date: authorRes.data.birth_date || "Unknown",
                            death_date: authorRes.data.death_date || "Unknown",
                        };
                    } catch (authorError) {
                        console.warn(`Could not fetch details for author ${authorKey}:`, authorError.message);
                        return { name: "N/A", bio: "No bio available", birth_date: "Unknown", death_date: "Unknown" };
                    }
                })
            );
        }

        const title = workData.title || "N/A";
        const author_name = authors.length > 0 
                            ? authors[0].name 
                            : (workData.author_names && workData.author_names.length > 0 ? workData.author_names[0] : "N/A"); // Fallback to workData.author_names if authors array is empty
        const image_url = workData.covers && workData.covers.length > 0
                          ? `https://covers.openlibrary.org/b/id/${workData.covers[0]}-M.jpg`
                          : "https://via.placeholder.com/150x200?text=No+Cover"; // Fallback

        res.json({
            // Add denormalized key fields here for frontend convenience
            open_library_key: open_library_key,
            title: title,
            author_name: author_name,
            image_url: image_url,

            // Original response data from Open Library
            work: {
                title: workData.title || "N/A",
                description: workData.description?.value || workData.description || "No description available",
                subjects: workData.subjects || [],
                first_publish_date: workData.first_publish_date || "Unknown",
                covers: workData.covers?.map(
                    (id) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`
                ) || [],
            },
            authors: authors // Use the correctly populated authors array
        });

    } catch (error) {
        console.error("Error fetching book details:", error);
        // Check for 404 specifically
        if (error.response && error.response.status === 404) {
            res.status(404).json({ message: "Book work details not found." });
        } else {
            res.status(500).json({ message: "Error fetching book details" });
        }
    }
}



