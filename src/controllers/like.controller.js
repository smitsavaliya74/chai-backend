import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Toggle like on a video (Like/Unlike)
// @route   POST /api/v1/likes/toggle/v/:videoId
// @access  Private
const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // 1. Validate if videoId is a valid MongoDB ObjectId
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // 2. Check if the video exists in the database
    const videoExists = await Video.exists({ _id: videoId });
    if (!videoExists) {
        throw new ApiError(404, "Video not found");
    }

    // 3. Check if the user has already liked this video
    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: req.user?._id
    });

    if (existingLike) {
        // If already liked, remove (unlike) it
        await Like.findByIdAndDelete(existingLike._id);
        
        return res
            .status(200)
            .json(
                new ApiResponse(200, { isLiked: false }, "Video unliked successfully")
            );
    } else {
        // If not liked, create a new like record
        await Like.create({
            video: videoId,
            likedBy: req.user?._id
        });

        return res
            .status(200)
            .json(
                new ApiResponse(200, { isLiked: true }, "Video liked successfully")
            );
    }
});

// @desc    Toggle like on a comment (Like/Unlike)
// @route   POST /api/v1/likes/toggle/c/:commentId
// @access  Private
const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    // 1. Validate if commentId is a valid MongoDB ObjectId
    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    // 2. Check if the comment exists in the database
    const commentExists = await Comment.exists({ _id: commentId });
    if (!commentExists) {
        throw new ApiError(404, "Comment not found");
    }

    // 3. Check if the user has already liked this comment
    const existingLike = await Like.findOne({
        comment: commentId,
        likedBy: req.user?._id
    });

    if (existingLike) {
        // If already liked, remove (unlike) it
        await Like.findByIdAndDelete(existingLike._id);

        return res
            .status(200)
            .json(
                new ApiResponse(200, { isLiked: false }, "Comment unliked successfully")
            );
    } else {
        // If not liked, create a new like record
        await Like.create({
            comment: commentId,
            likedBy: req.user?._id
        });

        return res
            .status(200)
            .json(
                new ApiResponse(200, { isLiked: true }, "Comment liked successfully")
            );
    }
});

// @desc    Toggle like on a tweet (Like/Unlike)
// @route   POST /api/v1/likes/toggle/t/:tweetId
// @access  Private
const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    // 1. Validate if tweetId is a valid MongoDB ObjectId
    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    // 2. Check if the tweet exists in the database
    const tweetExists = await Tweet.exists({ _id: tweetId });
    if (!tweetExists) {
        throw new ApiError(404, "Tweet not found");
    }

    // 3. Check if the user has already liked this tweet
    const existingLike = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user?._id
    });

    if (existingLike) {
        // If already liked, remove (unlike) it
        await Like.findByIdAndDelete(existingLike._id);

        return res
            .status(200)
            .json(
                new ApiResponse(200, { isLiked: false }, "Tweet unliked successfully")
            );
    } else {
        // If not liked, create a new like record
        await Like.create({
            tweet: tweetId,
            likedBy: req.user?._id
        });

        return res
            .status(200)
            .json(
                new ApiResponse(200, { isLiked: true }, "Tweet liked successfully")
            );
    }
});

// @desc    Get all videos liked by the current user
// @route   GET /api/v1/likes/videos
// @access  Private
const getLikedVideos = asyncHandler(async (req, res) => {
    const likedVideos = await Like.aggregate([
        {
            // Step 1: Find all like documents by the current user where 'video' is set
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user?._id),
                video: { $exists: true, $ne: null }
            }
        },
        {
            // Step 2: Join the 'videos' collection to retrieve full video details
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
                pipeline: [
                    {
                        // Step 2a: Inside the video document, join the 'users' collection to retrieve video owner's profile
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullname: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        // Step 2b: Convert owner array from lookup to a single object
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        },
        {
            // Step 3: Convert the 'video' array from the lookup to a single object
            $addFields: {
                video: {
                    $first: "$video"
                }
            }
        },
        {
            // Step 4: Ensure the video actually exists (filters out likes on videos that were deleted)
            $match: {
                video: { $ne: null }
            }
        },
        {
            // Step 5: Replace the root of the document with the 'video' details
            $replaceRoot: {
                newRoot: "$video"
            }
        }
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(200, likedVideos, "Liked videos retrieved successfully")
        );
});

export {
    toggleVideoLike,
    toggleCommentLike,
    toggleTweetLike,
    getLikedVideos
};
