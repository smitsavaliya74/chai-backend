import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { 
    getChannelStats,
    getChannelVideos
} from "../controllers/dashboard.controller.js";

const router = Router();

// Secure all routes in this router since dashboard requires authentication
router.use(verifyJWT);

// Route to fetch channel statistics
router.route("/stats").get(getChannelStats);

// Route to fetch all videos uploaded by the channel
router.route("/videos").get(getChannelVideos);

export default router;
