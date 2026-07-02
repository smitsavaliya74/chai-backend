import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Get channel stats (Total views, subscribers, videos, likes)
// @route   GET /api/v1/dashboard/stats
// @access  Private
const getChannelStats = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    // Step 1: Aggregate Video collection to count total videos and total views
    const videoStats = await Video.aggregate([
        {
            // Match all videos owned by the logged-in user
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $group: {
                _id: null,
                totalViews: {
                    $sum: "$views"
                },
                totalVideos: {
                    $sum: 1
                }
            }
        }
    ]);

    // Step 2: Query Subscription collection to count total subscribers
    const totalSubscribers = await Subscription.countDocuments({
        channel: userId
    });

    // Step 3: Aggregate Like collection to count total likes on user's uploaded videos
    const likeStats = await Like.aggregate([
        {
            // Join the 'videos' collection to filter likes by video creator/owner
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video"
            }
        },
        {
            // Flatten lookup array into a single object
            $addFields: {
                video: {
                    $first: "$video"
                }
            }
        },
        {
            // Match likes where the video owner is the logged-in user
            $match: {
                "video.owner": new mongoose.Types.ObjectId(userId)
            }
        },
        {
            // Count total likes
            $count: "totalLikes"
        }
    ]);

    // Step 4: Construct consolidated channel statistics object
    const stats = {
        totalVideos: videoStats[0]?.totalVideos || 0,
        totalViews: videoStats[0]?.totalViews || 0,
        totalSubscribers: totalSubscribers || 0,
        totalLikes: likeStats[0]?.totalLikes || 0
    };

    // Step 5: Return statistics details
    return res
        .status(200)
        .json(
            new ApiResponse(200, stats, "Channel statistics retrieved successfully")
        );
});

// @desc    Get all videos uploaded by the channel
// @route   GET /api/v1/dashboard/videos
// @access  Private
const getChannelVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    // Step 1: Query Video collection to find all videos uploaded by the current logged-in user
    // Note: Since this is the dashboard, we retrieve all videos regardless of their isPublished state
    const videos = await Video.find({ owner: userId }).sort({ createdAt: -1 });

    // Step 2: Return list of videos to the channel owner
    return res
        .status(200)
        .json(
            new ApiResponse(200, videos, "Channel videos retrieved successfully")
        );
});

export {
    getChannelStats,
    getChannelVideos
};
