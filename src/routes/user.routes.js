import { Router } from "express";
import { 
    loginUser, 
    logoutUser, 
    registerUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverAvatar,
    getUserChannleProfile,
    getWatchHistory
} from "../controllers/user.controllers.js";
import {upload} from "../middlewares/multer.middlerware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name : "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser)


// secured routes
router.route("/logout").post(verifyJWT, logoutUser)

router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/update-account").patch(verifyJWT,updateAccountDetails)


router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
router.route("/coverImage").patch(verifyJWT, upload.single("coverImage"), updateUserCoverAvatar)
router.route("/c/:username").get(verifyJWT, getUserChannleProfile)
router.route("/watch-history").get(verifyJWT, getWatchHistory)

export default router