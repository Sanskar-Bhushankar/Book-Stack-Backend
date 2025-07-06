function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        // User is authenticated, proceed to the next middleware or route handler
        next();
    } else {
        // User is not authenticated, send a 401 Unauthorized response
        res.status(401).json({ message: "Unauthorized: Please log in." });
    }
}

export { isAuthenticated }; 