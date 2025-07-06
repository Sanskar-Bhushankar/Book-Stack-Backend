import express from "express";
import axios from "axios";
import cors from "cors";
import session from "express-session";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

import galleryRoutes from "./src/routes/galleryRoutes.js";
import authRoutes from "./src/routes/authRoutes.js"; // New import

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON request bodies

// Session middleware configuration
app.use(session({
    secret: process.env.SESSION_SECRET, // Use a strong, random secret from your .env
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Routes
app.use("/gallery", galleryRoutes);
app.use("/auth", authRoutes); // Mount authentication routes

app.listen(3000,()=>{
    console.log("Server is running on port 3000");
})


