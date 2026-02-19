import { renameFile, moveFile } from "../server/googleDrive.ts";

// Category folder IDs (just created)
const COMO_FOUNDATION = "193pE-Pgp1ACeq18bSMzeCaS8wueAhKD2";
const PLOT_CONTRACTS = "1RJVz0uTBkm6xbLN8R_EFayh8f3TLJl74";
const CONSULTANCY_PROPOSALS = "1sAU8DhoTxqJ3aGSFb_YD5mzi3XfUgtRt";

const REMAINING_OPS = [
  // === COMO_FOUNDATION ===
  // From 02_Company Documents > MEETINGS_MOM (pick one copy of each)
  { id: "1u8F66PqUBJ6Qs45XuCYSk17j55_9X8te", newName: "COMO_MOM_20251225.pdf", target: COMO_FOUNDATION },
  { id: "1G5b6jmVeYFzLm4ACpoOB2BN_Zd1hrEuq", newName: "COMO_MOM-PRES_20251225.pdf", target: COMO_FOUNDATION },
  
  // From 02_Company Documents > LEGAL_&_LICENSES
  { id: "1xi5ZqULx5bymebHX9YModmRTn87nwkUu", newName: "COMO_LIC_2024_2025_Updated.pdf", target: COMO_FOUNDATION },
  { id: "1Y8DHvKp6Z7cV9AMZLblrRf352PPRaCaA", newName: "COMO_LIC_2024_2025.pdf", target: COMO_FOUNDATION },
  
  // From 02_Company Documents > METHODOLOGY (duplicates of already moved - rename in place)
  { id: "1z1TC11aL9BnFPgj_SrGDszoj0H9WPzzc", newName: "COMO_METHOD_V6.0_2026_copy.docx", target: COMO_FOUNDATION },
  { id: "1Y6pbMuaA6Zuzlr5fZp8VF6_IVyuDho7j", newName: "COMO_METHOD_V6.0_2026_copy.pdf", target: COMO_FOUNDATION },
  
  // From كولييرز مول > المصطلحات
  { id: "1BVZsUycUaajNDv9VRBuJ2ptlkriamZZJ", newName: "COMO_GLOSSARY_TERMS.pdf", target: COMO_FOUNDATION },
  
  // === PLOT_CONTRACTS ===
  // From 02_Company Documents > LEGAL_&_LICENSES (duplicate land analysis)
  { id: "1ixZgDE7c7Ief8vfWoK2VfT1QUw6f7hey", newName: "COMO_ANALYSIS_LAND_20260206_copy.pdf", target: PLOT_CONTRACTS },
  
  // === CONSULTANCY_PROPOSALS ===
  // From كولييرز مول
  { id: "1rzeTkiZQ7oHpucGCGtuXd0VQ_RDOfNGq", newName: "MAJ-M_6457956_PRO_202602_COL.pdf", target: CONSULTANCY_PROPOSALS },
  { id: "1Y9TS7KBBHqb4Kag5fy1PvFIuauFtkCKZ", newName: "MAJ-M_6457956_FACTSHEET.pdf", target: CONSULTANCY_PROPOSALS },
  { id: "1eTrKiYW80on3bYxQ7Vd4MbVf7dWML4Ol", newName: "MAJ-M_6457956_PRO-COL_EVAL.pdf", target: CONSULTANCY_PROPOSALS },
];

async function main() {
  console.log("=== Moving remaining files ===\n");
  let success = 0;
  let errors = [];
  
  for (const op of REMAINING_OPS) {
    try {
      await renameFile(op.id, op.newName);
      await moveFile(op.id, op.target);
      console.log(`  ✓ ${op.newName}`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${op.newName}: ${err.message}`);
      errors.push({ name: op.newName, error: err.message });
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Success: ${success}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`  - ${e.name}: ${e.error}`);
    }
  }
}

main().catch(console.error);
