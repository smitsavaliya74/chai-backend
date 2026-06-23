import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";

// @desc    Get all videos based on query, sort, pagination
// @route   GET /api/v1/videos
// @access  Public
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

    const matchCriteria = {};

    // 1. Filter by owner if userId is provided
    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid user ID");
        }
        matchCriteria.owner = new mongoose.Types.ObjectId(userId);
    }

    // 2. Filter by search query (matching against 'title' or 'description')
    if (query?.trim()) {
        matchCriteria.$or = [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ];
    }

    // 3. By default, show only published videos
    matchCriteria.isPublished = true;

    // 4. Construct aggregation pipeline
    const pipeline = [
        {
            $match: matchCriteria
        },
        {
            // Join owner details
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
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        }
    ];

    // 5. Apply sorting
    if (sortBy) {
        const sortDirection = sortType === "desc" ? -1 : 1;
        pipeline.push({
            $sort: {
                [sortBy]: sortDirection
            }
        });
    } else {
        pipeline.push({
            $sort: {
                createdAt: -1
            }
        });
    }

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    // 6. Execute aggregation with pagination
    const videoAggregate = Video.aggregate(pipeline);
    const videos = await Video.aggregatePaginate(videoAggregate, options);

    return res
        .status(200)
        .json(
            new ApiResponse(200, videos, "Videos retrieved successfully")
        );
});

// @desc    Upload video to Cloudinary, save title/description/duration to DB
// @route   POST /api/v1/videos
// @access  Private
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    // 1. Validate body fields
    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required");
    }

    // 2. Validate local paths of uploaded files from Multer
    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoFileLocalPath) {
        throw new ApiError(400, "Video file is required");
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail file is required");
    }

    // 3. Upload to Cloudinary
    const videoFileCloudinary = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnailCloudinary = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFileCloudinary) {
        throw new ApiError(500, "Failed to upload video file to Cloudinary");
    }

    if (!thumbnailCloudinary) {
        throw new ApiError(500, "Failed to upload thumbnail file to Cloudinary");
    }

    // 4. Create Video entry in DB
    const video = await Video.create({
        title,
        description,
        videoFile: videoFileCloudinary.url,
        thumbnail: thumbnailCloudinary.url,
        duration: videoFileCloudinary.duration || 0, // Cloudinary automatically returns duration for videos
        owner: req.user?._id,
        isPublished: true
    });

    if (!video) {
        throw new ApiError(500, "Something went wrong while publishing the video");
    }

    return res
        .status(201)
        .json(
            new ApiResponse(201, video, "Video published successfully")
        );
});

// @desc    Get video by ID
// @route   GET /api/v1/videos/:videoId
// @access  Public (or Private)
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // 1. Validate videoId parameter
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // 2. Aggregate video with owner details
    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
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
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        }
    ]);

    if (!video?.length) {
        throw new ApiError(404, "Video not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, video[0], "Video fetched successfully")
        );
});

// @desc    Update video details (title, description, thumbnail)
// @route   PATCH /api/v1/videos/:videoId
// @access  Private
const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;
    const thumbnailLocalPath = req.file?.path;

    // 1. Validate videoId parameter
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // 2. Validate that at least one field is provided for update
    if (!title?.trim() && !description?.trim() && !thumbnailLocalPath) {
        throw new ApiError(400, "At least one field (title, description, or thumbnail) must be provided to update");
    }

    // 3. Find video document
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // 4. Verify ownership
    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to update this video");
    }

    // 5. Handle thumbnail update on Cloudinary if a new file is uploaded
    if (thumbnailLocalPath) {
        const thumbnailCloudinary = await uploadOnCloudinary(thumbnailLocalPath);
        if (!thumbnailCloudinary?.url) {
            throw new ApiError(500, "Failed to upload new thumbnail to Cloudinary");
        }

        // Delete old thumbnail from Cloudinary
        if (video.thumbnail) {
            await deleteFromCloudinary(video.thumbnail);
        }

        video.thumbnail = thumbnailCloudinary.url;
    }

    // 6. Update title and description fields if supplied
    if (title?.trim()) {
        video.title = title;
    }
    if (description?.trim()) {
        video.description = description;
    }

    // 7. Save changes
    const updatedVideo = await video.save();

    if (!updatedVideo) {
        throw new ApiError(500, "Something went wrong while updating the video details");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedVideo, "Video updated successfully")
        );
});

// @desc    Delete a video
// @route   DELETE /api/v1/videos/:videoId
// @access  Private
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // 1. Validate videoId parameter
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // 2. Find video document
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // 3. Verify ownership
    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to delete this video");
    }

    // 4. Delete the video document
    const deletedVideo = await Video.findByIdAndDelete(videoId);
    if (!deletedVideo) {
        throw new ApiError(500, "Something went wrong while deleting the video document");
    }

    // 5. Delete associated files from Cloudinary
    if (video.videoFile) {
        await deleteFromCloudinary(video.videoFile);
    }
    if (video.thumbnail) {
        await deleteFromCloudinary(video.thumbnail);
    }

    // 6. Clean up database by deleting comments and likes associated with this video
    await Comment.deleteMany({ video: videoId });
    await Like.deleteMany({ video: videoId });

    return res
        .status(200)
        .json(
            new ApiResponse(200, { videoId }, "Video deleted successfully")
        );
});

// @desc    Toggle publish status of a video (public/private)
// @route   PATCH /api/v1/videos/toggle/publish/:videoId
// @access  Private
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // 1. Validate videoId parameter
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // 2. Find video document
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // 3. Verify ownership
    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to toggle publish status for this video");
    }

    // 4. Toggle the publish status and save
    video.isPublished = !video.isPublished;
    const updatedVideo = await video.save();

    if (!updatedVideo) {
        throw new ApiError(500, "Something went wrong while toggling the publish status");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, { isPublished: updatedVideo.isPublished }, "Video publish status toggled successfully")
        );
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
};
