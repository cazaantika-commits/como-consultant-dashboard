import crypto from "crypto";

// Generate tokens for the 3 members
const members = [
  { name: "Abdalrahman", nameAr: "عبدالرحمن", role: "admin", memberId: "abdulrahman" },
  { name: "Wael", nameAr: "وائل", role: "executive", memberId: "wael" },
  { name: "Sheikh Issa", nameAr: "الشيخ عيسى", role: "executive", memberId: "sheikh_issa" },
];

members.forEach(m => {
  const token = crypto.randomBytes(48).toString("hex");
  console.log(`${m.nameAr} (${m.memberId}): ${token}`);
});
