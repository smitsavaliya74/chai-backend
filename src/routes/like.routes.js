import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    toggleVideoLike,
    toggleCommentLike,
    toggleTweetLike,
    getLikedVideos
} from "../controllers/like.controller.js";

const router = Router();

// Secure all routes in this router since liking/unliking requires authentication
router.use(verifyJWT);

// Route to get all liked videos for the logged-in user
router.route("/videos").get(getLikedVideos);

// Route to toggle like on a video
router.route("/toggle/v/:videoId").post(toggleVideoLike);

// Route to toggle like on a comment
router.route("/toggle/c/:commentId").post(toggleCommentLike);

// Route to toggle like on a tweet
router.route("/toggle/t/:tweetId").post(toggleTweetLike);

export default router;
