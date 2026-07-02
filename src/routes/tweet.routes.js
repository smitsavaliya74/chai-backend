import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
} from "../controllers/tweet.controller.js";

const router = Router();

// Secure all routes in this router since tweeting requires authentication
router.use(verifyJWT);

// Route to handle tweets creation/retrieval
router.route("/").post(createTweet);

// Route to get a user's tweets
router.route("/user/:userId").get(getUserTweets);

// Route to update/delete specific tweet
router.route("/:tweetId").patch(updateTweet);
router.route("/:tweetId").delete(deleteTweet);

export default router;
