import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { 
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
} from "../controllers/subscription.controller.js";

const router = Router();

// Secure all routes in this router since subscriptions require authentication
router.use(verifyJWT);

// Routes for a channel
// GET: Fetch subscriber list
// POST: Toggle subscription (Subscribe/Unsubscribe)
router.route("/c/:channelId")
    .get(getUserChannelSubscribers)
    .post(toggleSubscription);

// Route for getting a subscriber's subscription list
// GET: Fetch channel list
router.route("/u/:subscriberId").get(getSubscribedChannels);

export default router;
