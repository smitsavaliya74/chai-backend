import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middlerware.js";
import { 
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
} from "../controllers/video.controller.js";

const router = Router();

// Route to handle video operations
// GET: Public route to fetch all videos
// POST: Secured route to publish a video (uploading videoFile and thumbnail fields)
router.route("/")
    .get(getAllVideos)
    .post(
        verifyJWT,
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1
            },
            {
                name: "thumbnail",
                maxCount: 1
            }
        ]),
        publishAVideo
    );

// Route to handle a specific video by ID
// GET: Public route to fetch a single video details
// PATCH: Secured route to update video details (title, description, or thumbnail)
// DELETE: Secured route to delete a video and associated media files
router.route("/:videoId")
    .get(getVideoById)
    .patch(verifyJWT, upload.single("thumbnail"), updateVideo)
    .delete(verifyJWT, deleteVideo);

// Route to toggle publish status of a video
// PATCH: Secured route
router.route("/toggle/publish/:videoId").patch(verifyJWT, togglePublishStatus);

export default router;
