import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Create a new tweet
// @route   POST /api/v1/tweets
// @access  Private
const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;

    // 1. Validate that content is not empty
    if (!content?.trim()) {
        throw new ApiError(400, "Tweet content is required");
    }

    // 2. Create the tweet
    const tweet = await Tweet.create({
        content,
        owner: req.user?._id
    });

    if (!tweet) {
        throw new ApiError(500, "Something went wrong while creating the tweet");
    }

    return res
        .status(201)
        .json(
            new ApiResponse(201, tweet, "Tweet created successfully")
        );
});

// @desc    Get user tweets
// @route   GET /api/v1/tweets/user/:userId
// @access  Private
const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // 1. Validate if userId is a valid MongoDB ObjectId
    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    // 2. Verify that the user exists in the database
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
        throw new ApiError(404, "User not found");
    }

    // 3. Find all tweets by the user, lookup owner profile details, and sort by newest
    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
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
        },
        {
            $sort: {
                createdAt: -1
            }
        }
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(200, tweets, "User tweets fetched successfully")
        );
});

// @desc    Update a tweet
// @route   PATCH /api/v1/tweets/:tweetId
// @access  Private
const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { content } = req.body;

    // 1. Validate that updated content is not empty
    if (!content?.trim()) {
        throw new ApiError(400, "Tweet content is required");
    }

    // 2. Validate if tweetId is a valid MongoDB ObjectId
    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    // 3. Find the tweet in the database
    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    // 4. Check if the current user is the owner of the tweet
    if (tweet.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to edit this tweet");
    }

    // 5. Update and save the tweet
    tweet.content = content;
    const updatedTweet = await tweet.save();

    if (!updatedTweet) {
        throw new ApiError(500, "Something went wrong while updating the tweet");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedTweet, "Tweet updated successfully")
        );
});

// @desc    Delete a tweet
// @route   DELETE /api/v1/tweets/:tweetId
// @access  Private
const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    // 1. Validate if tweetId is a valid MongoDB ObjectId
    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    // 2. Find the tweet in the database
    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    // 3. Check if the current user is the owner of the tweet
    if (tweet.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to delete this tweet");
    }

    // 4. Delete the tweet document
    const deletedTweet = await Tweet.findByIdAndDelete(tweetId);
    if (!deletedTweet) {
        throw new ApiError(500, "Something went wrong while deleting the tweet");
    }

    // 5. Clean up by deleting any likes associated with this tweet
    await Like.deleteMany({ tweet: tweetId });

    return res
        .status(200)
        .json(
            new ApiResponse(200, { tweetId }, "Tweet deleted successfully")
        );
});

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
};
