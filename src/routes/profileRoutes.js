import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { supabase, supabaseAdmin } from "../services/supabaseClient.js";
import axios from "axios";

const router = express.Router();

// POST /profile/my-books - Add a book to user's profile
router.post("/my-books", isAuthenticated, async (req, res) => {
    const { open_library_key, title, author_name, image_url } = req.body;
    const userId = req.session.userId;

    if (!open_library_key || !title || !author_name) {
        return res.status(400).json({ message: "Book key, title, and author are required." });
    }

    try {
        // Check if the book already exists for this user
        const { data: existingBook, error: checkError } = await supabase
            .from("user_books")
            .select("id")
            .eq("user_id", userId)
            .eq("open_library_key", open_library_key)
            .single();

        if (existingBook) {
            return res.status(409).json({ message: "Book already added to your profile." });
        }

        // Add the book to the user_books table
        const { data, error: insertError } = await supabase
            .from("user_books")
            .insert({
                user_id: userId,
                open_library_key: open_library_key,
                title: title,
                author_name: author_name,
                image_url: image_url || null, // Allow null if not provided
                current_page_number: 0, // Default to 0 pages read
                status: "to-read", // Default status
                // start_date and finish_date are nullable and will be set later by user interaction if needed
            })
            .select(); // Return the inserted data

        if (insertError) {
            console.error("Error adding book to user profile:", insertError);
            // Catch potential unique constraint violation (though our check above should prevent most)
            if (insertError.code === '23505') { // PostgreSQL unique violation error code
                return res.status(409).json({ message: "Book already exists in your profile." });
            }
            return res.status(500).json({ message: "Failed to add book to profile." });
        }

        res.status(201).json({
            message: "Book added to profile successfully!",
            userBook: data[0]
        });

    } catch (error) {
        console.error("Server error when adding book:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});

// GET /profile/my-books - View all books in user's profile
router.get("/my-books", isAuthenticated, async (req, res) => {
    const userId = req.session.userId;

    try {
        const { data: userBooks, error: fetchError } = await supabase
            .from("user_books")
            .select("*")
            .eq("user_id", userId);

        if (fetchError) {
            console.error("Error fetching user's books:", fetchError);
            return res.status(500).json({ message: "Failed to fetch user's books." });
        }

        // If no books added, return empty array
        if (!userBooks || userBooks.length === 0) {
            return res.status(200).json([]);
        }

        // Augment each book with detailed Open Library data and reading sessions
        const augmentedBooks = await Promise.all(userBooks.map(async (book) => {
            let openLibraryDetails = {};
            let readingSessions = [];

            // Fetch full details from Open Library for the work
            try {
                const olid = book.open_library_key.split("/works/")[1];
                const olidApiUrl = `https://openlibrary.org/api/books?bibkeys=OLID:${olid}&format=json&jscmd=data`;
                const olResponse = await axios.get(olidApiUrl);

                if (olResponse.data && olResponse.data[`OLID:${olid}`]) {
                    const olBookData = olResponse.data[`OLID:${olid}`];
                    const sourceData = olBookData.details || olBookData;

                    openLibraryDetails = {
                        description: typeof sourceData.description === 'object' && sourceData.description.value 
                                     ? sourceData.description.value 
                                     : sourceData.description || "N/A",
                        excerpts: sourceData.excerpts && sourceData.excerpts.length > 0 
                                  ? sourceData.excerpts.map(excerpt => excerpt.text).join("\n\n") 
                                  : "N/A",
                        number_of_pages: sourceData.number_of_pages || "N/A",
                        // Additional fields from details API
                        ol_isbn_10: sourceData.isbn_10 && sourceData.isbn_10.length > 0 ? sourceData.isbn_10[0] : "N/A",
                        ol_isbn_13: sourceData.isbn_13 && sourceData.isbn_13.length > 0 ? sourceData.isbn_13[0] : "N/A",
                        ol_subjects: sourceData.subjects || [],
                        // Use the correct publish date field from the details API
                        ol_publish_date: sourceData.publish_date || "N/A",
                    };
                }
            } catch (olError) {
                console.error(`Error fetching Open Library details for key ${book.open_library_key}:`, olError.message);
                // Continue even if OL API fails for one book
            }

            // Fetch reading sessions for this user_book
            try {
                const { data: sessions, error: sessionsError } = await supabase
                    .from("reading_sessions")
                    .select("*")
                    .eq("user_book_id", book.id)
                    .order("session_date", { ascending: false });

                if (sessionsError) {
                    console.error(`Error fetching reading sessions for user_book ${book.id}:`, sessionsError);
                } else {
                    readingSessions = sessions;
                }
            } catch (sessionFetchError) {
                console.error(`Unexpected error fetching reading sessions for user_book ${book.id}:`, sessionFetchError);
            }

            // Combine all data
            return {
                ...book, // Contains id, user_id, open_library_key, denormalized title, author, image, current_page_number, status
                openLibraryDetails: openLibraryDetails, // Additional details from Open Library
                readingSessions: readingSessions // List of reading sessions
            };
        }));

        res.status(200).json(augmentedBooks);

    } catch (error) {
        console.error("Server error when fetching user's books:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});

// GET /profile/my-books/:userBookId - View details and timeline for a single book in user's profile
router.get("/my-books/:userBookId", isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { userBookId } = req.params;

    try {
        // 1. Fetch the specific user_book entry and verify ownership
        const { data: userBook, error: fetchError } = await supabase
            .from("user_books")
            .select("*", "id")
            .eq("id", userBookId)
            .eq("user_id", userId)
            .single();

        if (fetchError || !userBook) {
            console.error("User book not found or unauthorized:", fetchError);
            return res.status(404).json({ message: "Book not found in your profile or you are not authorized." });
        }

        let openLibraryDetails = {};
        let readingSessions = [];

        // 2. Fetch full details from Open Library for the work
        try {
            const olid = userBook.open_library_key.split("/works/")[1];
            const olidApiUrl = `https://openlibrary.org/api/books?bibkeys=OLID:${olid}&format=json&jscmd=data`;
            const olResponse = await axios.get(olidApiUrl);

            if (olResponse.data && olResponse.data[`OLID:${olid}`]) {
                const olBookData = olResponse.data[`OLID:${olid}`];
                const sourceData = olBookData.details || olBookData;

                openLibraryDetails = {
                    description: typeof sourceData.description === 'object' && sourceData.description.value 
                                 ? sourceData.description.value 
                                 : sourceData.description || "N/A",
                    excerpts: sourceData.excerpts && sourceData.excerpts.length > 0 
                              ? sourceData.excerpts.map(excerpt => excerpt.text).join("\n\n") 
                              : "N/A",
                    number_of_pages: sourceData.number_of_pages || "N/A",
                    ol_isbn_10: sourceData.isbn_10 && sourceData.isbn_10.length > 0 ? sourceData.isbn_10[0] : "N/A",
                    ol_isbn_13: sourceData.isbn_13 && sourceData.isbn_13.length > 0 ? sourceData.isbn_13[0] : "N/A",
                    ol_subjects: sourceData.subjects || [],
                    ol_publish_date: sourceData.publish_date || "N/A",
                };
            }
        } catch (olError) {
            console.error(`Error fetching Open Library details for key ${userBook.open_library_key}:`, olError.message);
        }

        // 3. Fetch reading sessions for this specific user_book
        try {
            const { data: sessions, error: sessionsError } = await supabase
                .from("reading_sessions")
                .select("*")
                .eq("user_book_id", userBookId)
                .order("session_date", { ascending: false });

            if (sessionsError) {
                console.error(`Error fetching reading sessions for user_book ${userBookId}:`, sessionsError);
            } else {
                readingSessions = sessions;
            }
        } catch (sessionFetchError) {
            console.error(`Unexpected error fetching reading sessions for user_book ${userBookId}:`, sessionFetchError);
        }

        // 4. Combine and respond
        res.status(200).json({
            ...userBook, // Contains basic info from user_books table
            openLibraryDetails: openLibraryDetails, // Detailed info from Open Library
            readingSessions: readingSessions // All associated reading sessions
        });

    } catch (error) {
        console.error("Server error when fetching single user book details:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});

// POST /profile/my-books/:userBookId/add-session - Log reading progress
router.post("/my-books/:userBookId/add-session", isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { userBookId } = req.params;
    const { pages_read_in_session, notes } = req.body;

    if (!pages_read_in_session || typeof pages_read_in_session !== 'number' || pages_read_in_session <= 0) {
        return res.status(400).json({ message: "Pages read must be a positive number." });
    }

    try {
        // 1. Verify ownership of the user_book
        const { data: userBook, error: userBookError } = await supabase
            .from("user_books")
            .select("id, current_page_number")
            .eq("id", userBookId)
            .eq("user_id", userId)
            .single();

        if (userBookError || !userBook) {
            console.error("User book not found or unauthorized for session add:", userBookError);
            return res.status(403).json({ message: "Unauthorized or book not found in your profile." });
        }

        // 2. Insert new reading session
        const { data: newSession, error: sessionInsertError } = await supabase
            .from("reading_sessions")
            .insert({
                user_book_id: userBookId,
                pages_read_in_session: pages_read_in_session,
                notes: notes || null,
                // session_date defaults to now() in schema
            })
            .select();

        if (sessionInsertError) {
            console.error("Error inserting reading session:", sessionInsertError);
            return res.status(500).json({ message: "Failed to log reading session." });
        }

        // 3. Update current_page_number in user_books
        const newCurrentPage = userBook.current_page_number + pages_read_in_session;

        const { data: updatedBook, error: updateBookError } = await supabase
            .from("user_books")
            .update({ current_page_number: newCurrentPage })
            .eq("id", userBookId)
            .eq("user_id", userId) // Re-verify ownership on update
            .select();

        if (updateBookError) {
            console.error("Error updating user_book current_page_number:", updateBookError);
            // This is a soft error, session was logged, but page update failed
            return res.status(500).json({ message: "Reading session logged, but failed to update current page." });
        }

        res.status(200).json({
            message: "Reading session logged and progress updated!",
            session: newSession[0],
            updatedCurrentPage: updatedBook[0].current_page_number
        });

    } catch (error) {
        console.error("Server error when logging reading session:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});

export default router; 