const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const sql = require('mssql');

const { LocalStorage } = require('node-localstorage');

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));  // ตั้งค่าเป็น 50MB
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const port = 3000;

// การตั้งค่าการเชื่อมต่อ SQL Server
// 🔥 ตั้งค่าการเชื่อมต่อสำหรับ Test_ong
const configTestOng = {
    user: "my_user",
    password: "my_password",
    server: "DESKTOP-3ISTS3L\\SQLEXPRESS",
    database: "Test_ong",
    port: 1433, // port db
    options: {
        encrypt: false, // ปรับตามความต้องการของเซิร์ฟเวอร์
        trustServerCertificate: true,
    }
};
// 🔥 ตั้งค่าการเชื่อมต่อสำหรับ HS54
const configHS54 = {
    user: "my_user",
    password: "my_password",
    server: "DESKTOP-3ISTS3L\\SQLEXPRESS",
    database: "HS54",
    port: 1433, // port db
    options: {
        encrypt: false,
        trustServerCertificate: true,
    }
};
// 🔥 ตั้งค่าการเชื่อมต่อสำหรับ HSPK
const configHSPK = {
    user: "my_user",
    password: "my_password",
    server: "DESKTOP-3ISTS3L\\SQLEXPRESS",
    database: "HSPK",
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true,
    }
};

// 🛠️ ใช้ SQL Connection Pool Manager
const pools = {
    TestOng: new sql.ConnectionPool(configTestOng),
    HS54: new sql.ConnectionPool(configHS54),
    HSPK: new sql.ConnectionPool(configHSPK)
};

async function getPool(dbName) {
    if (!pools[dbName]._connected) await pools[dbName].connect();
    return pools[dbName];
}


// เชื่อมต่อฐานข้อมูล
// sql.connect(config).then(() => {
//     console.log('Connected to the database successfully!');
// }).catch(err => {
//     console.error('Database connection failed:', err);
// });

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// API สำหรับการสร้างผู้ใช้ใหม่ (Register)
app.post('/api/register', async (req, res) => {
    // console.log("Received data:", req.body); // ✅ Debug ดูค่าที่ถูกส่งมา
    const { username, password, firstname, lastname, branch_code, branch_name} = req.body;
    const userRights = 'user'; // ✅ กำหนดค่า user_rights เป็น "user" เสมอ

    if (!username || !password || !firstname || !lastname || !branch_code || !branch_name) {
        return res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    try {
        const pool = await getPool("TestOng");
        const existingUser = await pool.request()
            .input("username", sql.NVarChar, username)
            .query("SELECT * FROM users WHERE username = @username");

        if (existingUser.recordset.length > 0) {
            return res.status(400).json({ success: false, message: "Username นี้ถูกใช้ไปแล้ว" });
        }

        // ✅ เข้ารหัสรหัสผ่านก่อนบันทึก
        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.request()
            .input("username", sql.NVarChar, username)
            .input("password", sql.NVarChar, hashedPassword)
            .input("firstname", sql.NVarChar, firstname || "N/A") // ✅ ถ้า firstname เป็น NULL ให้ใช้ "N/A"
            .input("lastname", sql.NVarChar, lastname) // ✅ เพิ่ม lastname
            .input("userRights", sql.NVarChar, userRights) // ✅ บันทึกค่า user_rights เป็น "user"
            .input("branch_code", sql.NVarChar, branch_code) // ✅ ใช้ branch_code
            .input("branch_name", sql.NVarChar, branch_name) // ✅ เพิ่ม branch_name
            .query("INSERT INTO users (firstname, lastname, username, password, user_rights, branch_code, branch_name) VALUES (@firstname, @lastname, @username, @password, @userRights, @branch_code, @branch_name)");

        res.json({ success: true });

    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// API สำหรับตรวจสอบการล็อกอิน
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        let pool = await getPool("TestOng");
        let result = await pool.request()
            .input('username', sql.VarChar, username)
            .input("password", sql.NVarChar, password)
            .query(`
                SELECT u.password, u.branch_code, u.user_rights, b.branch_name 
                FROM users u
                LEFT JOIN branches b ON u.branch_code = b.branch_code
                WHERE u.username = @username
            `);
           
            // Getting EmployeeID to store in localstorage
            //.query('SELECT EmployeeID, password FROM Users WHERE username = @username');

        if (result.recordset.length > 0) {
            const hashedPassword = result.recordset[0].password;

            // ตรวจสอบรหัสผ่าน
            const isMatch = await bcrypt.compare(password, hashedPassword);
            if (isMatch) {

                res.json({ 
                    success: true, 
                    username: username, 
                    branch_code: result.recordset[0].branch_code,  // ✅ ส่ง branch_code กลับไป
                    branch_name: result.recordset[0].branch_name,
                    user_rights: result.recordset[0].user_rights, // ✅ เพิ่ม user_rights 
                    redirect: '/home' 
                });
                
            } else {
                res.status(401).json({ success: false, message: 'Invalid password' });
            }
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get('/api/get-stock-status2', async (req, res) => {
  try {
      const pool = await getPool("TestOng");

      // ดึง `DI_DATE` ล่าสุดก่อน
      const latestDateQuery = await pool.request().query(`
          SELECT MAX(DI_DATE) AS LatestDate FROM stock_summary
      `);
      const latestDate = latestDateQuery.recordset[0].LatestDate;

      if (!latestDate) {
          return res.json({ success: false, message: "ไม่พบข้อมูลวันที่ล่าสุด" });
      }

      // ดึงเฉพาะข้อมูลที่ `DI_DATE` เท่ากับวันที่ล่าสุด พร้อมทั้งดึง ar_name และ di_date
      const result = await pool.request()
          .input("LatestDate", sql.Date, latestDate)
          .query(`SELECT TOP 50
              DI_REF, 
              AR_NAME, 
              DI_DATE,
              SKU_NAME, 
              LATEST_PREPARE_QTY,
              UPDATE_DATE, 
              (CASE 
                  WHEN STATUS = 1 THEN 'รอจัด'
                  WHEN STATUS = 3 THEN 'จัดบางส่วน'
                  WHEN STATUS = 4 THEN 'จัดเสร็จ'
                  ELSE NULL
              END) AS STATUS_NAME
          FROM Stock_Summary
          WHERE DI_DATE = @LatestDate
          AND STATUS IN (1, 3, 4)
          ORDER BY UPDATE_DATE DESC;
          `);

      // console.log("ข้อมูลจาก Stock_Summary:", result.recordset);
      res.json({ success: true, data: result.recordset });
  } catch (error) {
      console.error("Error fetching stock status:", error);
      res.status(500).json({ success: false, message: "Database error" });
  }
});

// ดึงสาขามาจาก branch
app.get('/api/branches', async (req, res) => {
    try {
        const pool = await getPool("TestOng"); // เชื่อมต่อฐานข้อมูล
        const result = await pool.request().query("SELECT branch_code, branch_name FROM branches");

        if (!result.recordset || result.recordset.length === 0) {
            return res.json({ success: false, message: "No branches found" });
        }

        // console.log("Branches data:", result.recordset); // ✅ Debug log ดูข้อมูลที่ถูกส่งไป
        res.json({ success: true, data: result.recordset });

    } catch (error) {
        console.error("Error fetching branches:", error);
        res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
});


app.get('/api/product-categories', async (req, res) => {
    try {
        const pool = await getPool("HS54"); // ✅ เชื่อมต่อ HS54

        // ✅ ดึงข้อมูลจากฐานข้อมูล โดยแยกตามหมวดหมู่ของ ICCAT_CODE
        const result = await pool.request().query(`
            SELECT DISTINCT SUBSTRING(ICCAT_CODE, 1, 1) AS CategoryCode
            FROM ICCAT
            WHERE ICCAT_CODE LIKE 'A%' 
               OR ICCAT_CODE LIKE 'K%'
               OR ICCAT_CODE LIKE 'R%'
            ORDER BY CategoryCode;
        `);

        // ✅ แมปค่าให้ตรงกับหมวดหมู่ที่ต้องการ
        const categoryMap = {
            'A': 'เหล็ก',
            'K': 'โครงสร้าง', 
            'R': 'เซรามิค',
            };

        // ✅ จัดรูปแบบ JSON ที่จะส่งกลับไปยัง Frontend
        const categories = result.recordset.map(row => ({
            categoryCode: row.CategoryCode,
            categoryName: categoryMap[row.CategoryCode] || "อื่นๆ"
        }));

        res.json({ success: true, data: categories });

    } catch (error) {
        console.error("❌ Error fetching product categories from HS54:", error);
        res.status(500).json({ success: false, message: "Database error" });
    }
});

// app.post('/api/search-preparation', async (req, res) => {
//     try {
//       const { category, status, documentID, branch, start, length, draw } = req.body;
//       // console.log("ค่าที่ได้รับจาก Frontend:", { category, status, documentID, branch, start, length, draw });
  
//       const pool = await getPool("TestOng");
//       const request = pool.request();
//       request.input("Branch", sql.VarChar, branch);
//       request.input("start", sql.Int, start);
//       request.input("length", sql.Int, length);
  
//       // แปลงค่าสถานะ: ถ้าไม่ใช่ "all" ให้แปลงเป็นตัวเลข
//       let statusValue = null;
//       if (status && status !== "all") {
//         statusValue = parseInt(status, 10);
//         request.input("Status", sql.Int, statusValue);
//         // console.log("ค่าของ @Status ที่ใช้ใน SQL:", statusValue);
//       }
  
//       // ตรวจสอบ filter category
//       if (category && category !== "all") {
//         // เปลี่ยนเงื่อนไขให้ใช้ SUBSTRING เพื่อให้เปรียบเทียบเฉพาะตัวอักษรแรก
//         request.input("Category", sql.NVarChar, category);
//       }
//       // ตรวจสอบ documentID
//       if (documentID) {
//         request.input("documentID", sql.VarChar, documentID);
//       }
  
//       // --- คำนวณจำนวน record ทั้งหมด (summary) ---
//       let countQuery = `
//         SELECT COUNT(*) AS totalRecords
//         FROM (
//           SELECT DI_REF
//           FROM Stock_Summary WITH (NOLOCK)
//           WHERE BRANCH_CODE = @Branch
//             AND DATEPART(YEAR, DI_DATE) = 2024 
//             AND DATEPART(MONTH, DI_DATE) = 10
//       `;
//       if (documentID) {
//         countQuery += ` AND DI_REF = @documentID`;
//       }
//       if (category && category !== "all") {
//         // ใช้ SUBSTRING เพื่อเปรียบเทียบเฉพาะตัวอักษรแรก
//         countQuery += ` AND SUBSTRING(ICCAT_CODE, 1, 1) = @Category`;
//       }
//       if (statusValue !== null) {
//         countQuery += ` AND STATUS = @Status`;
//       }
//       countQuery += `
//           GROUP BY DI_REF
//         ) AS SummaryCount;
//       `;
//       // console.log("Count Query:", countQuery);
//       const countResult = await request.query(countQuery);
//       const totalRecords = countResult.recordset[0] ? countResult.recordset[0].totalRecords : 0;
//       // console.log("จำนวนข้อมูลทั้งหมด:", totalRecords);
  
//       // --- คำสั่ง query แบบ summary ---
//       let summaryQuery = `
//           SELECT 
//             DI_REF AS DocumentID,
//             CONVERT(VARCHAR, MIN(DI_DATE), 105) AS DI_DATE,
//             MIN(AR_NAME) AS AR_NAME
//           FROM Stock_Summary
//           WHERE BRANCH_CODE = @Branch
//             AND DATEPART(YEAR, DI_DATE) = 2024 
//             AND DATEPART(MONTH, DI_DATE) = 10
//       `;
//       if (documentID) {
//         summaryQuery += ` AND DI_REF = @documentID`;
//       }
//       if (category && category !== "all") {
//         // เปลี่ยนเงื่อนไขให้ใช้ SUBSTRING เพื่อเปรียบเทียบเฉพาะตัวอักษรแรก
//         summaryQuery += ` AND SUBSTRING(ICCAT_CODE, 1, 1) = @Category`;
//       }
//       if (statusValue !== null) {
//         summaryQuery += ` AND STATUS = @Status`;
//       }
//       summaryQuery += `
//           GROUP BY DI_REF
//           `;
//       // console.log("Summary Query ที่ใช้:", summaryQuery);
//       const result = await request.query(summaryQuery);
  
//       res.json({
//         success: true,
//         draw: draw || 0,
//         recordsTotal: totalRecords,
//         recordsFiltered: totalRecords,
//         data: result.recordset
//       });
//     } catch (error) {
//       console.error("❌ Database Error:", error);
//       res.status(500).json({ success: false, message: "Database error", error: error.message });
//     }
// });


// app.post('/api/search-preparation', async (req, res) => {
//   try {
//     const { category, status, documentID, branch, start, length, draw } = req.body;
//     // คำนวณค่า row boundaries ในฝั่ง application
//     const rowStart = parseInt(start, 10) + 1; // แถวเริ่มต้น (1-indexed)
//     const rowEnd = parseInt(start, 10) + parseInt(length, 10); // แถวสุดท้าย
//     // console.log({ rowStart, rowEnd });
  
//     const pool = await getPool("TestOng");
//     const request = pool.request();
//     request.input("Branch", sql.VarChar, branch);
//     request.input("rowStart", sql.Int, rowStart);
//     request.input("rowEnd", sql.Int, rowEnd);
  
//     // แปลงค่าสถานะ: ถ้าไม่ใช่ "all" ให้แปลงเป็นตัวเลข
//     let statusValue = null;
//     if (status && status !== "all") {
//       statusValue = parseInt(status, 10);
//       request.input("Status", sql.Int, statusValue);
//     }
  
//     // ตรวจสอบ filter category
//     if (category && category !== "all") {
//       request.input("Category", sql.NVarChar, category);
//     }
//     // ตรวจสอบ documentID
//     if (documentID) {
//       request.input("documentID", sql.VarChar, documentID);
//     }
  
//     // --- คำนวณจำนวน record ทั้งหมด (summary) ---
//     let countQuery = `
//       SELECT COUNT(*) AS totalRecords
//       FROM (
//         SELECT DI_REF
//         FROM Stock_Summary WITH (NOLOCK)
//         WHERE BRANCH_CODE = @Branch
//           AND DATEPART(YEAR, DI_DATE) = 2024 
//           AND DATEPART(MONTH, DI_DATE) = 10
//     `;
//     if (documentID) {
//       countQuery += ` AND DI_REF = @documentID`;
//     }
//     if (category && category !== "all") {
//       countQuery += ` AND SUBSTRING(ICCAT_CODE, 1, 1) = @Category`;
//     }
//     if (statusValue !== null) {
//       countQuery += ` AND STATUS = @Status`;
//     }
//     countQuery += `
//         GROUP BY DI_REF
//       ) AS SummaryCount;
//     `;
//     const countResult = await request.query(countQuery);
//     const totalRecords = countResult.recordset[0] ? countResult.recordset[0].totalRecords : 0;
  
//     // --- คำสั่ง query แบบแบ่งหน้าด้วย ROW_NUMBER() สำหรับ SQL Server 2008 R2 ---
//     let summaryQuery = `
//       WITH OrderedData AS (
//         SELECT 
//           DI_REF AS DocumentID,
//           CONVERT(VARCHAR, MIN(DI_DATE), 105) AS DI_DATE,
//           MIN(AR_NAME) AS AR_NAME,
//           ROW_NUMBER() OVER (ORDER BY DI_REF) AS RowNum
//         FROM Stock_Summary WITH (NOLOCK)
//         WHERE BRANCH_CODE = @Branch
//           AND DATEPART(YEAR, DI_DATE) = 2024 
//           AND DATEPART(MONTH, DI_DATE) = 10
//     `;
//     if (documentID) {
//       summaryQuery += ` AND DI_REF = @documentID`;
//     }
//     if (category && category !== "all") {
//       summaryQuery += ` AND SUBSTRING(ICCAT_CODE, 1, 1) = @Category`;
//     }
//     if (statusValue !== null) {
//       summaryQuery += ` AND STATUS = @Status`;
//     }
//     summaryQuery += `
//         GROUP BY DI_REF
//       )
//       SELECT *
//       FROM OrderedData
//       WHERE RowNum BETWEEN @rowStart AND @rowEnd
//       ORDER BY RowNum;
//     `;
//     const result = await request.query(summaryQuery);
  
//     res.json({
//       success: true,
//       draw: draw || 0,
//       recordsTotal: totalRecords,
//       recordsFiltered: totalRecords,
//       data: result.recordset
//     });
//   } catch (error) {
//     console.error("❌ Database Error:", error);
//     res.status(500).json({ success: false, message: "Database error", error: error.message });
//   }
// });
app.post('/api/search-preparation', async (req, res) => {
  try {
    const { category, status, documentID, branch, start, length, draw } = req.body;
    
    // คำนวณค่า row boundaries ในฝั่ง application
    const rowStart = parseInt(start, 10) + 1; // แถวเริ่มต้น (1-indexed)
    const rowEnd = parseInt(start, 10) + parseInt(length, 10); // แถวสุดท้าย

    const pool = await getPool("TestOng");
    const request = pool.request();
    request.input("Branch", sql.VarChar, branch);
    request.input("rowStart", sql.Int, rowStart);
    request.input("rowEnd", sql.Int, rowEnd);

    // แปลงค่าสถานะ: ถ้าไม่ใช่ "all" ให้แปลงเป็นตัวเลข
    let statusValue = null;
    if (status && status !== "all") {
      statusValue = parseInt(status, 10);
      request.input("Status", sql.Int, statusValue);
    }

    // ตรวจสอบ filter category
    if (category && category !== "all") {
      request.input("Category", sql.NVarChar, category);
    }
    // ตรวจสอบ documentID
    if (documentID) {
      request.input("documentID", sql.VarChar, documentID);
    }

    // --- คำนวณจำนวน record ทั้งหมด (summary) ---
    // --- คำนวณจำนวน record ทั้งหมด (summary) --- 
    let countQuery = `
    SELECT COUNT(*) AS totalRecords
    FROM (
      SELECT DI_REF
      FROM Stock_Summary WITH (NOLOCK)
      WHERE BRANCH_CODE = @Branch
        AND SKU_ICDEPT NOT IN (
          SELECT SKU_ICDEPT 
          FROM EXCEPT_CODE_LIST 
          WHERE BRANCH_CODE = @Branch
        )
        AND DATEPART(YEAR, DI_DATE) = 2024 
        AND DATEPART(MONTH, DI_DATE) = 10
    `;
    if (documentID) {
    countQuery += ` AND DI_REF = @documentID`;
    }
    if (category && category !== "all") {
    countQuery += ` AND SUBSTRING(ICCAT_CODE, 1, 1) = @Category`;
    } else {
    countQuery += ` AND LEFT(ICCAT_CODE, 1) IN ('A','K','R')`;
    }
    if (statusValue !== null) {
    countQuery += ` AND STATUS = @Status`;
    }
    countQuery += `
      GROUP BY DI_REF
    ) AS SummaryCount;
    `;

    const countResult = await request.query(countQuery);
    const totalRecords = countResult.recordset[0] ? countResult.recordset[0].totalRecords : 0;
    
    // --- Query หลักแบบแบ่งหน้า (ROW_NUMBER) ---
    // เพิ่ม CASE WHEN EXISTS เพื่อหาว่า DI_REF นี้ มีรายการ (SKU) ที่ ICCAT_CODE = A,K,R
    // และ STATUS = 1 หรือ 3 อย่างน้อย 1 รายการหรือไม่
    let summaryQuery = `
    WITH OrderedData AS (
      SELECT 
        DI_REF AS DocumentID,
        CONVERT(VARCHAR, MIN(DI_DATE), 105) AS DI_DATE,
        MIN(AR_NAME) AS AR_NAME,
        CASE 
          WHEN EXISTS (
            SELECT 1
            FROM Stock_Summary s2
            WHERE s2.DI_REF = Stock_Summary.DI_REF
              AND LEFT(s2.ICCAT_CODE, 1) IN ('A','K','R')
              AND s2.SKU_ICDEPT NOT IN (
                SELECT SKU_ICDEPT 
                FROM EXCEPT_CODE_LIST 
                WHERE BRANCH_CODE = @Branch
              )
              AND s2.STATUS IN (1, 3, 4, 5, 6)
          )
          THEN 1
          ELSE 0
        END AS canStart,
        MAX(UPDATE_DATE) AS UPDATE_DATE,
        ROW_NUMBER() OVER (ORDER BY MAX(UPDATE_DATE) ASC, DI_REF ASC) AS RowNum
      FROM Stock_Summary WITH (NOLOCK)
      WHERE BRANCH_CODE = @Branch
        AND SKU_ICDEPT NOT IN (
          SELECT SKU_ICDEPT 
          FROM EXCEPT_CODE_LIST 
          WHERE BRANCH_CODE = @Branch
        )
        AND DATEPART(YEAR, DI_DATE) = 2024 
        AND DATEPART(MONTH, DI_DATE) = 10
  `;
  
  if (documentID) {
    summaryQuery += ` AND DI_REF = @documentID`;
  }
  if (category !== "all") {
    summaryQuery += ` AND SUBSTRING(ICCAT_CODE, 1, 1) = @Category`;
  } else {
    summaryQuery += ` AND LEFT(ICCAT_CODE, 1) IN ('A','K','R')`;
  }
  if (statusValue !== null) {
    summaryQuery += ` AND STATUS = @Status`;
  }
  
  summaryQuery += `
      GROUP BY DI_REF
    )
    SELECT DocumentID, DI_DATE, AR_NAME, canStart, UPDATE_DATE, RowNum
    FROM OrderedData
    WHERE RowNum BETWEEN @rowStart AND @rowEnd
    ORDER BY RowNum;
  `;
  
    const result = await request.query(summaryQuery);

    res.json({
      success: true,
      draw: draw || 0,
      recordsTotal: totalRecords,
      recordsFiltered: totalRecords,
      data: result.recordset
    });
  } catch (error) {
    console.error("❌ Database Error:", error);
    res.status(500).json({ success: false, message: "Database error", error: error.message });
  }
});

// Global object สำหรับเก็บสถานะล็อกเอกสาร (สำหรับระบบที่รันบนเซิร์ฟเวอร์ตัวเดียว)
let recordLocks = {};
// API สำหรับอัปเดตสถานะ (รวม start-processing เข้าไปด้วย)
// เมื่อผู้ใช้กดปุ่ม "เริ่มจัด" ในหน้า prepdetail.html
app.post('/api/update-status', async (req, res) => {
  try {
    const { DI_REF, branch, category, username } = req.body;
    if (!DI_REF || !branch || !username) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // ตรวจสอบ global lock
    if (recordLocks[DI_REF] && recordLocks[DI_REF].username !== username) {
      return res.json({
        success: false,
        message: `เอกสารนี้กำลังถูกใช้งานโดย ${recordLocks[DI_REF].username}`
      });
    }

    // ตั้งหรืออัปเดต lock ให้เป็นของ current user
    recordLocks[DI_REF] = { username, timestamp: new Date() };

    const pool = await getPool("TestOng");
    const requestObj = pool.request();
    requestObj.input("DI_REF", sql.VarChar, DI_REF);
    requestObj.input("Branch", sql.VarChar, branch);
    requestObj.input("Username", sql.VarChar, username); // เพิ่ม username สำหรับ UPDATE_BY

    let selectQuery = `
      SELECT ID, STATUS, SKU_ICDEPT, ICCAT_CODE
      FROM stock_summary
      WHERE DI_REF = @DI_REF
        AND BRANCH_CODE = @Branch
    `;

    // เพิ่มเงื่อนไขสำหรับ category
    if (category && category !== "all") {
      requestObj.input("Category", sql.NVarChar, category);
      selectQuery += ` AND SUBSTRING(ICCAT_CODE, 1, 1) = @Category`;
    } else {
      selectQuery += ` AND LEFT(ICCAT_CODE, 1) IN ('A','K','R')`;
    }

    const selectResult = await requestObj.query(selectQuery);
    if (selectResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "No rows found with the given DI_REF and branch" });
    }

    let updatedCount = 0;
    let redirectFlag = false;
    const finalStatuses = ['4','6']; // สถานะสุดท้ายที่ไม่ควรเปลี่ยน

    // ดึงข้อมูล SKU_ICDEPT ที่อยู่ใน EXCEPT_CODE_LIST สำหรับ branch นี้
    let exceptList;
    if (branch === 'HS54') {
      const exceptResult = await pool.request()
        .input("BranchCode", sql.VarChar, branch)
        .query(`SELECT SKU_ICDEPT FROM EXCEPT_CODE_LIST WHERE BRANCH_CODE = @BranchCode`);
      exceptList = exceptResult.recordset.map(row => row.SKU_ICDEPT);
    }

    // Loop ตรวจสอบ record ทีละตัว
    for (const row of selectResult.recordset) {
      // เพิ่มการตรวจสอบใน loop เพื่อให้แน่ใจว่า record นี้อยู่ใน category ที่เลือก
      if (category && category !== "all" && row.ICCAT_CODE.charAt(0) !== category) {
        continue;
      } else if (category === "all" && !['A','K','R'].includes(row.ICCAT_CODE.charAt(0))) {
        continue;
      }

      const currentStatus = String(row.STATUS);

      // ถ้า record มี STATUS เป็น 4, 6 ให้ข้ามการอัปเดต
      if (finalStatuses.includes(currentStatus)) {
        redirectFlag = true; // ยังคงตั้ง redirectFlag ไว้เผื่อมี records อื่นที่ต้อง redirect
        continue;
      }

      // ตรวจสอบเงื่อนไขเพิ่มเติม: record ต้องไม่อยู่ใน exceptList
      if (!exceptList.includes(row.SKU_ICDEPT)) {
        // อัปเดต STATUS เป็น 2 ถ้าสถานะเดิมเป็น 3 หรือ 1
        if (currentStatus === '3' || currentStatus === '1' || currentStatus === '5') {
          const updateQuery = `
            UPDATE stock_summary
            SET STATUS = 2,
                UPDATE_DATE = GETDATE(),
                UPDATE_BY = @username
            WHERE ID = @ID
          `;
          await pool.request()
            .input("username", sql.VarChar, username)
            .input("ID", sql.Int, row.ID)
            .query(updateQuery);
          updatedCount++;
          redirectFlag = true;
        }
      }
    }

    if (redirectFlag) {
      return res.json({
          success: true,
          message: "Status updated (if applicable) and redirecting to prepdetail",
          updatedCount,
          redirect: "/prepdetail.html"
      });
    } else {
      return res.status(400).json({ success: false, message: "No rows updated" });
    }
  } catch (error) {
    console.error("Error in /api/update-status:", error);
    return res.status(500).json({
      success: false,
      message: "Database error",
      error: error.message
    });
  }
});
//API สำหรับอัปเดตสถานะ (เช่น เมื่อกด "เริ่มจัด")
// app.post('/api/update-status', async (req, res) => {
//   try {
//     const { DI_REF, branch, category,username} = req.body; 
//     if (!DI_REF || !branch) { 
//       return res.status(400).json({ success: false, message: "Missing required fields" });
//     }
      
//     const pool = await getPool("TestOng");

//     // ดึงข้อมูล record พร้อมกับ SKU_ICDEPT และ ICCAT_CODE
//     let selectQuery = `
//       SELECT ID, STATUS, SKU_ICDEPT, ICCAT_CODE
//       FROM stock_summary
//       WHERE DI_REF = @DI_REF
//         AND BRANCH_CODE = @Branch
//     `;

//     if (category && category !== "all") {
//       selectQuery += ` AND SUBSTRING(ICCAT_CODE, 1, 1) = @Category`;
//     }

//     const request = pool.request();
//     request.input("DI_REF", sql.VarChar, DI_REF);
//     request.input("Branch", sql.VarChar, branch);

//     if (category && category !== "all") {
//       request.input("Category", sql.NVarChar, category);
//     }

//     const selectResult = await request.query(selectQuery);

//     if (selectResult.recordset.length === 0) {
//       return res.status(404).json({ success: false, message: "No rows found with the given DI_REF and branch" });
//     }

    
//     // ดึงรายชื่อ SKU_ICDEPT ที่อยู่ในตาราง EXCEPT_CODE_LIST
//     const exceptQuery = `SELECT SKU_ICDEPT FROM EXCEPT_CODE_LIST`;
//     const exceptResult = await pool.request().query(exceptQuery);
//     const exceptList = exceptResult.recordset.map(r => r.SKU_ICDEPT);
    
//     let updatedCount = 0;
//     let redirectFlag = false;
    
//     for (const row of selectResult.recordset) {
//       const currentStatus = parseInt(row.STATUS, 10);
//       // ถ้า record มี STATUS = 4 อยู่แล้ว ไม่ต้อง update แต่ให้ส่ง redirect
//       if (currentStatus === 4) {
//         redirectFlag = true;
//         continue;
//       }
      
//       // ตรวจสอบเงื่อนไขสำหรับ record ที่จะ update
//       if (
//         !exceptList.includes(row.SKU_ICDEPT) &&
//         ['A', 'K', 'R'].includes(row.ICCAT_CODE.charAt(0))
//       ) {
//         // update status เป็น 2 เฉพาะ record ที่ยังไม่ใช่ 4
//         const updateQuery = `
//           UPDATE stock_summary
//           SET STATUS = 2, 
//               UPDATE_DATE = GETDATE(),
//               UPDATE_BY = '${username}'
//           WHERE ID = @ID
//         `;
//         await pool.request()
//           .input("ID", sql.Int, row.ID)
//           .query(updateQuery);
//         updatedCount++;
//         redirectFlag = true;
//       }
//       // Record ที่ไม่ตรงเงื่อนไขจะคง STATUS ไว้ (ไม่อัปเดท)
//     }
    
//     if (redirectFlag) {
//       return res.json({ 
//          success: true, 
//          message: "Status updated (if applicable) and redirecting to prepdetail", 
//          updatedCount,
//          redirect: "/prepdetail.html"
//       });
//     } else {
//       return res.status(400).json({ success: false, message: "No rows updated" });
//     }
//   } catch (error) {
//     console.error("Error updating status:", error);
//     return res.status(500).json({ 
//       success: false, 
//       message: "Database error", 
//       error: error.message 
//     });
//   }
// });

  
  
  

  app.post('/api/get-preparation-details', async (req, res) => {
    try {
      const { DI_REF, Category } = req.body;
      if (!DI_REF) {
        return res.status(400).json({ success: false, message: 'DI_REF is required' });
      }
      const pool = await getPool("TestOng");
      // Query ที่ 1: ดึงข้อมูลตาม DI_REF และ Category
      let query1 = `
          SELECT 
          DI_REF, 
          DI_DATE, 
          SKU_CODE, 
          SKU_NAME,
          ICCAT_CODE,
          ICCAT_NAME AS ProductCategoryName, 
          TOTAL_SKU_QTY AS SoldQty, 
          TOTAL_CR_QTY AS ReceivedQty, 
          PREPARE_REMAINING AS PendingQty, 
          LATEST_PREPARE_QTY, 
          STATUS,
          AR_NAME,
          SKU_ICDEPT
        FROM Stock_Summary
		    Where SKU_ICDEPT not in(select SKU_ICDEPT from EXCEPT_CODE_LIST where BRANCH_CODE='HS54') 
        AND DI_REF = @DI_REF
      `;
        if (Category != 'all') {
          // หาก Category เป็น 'K', 'R' หรือ 'A' ให้เพิ่มเงื่อนไขเฉพาะ
          if (Category === 'K') {
            query1 += `
              AND SUBSTRING(ICCAT_CODE, 1, 1) = 'K'
            `;
          } else if (Category === 'R') {
            query1 += `
              AND SUBSTRING(ICCAT_CODE, 1, 1) = 'R'
            `;
          } else if (Category === 'A') {
            query1 += `
              AND SUBSTRING(ICCAT_CODE, 1, 1) = 'A'
            `;
          } 
        }else {
          // กรณีอื่นๆ ใช้กรองตามตัวอักษรตัวแรกเท่านั้น
          
           query1 += ` AND SUBSTRING(ICCAT_CODE, 1, 1) in ('A','K','R') `;
        }
        const requestObj1 = pool.request().input("DI_REF", sql.VarChar, DI_REF);
        const result1 = await requestObj1.query(query1);
        const records1 = result1.recordset;
      //  if (Category && Category !== "all" && Category !== 'K' && Category !== 'R' && Category !== 'A') {
      //    requestObj.input("Category", sql.NVarChar, Category);
      //  }
      // Query ที่ 2: ดึงข้อมูลตาม DI_REF และ ICCAT_CODE = 'รด1' (ไม่สนใจ Category)
        const query2 = `
        SELECT
          DI_REF,
          DI_DATE,
          SKU_CODE,
          SKU_NAME,
          ICCAT_CODE,
          ICCAT_NAME AS ProductCategoryName,
          TOTAL_SKU_QTY AS SoldQty,
          TOTAL_CR_QTY AS ReceivedQty,
          PREPARE_REMAINING AS PendingQty,
          LATEST_PREPARE_QTY,
          STATUS,
          AR_NAME,
          SKU_ICDEPT
        FROM Stock_Summary
        Where SKU_ICDEPT not in(select SKU_ICDEPT from EXCEPT_CODE_LIST where BRANCH_CODE='HS54')
        AND DI_REF = @DI_REF
        AND ICCAT_CODE = 'รด1'
      `;
        const requestObj2 = pool.request().input("DI_REF", sql.VarChar, DI_REF);
        const result2 = await requestObj2.query(query2);
        const records2 = result2.recordset; 
        // รวมผลลัพธ์จากทั้งสอง Query เข้าด้วยกัน
        const combinedResults = [...records1, ...records2]; 
            
        if (combinedResults.length > 0) {
          res.json({ success: true, data: combinedResults });
        } else {
          res.json({ success: false, message: 'No data found for this DI_REF' });
        }
      } catch (error) {
        console.error("Error in /api/get-preparation-details:", error);
        res.status(500).json({ success: false, message: "Database error", error: error.message });
      }
      });

  
app.post('/api/get-stock-details', async (req, res) => {
  try {
    const { DI_REF } = req.body;
    if (!DI_REF) {
      return res.status(400).json({ success: false, message: 'Document ID is required' });
    }
    const pool = await getPool("TestOng");
    let query = `
      SELECT 
        ID,
        DI_REF, 
        DI_DATE,
        LATEST_ROUND AS ROUND,
        SKU_CODE, 
        SKU_NAME,
        ICCAT_CODE,
        ICCAT_NAME, 
        TOTAL_SKU_QTY, 
        TOTAL_CR_QTY, 
        REMAINING_QTY, 
        STATUS,
        AR_NAME
      FROM Stock_Summary
      WHERE DI_REF = @DI_REF
    `;

    const requestObj = pool.request()
      .input("DI_REF", sql.VarChar, DI_REF);
  
    const result = await requestObj.query(query);
    if (result.recordset.length > 0) {
      res.json({ success: true, data: result.recordset });
    } else {
      res.json({ success: false, message: 'No data found for this DI_REF and Category' });
    }
  } catch (error) {
    console.error("Error in /api/get-stock-details:", error);
    res.status(500).json({ success: false, message: "Database error", error: error.message });
  }
});


app.get('/api/status-list', async (req, res) => {
    try {
        const pool = await getPool("TestOng");
        const result = await pool.request().query(`
            SELECT status FROM stock_status ORDER BY ID
        `);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("Error fetching status list:", error);
        res.status(500).json({ success: false, message: "Database error" });
    }
});

// app.post('/api/save-preparation', async (req, res) => {
//   // ถ้า req.body เป็นอาร์เรย์ ให้ใช้เป็น updates array ถ้าไม่ใช่ ให้แปลงเป็น array เดียว
//   const updates = Array.isArray(req.body) ? req.body : [req.body];

//   // ตรวจสอบข้อมูลแต่ละ record
//   for (const update of updates) {
//     if (!update.DI_REF || !update.ProductCode || update.PreparedQty === undefined || !update.branch) {
//       return res.status(400).json({ success: false, message: "Missing required fields (DI_REF, ProductCode, PreparedQty, branch) in one or more records" });
//     }
//   }

//   const lockKey = updates[0].DI_REF;
//   let transaction;

//   try {
//     const pool = await getPool("TestOng");
//     transaction = new sql.Transaction(pool);
//     await transaction.begin();

//     // Loop ผ่านแต่ละ update ในอาร์เรย์
//     for (const update of updates) {
//       const { DI_REF, ProductCode, PreparedQty, Username, branch } = update;
//       const PreparedBy = Username || "ระบบ";

//       // 1. ดึงข้อมูลที่จำเป็นทั้งหมดจาก stock_summary ในครั้งเดียว
//       const stockRequest = new sql.Request(transaction);
//       stockRequest.timeout = 60000;
//       stockRequest.input('DI_REF', sql.NVarChar, DI_REF);
//       stockRequest.input('SKU_CODE', sql.NVarChar, ProductCode);
//       stockRequest.input('BRANCH_CODE', sql.VarChar, branch);
//       const stockQuery = await stockRequest.query(`
//         SELECT 
//           STATUS, 
//           PREPARE_REMAINING, 
//           LATEST_PREPARE_QTY, 
//           TOTAL_SKU_QTY, 
//           ICCAT_CODE, 
//           ICCAT_NAME 
//         FROM stock_summary 
//         WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE AND BRANCH_CODE = @BRANCH_CODE
//       `);

//       if (stockQuery.recordset.length === 0) {
//         throw new Error(`❌ ไม่พบข้อมูลใน stock_summary สำหรับ DI_REF: ${DI_REF}, ProductCode: ${ProductCode}, branch: ${branch}`);
//       }

//       const stockData = stockQuery.recordset[0];
//       const { 
//         STATUS: currentStatus, 
//         PREPARE_REMAINING: prepareRemainingBefore, 
//         LATEST_PREPARE_QTY: previousPrepared, 
//         TOTAL_SKU_QTY: total, 
//         ICCAT_CODE, 
//         ICCAT_NAME 
//       } = stockData;

//       // ตรวจสอบสถานะ
//       if (currentStatus == 4 || currentStatus == 6) {
//         return res.status(400).json({
//           success: false,
//           message: `ไม่สามารถบันทึกข้อมูลได้ เนื่องจากสถานะเป็น 'จัดเตรียมเรียบร้อย' แล้ว! (DI_REF: ${DI_REF}, ProductCode: ${ProductCode})`
//         });
//       }

//       const remainingBeforeCalculation = Number(total) - Number(previousPrepared);
//       const newTotalPrepared = Number(previousPrepared) + Number(PreparedQty);
//       const remain = Number(total) - newTotalPrepared;
//       const newStatus = (Number(PreparedQty) <= remainingBeforeCalculation) ? "3" : "4";

//       // 2. อัปเดต stock_summary
//       const updateRequest = new sql.Request(transaction);
//       updateRequest.timeout = 60000;
//       updateRequest.input('DI_REF', sql.NVarChar, DI_REF);
//       updateRequest.input('SKU_CODE', sql.NVarChar, ProductCode);
//       updateRequest.input('LATEST_PREPARE_QTY', sql.Decimal(18, 2), newTotalPrepared);
//       updateRequest.input('PREPARE_REMAINING', sql.Decimal(18, 2), remain);
//       updateRequest.input('UPDATE_BY', sql.NVarChar, PreparedBy);
//       updateRequest.input('STATUS', sql.NVarChar, newStatus);
//       updateRequest.input('BRANCH_CODE', sql.VarChar, branch);
//       const resultUpdate = await updateRequest.query(`
//         UPDATE stock_summary
//         SET
//           LATEST_PREPARE_QTY = @LATEST_PREPARE_QTY,
//           PREPARE_REMAINING = @PREPARE_REMAINING,
//           STATUS = @STATUS,
//           UPDATE_DATE = GETDATE(),
//           UPDATE_BY = @UPDATE_BY
//         WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE AND BRANCH_CODE = @BRANCH_CODE;
//         SELECT @@ROWCOUNT AS affectedRows;
//       `);

//       if (!resultUpdate.recordset || resultUpdate.recordset.length === 0 || resultUpdate.recordset[0].affectedRows === 0) {
//         throw new Error(`❌ ไม่สามารถอัปเดต stock_summary ได้ โปรดตรวจสอบ DI_REF: ${DI_REF}, SKU_CODE: ${ProductCode}, และ BRANCH_CODE: ${branch}`);
//       }
//       console.log(`Stock summary updated successfully for DI_REF: ${DI_REF}, ProductCode: ${ProductCode}, branch: ${branch} with status =`, newStatus);

//       // 3. บันทึกข้อมูลลง preparationRecords
//       const insertRequest = new sql.Request(transaction);
//       insertRequest.timeout = 60000;
//       insertRequest.input('DI_REF', sql.NVarChar, DI_REF);
//       insertRequest.input('SKU_CODE', sql.NVarChar, ProductCode);
//       insertRequest.input('ICCAT_CODE', sql.NVarChar, ICCAT_CODE);
//       insertRequest.input('ICCAT_NAME', sql.NVarChar, ICCAT_NAME);
//       insertRequest.input('PREPARE_QTY', sql.Decimal(18, 2), PreparedQty);
//       insertRequest.input('PreparedBy', sql.NVarChar, PreparedBy);
//       insertRequest.input('Timestamp', sql.DateTime, new Date());
//       insertRequest.input('Status', sql.NVarChar, newStatus);
//       await insertRequest.query(`
//         INSERT INTO preparationRecords
//         (DI_REF, SKU_CODE, ICCAT_CODE, ICCAT_NAME, PREPARE_QTY, PreparedBy, Timestamp, Status)
//         VALUES (@DI_REF, @SKU_CODE, @ICCAT_CODE, @ICCAT_NAME, @PREPARE_QTY, @PreparedBy, @Timestamp, @Status)
//       `);
//     }

//     await transaction.commit();
//     // ปลดล็อคเอกสารด้วย lockKey (ซึ่งเก็บ DI_REF จาก update ตัวแรก)
//     delete recordLocks[lockKey];
//     res.json({ success: true, message: "Preparation saved successfully!" });

//   } catch (error) {
//     console.error("❌ Error saving preparation:", error);
//     if (transaction) {
//       await transaction.rollback();
//     }
//     res.status(500).json({ success: false, message: "Database error", error: error.message });
//   }
// });  
app.post('/api/save-preparation', async (req, res) => {
  // ถ้า req.body เป็นอาร์เรย์ ให้ใช้เป็น updates array ถ้าไม่ใช่ ให้แปลงเป็น array เดียว
  const updates = Array.isArray(req.body) ? req.body : [req.body];

  // ตรวจสอบข้อมูลแต่ละ record
  for (const update of updates) {
      if (!update.DI_REF || !update.ProductCode || update.PreparedQty === undefined || !update.branch) {
          return res.status(400).json({ success: false, message: "Missing required fields (DI_REF, ProductCode, PreparedQty, branch) in one or more records" });
      }
  }

  const lockKey = updates[0].DI_REF;
  let transaction;
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
      try {
          const pool = await getPool("TestOng");
          transaction = new sql.Transaction(pool);
          await transaction.begin();

          for (const update of updates) {
              const { DI_REF, ProductCode, PreparedQty, Username, branch } = update;
              const PreparedBy = Username || "ระบบ";
              const preparedQtyNumber = Number(PreparedQty);

              // ตรวจสอบว่า PreparedQty เป็น 0 หรือค่าว่างหรือไม่
              if (preparedQtyNumber === 0 || PreparedQty === "") {
                  // ถ้า PreparedQty เป็น 0 หรือค่าว่าง ให้อัปเดต STATUS เป็น 1 และข้ามการเตรียมสินค้า
                  const updateStatusRequest = new sql.Request(transaction);
                  updateStatusRequest.timeout = 60000;
                  updateStatusRequest.input('DI_REF', sql.NVarChar, DI_REF);
                  updateStatusRequest.input('SKU_CODE', sql.NVarChar, ProductCode);
                  updateStatusRequest.input('BRANCH_CODE', sql.VarChar, branch);
                  updateStatusRequest.input('STATUS', sql.NVarChar, '1'); // Set status to 1
                  updateStatusRequest.input('UPDATE_BY', sql.NVarChar, PreparedBy);
                  await updateStatusRequest.query(`
                      UPDATE stock_summary
                      SET
                          STATUS = @STATUS,
                          UPDATE_DATE = GETDATE(),
                          UPDATE_BY = @UPDATE_BY
                      WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE AND BRANCH_CODE = @BRANCH_CODE;
                  `);
                  console.log(`Stock summary status updated to 1 for DI_REF: ${DI_REF}, ProductCode: ${ProductCode}, branch: ${branch}`);
                  continue; // ข้ามไปยัง update record ถัดไป
              }

              // ถ้า PreparedQty ไม่เป็น 0 หรือค่าว่าง ให้ทำ logic การเตรียมสินค้าตามเดิม
              // 1. ดึงข้อมูลที่จำเป็นทั้งหมดจาก stock_summary ในครั้งเดียว
              const stockRequest = new sql.Request(transaction);
              stockRequest.timeout = 60000;
              stockRequest.input('DI_REF', sql.NVarChar, DI_REF);
              stockRequest.input('SKU_CODE', sql.NVarChar, ProductCode);
              stockRequest.input('BRANCH_CODE', sql.VarChar, branch);
              const stockQuery = await stockRequest.query(`
                  SELECT
                      STATUS,
                      PREPARE_REMAINING,
                      LATEST_PREPARE_QTY,
                      TOTAL_SKU_QTY,
                      ICCAT_CODE,
                      ICCAT_NAME,
                      DI_DATE
                  FROM stock_summary
                  WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE AND BRANCH_CODE = @BRANCH_CODE
              `);

              if (stockQuery.recordset.length === 0) {
                  throw new Error(`❌ ไม่พบข้อมูลใน stock_summary สำหรับ DI_REF: ${DI_REF}, ProductCode: ${ProductCode}, branch: ${branch}`);
              }

              const stockData = stockQuery.recordset[0];
              const {
                  STATUS: currentStatus,
                  PREPARE_REMAINING: previousPrepared,
                  LATEST_PREPARE_QTY: previousPreparedQty,
                  TOTAL_SKU_QTY: total,
                  ICCAT_CODE,
                  ICCAT_NAME,
                  DI_DATE
              } = stockData;

              // ตรวจสอบสถานะ
              if (currentStatus == 4 || currentStatus == 6) {
                  return res.status(400).json({
                      success: false,
                      message: `จัดเตรียมเรียบร้อยแล้ว! (DI_REF: ${DI_REF})`
                  });
              }

              const remainingBeforeCalculation = Number(total) - Number(previousPreparedQty);
              const newTotalPrepared = Number(previousPreparedQty) + preparedQtyNumber;

              // ตรวจสอบว่าจำนวนที่จัดเตรียมเกินจำนวนที่เหลืออยู่หรือไม่
              if (preparedQtyNumber > remainingBeforeCalculation) {
                  return res.status(400).json({
                      success: false,
                      message: `ไม่สามารถบันทึกข้อมูลได้ เนื่องจากจำนวนที่จัดเตรียม (${preparedQtyNumber}) มากกว่าจำนวนที่เหลืออยู่ (${remainingBeforeCalculation})`
                  });
              }

              const remain = Number(total) - newTotalPrepared;
              let newStatus = "3"; // ตั้งค่าเริ่มต้นเป็น "กำลังจัดเตรียม"

              if (remain === 0) {
                  newStatus = "4"; // ถ้า PREPARE_REMAINING เป็น 0 ให้เปลี่ยนสถานะเป็น "จัดเตรียมเรียบร้อย"
              }

              // 2. อัปเดต stock_summary
              const updateRequest = new sql.Request(transaction);
              updateRequest.timeout = 60000;
              updateRequest.input('DI_REF', sql.NVarChar, DI_REF);
              updateRequest.input('SKU_CODE', sql.NVarChar, ProductCode);
              updateRequest.input('LATEST_PREPARE_QTY', sql.Decimal(18, 2), newTotalPrepared);
              updateRequest.input('PREPARE_REMAINING', sql.Decimal(18, 2), remain);
              updateRequest.input('UPDATE_BY', sql.NVarChar, PreparedBy);
              updateRequest.input('STATUS', sql.NVarChar, newStatus);
              updateRequest.input('BRANCH_CODE', sql.VarChar, branch);
              const resultUpdate = await updateRequest.query(`
                  UPDATE stock_summary
                  SET
                      LATEST_PREPARE_QTY = @LATEST_PREPARE_QTY,
                      PREPARE_REMAINING = @PREPARE_REMAINING,
                      STATUS = @STATUS,
                      UPDATE_DATE = GETDATE(),
                      UPDATE_BY = @UPDATE_BY
                  WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE AND BRANCH_CODE = @BRANCH_CODE;
                  SELECT @@ROWCOUNT AS affectedRows;
              `);

              if (!resultUpdate.recordset || resultUpdate.recordset.length === 0 || resultUpdate.recordset[0].affectedRows === 0) {
                  throw new Error(`❌ ไม่สามารถอัปเดต stock_summary ได้ โปรดตรวจสอบ DI_REF: ${DI_REF}, SKU_CODE: ${ProductCode}, และ BRANCH_CODE: ${branch}`);
              }
              console.log(`Stock summary updated successfully for DI_REF: ${DI_REF}, ProductCode: ${ProductCode}, branch: ${branch} with status =`, newStatus);
              // ******** ส่วนที่เพิ่มเข้ามา: ตรวจสอบก่อน Insert ********
              const checkExistRequest = new sql.Request(transaction);
              checkExistRequest.timeout = 60000;
              checkExistRequest.input('DI_REF', sql.NVarChar, DI_REF);
              checkExistRequest.input('SKU_CODE', sql.NVarChar, ProductCode);
              // ใช้เงื่อนไขที่ระบุการกระทำครั้งนี้ให้ชัดเจนที่สุด
              checkExistRequest.input('PREPARE_QTY', sql.Decimal(18, 2), preparedQtyNumber); // จำนวนที่เตรียมครั้งนี้
              checkExistRequest.input('PreparedBy', sql.NVarChar, PreparedBy); // User ที่เตรียมครั้งนี้
              // อาจจะเพิ่มเงื่อนไข Timestamp ถ้าต้องการให้แคบลงมากๆ แต่ต้องระวังเรื่องความเร็ว retry
              // checkExistRequest.input('TimestampCheck', sql.DateTime, new Date(Date.now() - 5 * 60 * 1000)); // ตัวอย่าง เช็ค 5 นาทีล่าสุด
              const checkResult = await checkExistRequest.query(`
                  SELECT COUNT(*) AS RecordCount
                  FROM preparationRecords
                  WHERE DI_REF = @DI_REF
                    AND SKU_CODE = @SKU_CODE
                    AND PREPARE_QTY = @PREPARE_QTY
                    AND PreparedBy = @PreparedBy;
                    
              `);

              const recordExists = checkResult.recordset[0].RecordCount > 0;

              if (!recordExists) {
              // 3. บันทึกข้อมูลลง preparationRecords
              const insertRequest = new sql.Request(transaction);
              insertRequest.timeout = 60000;
              insertRequest.input('DI_REF', sql.NVarChar, DI_REF);
              insertRequest.input('SKU_CODE', sql.NVarChar, ProductCode);
              insertRequest.input('ICCAT_CODE', sql.NVarChar, ICCAT_CODE);
              insertRequest.input('ICCAT_NAME', sql.NVarChar, ICCAT_NAME);
              insertRequest.input('PREPARE_QTY', sql.Decimal(18, 2), preparedQtyNumber);
              insertRequest.input('PreparedBy', sql.NVarChar, PreparedBy);
              insertRequest.input('Timestamp', sql.DateTime, new Date());
              insertRequest.input('Status', sql.NVarChar, newStatus);
              insertRequest.input('DI_DATE', sql.DateTime, DI_DATE);
              await insertRequest.query(`
                  INSERT INTO preparationRecords
                  (DI_REF, DI_DATE, SKU_CODE, ICCAT_CODE, ICCAT_NAME, PREPARE_QTY, PreparedBy, Timestamp, Status)
                  VALUES (@DI_REF, @DI_DATE, @SKU_CODE, @ICCAT_CODE, @ICCAT_NAME, @PREPARE_QTY, @PreparedBy, @Timestamp, @Status)
              `);
              console.log(`Preparation record inserted for DI_REF: ${DI_REF}, SKU_CODE: ${ProductCode}`);
            } else {
                 console.log(`Skipping insert for DI_REF: ${DI_REF}, SKU_CODE: ${ProductCode} - Record likely exists.`);
                 // ไม่ต้องทำอะไร ปล่อยให้ Transaction ดำเนินต่อไป (ถือว่าการ Insert นี้สำเร็จไปแล้วในทางปฏิบัติ)
            }
            // ******** จบส่วนตรวจสอบก่อน Insert ********

        } // จบ for loop updates

          await transaction.commit();
          // delete recordLocks[lockKey];
          return res.json({ success: true, message: "Preparation saved successfully!" });

      } catch (error) {
          console.error("❌ Error saving preparation (attempt " + (retryCount + 1) + "):", error);
          if (transaction && transaction.active) {
              await transaction.rollback();
          }// จบ while loop retry

          if (error.code === 'EREQUEST' && error.number === 1205) {
              // 1205 คือรหัส error สำหรับ deadlock ใน SQL Server
              retryCount++;
              console.log("🔄 Deadlock detected, retrying in 1 second...");
              await new Promise(resolve => setTimeout(resolve, 1000)); // หน่วงเวลา 1 วินาที
              transaction = null; // Reset transaction สำหรับการ retry ครั้งถัดไป
          } else {
              // เป็น error อื่นที่ไม่ใช่ deadlock ให้ส่ง response กลับไปเลย
              if (!res.headersSent) {
                  res.status(500).json({ success: false, message: "Database error", error: error.message });
              }
              return; // ออกจาก loop และ function
          }
      }
  }

  // หาก retry ครบจำนวนครั้งแล้วยังไม่สำเร็จ
  if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Failed to save preparation after multiple retries due to deadlocks" });
  }
});

app.post('/searchCheckQTY', async (req, res) => {
    const { reference } = req.body;

    if (!reference) {
        return res.status(400).json({ success: false, message: 'Reference is required' });
    }
    
    try {
        // ✅ เลือกฐานข้อมูลตาม branch_code
        const pool = await getPool("TestOng");

        // เช็คข้อมูลจาก QUERY1
        const query1Result = await pool.request()
            .input('DI_REF', sql.VarChar, reference)
            .query(` SELECT distinct
              SS.DI_REF,
              CONVERT(VARCHAR, SS.DI_DATE, 105) AS DI_DATE,
              SS.AR_NAME
              FROM Stock_Summary SS
                LEFT JOIN stock_status SST
                  ON SS.STATUS = SST.ID
              WHERE SS.DI_REF = @DI_REF;
            `);
            //อย่าพึ่งลบนะ
            // .query(`
            //     SELECT 
            //         CONVERT(INT, SS.ID) AS IDENT,
            //         SS.DI_REF,
            //         CONVERT(VARCHAR, SS.DI_DATE, 105) AS DI_DATE,
            //         CONVERT(INT, SS.LATEST_ROUND) AS LATEST_ROUND,
            //         SS.AR_NAME, 
            //         SS.SKU_CODE, 
            //         SS.SKU_WL, 
            //         SS.SKU_NAME,
            //         SS.ICCAT_KEY,
            //         SS.ICCAT_CODE,
            //         SS.ICCAT_NAME,
            //         SS.TOTAL_SKU_QTY AS QTY,
            //         SS.TOTAL_CR_QTY,
            //         SS.REMAINING_QTY AS REMAIN_QTY,
            //         CONVERT(INT, ISNULL(SS.LATEST_PREPARE_QTY, 0)) AS LATEST_PREPARE_QTY,
            //         SST.status AS STATUS
            //     FROM Stock_Summary SS WITH (NOLOCK)
            //     LEFT JOIN stock_status SST WITH (NOLOCK) 
            //         ON SS.STATUS = SST.ID
            //     WHERE SS.DI_REF = @DI_REF;

            // `);

        // ถ้ามีข้อมูลจาก QUERY1 ส่งข้อมูลกลับ
        if (query1Result.recordset.length > 0) {
            res.json({ success: true, data: query1Result.recordset });
        }else {
                  res.json({ success: false, message: 'No data found in both queries.' });
        }
        //อย่าพึ่งลบนะ
        // else {
        //     // ถ้าไม่มีข้อมูลใน QUERY1, ใช้ Connection `HS54` สำหรับ QUERY2
        //     const pool2 = await getPool(branch);
        //     const query2Result = await pool2.request()
        //         .input('DI_REF', sql.VarChar, reference)
        //         .query(`
        //             SELECT
        //                 0 AS IDENT,
        //                 DI_REF, 
        //                 CONVERT(VARCHAR, DI_DATE, 105) AS DI_DATE, 
        //                 0 AS LATEST_ROUND,  
        //                 SKU_CODE,
        //                 SKU_NAME,
        //                 ICCAT.ICCAT_KEY,
        //                 ICCAT.ICCAT_CODE,
        //                 ICCAT.ICCAT_NAME,
        //                 ABS(SKM_QTY) AS REMAIN_QTY, 
        //                 ABS(SKM_QTY) AS QTY, 
        //                 0 AS TOTAL_CR_QTY,  
        //                 NULL AS LATEST_PREPARE_QTY, 
        //                 CASE 
        //                     WHEN LEFT(ICCAT_CODE, 1) IN ('A', 'B', 'K') THEN 'คลังสินค้า'
        //                     WHEN LEFT(ICCAT_CODE, 1) = 'R' THEN 'สโตร์/คลัง'
        //                     WHEN LEFT(ICCAT_CODE, 1) IN ('M', 'O', 'P', 'S', 'T', 'V', 'W') THEN 'สโตร์'
        //                     ELSE 'Unknown'
        //                 END AS SKU_WL, 
        //                 CASE 
        //                     WHEN LEFT(ICCAT_CODE, 1) IN ('A', 'B', 'K','M', 'O', 'P', 'S', 'T', 'V', 'W','R') THEN 'รอจัด'     
        //                     ELSE 'Unknown'
        //                 END AS STATUS
        //             FROM DOCINFO
        //             INNER JOIN DOCTYPE ON DOCINFO.DI_DT = DOCTYPE.DT_KEY
        //             INNER JOIN SKUMOVE ON DOCINFO.DI_KEY = SKUMOVE.SKM_DI
        //             INNER JOIN SKUMASTER ON SKUMOVE.SKM_SKU = SKUMASTER.SKU_KEY
        //             INNER JOIN ICCAT ON SKUMASTER.SKU_ICCAT = ICCAT.ICCAT_KEY
        //             WHERE 
        //                 ((DOCTYPE.DT_PROPERTIES=302 AND DOCTYPE.DT_KEY != 1471) OR
        //                 DOCTYPE.DT_PROPERTIES=307 OR
        //                 DOCTYPE.DT_PROPERTIES=308 OR
        //                 DOCTYPE.DT_PROPERTIES=337) AND
        //                 (DOCINFO.DI_ACTIVE = 0) AND
        //                 SKU_CODE != '4001' AND
        //                 LEFT(ICCAT_CODE, 1) IN ('A', 'B', 'K', 'M', 'O', 'R', 'P', 'S', 'T', 'V', 'W') AND
        //                 DI_REF = @DI_REF
        //         `);

        //     // ส่งผลลัพธ์จาก QUERY2 ถ้าไม่พบข้อมูลจาก QUERY1
        //     if (query2Result.recordset.length > 0) {
        //         res.json({ success: true, data: query2Result.recordset });
        //     } else {
        //         res.json({ success: false, message: 'No data found in both queries.' });
        //     }
        // }
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
    });     


// API สำหรับ Insert ข้อมูลจาก stock
app.post('/api/insert-stock-data', async (req, res) => {
  const { data } = req.body;
  // console.log(data);
  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ success: false, message: "Invalid data format" });
  }

  let transaction;
  try {
    const pool = await getPool("TestOng");
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    let sta;
    const batchSize = 100; // ป้องกัน SQL parameter overflow
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      // ใช้ for...of loop เดียวสำหรับแต่ละ recordใน batch
      for (const item of batch) {
       
        // INSERT ลงในตาราง Stock
        const insertRequest = transaction.request();
        insertRequest.input("DI_REF", sql.VarChar, item.DI_REF);
        insertRequest.input("CHECKROUND", sql.Int, item.ROUND);
        // แปลงค่าสตริงวันที่เป็น Date object แล้วใช้ CONVERT(date, @DI_DATE, 126) ใน query
        insertRequest.input("DI_DATE", sql.Date, new Date(item.DI_DATE));
        insertRequest.input("SKU_CODE", sql.VarChar, item.SKU_CODE);
        insertRequest.input("SKU_NAME", sql.NVarChar, item.SKU_NAME);
        insertRequest.input("SKU_QTY", sql.Decimal(18,2), item.SKU_QTY);
        insertRequest.input("CR_QTY", sql.Decimal(18,2), item.CheckQTY);
        insertRequest.input("BRANCH_CODE", sql.VarChar, item.Branch);
        insertRequest.input("CREATE_BY", sql.VarChar, item.CreateBy);
        const insertQuery = `
          INSERT INTO Stock 
            (DI_REF, CHECKROUND, DI_DATE, SKU_CODE, SKU_NAME, SKU_QTY, CR_QTY, BRANCH_CODE, CREATE_BY, UPDATE_DATE, UPDATE_BY)
          VALUES 
            (@DI_REF, @CHECKROUND, CONVERT(date, @DI_DATE, 126), @SKU_CODE, @SKU_NAME, @SKU_QTY, @CR_QTY, @BRANCH_CODE, @CREATE_BY, GETDATE(), @CREATE_BY)
        `;
        await insertRequest.query(insertQuery);

        // UPDATE ตาราง Stock_Summary สำหรับ record นี้
        const updateRequest = transaction.request();
        updateRequest.input("ROUND", sql.Int, item.ROUND);
        updateRequest.input("TotalCR", sql.Decimal(18,2), item.TotalCR);
        updateRequest.input("RemainQTY", sql.Decimal(18,2), item.RemainQTY);
        updateRequest.input("Status", sql.Int, item.Status);
        updateRequest.input("CREATE_BY", sql.VarChar, item.CreateBy);
        updateRequest.input("ID", sql.Int, item.ID);
        const updateQuery = `
          UPDATE Stock_Summary
          SET LATEST_ROUND = @ROUND,
              TOTAL_CR_QTY = @TotalCR,
              REMAINING_QTY = @RemainQTY,
              LATEST_PREPARE_QTY = NULL,
              STATUS = @Status,
              UPDATE_DATE = GETDATE(),
              UPDATE_BY = @CREATE_BY
          WHERE id = @ID
        `;
        await updateRequest.query(updateQuery);
      }
    }

    await transaction.commit();
    res.json({ success: true, message: "Data inserted/updated successfully" });
  } catch (err) {
    console.error("Database error:", err);
    if (transaction) {
      await transaction.rollback();
    }
    res.status(500).json({ success: false, message: "Failed to insert/update data" });
  }
});


// ✅ ฟังก์ชันแปลงค่า `status`
function getStatusValue(status) {
    const statusMapping = {
        "รอสโตร์ตรวจจ่าย": '5',
        "รอการตรวจจ่าย": '2',
        "รอการจัดเตรียม": '1',
        "จัดเตรียมเรียบร้อย": '3',
        "ตรวจจ่ายเรียบร้อย": '4'
    };
    return statusMapping[status] || '0'; // ✅ ถ้าไม่พบค่า ใช้ 0 (ป้องกัน error)
}

app.post("/api/get-stock-transactions", async (req, res) => {
    try {
        const { DI_REF, CHECKROUND, BRANCH, startDate, endDate, customerName } = req.body;
        const pool = await getPool("TestOng");
        const request = pool.request();
        request.input("BRANCH", sql.VarChar, BRANCH);
        let query = `
            SELECT 
                s.ID, s.DI_REF, s.CHECKROUND,
                s.SKU_CODE, s.SKU_NAME, s.SKU_QTY, s.CR_QTY, 
                u.Firstname + ' ' + u.Lastname AS CREATE_BY, 
                CONVERT(varchar, s.CREATE_DATE, 103) AS CREATE_DATE,
                ISNULL(s.UPDATE_BY, '-') AS UPDATE_BY,
                CONVERT(varchar, s.UPDATE_DATE, 103) AS UPDATE_DATE,
                s.CR_QTY + ss.REMAINING_QTY AS REMAINING_QTY 
            FROM Stock s
            LEFT JOIN Users u ON s.CREATE_BY = u.username
            LEFT JOIN stock_summary ss ON s.DI_REF = ss.DI_REF AND s.SKU_CODE = ss.SKU_CODE
            WHERE 1=1 and s.branch_code = @BRANCH
        `;

        if (DI_REF) {
            query += ` AND s.DI_REF = @DI_REF`;
            request.input("DI_REF", sql.NVarChar, DI_REF);
        }
        if (CHECKROUND) {
            query += ` AND s.CHECKROUND = @CHECKROUND`;
            request.input("CHECKROUND", sql.Int, CHECKROUND);
        }
        // --- เปลี่ยนไปใช้ DI_DATE สำหรับกรองวันที่ ---
        const dateColumn = "s.DI_DATE"; // <<<<<<< เปลี่ยนเป็น s.DI_DATE
        if (startDate) {
            query += ` AND ${dateColumn} >= @startDate`;
            request.input("startDate", sql.Date, startDate); // ใช้ sql.Date หรือ sql.DateTime ตามชนิดข้อมูล DI_DATE
        }
        if (endDate) {
            // หาก DI_DATE เก็บเวลาด้วย ควรปรับเป็นสิ้นสุดวัน
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 997);
            query += ` AND ${dateColumn} <= @endDate`;
            request.input("endDate", sql.DateTime, endOfDay); // ใช้ sql.DateTime
            // หรือถ้า DI_DATE เป็นแค่ Date:
            // query += ` AND ${dateColumn} <= @endDate`;
            // request.input("endDate", sql.Date, endDate);
        }
        // --- จบการเปลี่ยน ---

        if (customerName) {
            query += ` AND ss.AR_NAME LIKE @customerName + '%'`;
            request.input("customerName", sql.NVarChar, customerName);
        }
        query += ` ORDER BY s.CREATE_DATE DESC`;

        const result = await request.query(query);
        res.json({ success: true, data: result.recordset });

    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ success: false, message: "Database error" });
    }
});



app.post("/api/update-stock-transaction", async (req, res) => {
    const { ID, DI_REF, SKU_CODE, NEW_CR_QTY, Username, BranchCode } = req.body;
    // console.error("Check:", req.body);
    if (!ID || !DI_REF || !SKU_CODE || NEW_CR_QTY === undefined || !Username || !BranchCode) {
        // console.error("ค่าที่รับมาไม่ครบ:", req.body);
        return res.status(400).json({ success: false, message: "Missing required fields!" });
    }

    try {
        const pool = await getPool("TestOng");
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        // 1️⃣ ดึงค่า CR_QTY ปัจจุบันจาก `Stock`
        const stockQuery = `SELECT ISNULL(CR_QTY, 0) AS CR_QTY FROM Stock WHERE ID = @ID`;
        const stockRequest = new sql.Request(transaction);
        stockRequest.input("ID", sql.Int, ID);
        const stockResult = await stockRequest.query(stockQuery);
        
        if (stockResult.recordset.length === 0) {
            return res.status(400).json({ success: false, message: "Stock data not found!" });
        }

        const OLD_CR_QTY = stockResult.recordset[0].CR_QTY;

        // 2️⃣ ดึงค่า TOTAL_CR_QTY และ TOTAL_SKU_QTY จาก `stock_summary`
        const summaryQuery = `
            SELECT 
                ISNULL(TOTAL_CR_QTY, 0) AS TOTAL_CR_QTY,  
                ISNULL(REMAINING_QTY, 0) AS REMAINING_QTY
            FROM stock_summary 
            WHERE DI_REF = @DI_REF 
            AND SKU_CODE = @SKU_CODE 
            AND BRANCH_CODE = @Branch_Code
        `;
        const summaryRequest = new sql.Request(transaction);
        summaryRequest.input("DI_REF", sql.NVarChar, DI_REF);
        summaryRequest.input("SKU_CODE", sql.NVarChar, SKU_CODE);
        summaryRequest.input("Branch_Code", sql.VarChar, BranchCode);
        const summaryResult = await summaryRequest.query(summaryQuery);

        if (summaryResult.recordset.length === 0) {
            return res.status(400).json({ success: false, message: "Stock summary data not found!" });
        }

        let { TOTAL_CR_QTY, REMAINING_QTY } = summaryResult.recordset[0];
        let status = 6;

        // 3️⃣ คำนวณค่าใหม่
        const NEW_TOTAL_CR_QTY = (TOTAL_CR_QTY || 0) - (OLD_CR_QTY || 0) + (NEW_CR_QTY || 0);
        const UPDATED_REMAINING_QTY = (REMAINING_QTY || 0) + (TOTAL_CR_QTY || 0) - (NEW_TOTAL_CR_QTY || 0);
        if(UPDATED_REMAINING_QTY !=0)
        {
          
          if(NEW_TOTAL_CR_QTY<UPDATED_REMAINING_QTY){
            status = 5;
          }
          if(NEW_TOTAL_CR_QTY == 0){
            status = 1;
          }
        }

        // 4️⃣ อัปเดต `Stock`
        const updateStockQuery = `
            UPDATE Stock 
            SET CR_QTY = @NEWCRQTY,
                UPDATE_BY = @UPDATEBY,
                UPDATE_DATE = GETDATE()
            WHERE ID = @ID
        `;

        const updateStockRequest = new sql.Request(transaction);
        updateStockRequest.input("NEWCRQTY", sql.Decimal(18,2), NEW_CR_QTY);
        updateStockRequest.input("UPDATEBY", sql.VarChar, Username);
        updateStockRequest.input("ID", sql.Int, ID);
        
        await updateStockRequest.query(updateStockQuery);

        const updateSummaryQuery = `
        UPDATE stock_summary 
        SET 
            TOTAL_CR_QTY = @TOTALCRQTY,
            REMAINING_QTY = @UPDATEDREMAININGQTY,
            STATUS = @STATUS,
            UPDATE_BY = @UPDATEBY,
            UPDATE_DATE = GETDATE()
        WHERE DI_REF = @DIREF 
        AND SKU_CODE = @SKUCODE 
        AND BRANCH_CODE = @BranchCode
        `;
        const updateSummaryRequest = new sql.Request(transaction);
        updateSummaryRequest.input("TOTALCRQTY", sql.Decimal(18,2), NEW_TOTAL_CR_QTY);
        updateSummaryRequest.input("UPDATEDREMAININGQTY", sql.Decimal(18,2), UPDATED_REMAINING_QTY);
        updateSummaryRequest.input("UPDATEBY", sql.VarChar, Username);
        updateSummaryRequest.input("DIREF", sql.VarChar, DI_REF);
        updateSummaryRequest.input("SKUCODE", sql.VarChar, SKU_CODE);
        updateSummaryRequest.input("BranchCode", sql.VarChar, BranchCode);
        updateSummaryRequest.input("STATUS", sql.Int, status);
        await updateSummaryRequest.query(updateSummaryQuery);

        await transaction.commit();
        res.json({ success: true, message: "Stock summary updated successfully!" });

    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ success: false, message: "Database error" });
    }
});

// app.post('/api/get-report', async (req, res) => {
//   try {
//     const { reportType, DI_REF, CHECKROUND } = req.body;
//     const pool = await getPool("TestOng");
//     let query = "";
//     let whereClauses = [];
    
//     // เลือก table ตาม reportType
//     if(reportType === 'stock'){
//       query = "SELECT * FROM stock";
//     } else if(reportType === 'preparationRecords'){
//       query = "SELECT * FROM preparationRecords";
//     } else {
//       return res.json({ success: false, message: "Invalid report type" });
//     }
    
//     // ถ้ามีค่า DI_REF (เลขที่เอกสาร) ให้เพิ่มเงื่อนไขค้นหา
//     if(DI_REF && DI_REF.trim() !== ""){
//       whereClauses.push("DI_REF = @DI_REF");
//     }
    
//     // ถ้ามีค่า CHECKROUND (รอบตรวจจ่าย) สามารถเพิ่มเงื่อนไขได้เช่นกัน
//     if(CHECKROUND && CHECKROUND.toString().trim() !== ""){
//       whereClauses.push("CHECKROUND = @CHECKROUND");
//     }
    
//     // ถ้ามีเงื่อนไข ให้ต่อเข้าไปกับ query
//     if(whereClauses.length > 0){
//       query += " WHERE " + whereClauses.join(" AND ");
//     }
    
//     const requestObj = pool.request();
//     if(DI_REF && DI_REF.trim() !== ""){
//       requestObj.input("DI_REF", sql.VarChar, DI_REF);
//     }
//     if(CHECKROUND && CHECKROUND.toString().trim() !== ""){
//       requestObj.input("CHECKROUND", sql.Int, CHECKROUND);
//     }
    
//     const result = await requestObj.query(query);
//     res.json({ success: true, data: result.recordset });
    
//   } catch(error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: "Database error", error: error.message });
//   }
// });
app.post('/api/get-report', async (req, res) => {
  try {
      const { reportType, DI_REF, CHECKROUND, startDate, endDate, customerName } = req.body;
      const pool = await getPool("TestOng");
      const requestObj = pool.request();

      let baseQuery = "";
        let whereConditions = []; // เปลี่ยนชื่อเป็น conditions เพื่อความชัดเจน
        let queryParams = {}; // Object สำหรับเก็บ parameters ที่จะ bind

        let hasBaseWhere = false; // Flag เช็คว่า query หลักมี WHERE แล้วหรือไม่

      // 2. กำหนด Base Query และเงื่อนไขพื้นฐานตาม reportType
        if (reportType === 'preparationRecords') {
            baseQuery = `
                SELECT
                    ID, DI_REF, DI_DATE, ICCAT_CODE, ICCAT_NAME, PREPARE_QTY,
                    PreparedBy, Status, SKU_CODE, update_date,
                    updated_by,
                    ROW_NUMBER() OVER(PARTITION BY DI_REF, SKU_CODE ORDER BY update_date ASC) AS Round
                FROM preparationRecords
            `;
            // ไม่มี WHERE พื้นฐาน
            hasBaseWhere = false;

            // เพิ่มเงื่อนไข Filter สำหรับ preparationRecords
            if (DI_REF && DI_REF.trim() !== "") {
                whereConditions.push("DI_REF = @DI_REF");
                queryParams.DI_REF = { type: sql.NVarChar, value: DI_REF.trim() };
            }
            if (startDate && startDate.trim() !== "") {
                whereConditions.push("DI_DATE >= @startDate");
                queryParams.startDate = { type: sql.Date, value: startDate };
            }
            if (endDate && endDate.trim() !== "") {
                whereConditions.push("DI_DATE <= @endDate");
                queryParams.endDate = { type: sql.Date, value: endDate };
            }
            // เพิ่ม customerName ถ้า table นี้มี column AR_NAME หรือเทียบเท่า
            if (customerName && customerName.trim() !== "") {
                 // whereConditions.push("AR_NAME LIKE @customerName + '%'"); // สมมติว่ามีคอลัมน์ AR_NAME
                 // queryParams.customerName = { type: sql.NVarChar, value: customerName.trim() };
            }
             // CHECKROUND ไม่น่าจะใช้กับ preparationRecords ตามโครงสร้างเดิม

            } else if (reportType === 'stocksummary') {
            baseQuery = `
                SELECT
                    DI_REF, DI_DATE, SKU_CODE, SKU_NAME, ICCAT_CODE,
                    ICCAT_NAME AS ProductCategoryName, TOTAL_SKU_QTY AS SoldQty,
                    TOTAL_CR_QTY AS ReceivedQty, PREPARE_REMAINING AS PendingQty,
                    LATEST_PREPARE_QTY, STATUS, AR_NAME, SKU_ICDEPT
                FROM Stock_Summary
            `;
            // มี WHERE พื้นฐาน
            whereConditions.push("STATUS = 1");
            hasBaseWhere = true;

             // เพิ่มเงื่อนไข Filter สำหรับ stocksummary
            if (DI_REF && DI_REF.trim() !== "") {
                whereConditions.push("DI_REF = @DI_REF");
                queryParams.DI_REF = { type: sql.NVarChar, value: DI_REF.trim() };
            }
             if (CHECKROUND && CHECKROUND.toString().trim() !== "") {
                 // สมมติว่า Stock_Summary มีคอลัมน์ CHECKROUND (ถ้าไม่มี ให้เอาส่วนนี้ออก)
                whereConditions.push("CHECKROUND = @CHECKROUND");
                queryParams.CHECKROUND = { type: sql.Int, value: parseInt(CHECKROUND, 10) };
            }
            if (startDate && startDate.trim() !== "") {
                whereConditions.push("DI_DATE >= @startDate"); // ใช้ DI_DATE
                queryParams.startDate = { type: sql.Date, value: startDate };
            }
            if (endDate && endDate.trim() !== "") {
                whereConditions.push("DI_DATE <= @endDate"); // ใช้ DI_DATE
                queryParams.endDate = { type: sql.Date, value: endDate };
            }
            if (customerName && customerName.trim() !== "") {
                whereConditions.push("AR_NAME LIKE @customerName + '%'");
                queryParams.customerName = { type: sql.NVarChar, value: customerName.trim() };
            }  
          } else if (reportType === 'stock') {
            // --- จัดการ reportType 'stock' ผ่าน endpoint นี้ (ถ้าต้องการ) ---
            baseQuery = "SELECT * FROM stock"; // ปรับ SELECT columns ตามต้องการ
            hasBaseWhere = false; // หรือ true ถ้ามีเงื่อนไขพื้นฐาน

            // เพิ่มเงื่อนไข Filter สำหรับ stock (ปรับชื่อคอลัมน์ตามตาราง stock)
            if (DI_REF && DI_REF.trim() !== "") {
                whereConditions.push("DI_REF = @DI_REF"); // สมมติชื่อคอลัมน์ DI_REF
                queryParams.DI_REF = { type: sql.NVarChar, value: DI_REF.trim() };
            }
            if (CHECKROUND && CHECKROUND.toString().trim() !== "") {
                whereConditions.push("CHECKROUND = @CHECKROUND"); // สมมติชื่อคอลัมน์ CHECKROUND
                queryParams.CHECKROUND = { type: sql.Int, value: parseInt(CHECKROUND, 10) };
            }
            // เพิ่มเงื่อนไขวันที่ startDate, endDate (ถ้ามีคอลัมน์วันที่ในตาราง stock)
            // if (startDate && startDate.trim() !== "") {
            //     whereConditions.push("YourDateColumn >= @startDate");
            //     queryParams.startDate = { type: sql.Date, value: startDate };
            // }
            // if (endDate && endDate.trim() !== "") {
            //     whereConditions.push("YourDateColumn <= @endDate");
            //     queryParams.endDate = { type: sql.Date, value: endDate };
            // }
            // เพิ่ม customerName (ถ้ามีคอลัมน์ชื่อลูกค้าในตาราง stock)
            // if (customerName && customerName.trim() !== "") {
            //    whereConditions.push("YourCustomerNameColumn LIKE @customerName + '%'");
            //    queryParams.customerName = { type: sql.NVarChar, value: customerName.trim() };
            // }
            // --- จบการจัดการ 'stock' ---

       } else {
           // ถ้า reportType ไม่ถูกต้อง
           return res.status(400).json({ success: false, message: "Invalid report type" });
       }  
          

      // ถ้ามีค่า DI_REF (เลขที่เอกสาร) ให้เพิ่มเงื่อนไขค้นหา
      // if(DI_REF && DI_REF.trim() !== ""){
      //     whereClauses.push("DI_REF = @DI_REF");
      // }

      // ถ้ามีค่า CHECKROUND (รอบตรวจจ่าย) สามารถเพิ่มเงื่อนไขได้เช่นกัน
      // if(CHECKROUND && CHECKROUND.toString().trim() !== ""){
      //     whereClauses.push("CHECKROUND = @CHECKROUND");
      // }

      // ถ้ามีเงื่อนไข ให้ต่อเข้าไปกับ query
      // if(whereClauses.length > 0){
      //     query += " WHERE " + whereClauses.join(" AND ");
      // }
      // if(whereClauses.length > 0 && reportType !== 'stocksummary'){ // ✅ ไม่ต้องใส่ WHERE สำหรับ stocksummary เพราะมี STATUS=1 อยู่แล้ว
      //   query += " WHERE " + whereClauses.join(" AND ");
      // } else if (whereClauses.length > 0 && reportType === 'stocksummary') {
      //     query += " AND " + whereClauses.join(" AND "); // ต่อ WHERE clause เพิ่มเติมสำหรับ stocksummary
      // }

      // 3. สร้าง Query String สุดท้ายโดยรวมเงื่อนไข WHERE/AND
      let finalQuery = baseQuery;
      if (whereConditions.length > 0) {
          if (hasBaseWhere) {
              // มี WHERE พื้นฐานแล้ว (เช่น STATUS=1)
              // เอาเฉพาะเงื่อนไข filter ที่เพิ่มเข้ามา (ไม่รวมเงื่อนไขพื้นฐานอันแรก)
              const filterConditions = whereConditions.slice(1);
               finalQuery += " WHERE " + whereConditions[0]; // ต่อ WHERE + เงื่อนไขพื้นฐาน
              if (filterConditions.length > 0) {
                  finalQuery += " AND " + filterConditions.join(" AND "); // ต่อ AND + เงื่อนไข filter อื่นๆ
              }
          } else {
              // ไม่มี WHERE พื้นฐาน ให้ใช้ WHERE กับเงื่อนไขแรก และ AND กับที่เหลือ
              finalQuery += " WHERE " + whereConditions.join(" AND ");
          }
      }

      // 4. Bind Parameters ที่เก็บไว้ใน queryParams
      for (const key in queryParams) {
          requestObj.input(key, queryParams[key].type, queryParams[key].value);
      }

      // 5. Execute Query และส่งผลลัพธ์
      console.log("Executing Query:", finalQuery); // แสดง query ที่จะรันใน console (สำหรับ debug)
      console.log("With Params:", queryParams); // แสดง parameters ที่ bind
      const result = await requestObj.query(finalQuery);
      res.json({ success: true, data: result.recordset });

  } catch (error) {
      console.error("API Error in /api/get-report:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
  }
});

app.post('/api/update-preparation', async (req, res) => {
  console.log("Request Body:", req.body); // เพิ่มบรรทัดนี้
    try {
      const { documentID, status, prepare_qty, updated_by, id, SKU_CODE } = req.body; // เพิ่ม id ในนี้
      if (!documentID || !id) {
        return res.status(400).json({ success: false, message: "Missing documentID or ID" });
      }
  
      const pool = await getPool("TestOng");
  
      // อัปเดทข้อมูลใน table preparationRecords
      const updatePrepQuery = `
        UPDATE preparationRecords
        SET status = @status,
            PREPARE_QTY = @prepare_qty,
            updated_by = @updated_by,
            update_date = GETDATE()
        WHERE ID = @id
      `;
      await pool.request()
        .input("status", sql.Int, status)
        .input("prepare_qty", sql.Decimal, prepare_qty)
        .input("updated_by", sql.VarChar, updated_by)
        .input("id", sql.Int, id) // รับค่า ID
        .query(updatePrepQuery);
  
      // อัปเดทข้อมูลใน table Stock_summary โดยใช้ทั้ง DI_REF และ SKU_CODE
      const updateStockQuery = `
        UPDATE Stock_summary
        SET STATUS = @status,
            LATEST_PREPARE_QTY = @prepare_qty,
            UPDATE_BY = @updated_by,
            UPDATE_DATE = GETDATE()
         WHERE DI_REF = @documentID
         AND SKU_CODE = @skuCode
      `;
      await pool.request()
      .input("status", sql.Int, status)
      .input("prepare_qty", sql.Decimal, prepare_qty)
      .input("updated_by", sql.VarChar, updated_by)
      .input("documentID", sql.VarChar, documentID)
      .input("skuCode", sql.VarChar, SKU_CODE) // เพิ่ม input สำหรับ SKU_CODE
      .query(updateStockQuery);
  
      res.json({ success: true, message: "Records updated successfully" });
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });
async function getUserDatabase(username) {
    const pool = await getPool("TestOng");
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    const branchQuery = `SELECT branch_code FROM users WHERE username = @username`;
    const branchRequest = new sql.Request(transaction);
    branchRequest.input("username",  sql.VarChar, username);
    const branchResult = await branchRequest.query(branchQuery);

    if (branchResult.recordset.length > 0) {
        const branchCode = branchResult.recordset[0].branch_code;
        if (branchCode === 'HS54') return "HS54";
        if (branchCode === 'HSPK') return "HSPK";
    }
    return null;
}




// // เริ่มต้นเซิร์ฟเวอร์
// app.listen(3000, () => {
//     console.log("Server is running on http://localhost:3000");
// });


const path = require('path'); // ใช้ path เพื่อจัดการเส้นทางไฟล์

app.use('/vendor', express.static(path.join(__dirname, 'vendor')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/scss', express.static(path.join(__dirname, 'scss')));
app.use('/img', express.static(path.join(__dirname, 'img')));

// กำหนดเส้นทางแสดงผลหน้า Login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // เสิร์ฟไฟล์ HTML
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// เส้นทางสำหรับแสดง Dashboard หลัง Login
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});


// เส้นทางสำหรับแสดง Buttons
app.get('/buttons', (req, res) => {
    res.sendFile(path.join(__dirname, 'buttons.html'));
});

app.get('/cards', (req, res) => {
    res.sendFile(path.join(__dirname, 'cards.html'));
});

app.get('/charts', (req, res) => {
    res.sendFile(path.join(__dirname, 'charts.html'));
});
app.get('/tables', (req, res) => {
    res.sendFile(path.join(__dirname, 'tables.html'));
});
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // แก้ให้เสิร์ฟไฟล์ login
});
app.get('/tables2', (req, res) => {
    res.sendFile(path.join(__dirname, 'tables2.html'));
});

app.get('/prepdetail', (req, res) => {
    res.sendFile(path.join(__dirname, 'prepdetail.html'));
});

app.get('/Checkdetail', (req, res) => {
  res.sendFile(path.join(__dirname, 'Checkdetail.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// เส้นทางสำหรับแต่ละปุ่ม
app.get('/page1', (req, res) => {
    res.send('<h1>Page 1</h1><p>This is the content of Page 1.</p>');
});

app.get('/page2', (req, res) => {
    res.send('<h1>Page 2</h1><p>This is the content of Page 2.</p>');
});

app.get('/page3', (req, res) => {
    res.send('<h1>Page 3</h1><p>This is the content of Page 3.</p>');
});

// เริ่มต้นเซิร์ฟเวอร์
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});



