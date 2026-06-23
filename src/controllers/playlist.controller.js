import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Create a new playlist
// @route   POST /api/v1/playlists
// @access  Private
const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    // Step 1: Validate name and description are provided
    if (!name?.trim() || !description?.trim()) {
        throw new ApiError(400, "Name and description are required");
    }

    // Step 2: Create a new playlist document under the logged-in user
    const playlist = await Playlist.create({
        name,
        description,
        videos: [],
        owner: req.user?._id // Available because verifyJWT middleware runs first
    });

    if (!playlist) {
        throw new ApiError(500, "Something went wrong while creating the playlist");
    }

    // Step 3: Return the created playlist document
    return res
        .status(201)
        .json(
            new ApiResponse(201, playlist, "Playlist created successfully")
        );
});

// @desc    Get all playlists of a specific user
// @route   GET /api/v1/playlist/user/:userId
// @access  Private
const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Step 1: Validate if userId is a valid MongoDB ObjectId
    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    // Step 2: Find all playlist records matching the owner ID
    const playlists = await Playlist.find({ owner: userId });

    // Step 3: Return the matching playlists list
    return res
        .status(200)
        .json(
            new ApiResponse(200, playlists, "User playlists retrieved successfully")
        );
});

// @desc    Get playlist details by ID (including populated video and owner details)
// @route   GET /api/v1/playlist/:playlistId
// @access  Private
const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    // Step 1: Validate if playlistId is a valid MongoDB ObjectId
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    // Step 2: Query the playlist with aggregation to populate video and owner details
    const playlist = await Playlist.aggregate([
        {
            // Match the specific playlist document
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            // Join the 'videos' collection to populate full video details
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline: [
                    {
                        // Inside each video document, join the 'users' collection to get video owner profile details
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
                        // Convert owner array from lookup to a single object
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
            // Join the 'users' collection to retrieve details of the playlist's creator
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
            // Flatten the playlist owner array to a single object
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        }
    ]);

    if (!playlist?.length) {
        throw new ApiError(404, "Playlist not found");
    }

    // Step 3: Return the detailed playlist document
    return res
        .status(200)
        .json(
            new ApiResponse(200, playlist[0], "Playlist retrieved successfully")
        );
});

// @desc    Add a video to a playlist
// @route   PATCH /api/v1/playlist/add/:videoId/:playlistId
// @access  Private
const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    // Step 1: Validate both IDs are valid MongoDB ObjectIds
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist or video ID");
    }

    // Step 2: Retrieve the playlist from the database
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    // Step 3: Verify that the current user owns this playlist
    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to add videos to this playlist");
    }

    // Step 4: Verify that the video exists in the database
    const videoExists = await Video.exists({ _id: videoId });
    if (!videoExists) {
        throw new ApiError(404, "Video not found");
    }

    // Step 5: Check if the video is already present in the playlist's videos array
    if (playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video is already in the playlist");
    }

    // Step 6: Add the video ID to the videos array and save the document
    playlist.videos.push(videoId);
    const updatedPlaylist = await playlist.save();

    if (!updatedPlaylist) {
        throw new ApiError(500, "Something went wrong while adding the video to the playlist");
    }

    // Step 7: Return the updated playlist
    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedPlaylist, "Video added to playlist successfully")
        );
});

// @desc    Remove a video from a playlist
// @route   PATCH /api/v1/playlist/remove/:videoId/:playlistId
// @access  Private
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    // Step 1: Validate both IDs are valid MongoDB ObjectIds
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist or video ID");
    }

    // Step 2: Retrieve the playlist from the database
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    // Step 3: Verify that the current user owns this playlist
    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to remove videos from this playlist");
    }

    // Step 4: Check if the video is present in the playlist
    const videoIndex = playlist.videos.indexOf(videoId);
    if (videoIndex === -1) {
        throw new ApiError(400, "Video not found in this playlist");
    }

    // Step 5: Remove the video ID from the videos array and save
    playlist.videos.splice(videoIndex, 1);
    const updatedPlaylist = await playlist.save();

    if (!updatedPlaylist) {
        throw new ApiError(500, "Something went wrong while removing the video from the playlist");
    }

    // Step 6: Return the updated playlist
    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedPlaylist, "Video removed from playlist successfully")
        );
});

// @desc    Delete a playlist
// @route   DELETE /api/v1/playlist/:playlistId
// @access  Private
const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    // Step 1: Validate playlistId parameter
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    // Step 2: Retrieve the playlist from the database
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    // Step 3: Verify that the current user owns this playlist
    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to delete this playlist");
    }

    // Step 4: Delete the playlist document
    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);
    if (!deletedPlaylist) {
        throw new ApiError(500, "Something went wrong while deleting the playlist");
    }

    // Step 5: Return success response
    return res
        .status(200)
        .json(
            new ApiResponse(200, { playlistId }, "Playlist deleted successfully")
        );
});

// @desc    Update a playlist (name and description)
// @route   PATCH /api/v1/playlist/:playlistId
// @access  Private
const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { name, description } = req.body;

    // Step 1: Validate playlistId parameter
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    // Step 2: Ensure at least one update field is provided
    if (!name?.trim() && !description?.trim()) {
        throw new ApiError(400, "Name or description is required to update playlist");
    }

    // Step 3: Retrieve the playlist from the database
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    // Step 4: Verify that the current user owns this playlist
    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to update this playlist");
    }

    // Step 5: Update the fields if supplied and save the changes
    if (name?.trim()) {
        playlist.name = name;
    }
    if (description?.trim()) {
        playlist.description = description;
    }

    const updatedPlaylist = await playlist.save();
    if (!updatedPlaylist) {
        throw new ApiError(500, "Something went wrong while updating the playlist");
    }

    // Step 6: Return the updated playlist
    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
        );
});

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
};
