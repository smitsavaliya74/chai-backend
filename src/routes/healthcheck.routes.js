import { Router } from "express";
import { healthcheck } from "../controllers/healthcheck.controller.js";

const router = Router();

// Route to perform health check on the server
router.route("/").get(healthcheck);

export default router;
