import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface EvaluationPDFData {
  projectName: string;
  bua: number;
  pricePerSqft: number;
  constructionCost: number;
  consultants: Array<{
    name: string;
    scores: number[];
    weightedTotal: number;
  }>;
  criteria: Array<{
    name: string;
    weight: number;
  }>;
  evaluators: Array<{
    name: string;
  }>;
  financials: Array<{
    consultantName: string;
    designValue: string;
    designType: string;
    designAmount: number;
    supervisionValue: string;
    supervisionType: string;
    supervisionAmount: number;
    total: number;
  }>;
}

export function generateEvaluationPDF(data: EvaluationPDFData, type: "technical" | "financial" | "full") {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Colors
  const primaryBlue = [37, 99, 235]; // blue-600
  const primaryPurple = [124, 58, 237]; // purple-600
  const emeraldGreen = [16, 185, 129]; // emerald-500
  const amberYellow = [245, 158, 11]; // amber-500
  const slateGray = [71, 85, 105]; // slate-600
  
  // Helper: draw gradient-like header
  function drawHeader(title: string, subtitle: string) {
    // Background rectangle
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(0, 0, pageWidth, 35, "F");
    
    // Overlay gradient effect
    doc.setFillColor(primaryPurple[0], primaryPurple[1], primaryPurple[2]);
    doc.rect(pageWidth * 0.6, 0, pageWidth * 0.4, 35, "F");
    
    // Title (right-aligned for Arabic)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(title, pageWidth - 15, 15, { align: "right" });
    
    // Subtitle
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, pageWidth - 15, 25, { align: "right" });
    
    // Logo area
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("COMO Developments", 15, 15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Consultant Evaluation Report", 15, 22);
    
    // Date
    const dateStr = new Date().toLocaleDateString("ar-AE", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    doc.setFontSize(8);
    doc.text(dateStr, 15, 30);
  }
  
  // Helper: draw project info bar
  function drawProjectInfo(yPos: number) {
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(10, yPos, pageWidth - 20, 18, 3, 3, "F");
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(10, yPos, pageWidth - 20, 18, 3, 3, "S");
    
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    
    const infoItems = [
      `Project: ${data.projectName}`,
      `BUA: ${data.bua.toLocaleString()} sqft`,
      `Price/sqft: ${data.pricePerSqft.toLocaleString()} AED`,
      `Construction Cost: ${data.constructionCost.toLocaleString()} AED`
    ];
    
    const spacing = (pageWidth - 30) / infoItems.length;
    infoItems.forEach((item, i) => {
      doc.text(item, 15 + (i * spacing), yPos + 11);
    });
    
    return yPos + 22;
  }
  
  // Helper: draw footer
  function drawFooter(pageNum: number, totalPages: number) {
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageHeight - 12, pageWidth, 12, "F");
    doc.setDrawColor(226, 232, 240);
    doc.line(0, pageHeight - 12, pageWidth, pageHeight - 12);
    
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`COMO Developments - Confidential`, 15, pageHeight - 5);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 15, pageHeight - 5, { align: "right" });
  }

  // ============ TECHNICAL EVALUATION PAGE ============
  if (type === "technical" || type === "full") {
    drawHeader("Technical Evaluation Report", "Consultant Technical Assessment");
    let yPos = drawProjectInfo(40);
    
    // Technical evaluation table
    const techHeaders = [
      "Criteria",
      "Weight %",
      ...data.consultants.map(c => c.name)
    ];
    
    const techBody = data.criteria.map((criterion, idx) => [
      criterion.name,
      `${criterion.weight}%`,
      ...data.consultants.map(c => {
        const score = c.scores[idx] || 0;
        return score.toFixed(1);
      })
    ]);
    
    // Add weighted total row
    techBody.push([
      "Weighted Total",
      "100%",
      ...data.consultants.map(c => c.weightedTotal.toFixed(1))
    ]);
    
    autoTable(doc, {
      head: [techHeaders],
      body: techBody,
      startY: yPos,
      margin: { left: 10, right: 10 },
      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [primaryBlue[0], primaryBlue[1], primaryBlue[2]],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 60, halign: "left", fontStyle: "bold" },
        1: { cellWidth: 20, halign: "center" },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didParseCell: function(data) {
        // Style the last row (weighted total) differently
        if (data.row.index === techBody.length - 1) {
          data.cell.styles.fillColor = [37, 99, 235];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 9;
        }
        // Color code scores
        if (data.section === "body" && data.column.index >= 2 && data.row.index < techBody.length - 1) {
          const val = parseFloat(data.cell.text[0]) || 0;
          if (val >= 8) {
            data.cell.styles.textColor = [16, 185, 129]; // green
            data.cell.styles.fontStyle = "bold";
          } else if (val >= 6) {
            data.cell.styles.textColor = [245, 158, 11]; // amber
          } else if (val > 0) {
            data.cell.styles.textColor = [239, 68, 68]; // red
          }
        }
      }
    });
    
    // Ranking section below table
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Sort consultants by weighted total
    const ranked = [...data.consultants].sort((a, b) => b.weightedTotal - a.weightedTotal);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.text("Final Ranking", pageWidth - 15, finalY, { align: "right" });
    
    ranked.forEach((c, i) => {
      const y = finalY + 8 + (i * 12);
      const colors = i === 0 ? emeraldGreen : i === 1 ? amberYellow : slateGray;
      
      doc.setFillColor(colors[0], colors[1], colors[2]);
      doc.roundedRect(pageWidth - 85, y - 4, 70, 10, 2, 2, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`#${i + 1}  ${c.name}  —  ${c.weightedTotal.toFixed(1)} / 100`, pageWidth - 80, y + 2);
    });
    
    drawFooter(1, type === "full" ? 2 : 1);
  }
  
  // ============ FINANCIAL EVALUATION PAGE ============
  if (type === "financial" || type === "full") {
    if (type === "full") doc.addPage("landscape");
    
    drawHeader("Financial Evaluation Report", "Consultant Fees Comparison");
    let yPos = drawProjectInfo(40);
    
    const finHeaders = [
      "Consultant",
      "Design Fee",
      "Design Amount (AED)",
      "Supervision Fee",
      "Supervision Amount (AED)",
      "Total Fees (AED)"
    ];
    
    const finBody = data.financials.map(f => [
      f.consultantName,
      f.designType === "pct" ? `${f.designValue}%` : `${parseFloat(f.designValue).toLocaleString()} AED`,
      f.designAmount.toLocaleString(),
      f.supervisionType === "pct" ? `${f.supervisionValue}%` : `${parseFloat(f.supervisionValue).toLocaleString()} AED`,
      f.supervisionAmount.toLocaleString(),
      f.total.toLocaleString()
    ]);
    
    // Add average row
    const avgTotal = data.financials.reduce((sum, f) => sum + f.total, 0) / (data.financials.length || 1);
    finBody.push([
      "Average",
      "",
      "",
      "",
      "",
      avgTotal.toLocaleString()
    ]);
    
    autoTable(doc, {
      head: [finHeaders],
      body: finBody,
      startY: yPos,
      margin: { left: 10, right: 10 },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: "bold" },
        2: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right", fontStyle: "bold" },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didParseCell: function(data) {
        // Style average row
        if (data.row.index === finBody.length - 1) {
          data.cell.styles.fillColor = [245, 158, 11];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = "bold";
        }
        // Highlight total column
        if (data.section === "body" && data.column.index === 5 && data.row.index < finBody.length - 1) {
          data.cell.styles.textColor = [16, 185, 129];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 9;
        }
      }
    });
    
    // Financial ranking
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const rankedFin = [...data.financials].sort((a, b) => a.total - b.total); // lowest cost first
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.text("Cost Ranking (Lowest to Highest)", pageWidth - 15, finalY, { align: "right" });
    
    rankedFin.forEach((f, i) => {
      const y = finalY + 8 + (i * 12);
      const colors = i === 0 ? emeraldGreen : i === 1 ? amberYellow : slateGray;
      
      doc.setFillColor(colors[0], colors[1], colors[2]);
      doc.roundedRect(pageWidth - 105, y - 4, 90, 10, 2, 2, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`#${i + 1}  ${f.consultantName}  —  ${f.total.toLocaleString()} AED`, pageWidth - 100, y + 2);
    });
    
    drawFooter(type === "full" ? 2 : 1, type === "full" ? 2 : 1);
  }
  
  // Save
  const filename = type === "full" 
    ? `COMO_Evaluation_Full_${data.projectName}_${new Date().toISOString().slice(0, 10)}.pdf`
    : type === "technical"
      ? `COMO_Technical_Evaluation_${data.projectName}_${new Date().toISOString().slice(0, 10)}.pdf`
      : `COMO_Financial_Evaluation_${data.projectName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  
  doc.save(filename);
}
