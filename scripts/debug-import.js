import XLSX from "xlsx";
import * as fs from "fs";

const fileBuffer = fs.readFileSync("./upload/beep_2026-06-20.xlsx");
const workbook = XLSX.read(fileBuffer, { type: "buffer" });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Total de linhas:", rows.length);
console.log("\nPrimeiras 3 linhas (raw):");
for (let i = 0; i < 3; i++) {
  console.log(`Linha ${i}:`, rows[i]);
}

console.log("\nVerificando coluna 3 (Expiration Date):");
for (let i = 1; i < 5; i++) {
  const val = rows[i][3];
  console.log(`Linha ${i}: valor=${val}, tipo=${typeof val}, instanceof Date=${val instanceof Date}`);
}
