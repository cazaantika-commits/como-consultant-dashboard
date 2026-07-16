/**
 * Shared table export utilities for PDF (print), Excel (.xlsx), and HTML.
 * Used by InvestorCashFlowSchedulePage and EscrowCashFlowSchedulePage2.
 */
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
export interface ExportTableData {
  title: string;
  subtitle?: string;
  projectName: string;
  scenario: string;
  headers: string[][]; // multiple header rows
  rows: (string | number)[][]; // data rows
  footerRows?: (string | number)[][]; // footer/totals rows
}

// ═══════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════
export function exportToExcel(data: ExportTableData, filename: string): void {
  const wb = XLSX.utils.book_new();

  // Build all rows: title + headers + data + footer
  const allRows: (string | number)[][] = [];

  // Title rows
  allRows.push([data.title]);
  if (data.subtitle) allRows.push([data.subtitle]);
  allRows.push([`المشروع: ${data.projectName}`]);
  allRows.push([`السيناريو: ${data.scenario}`]);
  allRows.push([`تاريخ التصدير: ${new Date().toLocaleDateString("ar-AE")}`]);
  allRows.push([]); // empty row

  // Headers
  for (const headerRow of data.headers) {
    allRows.push(headerRow);
  }

  // Data rows
  for (const row of data.rows) {
    allRows.push(row);
  }

  // Footer rows
  if (data.footerRows) {
    allRows.push([]); // separator
    for (const row of data.footerRows) {
      allRows.push(row);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Set RTL
  if (!ws["!sheetViews"]) {
    (ws as any)["!sheetViews"] = [{ rightToLeft: true }];
  }

  // Auto-width columns
  const colWidths: number[] = [];
  for (const row of allRows) {
    for (let i = 0; i < row.length; i++) {
      const cellLen = String(row[i] || "").length;
      colWidths[i] = Math.max(colWidths[i] || 8, Math.min(cellLen + 2, 25));
    }
  }
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));

  XLSX.utils.book_append_sheet(wb, ws, "التقرير");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${filename}.xlsx`);
}

// ═══════════════════════════════════════════
// HTML EXPORT (standalone file)
// ═══════════════════════════════════════════
export function exportToHTML(data: ExportTableData, filename: string): void {
  const now = new Date().toLocaleDateString("ar-AE");

  const headerRowsHTML = data.headers
    .map(
      (row) =>
        `<tr class="header-row">${row.map((cell) => `<th>${cell}</th>`).join("")}</tr>`
    )
    .join("\n");

  const dataRowsHTML = data.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
    )
    .join("\n");

  const footerRowsHTML = data.footerRows
    ? data.footerRows
        .map(
          (row) =>
            `<tr class="footer-row">${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
        )
        .join("\n")
    : "";

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title} - ${data.projectName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      direction: rtl;
      background: #f8fafc;
      padding: 20px;
      color: #1e293b;
    }
    .report-header {
      background: linear-gradient(135deg, #1e3a5f, #2563eb);
      color: white;
      padding: 24px 32px;
      border-radius: 12px;
      margin-bottom: 24px;
    }
    .report-header h1 { font-size: 1.5rem; margin-bottom: 8px; }
    .report-header p { opacity: 0.85; font-size: 0.9rem; }
    .meta-info {
      display: flex;
      gap: 24px;
      margin-top: 12px;
      flex-wrap: wrap;
    }
    .meta-info span {
      background: rgba(255,255,255,0.15);
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 0.85rem;
    }
    .actions {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .actions button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn-print { background: #2563eb; color: white; }
    .btn-print:hover { background: #1d4ed8; }
    .btn-save { background: #059669; color: white; }
    .btn-save:hover { background: #047857; }
    .table-container {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: white;
    }
    table {
      width: max-content;
      min-width: 100%;
      border-collapse: collapse;
      font-size: 0.75rem;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 6px 8px;
      text-align: center;
      white-space: nowrap;
    }
    .header-row th {
      background: #1e293b;
      color: white;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .footer-row td {
      background: #eef2ff;
      font-weight: 700;
      color: #3730a3;
    }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #eff6ff; }
    @media print {
      body { background: white; padding: 0; }
      .actions { display: none !important; }
      .report-header { border-radius: 0; }
      .table-container { border: none; }
      @page { size: A3 landscape; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${data.title}</h1>
    ${data.subtitle ? `<p>${data.subtitle}</p>` : ""}
    <div class="meta-info">
      <span>المشروع: ${data.projectName}</span>
      <span>السيناريو: ${data.scenario}</span>
      <span>تاريخ التصدير: ${now}</span>
    </div>
  </div>

  <div class="actions">
    <button class="btn-print" onclick="window.print()">🖨️ طباعة / PDF</button>
    <button class="btn-save" onclick="saveHTML()">💾 حفظ HTML</button>
  </div>

  <div class="table-container">
    <table>
      <thead>
        ${headerRowsHTML}
      </thead>
      <tbody>
        ${dataRowsHTML}
      </tbody>
      ${footerRowsHTML ? `<tfoot>${footerRowsHTML}</tfoot>` : ""}
    </table>
  </div>

  <script>
    function saveHTML() {
      const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '${filename}.html';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ═══════════════════════════════════════════
// PDF EXPORT (via window.print on current page)
// ═══════════════════════════════════════════
export function exportToPDF(): void {
  window.print();
}

// ═══════════════════════════════════════════
// HELPER: Extract table data from DOM ref
// ═══════════════════════════════════════════
export function extractTableFromDOM(
  tableRef: React.RefObject<HTMLDivElement | null>,
  title: string,
  projectName: string,
  scenario: string,
  subtitle?: string
): ExportTableData | null {
  if (!tableRef.current) return null;

  const table = tableRef.current.querySelector("table");
  if (!table) return null;

  const headers: string[][] = [];
  const rows: (string | number)[][] = [];
  const footerRows: (string | number)[][] = [];

  // Extract headers
  const thead = table.querySelector("thead");
  if (thead) {
    thead.querySelectorAll("tr").forEach((tr) => {
      const cells: string[] = [];
      tr.querySelectorAll("th").forEach((th) => {
        const text = th.textContent?.trim() || "";
        const colspan = parseInt(th.getAttribute("colspan") || "1");
        cells.push(text);
        // Add empty cells for colspan
        for (let i = 1; i < colspan; i++) {
          cells.push("");
        }
      });
      headers.push(cells);
    });
  }

  // Extract body rows
  const tbody = table.querySelector("tbody");
  if (tbody) {
    tbody.querySelectorAll("tr").forEach((tr) => {
      const cells: (string | number)[] = [];
      tr.querySelectorAll("td").forEach((td) => {
        const text = td.textContent?.trim() || "";
        // Try to parse as number (remove commas)
        const numStr = text.replace(/,/g, "").replace(/–/g, "0");
        const num = parseFloat(numStr);
        if (!isNaN(num) && text !== "" && text !== "–" && text !== "✓" && text !== "✗" && !text.includes("من الضمان")) {
          cells.push(num);
        } else {
          cells.push(text);
        }
      });
      rows.push(cells);
    });
  }

  // Extract footer rows
  const tfoot = table.querySelector("tfoot");
  if (tfoot) {
    tfoot.querySelectorAll("tr").forEach((tr) => {
      const cells: (string | number)[] = [];
      tr.querySelectorAll("td").forEach((td) => {
        const text = td.textContent?.trim() || "";
        const numStr = text.replace(/,/g, "").replace(/–/g, "0");
        const num = parseFloat(numStr);
        if (!isNaN(num) && text !== "" && text !== "–") {
          cells.push(num);
        } else {
          cells.push(text);
        }
      });
      footerRows.push(cells);
    });
  }

  return {
    title,
    subtitle,
    projectName,
    scenario,
    headers,
    rows,
    footerRows: footerRows.length > 0 ? footerRows : undefined,
  };
}
