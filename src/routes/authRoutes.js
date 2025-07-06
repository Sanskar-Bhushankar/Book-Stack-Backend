import express from "express";
import { supabase, supabaseAdmin } from "../services/supabaseClient.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /auth/signup
router.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: "Username, email, and password are required." });
    }

    try {
        // 1. Sign up user with Supabase Auth
        const { data, error: signUpError } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (signUpError) {
            console.error("Supabase signUp error:", signUpError);
            // Check for duplicate email error from Supabase
            if (signUpError.message.includes("already registered")) {
                return res.status(409).json({ message: "Email already registered." });
            }
            return res.status(400).json({ message: signUpError.message });
        }

        const user = data.user;

        if (!user) {
            return res.status(500).json({ message: "User not returned after signup." });
        }

        // 2. Create custom profile in public.profiles table
        // Using supabaseAdmin here to bypass RLS for initial profile creation
        // if RLS on insert is causing issues, otherwise supabase (anon) can be used.
        const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .insert({ id: user.id, username: username });

        if (profileError) {
            console.error("Profile creation error:", profileError);
            // If profile creation fails, you might want to consider deleting the user from auth.users
            // This is a more advanced error handling scenario (transaction-like behavior)
            return res.status(500).json({ message: "Failed to create user profile. Username might already be taken." });
        }

        // 3. Establish session
        req.session.userId = user.id;
        req.session.username = username; // Store username in session for convenience

        res.status(201).json({
            message: "User registered and logged in successfully!",
            user: { id: user.id, email: user.email, username: username }
        });

    } catch (error) {
        console.error("Signup process error:", error);
        res.status(500).json({ message: "Internal server error during signup." });
    }
});

// POST /auth/login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        // 1. Sign in user with Supabase Auth
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (signInError) {
            console.error("Supabase signIn error:", signInError);
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const user = data.user;

        // 2. Fetch username from public.profiles table
        const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single();

        if (profileError || !profileData) {
            console.error("Profile fetch error during login:", profileError);
            // This should ideally not happen if profile was created during signup
            return res.status(500).json({ message: "User profile not found." });
        }

        // 3. Establish session
        req.session.userId = user.id;
        req.session.username = profileData.username; // Store username in session

        res.status(200).json({
            message: "Logged in successfully!",
            user: { id: user.id, email: user.email, username: profileData.username }
        });

    } catch (error) {
        console.error("Login process error:", error);
        res.status(500).json({ message: "Internal server error during login." });
    }
});

// POST /auth/logout
router.post("/logout", async (req, res) => {
    try {
        // 1. Sign out from Supabase Auth
        const { error: signOutError } = await supabase.auth.signOut();

        if (signOutError) {
            console.error("Supabase signOut error:", signOutError);
            // Proceed to destroy session even if Supabase sign out fails, to ensure local logout
        }

        // 2. Destroy Express session
        req.session.destroy((err) => {
            if (err) {
                console.error("Express session destroy error:", err);
                return res.status(500).json({ message: "Failed to log out." });
            }
            // Clear the cookie in the client's browser as well
            res.clearCookie("connect.sid"); // Name of the default session cookie
            res.status(200).json({ message: "Logged out successfully." });
        });

    } catch (error) {
        console.error("Logout process error:", error);
        res.status(500).json({ message: "Internal server error during logout." });
    }
});

// GET /auth/check-session (Protected Route to test session)
router.get("/check-session", isAuthenticated, (req, res) => {
    // If this code executes, it means isAuthenticated middleware passed
    res.status(200).json({
        message: "Session is active! You are logged in.",
        userId: req.session.userId, // Display userId from session
        username: req.session.username // Display username from session
    });
});

export default router; 