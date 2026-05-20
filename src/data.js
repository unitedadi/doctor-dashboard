/* global React */
// Mock data for the doctor dashboard
// All in Arabic-Gulf names, DarDoc service catalog, AED currency

const DOCTOR = {
  name: "Dr. Sami",
  title: "GLP-1 & Peptide Specialist",
  initials: "S",
  license: "MOH-DXB-29871",
};

// Lab test catalog — what the doctor can recommend
const LAB_TESTS = [
  { code: "CBC", name: "Complete Blood Count", category: "Hematology", turnaround: "Same day", price: "AED 90" },
  { code: "HBA1C", name: "Hemoglobin A1c", category: "Metabolic", turnaround: "Same day", price: "AED 110" },
  { code: "LIPID", name: "Lipid Panel", category: "Metabolic", turnaround: "Same day", price: "AED 140" },
  { code: "FBG", name: "Fasting Blood Glucose", category: "Metabolic", turnaround: "Same day", price: "AED 60" },
  { code: "TSH", name: "TSH (Thyroid)", category: "Endocrine", turnaround: "24h", price: "AED 95" },
  { code: "FT4", name: "Free T4", category: "Endocrine", turnaround: "24h", price: "AED 110" },
  { code: "TEST", name: "Testosterone (Total + Free)", category: "Endocrine", turnaround: "24h", price: "AED 220" },
  { code: "COR", name: "Cortisol (AM)", category: "Endocrine", turnaround: "24h", price: "AED 140" },
  { code: "VITD", name: "Vitamin D (25-OH)", category: "Nutrition", turnaround: "24h", price: "AED 180" },
  { code: "B12", name: "Vitamin B12", category: "Nutrition", turnaround: "24h", price: "AED 110" },
  { code: "FERR", name: "Ferritin", category: "Nutrition", turnaround: "24h", price: "AED 130" },
  { code: "MAG", name: "Magnesium (RBC)", category: "Nutrition", turnaround: "24h", price: "AED 140" },
  { code: "LFT", name: "Liver Function Panel", category: "Hepatic", turnaround: "Same day", price: "AED 160" },
  { code: "RFT", name: "Kidney Function Panel", category: "Renal", turnaround: "Same day", price: "AED 150" },
  { code: "URIC", name: "Uric Acid", category: "Renal", turnaround: "Same day", price: "AED 70" },
  { code: "CRP", name: "C-Reactive Protein (hs)", category: "Inflammation", turnaround: "24h", price: "AED 120" },
  { code: "INSF", name: "Fasting Insulin + HOMA-IR", category: "Metabolic", turnaround: "48h", price: "AED 240" },
  { code: "IGF1", name: "IGF-1", category: "Endocrine", turnaround: "48h", price: "AED 280" },
  { code: "HOMR", name: "Hormone Profile (full)", category: "Endocrine", turnaround: "48h", price: "AED 620" },
];

const LAB_BUNDLES = [
  { id: "lb1", name: "GLP-1 baseline", desc: "Pre-treatment workup", tests: ["CBC", "HBA1C", "LIPID", "LFT", "RFT", "TSH"] },
  { id: "lb2", name: "GLP-1 monthly check", desc: "Tolerance & efficacy", tests: ["HBA1C", "LFT", "FBG"] },
  { id: "lb3", name: "Peptide therapy panel", desc: "BPC-157, CJC, Ipamorelin", tests: ["CBC", "LFT", "RFT", "IGF1", "CRP"] },
  { id: "lb4", name: "Hormone optimization (M)", desc: "Testosterone & adjacent", tests: ["TEST", "COR", "VITD", "TSH", "LIPID"] },
  { id: "lb5", name: "Hormone optimization (F)", desc: "Cycle & thyroid", tests: ["HOMR", "TSH", "FT4", "VITD", "FERR"] },
  { id: "lb6", name: "Longevity baseline", desc: "Comprehensive", tests: ["CBC", "HBA1C", "LIPID", "LFT", "RFT", "VITD", "B12", "TSH", "INSF", "CRP"] },
];

const PATIENTS = [
  {
    id: "p1",
    name: "Omar Al Hashimi",
    initials: "OH",
    age: 38, sex: "Male",
    nationality: "UAE",
    phone: "+971 50 422 8810",
    email: "omar.h@protonmail.com",
    address: "Villa 14, Al Wasl Road, Dubai",
    insurance: "Daman Premier · Active",
    insuranceId: "DM-2298-77451",
    member: "Primary",
    bloodType: "O+",
    height: "178 cm", weight: "94 kg", bmi: "29.7",
    allergies: ["Penicillin", "Pollen"],
    conditions: ["Recovery (post-op shoulder)", "Pre-diabetes"],
    medications: [
      { name: "BPC-157 500 mcg", schedule: "Subcutaneous, twice daily", since: "Apr 2026" },
      { name: "Metformin 500 mg", schedule: "Twice daily, with meals", since: "Aug 2024" },
    ],
    vitalsLast: { date: "Apr 28, 2026", bp: "138/86", hr: "78", spo2: "98%", temp: "36.7°C" },
    labs: [
      { name: "HbA1c", value: "6.1", unit: "%", range: "4.0–5.6", status: "high", date: "Apr 12" },
      { name: "LDL Cholesterol", value: "142", unit: "mg/dL", range: "<130", status: "high", date: "Apr 12" },
      { name: "HDL", value: "48", unit: "mg/dL", range: ">40", status: "normal", date: "Apr 12" },
      { name: "Triglycerides", value: "188", unit: "mg/dL", range: "<150", status: "high", date: "Apr 12" },
      { name: "Fasting glucose", value: "112", unit: "mg/dL", range: "70–100", status: "high", date: "Apr 12" },
      { name: "Vitamin D", value: "21", unit: "ng/mL", range: "30–100", status: "low", date: "Apr 12" },
    ],
    history: [
      { date: "Apr 28, 2026", title: "Peptide check-in · video", note: "Tolerating BPC-157 well. Shoulder ROM improving. Continue 4 weeks." },
      { date: "Apr 12, 2026", title: "Pre-peptide blood panel", note: "HbA1c 6.1, LDL 142. Cleared for BPC-157. Reinforced Mediterranean diet." },
      { date: "Mar 18, 2026", title: "Peptide consult", note: "Post-op shoulder. Started BPC-157 500 mcg BID, 4-week protocol." },
      { date: "Aug 18, 2025", title: "GP consult · video", note: "Pre-diabetes screen. Started metformin 500 mg." },
    ],
    upcoming: { date: "Today", time: "10:00", service: "Peptide consult · BPC-157" },
  },
  {
    id: "p2",
    name: "Fatima Al Suwaidi",
    initials: "FS",
    age: 31, sex: "Female",
    nationality: "UAE",
    phone: "+971 55 198 4420",
    email: "fatima.suwaidi@gmail.com",
    address: "Reem Island, Sun Tower 22B, Abu Dhabi",
    insurance: "Thiqa · Active",
    insuranceId: "TH-99812-203",
    member: "Primary",
    bloodType: "A-",
    height: "164 cm", weight: "78 kg", bmi: "29.0",
    allergies: ["Sulfa drugs"],
    conditions: ["Obesity (Class I)", "PCOS"],
    medications: [
      { name: "Semaglutide 0.5 mg", schedule: "Weekly · Sunday morning", since: "Feb 2026" },
      { name: "Folic acid 5 mg", schedule: "Once daily", since: "Jan 2026" },
    ],
    vitalsLast: { date: "Apr 30, 2026", bp: "124/80", hr: "72", spo2: "99%", temp: "36.5°C" },
    labs: [
      { name: "HbA1c", value: "5.4", unit: "%", range: "4.0–5.6", status: "normal", date: "Apr 09" },
      { name: "LDL Cholesterol", value: "118", unit: "mg/dL", range: "<130", status: "normal", date: "Apr 09" },
      { name: "TSH", value: "2.1", unit: "mIU/L", range: "0.4–4.0", status: "normal", date: "Apr 09" },
      { name: "Ferritin", value: "18", unit: "ng/mL", range: "20–200", status: "low", date: "Apr 09" },
    ],
    history: [
      { date: "Apr 30, 2026", title: "GLP-1 follow-up · video", note: "Tolerating semaglutide. Down 4.2 kg in 8 weeks. Continue 0.5 mg." },
      { date: "Apr 09, 2026", title: "Blood panel + thyroid", note: "Within range. Iron borderline low, recommended supplement." },
      { date: "Feb 15, 2026", title: "GLP-1 onboarding", note: "Started semaglutide 0.25 mg, titrated to 0.5 mg after 4 weeks." },
    ],
    upcoming: { date: "Today", time: "11:30", service: "GLP-1 review" },
  },
  {
    id: "p3",
    name: "Khalid Al Marri",
    initials: "KM",
    age: 45, sex: "Male",
    nationality: "UAE",
    phone: "+971 50 901 1276",
    email: "khalid.almarri@me.com",
    address: "Saadiyat Beach, Villa 8, Abu Dhabi",
    insurance: "AXA Gulf Platinum",
    insuranceId: "AXA-44-29981",
    member: "Primary",
    bloodType: "B+",
    height: "182 cm", weight: "88 kg", bmi: "26.6",
    allergies: ["None known"],
    conditions: ["Hormone optimization", "Recovery & longevity"],
    medications: [
      { name: "CJC-1295 / Ipamorelin 300 mcg", schedule: "Subcut, nightly", since: "Feb 2026" },
      { name: "Vitamin D3 5000 IU", schedule: "Once daily", since: "Mar 2026" },
    ],
    vitalsLast: { date: "Apr 02, 2026", bp: "118/76", hr: "62", spo2: "99%", temp: "36.6°C" },
    labs: [
      { name: "IGF-1", value: "244", unit: "ng/mL", range: "117–329", status: "normal", date: "Apr 02" },
      { name: "Testosterone (total)", value: "512", unit: "ng/dL", range: "300–1000", status: "normal", date: "Apr 02" },
      { name: "Vitamin D", value: "42", unit: "ng/mL", range: "30–100", status: "normal", date: "Apr 02" },
    ],
    history: [
      { date: "Apr 02, 2026", title: "Peptide therapy · video", note: "Tolerating CJC/Ipa well. Sleep improved, recovery faster." },
      { date: "Feb 18, 2026", title: "Peptide consult · baseline", note: "Started CJC-1295/Ipamorelin. 12-week protocol." },
    ],
    upcoming: { date: "Today", time: "14:00", service: "Peptide therapy · CJC/Ipamorelin" },
  },
  {
    id: "p4",
    name: "Noura Al Qubaisi",
    initials: "NQ",
    age: 29, sex: "Female",
    nationality: "UAE",
    phone: "+971 56 442 0090",
    email: "noura.q@icloud.com",
    address: "Marina Gate 2, Tower 1, Dubai",
    insurance: "Daman Enhanced",
    insuranceId: "DM-1182-8810",
    member: "Primary",
    bloodType: "AB+",
    height: "168 cm", weight: "74 kg", bmi: "26.2",
    allergies: ["Shellfish"],
    conditions: ["Weight management", "Insulin resistance"],
    medications: [
      { name: "Folic acid 1 mg", schedule: "Once daily", since: "Apr 2026" },
    ],
    vitalsLast: { date: "Apr 24, 2026", bp: "118/76", hr: "74", spo2: "99%", temp: "36.6°C" },
    labs: [
      { name: "HbA1c", value: "5.7", unit: "%", range: "4.0–5.6", status: "high", date: "Apr 22" },
      { name: "Fasting insulin", value: "18", unit: "µIU/mL", range: "3–25", status: "normal", date: "Apr 22" },
    ],
    history: [
      { date: "Apr 24, 2026", title: "GLP-1 intake · video", note: "Eligibility confirmed. Counseled on titration & side effects." },
      { date: "Apr 22, 2026", title: "Baseline blood panel", note: "HbA1c borderline. Insulin within range. Cleared to start." },
    ],
    upcoming: { date: "Today", time: "15:30", service: "GLP-1 onboarding" },
  },
  {
    id: "p5",
    name: "Sara Mahmoud",
    initials: "SM",
    age: 42, sex: "Female",
    nationality: "Egyptian",
    phone: "+971 52 711 9034",
    email: "sara.m@outlook.com",
    address: "JLT, Cluster G, Dubai",
    insurance: "Cigna Gold",
    insuranceId: "CG-22-77400",
    member: "Primary",
    bloodType: "O-",
    height: "160 cm", weight: "72 kg", bmi: "28.1",
    allergies: ["Aspirin"],
    conditions: ["Hypothyroidism", "Perimenopause"],
    medications: [
      { name: "Levothyroxine 75 mcg", schedule: "Once daily, morning", since: "Jan 2024" },
    ],
    vitalsLast: { date: "Apr 18, 2026", bp: "128/82", hr: "74", spo2: "98%", temp: "36.6°C" },
    labs: [
      { name: "TSH", value: "3.8", unit: "mIU/L", range: "0.4–4.0", status: "normal", date: "Apr 18" },
      { name: "Free T4", value: "1.1", unit: "ng/dL", range: "0.8–1.8", status: "normal", date: "Apr 18" },
    ],
    history: [
      { date: "Apr 18, 2026", title: "Hormone consult · video", note: "Discussed perimenopausal symptoms; considering peptide adjuncts." },
    ],
    upcoming: { date: "Tomorrow", time: "09:00", service: "Hormone optimization" },
  },
  {
    id: "p6",
    name: "Yousef Al Fardan",
    initials: "YF",
    age: 52, sex: "Male",
    nationality: "UAE",
    phone: "+971 50 332 6612",
    email: "y.fardan@gmail.com",
    address: "Emirates Hills, Villa 311, Dubai",
    insurance: "Bupa International",
    insuranceId: "BU-9931-4422",
    member: "Primary",
    bloodType: "A+",
    height: "175 cm", weight: "82 kg", bmi: "26.8",
    allergies: ["Latex"],
    conditions: ["Type 2 Diabetes", "Hyperlipidemia"],
    medications: [
      { name: "Metformin 1000 mg", schedule: "Twice daily", since: "Jun 2022" },
      { name: "Atorvastatin 20 mg", schedule: "At night", since: "Jun 2022" },
    ],
    vitalsLast: { date: "Apr 15, 2026", bp: "132/84", hr: "70", spo2: "98%", temp: "36.5°C" },
    labs: [
      { name: "HbA1c", value: "6.8", unit: "%", range: "4.0–5.6", status: "high", date: "Apr 15" },
      { name: "LDL", value: "98", unit: "mg/dL", range: "<100", status: "normal", date: "Apr 15" },
    ],
    history: [
      { date: "Apr 15, 2026", title: "GLP-1 review · video", note: "Down 6.4 kg in 12 weeks. HbA1c 6.8. Continue semaglutide 1 mg weekly." },
    ],
    upcoming: { date: "Tomorrow", time: "11:00", service: "GLP-1 follow-up" },
  },
  {
    id: "p7",
    name: "Maya Petrov",
    initials: "MP",
    age: 34, sex: "Female",
    nationality: "Russian",
    phone: "+971 58 100 4452",
    email: "maya.petrov@me.com",
    address: "Bluewaters, Apt 1408, Dubai",
    insurance: "Aetna Premier",
    insuranceId: "AE-552-0011",
    member: "Primary",
    bloodType: "A+",
    height: "171 cm", weight: "63 kg", bmi: "21.5",
    allergies: ["None known"],
    conditions: ["Recovery & repair (active athlete)"],
    medications: [
      { name: "BPC-157 250 mcg", schedule: "Subcutaneous, daily", since: "Mar 2026" },
    ],
    vitalsLast: { date: "Apr 11, 2026", bp: "115/74", hr: "58", spo2: "99%", temp: "36.6°C" },
    labs: [
      { name: "IGF-1", value: "228", unit: "ng/mL", range: "117–329", status: "normal", date: "Apr 11" },
      { name: "Vitamin B12", value: "208", unit: "pg/mL", range: "200–900", status: "low", date: "Apr 11" },
    ],
    history: [
      { date: "Apr 11, 2026", title: "Peptide consult · BPC-157", note: "Started BPC-157 for ACL post-surgical recovery. 4-week protocol." },
    ],
    upcoming: { date: "Wed", time: "16:00", service: "Peptide follow-up" },
  },
];

// Map current week
const APPOINTMENTS = [
  // TODAY (May 5, 2026)
  { id: "a1", patientId: "p1", date: "2026-05-05", day: "Today", time: "10:00", duration: 30, service: "Peptide consult · BPC-157", type: "Video call", location: "Telehealth", status: "upcoming" },
  { id: "a2", patientId: "p2", date: "2026-05-05", day: "Today", time: "11:30", duration: 25, service: "GLP-1 review", type: "Video call", location: "Telehealth", status: "upcoming" },
  { id: "a3", patientId: "p3", date: "2026-05-05", day: "Today", time: "14:00", duration: 45, service: "Peptide therapy · CJC/Ipamorelin", type: "Video call", location: "Telehealth", status: "upcoming" },
  { id: "a4", patientId: "p4", date: "2026-05-05", day: "Today", time: "15:30", duration: 30, service: "GLP-1 onboarding", type: "Video call", location: "Telehealth", status: "upcoming" },
  { id: "a5", patientId: "p1", date: "2026-05-05", day: "Today", time: "08:30", duration: 20, service: "Lab review", type: "Phone call", location: "Telehealth", status: "completed" },

  // Tomorrow (May 6)
  { id: "a6", patientId: "p5", date: "2026-05-06", day: "Tomorrow", time: "09:00", duration: 30, service: "Hormone optimization", type: "Video call", location: "Telehealth", status: "upcoming" },
  { id: "a7", patientId: "p6", date: "2026-05-06", day: "Tomorrow", time: "11:00", duration: 30, service: "GLP-1 follow-up", type: "Video call", location: "Telehealth", status: "upcoming" },
  { id: "a8", patientId: "p2", date: "2026-05-06", day: "Tomorrow", time: "16:30", duration: 30, service: "Blood draw · home", type: "Home visit", location: "Reem · AUH", status: "upcoming" },

  // Wed May 7
  { id: "a9", patientId: "p7", date: "2026-05-07", day: "Wed", time: "16:00", duration: 30, service: "Peptide follow-up", type: "Video call", location: "Telehealth", status: "upcoming" },
  { id: "a10", patientId: "p3", date: "2026-05-07", day: "Wed", time: "10:30", duration: 45, service: "Peptide consult", type: "Video call", location: "Telehealth", status: "upcoming" },

  // Thu May 8
  { id: "a11", patientId: "p4", date: "2026-05-08", day: "Thu", time: "10:00", duration: 30, service: "Newborn check", type: "Home visit", location: "Marina · Dubai", status: "upcoming" },

  // Fri May 9
  { id: "a12", patientId: "p1", date: "2026-05-09", day: "Fri", time: "09:30", duration: 30, service: "Peptide check-in", type: "Video call", location: "Telehealth", status: "upcoming" },
  { id: "a13", patientId: "p6", date: "2026-05-09", day: "Fri", time: "14:00", duration: 30, service: "GLP-1 lab review", type: "Video call", location: "Telehealth", status: "upcoming" },

  // Sat May 10
  { id: "a14", patientId: "p2", date: "2026-05-10", day: "Sat", time: "10:00", duration: 30, service: "Nutrition coaching", type: "Video call", location: "Telehealth", status: "upcoming" },

  // Sun May 11
  { id: "a15", patientId: "p5", date: "2026-05-11", day: "Sun", time: "11:00", duration: 30, service: "Thyroid review", type: "Video call", location: "Telehealth", status: "upcoming" },
];

// Chats
const CHATS = [
  {
    id: "c1", patientId: "p1", unread: 2, lastTime: "9:42 AM", typing: false,
    messages: [
      { id: "m1", from: "them", text: "Good morning Doctor. Done with day 14 of BPC-157, shoulder feels noticeably better.", time: "9:38 AM", day: "Today" },
      { id: "m2", from: "them", text: "Slight redness at the injection site this morning.", time: "9:38 AM", day: "Today" },
      { id: "m3", from: "them", text: "Anything I should change before our consult at 10?", time: "9:42 AM", day: "Today" },
    ],
  },
  {
    id: "c2", patientId: "p2", unread: 0, lastTime: "Yesterday", typing: false,
    messages: [
      { id: "m4", from: "them", text: "Hi! The injection went smoothly this Sunday. Mild nausea on day 2 but it passed.", time: "8:14 PM", day: "Yesterday" },
      { id: "m5", from: "me", text: "That's expected and a good sign you're tolerating the dose. Keep meals light and stay hydrated.", time: "8:22 PM", day: "Yesterday" },
      { id: "m6", from: "me", text: "We'll review at 11:30 tomorrow. Reminder: weigh yourself before the call please.", time: "8:23 PM", day: "Yesterday" },
      { id: "m7", from: "them", text: "Will do, thank you ❤️", time: "8:30 PM", day: "Yesterday" },
    ],
  },
  {
    id: "c3", patientId: "p4", unread: 1, lastTime: "8:01 AM", typing: true,
    messages: [
      { id: "m8", from: "them", text: "Doctor, I'm starting GLP-1 today. A little anxious about the first injection. Any tips?", time: "8:01 AM", day: "Today" },
    ],
  },
  {
    id: "c4", patientId: "p6", unread: 0, lastTime: "Mon", typing: false,
    messages: [
      { id: "m9", from: "me", text: "Your latest HbA1c came back at 6.8. Slight uptick from last quarter. Let's discuss adjustments on our call.", time: "Mon 4:18 PM", day: "Monday" },
      { id: "m10", from: "them", text: "Understood. I've been less consistent with walks lately.", time: "Mon 6:02 PM", day: "Monday" },
    ],
  },
  {
    id: "c5", patientId: "p3", unread: 0, lastTime: "Sun", typing: false,
    messages: [
      { id: "m11", from: "them", text: "Looking forward to the drip session this Tuesday.", time: "Sun 7:14 PM", day: "Sunday" },
    ],
  },
  {
    id: "c6", patientId: "p7", unread: 0, lastTime: "Sat", typing: false,
    messages: [
      { id: "m12", from: "them", text: "Skin feels much smoother already. Slight peeling on cheeks.", time: "Sat 10:08 AM", day: "Saturday" },
      { id: "m13", from: "me", text: "Normal in the first 2 weeks. Apply moisturizer 10 min after tretinoin and use SPF 50 every morning.", time: "Sat 11:30 AM", day: "Saturday" },
    ],
  },
];

// Drug catalog (small but realistic)
const DRUGS = [
  // Peptides — primary
  { name: "BPC-157", generic: "BPC-157", class: "Peptide · healing", strengths: ["250 mcg", "500 mcg", "750 mcg"], commonDose: "500 mcg" },
  { name: "CJC-1295 / Ipamorelin", generic: "CJC-1295 + Ipamorelin", class: "Peptide · GH secretagogue", strengths: ["100 mcg", "200 mcg", "300 mcg"], commonDose: "300 mcg" },
  { name: "Tesamorelin", generic: "Tesamorelin", class: "Peptide · GHRH analog", strengths: ["1 mg", "2 mg"], commonDose: "2 mg" },
  { name: "TB-500", generic: "Thymosin Beta-4", class: "Peptide · recovery", strengths: ["2 mg", "5 mg"], commonDose: "2 mg" },
  { name: "Selank", generic: "Selank", class: "Peptide · cognitive", strengths: ["250 mcg", "500 mcg"], commonDose: "500 mcg" },
  { name: "Epitalon", generic: "Epitalon", class: "Peptide · longevity", strengths: ["5 mg", "10 mg"], commonDose: "10 mg" },
  // GLP-1 — primary
  { name: "Semaglutide", generic: "Semaglutide", class: "GLP-1 agonist", strengths: ["0.25 mg", "0.5 mg", "1 mg", "2 mg"], commonDose: "0.5 mg" },
  { name: "Tirzepatide", generic: "Tirzepatide", class: "GIP/GLP-1 agonist", strengths: ["2.5 mg", "5 mg", "7.5 mg", "10 mg"], commonDose: "5 mg" },
  { name: "Liraglutide", generic: "Liraglutide", class: "GLP-1 agonist", strengths: ["0.6 mg", "1.2 mg", "1.8 mg", "3 mg"], commonDose: "1.2 mg" },
  // Supportive
  { name: "Metformin", generic: "Metformin HCl", class: "Biguanide", strengths: ["500 mg", "850 mg", "1000 mg"], commonDose: "500 mg" },
  { name: "Vitamin D3", generic: "Cholecalciferol", class: "Supplement", strengths: ["1000 IU", "2000 IU", "5000 IU"], commonDose: "5000 IU" },
  { name: "Ondansetron", generic: "Ondansetron", class: "Antiemetic", strengths: ["4 mg", "8 mg"], commonDose: "4 mg" },
  { name: "Omeprazole", generic: "Omeprazole", class: "PPI", strengths: ["10 mg", "20 mg", "40 mg"], commonDose: "20 mg" },
  { name: "Folic acid", generic: "Folic acid", class: "B-vitamin", strengths: ["400 mcg", "1 mg", "5 mg"], commonDose: "1 mg" },
];

const FREQUENCIES = ["Once daily", "Twice daily", "Three times daily", "Every 8 hours", "Every 12 hours", "At bedtime", "Subcutaneous, daily", "Subcutaneous, twice daily", "Weekly · subcutaneous", "5 days on, 2 off"];
const DURATIONS = ["7 days", "14 days", "4 weeks", "6 weeks", "8 weeks", "12 weeks", "3 months", "6 months", "Ongoing"];

// Quick reply templates
const QUICK_REPLIES = [
  "Thanks for the update. We'll review at our next visit.",
  "Please send a photo if it's possible.",
  "Take readings morning and evening for the next 3 days.",
  "If symptoms worsen, please call our clinical line immediately.",
];

window.DD_DATA = { DOCTOR, PATIENTS, APPOINTMENTS, CHATS, DRUGS, FREQUENCIES, DURATIONS, QUICK_REPLIES, LAB_TESTS, LAB_BUNDLES };
