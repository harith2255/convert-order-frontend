import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { normalizeKey } from "../utils/normalizeKey.js";
const TEMPLATE_PATH = path.join(
  process.cwd(),
  "uploads",
  "Order Training.xlsx"
);

let TRAINING_COLUMNS = [];

export const initTrainingTemplate = async () => {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error("Order Training.xlsx not found");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const sheet = workbook.worksheets[0];
  const headerRow = sheet.getRow(1);

 TRAINING_COLUMNS = headerRow.values
  .slice(1)
  .map(v => normalizeKey(v.toString()))
  .filter(Boolean);


  console.log("✅ Training template loaded:", TRAINING_COLUMNS);
};

export const getTrainingColumns = () => {
  if (!TRAINING_COLUMNS.length) {
    throw new Error("Training template not initialized");
  }
  return TRAINING_COLUMNS;
};
