import { Router } from "express";
import {
  getCompleteOverview,
  getContacts,
  getHistory,
  getSessions,
} from "../controllers/report.controller.js";

const router = Router();

router.route("/history").get(getHistory);
router.route("/sessions").get(getSessions);
router.route("/contacts").get(getContacts);
router.route("/getOverview").get(getCompleteOverview);
export default router;
