import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { 
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
} from "../controllers/comment.controller.js";

const router = Router();

// Route to handle comments for a video
// GET: Public route to fetch video comments
// POST: Secured route (requires JWT login) to add a comment
router.route("/:videoId")
    .get(getVideoComments)
    .post(verifyJWT, addComment);

// Route to handle a specific comment by ID
// PATCH: Secured route to update a comment
// DELETE: Secured route to delete a comment
router.route("/c/:commentId")
    .patch(verifyJWT, updateComment)
    .delete(verifyJWT, deleteComment);

export default router;
