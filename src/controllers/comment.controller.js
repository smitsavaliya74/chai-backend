import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Get all comments for a video
// @route   GET /api/v1/comments/:videoId
// @access  Public
const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate if the videoId is a valid MongoDB ObjectId
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // Check if the video actually exists in the database
    const videoExists = await Video.exists({ _id: videoId });
    if (!videoExists) {
        throw new ApiError(404, "Video not found");
    }

    // Define the MongoDB aggregation pipeline to query comments
    const commentsAggregate = Comment.aggregate([
        {
            // Step 1: Filter comments matching the video ID
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            // Step 2: Join the 'users' collection to retrieve owner profile details
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        // Select only username, fullname, and avatar from user document
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
            // Step 3: Convert the 'owner' array (resulted from lookup) to a single object
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            // Step 4: Sort comments by creation date in descending order (latest first)
            $sort: {
                createdAt: -1
            }
        }
    ]);

    // Setup options for mongooseAggregatePaginate
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    // Execute paginated aggregation query
    const comments = await Comment.aggregatePaginate(commentsAggregate, options);

    return res
        .status(200)
        .json(
            new ApiResponse(200, comments, "Video comments fetched successfully")
        );
});

// @desc    Add a comment to a video
// @route   POST /api/v1/comments/:videoId
// @access  Private
const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;

    // 1. Validate that comment content is not empty
    if (!content?.trim()) {
        throw new ApiError(400, "Comment content is required");
    }

    // 2. Validate that videoId is a valid ObjectId
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // 3. Verify that the video exists in the database
    const videoExists = await Video.exists({ _id: videoId });
    if (!videoExists) {
        throw new ApiError(404, "Video not found");
    }

    // 4. Create the comment in the database
    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id // Available because verifyJWT middleware is applied
    });

    if (!comment) {
        throw new ApiError(500, "Something went wrong while adding the comment");
    }

    return res
        .status(201)
        .json(
            new ApiResponse(201, comment, "Comment added successfully")
        );
});

// @desc    Update a comment
// @route   PATCH /api/v1/comments/c/:commentId
// @access  Private
const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;

    // 1. Validate that updated comment content is not empty
    if (!content?.trim()) {
        throw new ApiError(400, "Comment content is required");
    }

    // 2. Validate that commentId is a valid ObjectId
    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    // 3. Find the comment in the database
    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    // 4. Check if the current user is the owner of the comment
    if (comment.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to edit this comment");
    }

    // 5. Update and save the comment
    comment.content = content;
    const updatedComment = await comment.save();

    if (!updatedComment) {
        throw new ApiError(500, "Something went wrong while updating the comment");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedComment, "Comment updated successfully")
        );
});

// @desc    Delete a comment
// @route   DELETE /api/v1/comments/c/:commentId
// @access  Private
const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    // 1. Validate that commentId is a valid ObjectId
    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    // 2. Find the comment in the database
    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    // 3. Check if the current user is the owner of the comment
    if (comment.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to delete this comment");
    }

    // 4. Delete the comment document
    const deletedComment = await Comment.findByIdAndDelete(commentId);
    if (!deletedComment) {
        throw new ApiError(500, "Something went wrong while deleting the comment");
    }

    // 5. Clean up by deleting any likes associated with this comment
    await Like.deleteMany({ comment: commentId });

    return res
        .status(200)
        .json(
            new ApiResponse(200, { commentId }, "Comment deleted successfully")
        );
});

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
};
