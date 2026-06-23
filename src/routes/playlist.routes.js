import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { 
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
} from "../controllers/playlist.controller.js";

const router = Router();

// Secure all routes in this router since playlist operations require authentication
router.use(verifyJWT);

// Route to create a playlist
router.route("/").post(createPlaylist);

// Route to handle specific playlist details (GET: details, PATCH: update, DELETE: delete)
router.route("/:playlistId")
    .get(getPlaylistById)
    .patch(updatePlaylist)
    .delete(deletePlaylist);

// Route to add a video to a specific playlist
router.route("/add/:videoId/:playlistId").patch(addVideoToPlaylist);

// Route to remove a video from a specific playlist
router.route("/remove/:videoId/:playlistId").patch(removeVideoFromPlaylist);

// Route to get all playlists of a specific user
router.route("/user/:userId").get(getUserPlaylists);

export default router;
