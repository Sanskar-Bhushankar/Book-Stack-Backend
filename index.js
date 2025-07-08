import express from "express";
import axios from "axios";
import cors from "cors";
import session from "express-session";
import dotenv from "dotenv";

dotenv.config(); 

import galleryRoutes from "./src/routes/galleryRoutes.js";
import authRoutes from "./src/routes/authRoutes.js"; 
import profileRoutes from "./src/routes/profileRoutes.js"; 

const app = express();


app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json()); 


app.use(session({
    // secret: process.env.SESSION_SECRET, 
    // resave: false,
    // saveUninitialized: false,
    // cookie: { 
    //     secure: process.env.NODE_ENV === 'production', 
    //     maxAge: 1000 * 60 * 60 * 24 
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,          // For Postman (non-HTTPS)
        sameSite: 'lax',        // Safe for cross-origin requests
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// Routes
app.use("/gallery", galleryRoutes);
app.use("/auth", authRoutes); 
app.use("/profile", profileRoutes); 

app.listen(3000,()=>{
    console.log("Server is running on port 3000");
})


