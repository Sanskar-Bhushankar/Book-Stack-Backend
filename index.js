import express from "express";
import axios from "axios";
import cors from "cors";
import galleryRoutes from "./src/routes/galleryRoutes.js";

const app = express();

app.use(cors());

app.use("/gallery", galleryRoutes);

app.listen(3000,()=>{
    console.log("Server is running on port 3000");
})


