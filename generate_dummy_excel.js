const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Real-world datasets for generating authentic Indian candidate records
const maleFirstNames = [
  "Aarav", "Vihaan", "Vivaan", "Anaya", "Reyansh", "Ishan", "Arjun", "Sai", "Krishna", "Atharva",
  "Shaurya", "Ayan", "Advik", "Dhruv", "Kavir", "Ritvik", "Kabir", "Siddharth", "Utkarsh", "Samar",
  "Om", "Dev", "Shivansh", "Rudra", "Vansh", "Ayush", "Pranav", "Yash", "Parth", "Arnav",
  "Abhinav", "Aditya", "Bhavya", "Chetan", "Deepak", "Gaurav", "Harsh", "Jatin", "Karan", "Manish",
  "Nikhil", "Piyush", "Rahul", "Sachin", "Tushar", "Varun", "Vikram", "Yatin", "Aman", "Rohan"
];

const femaleFirstNames = [
  "Ananya", "Diya", "Vanya", "Pari", "Anika", "Navya", "Angel", "Aadya", "Myra", "Ira",
  "Saanvi", "Aadhya", "Avani", "Ishita", "Riya", "Kavya", "Shanaya", "Bhavya", "Tanya", "Trisha",
  "Mihika", "Prisha", "Sara", "Aditi", "Meera", "Shreya", "Sneha", "Radhika", "Neha", "Tanvi",
  "Aakanksha", "Bhumika", "Charu", "Divya", "Ekta", "Garima", "Isha", "Juhi", "Kritika", "Pooja"
];

const lastNames = [
  "Sharma", "Verma", "Singh", "Kumar", "Patel", "Gupta", "Yadav", "Joshi", "Mehta", "Das",
  "Banerjee", "Nair", "Rao", "Reddy", "Kulkarni", "Deshmukh", "Choudhury", "Mishra", "Pandey", "Jha",
  "Tripathi", "Saxena", "Agarwal", "Tiwari", "Mukhopadhyay", "Bhat", "Pillai", "Gill", "Sen", "Nambiar",
  "Sinha", "Chauhan", "Bose", "Dutta", "Shukla", "Thakur", "Rathore", "Bhattacharya", "Chakraborty", "Srivastava"
];

const fatherFirstNames = [
  "Rajesh", "Suresh", "Amit", "Anil", "Sunil", "Ramesh", "Dinesh", "Sanjay", "Vikrant", "Rakesh",
  "Alok", "Sanjeev", "Manoj", "Vijay", "Praveen", "Deepak", "Pankaj", "Ashish", "Vinod", "Rajiv",
  "Mahesh", "Mukesh", "Naresh", "Satish", "Subhash", "Ashok", "Santosh", "Girish", "Harish", "Brijesh"
];

const motherFirstNames = [
  "Sunita", "Pooja", "Sarita", "Anita", "Rekha", "Kavita", "Sangeeta", "Meena", "Asha", "Geeta",
  "Pushpa", "Lata", "Neelam", "Seema", "Ritu", "Anju", "Vandana", "Savita", "Mamta", "Archana",
  "Suman", "Shobha", "Usha", "Manju", "Kiran", "Shakuntala", "Sushma", "Kamla", "Sudha", "Bimla"
];

const classesConfig = [
  { id: "Balvatika-1", weight: 15, minDob: "2022-04-02", maxDob: "2023-03-31" },
  { id: "Balvatika-2", weight: 10, minDob: "2021-04-02", maxDob: "2022-03-31" },
  { id: "Balvatika-3", weight: 10, minDob: "2020-04-02", maxDob: "2021-03-31" },
  { id: "I", weight: 25, minDob: "2018-04-02", maxDob: "2020-03-31" },
  { id: "II", weight: 5, minDob: "2017-04-02", maxDob: "2019-03-31" },
  { id: "III", weight: 5, minDob: "2016-04-02", maxDob: "2018-03-31" },
  { id: "IV", weight: 5, minDob: "2015-04-02", maxDob: "2017-03-31" },
  { id: "V", weight: 5, minDob: "2014-04-02", maxDob: "2016-03-31" },
  { id: "VI", weight: 4, minDob: "2014-04-02", maxDob: "2016-03-31" },
  { id: "VII", weight: 4, minDob: "2013-04-02", maxDob: "2015-03-31" },
  { id: "VIII", weight: 4, minDob: "2012-04-02", maxDob: "2014-03-31" },
  { id: "IX", weight: 4, minDob: "2011-04-02", maxDob: "2013-03-31" },
  { id: "XI", weight: 4, minDob: "2009-04-02", maxDob: "2011-03-31" }
];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(startStr, endStr) {
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  const randomTime = start + Math.random() * (end - start);
  const d = new Date(randomTime);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRandomClass() {
  const totalWeight = classesConfig.reduce((acc, c) => acc + c.weight, 0);
  let rnd = Math.random() * totalWeight;
  for (const c of classesConfig) {
    if (rnd < c.weight) return c;
    rnd -= c.weight;
  }
  return classesConfig[0];
}

function generateMobileNumber() {
  const prefixes = ['98', '97', '96', '95', '94', '88', '87', '86', '79', '78', '70', '63'];
  const prefix = getRandomElement(prefixes);
  const suffix = Math.floor(1000000 + Math.random() * 9000000).toString();
  return prefix + suffix;
}

function generateDataset(recordCount) {
  const headers = [
    "S.No", 
    "Registration No/Submission Code", 
    "Student Full Name", 
    "Father Name", 
    "Mother Name", 
    "Date of Birth (YYYY-MM-DD)", 
    "Gender (MALE/FEMALE)", 
    "Class Applied (Balvatika-1 to 3, I to XI)", 
    "Service Category (Cat-1 to Cat-5)", 
    "Social Category (GEN/SC/ST/OBC-NCL)", 
    "RTE Claim (YES/NO)", 
    "Residence Distance (Km)", 
    "CwSN (YES/NO)", 
    "Transfers (Last 7 Yrs)", 
    "Parent Mobile Number"
  ];

  const rows = [headers];

  // Use Roman numerals matching real Excel sheet format (I, II, III, IV, V)
  const categories = ["I", "I", "I", "II", "II", "III", "III", "IV", "V", "V"];
  // Mix OBC NCL and OBC-NCL to test normalization
  const socialCategories = ["GEN", "GEN", "GEN", "GEN", "OBC NCL", "OBC-NCL", "OBC NCL", "SC", "SC", "ST", "OBC-CL"];

  for (let i = 1; i <= recordCount; i++) {
    const isMale = Math.random() > 0.48;
    const gender = isMale ? "MALE" : "FEMALE";
    const firstName = isMale ? getRandomElement(maleFirstNames) : getRandomElement(femaleFirstNames);
    const lastName = getRandomElement(lastNames);
    const fullName = `${firstName} ${lastName}`;
    
    const fatherName = `${getRandomElement(fatherFirstNames)} ${lastName}`;
    const motherName = `${getRandomElement(motherFirstNames)} ${lastName}`;

    const regNo = `2627${String(100000000 + i).slice(1)}`;
    const classObj = getRandomClass();
    const dob = getRandomDate(classObj.minDob, classObj.maxDob);
    const classApplied = classObj.id;

    const cat = getRandomElement(categories);
    const caste = getRandomElement(socialCategories);

    // Distance logic: candidates within 5km are RTE eligible if claiming
    const distanceKm = (Math.random() * 11.5 + 0.3).toFixed(1);
    const isRteDistanceEligible = parseFloat(distanceKm) <= 5.0;

    let rteClaim = "NO";
    if (isRteDistanceEligible && (caste === "OBC-NCL" || caste === "SC" || caste === "ST" || Math.random() < 0.25)) {
      rteClaim = Math.random() < 0.7 ? "YES" : "NO";
    }

    const isCwSN = Math.random() < 0.04 ? "YES" : "NO";

    // Transfers logic for Category 1 & 2
    let transfers = 0;
    if (cat === "Cat-1") {
      transfers = Math.floor(Math.random() * 6);
    } else if (cat === "Cat-2") {
      transfers = Math.floor(Math.random() * 4);
    }

    const mobile = generateMobileNumber();

    rows.push([
      i,
      regNo,
      fullName,
      fatherName,
      motherName,
      dob,
      gender,
      classApplied,
      cat,
      caste,
      rteClaim,
      parseFloat(distanceKm),
      isCwSN,
      transfers,
      mobile
    ]);
  }

  return rows;
}

function createExcelFile(filename, recordCount) {
  const data = generateDataset(recordCount);
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column Widths
  ws['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 20 }, // Reg No
    { wch: 22 }, // Name
    { wch: 20 }, // Father Name
    { wch: 20 }, // Mother Name
    { wch: 18 }, // DOB
    { wch: 12 }, // Gender
    { wch: 16 }, // Class Applied
    { wch: 18 }, // Service Cat
    { wch: 18 }, // Social Cat
    { wch: 14 }, // RTE
    { wch: 16 }, // Distance
    { wch: 14 }, // CwSN
    { wch: 16 }, // Transfers
    { wch: 18 }  // Mobile
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "KVS Application Import");

  const targetPath = path.join(process.cwd(), filename);
  XLSX.writeFile(wb, targetPath);
  console.log(`Generated ${filename} with ${recordCount} records at: ${targetPath}`);
}

createExcelFile("KVS_Stress_Test_500_Applications.xlsx", 500);
createExcelFile("KVS_Stress_Test_1000_Applications.xlsx", 1000);
