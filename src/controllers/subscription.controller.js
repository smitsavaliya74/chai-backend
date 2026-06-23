import mongoose, { isValidObjectId } from "mongoose";
import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Toggle subscription to a channel (Subscribe/Unsubscribe)
// @route   POST /api/v1/subscriptions/c/:channelId
// @access  Private
const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    // 1. Validate if channelId is a valid MongoDB ObjectId
    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    // 2. Prevent users from subscribing to themselves
    if (channelId.toString() === req.user?._id.toString()) {
        throw new ApiError(400, "You cannot subscribe to your own channel");
    }

    // 3. Verify that the channel exists in the database
    const channelExists = await User.exists({ _id: channelId });
    if (!channelExists) {
        throw new ApiError(404, "Channel not found");
    }

    // 4. Check if the subscription record already exists
    const existingSubscription = await Subscription.findOne({
        subscriber: req.user?._id,
        channel: channelId
    });

    if (existingSubscription) {
        // If subscribed, remove the record (unsubscribe)
        await Subscription.findByIdAndDelete(existingSubscription._id);

        return res
            .status(200)
            .json(
                new ApiResponse(200, { isSubscribed: false }, "Unsubscribed successfully")
            );
    } else {
        // If not subscribed, create a new record (subscribe)
        await Subscription.create({
            subscriber: req.user?._id,
            channel: channelId
        });

        return res
            .status(200)
            .json(
                new ApiResponse(200, { isSubscribed: true }, "Subscribed successfully")
            );
    }
});

// @desc    Get subscribers list of a channel
// @route   GET /api/v1/subscriptions/c/:channelId
// @access  Private
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    // 1. Validate if channelId is a valid MongoDB ObjectId
    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    // 2. Aggregate to find matching subscription records and join subscriber profiles
    const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
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
                subscriber: {
                    $first: "$subscriber"
                }
            }
        },
        {
            $project: {
                subscriber: 1,
                createdAt: 1
            }
        }
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(200, subscribers, "Subscribers retrieved successfully")
        );
});

// @desc    Get channels to which a user has subscribed
// @route   GET /api/v1/subscriptions/u/:subscriberId
// @access  Private
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    // Step 1: Validate if subscriberId is a valid MongoDB ObjectId
    if (!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID");
    }

    // Step 2: Query the subscriptions collection matching the subscriber's ID
    const subscribedChannels = await Subscription.aggregate([
        {
            // Step 2a: Match subscription records belonging to this subscriber
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            // Step 2b: Perform lookup to join user details for the channel being subscribed to
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channel",
                pipeline: [
                    {
                        // Step 2c: Project only required fields from the channel's user account
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
            // Step 2d: Flatten the channel array into a single object
            $addFields: {
                channel: {
                    $first: "$channel"
                }
            }
        },
        {
            // Step 2e: Project only the channel info and subscription timestamp in the final response
            $project: {
                channel: 1,
                createdAt: 1
            }
        }
    ]);

    // Step 3: Return the result list to the user
    return res
        .status(200)
        .json(
            new ApiResponse(200, subscribedChannels, "Subscribed channels retrieved successfully")
        );
});

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
};
