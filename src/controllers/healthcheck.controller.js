import mongoose from "mongoose";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Healthcheck route to verify database connection and server status
// @route   GET /api/v1/healthcheck
// @access  Public
const healthcheck = asyncHandler(async (req, res) => {
    // Step 1: Check database state (1 = connected)
    const dbStatus = mongoose.connection.readyState === 1 ? "UP" : "DOWN";

    // Step 2: Build health statistics
    const healthInfo = {
        status: "OK",
        message: "Server is healthy and running smoothly",
        database: dbStatus,
        uptime: process.uptime(), // server uptime in seconds
        timestamp: Date.now()
    };

    // Step 3: Return health details
    return res
        .status(200)
        .json(
            new ApiResponse(200, healthInfo, "Healthcheck completed successfully")
        );
});

export {
    healthcheck
};
