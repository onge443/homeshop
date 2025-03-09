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

app.post('/api/search-preparation', async (req, res) => {
    try {
      const { category, status, documentID, branch, start, length, draw } = req.body;
      // console.log("ค่าที่ได้รับจาก Frontend:", { category, status, documentID, branch, start, length, draw });
  
      const pool = await getPool("TestOng");
      const request = pool.request();
      request.input("Branch", sql.VarChar, branch);
      request.input("start", sql.Int, start);
      request.input("length", sql.Int, length);
  
      // แปลงค่าสถานะ: ถ้าไม่ใช่ "all" ให้แปลงเป็นตัวเลข
      let statusValue = null;
      if (status && status !== "all") {
        statusValue = parseInt(status, 10);
        request.input("Status", sql.Int, statusValue);
        // console.log("ค่าของ @Status ที่ใช้ใน SQL:", statusValue);
      }
  
      // ตรวจสอบ filter category
      if (category && category !== "all") {
        // เปลี่ยนเงื่อนไขให้ใช้ SUBSTRING เพื่อให้เปรียบเทียบเฉพาะตัวอักษรแรก
        request.input("Category", sql.NVarChar, category);
      }
      // ตรวจสอบ documentID
      if (documentID) {
        request.input("documentID", sql.VarChar, documentID);
      }
  
      // --- คำนวณจำนวน record ทั้งหมด (summary) ---
      let countQuery = `
        SELECT COUNT(*) AS totalRecords
        FROM (
          SELECT DI_REF
          FROM Stock_Summary WITH (NOLOCK)
          WHERE BRANCH_CODE = @Branch
            AND DATEPART(YEAR, DI_DATE) = 2024 
            AND DATEPART(MONTH, DI_DATE) = 10
      `;
      if (documentID) {
        countQuery += ` AND DI_REF = @documentID`;
      }
      if (category && category !== "all") {
        // ใช้ SUBSTRING เพื่อเปรียบเทียบเฉพาะตัวอักษรแรก
        countQuery += ` AND SUBSTRING(ICCAT_CODE, 1, 1) = @Category`;
      }
      if (statusValue !== null) {
        countQuery += ` AND STATUS = @Status`;
      }
      countQuery += `
          GROUP BY DI_REF
        ) AS SummaryCount;
      `;
      // console.log("Count Query:", countQuery);
      const countResult = await request.query(countQuery);
      const totalRecords = countResult.recordset[0] ? countResult.recordset[0].totalRecords : 0;
      // console.log("จำนวนข้อมูลทั้งหมด:", totalRecords);
  
      // --- คำสั่ง query แบบ summary ---
      let summaryQuery = `
          SELECT 
            DI_REF AS DocumentID,
            CONVERT(VARCHAR, MIN(DI_DATE), 105) AS DI_DATE,
            MIN(AR_NAME) AS AR_NAME
          FROM Stock_Summary
          WHERE BRANCH_CODE = @Branch
            AND DATEPART(YEAR, DI_DATE) = 2024 
            AND DATEPART(MONTH, DI_DATE) = 10
      `;
      if (documentID) {
        summaryQuery += ` AND DI_REF = @documentID`;
      }
      if (category && category !== "all") {
        // เปลี่ยนเงื่อนไขให้ใช้ SUBSTRING เพื่อเปรียบเทียบเฉพาะตัวอักษรแรก
        summaryQuery += ` AND SUBSTRING(ICCAT_CODE, 1, 1) = @Category`;
      }
      if (statusValue !== null) {
        summaryQuery += ` AND STATUS = @Status`;
      }
      summaryQuery += `
          GROUP BY DI_REF
          `;
      // console.log("Summary Query ที่ใช้:", summaryQuery);
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
   
  // API สำหรับอัปเดตสถานะ (เช่น เมื่อกด "เริ่มจัด" หรือ "จัดเสร็จ")
  app.post('/api/update-status', async (req, res) => {
    try {
      const { DI_REF, branch } = req.body; 
      if (!DI_REF || !branch) { 
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }
      
      const pool = await getPool("TestOng");
  
      // Step 1: ดึงข้อมูลจาก stock_summary สำหรับ DI_REF และ branch ที่ระบุ
      const selectQuery = `
        SELECT ID, STATUS
        FROM stock_summary
        WHERE DI_REF = @DI_REF
          AND BRANCH_CODE = @Branch
      `;
      const selectResult = await pool.request()
        .input("DI_REF", sql.VarChar, DI_REF)
        .input("Branch", sql.VarChar, branch)
        .query(selectQuery);
  
      if (selectResult.recordset.length === 0) {
        return res.status(404).json({ success: false, message: "No rows found with the given DI_REF and branch" });
      }
  
      // Step 2: สำหรับแต่ละ record ตรวจสอบว่า STATUS เป็น 1 หรือ 3 ถ้าใช่ ให้ update เป็น 2  
      let updatedCount = 0;
      for (const row of selectResult.recordset) {
        // แปลงค่า STATUS ให้เป็นตัวเลข
        const currentStatus = parseInt(row.STATUS, 10);
        if (currentStatus === 1 || currentStatus === 3) {
          const updateQuery = `
            UPDATE stock_summary
            SET STATUS = 2, 
                UPDATE_DATE = GETDATE()
            WHERE ID = @ID
          `;
          await pool.request()
            .input("ID", sql.Int, row.ID)
            .query(updateQuery);
          updatedCount++;
        }
      }
  
      if (updatedCount > 0) {
        res.json({ success: true, message: "Status updated successfully", updatedCount });
      } else {
        res.status(400).json({ success: false, message: "No rows updated" });
      }
    } catch (error) {
      console.error("Error updating status:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });
  
  
  

  app.post('/api/get-preparation-details', async (req, res) => {
    try {
      const { DI_REF, Category } = req.body;
      if (!DI_REF) {
        return res.status(400).json({ success: false, message: 'DI_REF is required' });
      }
      const pool = await getPool("TestOng");
      let query = `
          SELECT 
          DI_REF, 
          DI_DATE, 
          SKU_CODE, 
          SKU_NAME,
          ICCAT_CODE,
          ICCAT_NAME AS ProductCategoryName, 
          TOTAL_SKU_QTY AS SoldQty, 
          TOTAL_CR_QTY AS ReceivedQty, 
          REMAINING_QTY AS PendingQty, 
          LATEST_PREPARE_QTY, 
          STATUS,
          AR_NAME,
          SKU_ICDEPT
        FROM Stock_Summary
		    Where SKU_ICDEPT not in( select SKU_ICDEPT from EXCEPT_CODE_LIST where BRANCH_CODE='HS54')
        AND DI_REF = @DI_REF
      `;
      if (Category && Category !== "all") {
        // หาก Category เป็น 'K', 'R' หรือ 'A' ให้เพิ่มเงื่อนไขเฉพาะ
        if (Category === 'K') {
          query += `
            AND SUBSTRING(ICCAT_CODE, 1, 1) = 'K'
          `;
        } else if (Category === 'R') {
          query += `
            AND SUBSTRING(ICCAT_CODE, 1, 1) = 'R'
          `;
        } else if (Category === 'A') {
          query += `
            AND SUBSTRING(ICCAT_CODE, 1, 1) = 'A'
          `;
        } else {
          // กรณีอื่นๆ ใช้กรองตามตัวอักษรตัวแรกเท่านั้น
          query += ` AND SUBSTRING(ICCAT_CODE, 1, 1) = @Category `;
        }
      }
      const requestObj = pool.request()
        .input("DI_REF", sql.VarChar, DI_REF);
      if (Category && Category !== "all" && Category !== 'K' && Category !== 'R' && Category !== 'A') {
        requestObj.input("Category", sql.NVarChar, Category);
      }
        
      const result = await requestObj.query(query);
      if (result.recordset.length > 0) {
        res.json({ success: true, data: result.recordset });
      } else {
        res.json({ success: false, message: 'No data found for this DI_REF and Category' });
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

app.post('/api/save-preparation', async (req, res) => {
    // ถ้า req.body เป็นอาร์เรย์ ให้ใช้เป็น updates array ถ้าไม่ใช่ ให้แปลงเป็น array เดียว
    const updates = Array.isArray(req.body) ? req.body : [req.body];
  
    // ตรวจสอบข้อมูลแต่ละ record
    for (const update of updates) {
      if (!update.DI_REF || !update.ProductCode || update.PreparedQty === undefined) {
        // console.log("Missing fields:", update);
        return res.status(400).json({ success: false, message: "Missing required fields in one or more records" });
      }
    }
  
    let transaction;
    try {
      const pool = await getPool("TestOng");
      transaction = new sql.Transaction(pool);
      await transaction.begin();
  
      // Loop ผ่านแต่ละ update ในอาร์เรย์
      for (const update of updates) {
        const { DI_REF, ProductCode, PreparedQty, Username, branch } = update;
        const PreparedBy = Username || "ระบบ";
  
        // ตรวจสอบสถานะใน stock_summary
        const checkStatusQuery = await pool.request()
          .input('DI_REF', sql.NVarChar, DI_REF)
          .input('SKU_CODE', sql.NVarChar, ProductCode)
          .input('BRANCH_CODE', sql.VarChar, branch)
          .query(`
            SELECT STATUS, REMAINING_QTY
            FROM stock_summary 
            WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE AND BRANCH_CODE = @BRANCH_CODE
          `);
  
        if (checkStatusQuery.recordset.length > 0) {
          const { STATUS: currentStatus} = checkStatusQuery.recordset[0];
          // console.log("check stock_summary ", { currentStatus, currentRemain, currentlocation });
          if (currentStatus == 4 || currentStatus == 6) {
            return res.status(400).json({ 
              success: false, 
              message: "ไม่สามารถบันทึกข้อมูลได้ เนื่องจากสถานะเป็น 'จัดเตรียมเรียบร้อย' แล้ว!" 
            });
          }
          
        }
        // ดึงข้อมูล TOTAL_SKU_QTY จาก stock_summary เพื่อเปรียบเทียบกับ PreparedQty
        const requestStockSummary = new sql.Request(transaction);
        const stockQuery = await requestStockSummary
        .input('DI_REF', sql.NVarChar, DI_REF)
        .input('SKU_CODE', sql.NVarChar, ProductCode)
        .input('BRANCH_CODE', sql.VarChar, branch)
        .query(`
            SELECT LATEST_PREPARE_QTY, TOTAL_SKU_QTY 
            FROM stock_summary 
            WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE AND BRANCH_CODE = @BRANCH_CODE
        `);

        if (stockQuery.recordset.length === 0) {
        throw new Error("❌ ไม่พบข้อมูลใน stock_summary");
        }
        // const currentPrepared = stockQuery.recordset[0].LATEST_PREPARE_QTY || 0;
        const total = stockQuery.recordset[0].TOTAL_SKU_QTY || 0;

        // เปรียบเทียบ PreparedQty กับ TOTAL_SKU_QTY:
        // ถ้า PreparedQty น้อยกว่า TOTAL_SKU_QTY (ยังไม่ครบ) ให้ set status = "3"
        // ถ้า PreparedQty เท่ากับ TOTAL_SKU_QTY ให้ set status = "4"
        let newStatus = (PreparedQty < total) ? "3" : "4";

        // อัปเดต stock_summary
        // console.log("Updating stock_summary with", { DI_REF, ProductCode, PreparedQty, branch });
        const requestUpdate = new sql.Request(transaction);
        const resultUpdate = await requestUpdate
          .input('DI_REF', sql.NVarChar, DI_REF)
          .input('SKU_CODE', sql.NVarChar, ProductCode)
          .input('LATEST_PREPARE_QTY', sql.Decimal(18,2), PreparedQty)
          .input('UPDATE_DATE', sql.DateTime, new Date())
          .input('UPDATE_BY', sql.NVarChar, PreparedBy)
          .input('STATUS', sql.NVarChar, newStatus)
          .input('BRANCH_CODE', sql.VarChar, branch)
          .query(`
            UPDATE stock_summary
            SET 
              LATEST_PREPARE_QTY = @LATEST_PREPARE_QTY, 
              STATUS = @STATUS, 
              UPDATE_DATE = @UPDATE_DATE, 
              UPDATE_BY = @UPDATE_BY
            WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE AND BRANCH_CODE = @BRANCH_CODE;
            SELECT @@ROWCOUNT AS affectedRows;
          `);
    
        if (!resultUpdate.recordset || resultUpdate.recordset.length === 0 || resultUpdate.recordset[0].affectedRows === 0) {
          throw new Error("❌ No rows updated in stock_summary. Check DI_REF, SKU_CODE, and BRANCH_CODE.");
        }
    
        // console.log("Stock summary updated successfully with status =", newStatus);
    
        // ดึงข้อมูล ICCAT_CODE และ ICCAT_NAME
        const requestICCAT = new sql.Request(transaction);
        const iccatQuery = await requestICCAT
          .input('DI_REF', sql.NVarChar, DI_REF)
          .input('SKU_CODE', sql.NVarChar, ProductCode)
          .query(`
            SELECT ICCAT_CODE, ICCAT_NAME 
            FROM stock_summary 
            WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE
          `);
    
        if (iccatQuery.recordset.length === 0) {
          throw new Error("❌ ICCAT_CODE หรือ ICCAT_NAME ไม่พบใน stock_summary");
        }
    
        // บันทึกข้อมูลลง preparationRecords
        const requestInsert = new sql.Request(transaction);
        await requestInsert
          .input('DI_REF', sql.NVarChar, DI_REF)
          .input('SKU_CODE', sql.NVarChar, ProductCode)
          .input('ICCAT_CODE', sql.NVarChar, iccatQuery.recordset[0].ICCAT_CODE)
          .input('ICCAT_NAME', sql.NVarChar, iccatQuery.recordset[0].ICCAT_NAME)
          .input('PREPARE_QTY', sql.Decimal(18,2), PreparedQty)
          .input('PreparedBy', sql.NVarChar, PreparedBy)
          .input('Timestamp', sql.DateTime, new Date())
          .input('Status', sql.NVarChar, newStatus)
          .query(`
            INSERT INTO preparationRecords 
            (DI_REF, SKU_CODE, ICCAT_CODE, ICCAT_NAME, PREPARE_QTY, PreparedBy, Timestamp, Status)
            VALUES (@DI_REF, @SKU_CODE, @ICCAT_CODE, @ICCAT_NAME, @PREPARE_QTY, @PreparedBy, @Timestamp, @Status)
          `);
      }
    
      await transaction.commit();
      res.json({ success: true, message: "Preparation saved successfully!" });
    
    } catch (error) {
      console.error("❌ Error saving preparation:", error);
      if (transaction) {
        await transaction.rollback();
      }
      res.status(500).json({ success: false, message: "Database error", error: error.message });
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
        const { DI_REF, CHECKROUND, BRANCH } = req.body;
        const pool = await getPool("TestOng");
        const request = pool.request();
        request.input("BRANCH", sql.VarChar, BRANCH);
        let query = `
            SELECT 
                s.ID, s.DI_REF, s.CHECKROUND, s.SKU_WL, 
                s.SKU_CODE, s.SKU_NAME, s.SKU_QTY, s.CR_QTY, 
                u.Firstname + ' ' + u.Lastname AS CREATE_BY, 
                FORMAT(s.CREATE_DATE, 'dd-MM-yyyy HH:mm:ss') AS CREATE_DATE,
                ISNULL(s.UPDATE_BY, '-') AS UPDATE_BY,
                FORMAT(s.UPDATE_DATE, 'dd-MM-yyyy HH:mm:ss') AS UPDATE_DATE,
                ss.REMAINING_QTY  -- ✅ ดึง REMAINING_QTY จาก stock_summary
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
            WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE AND BRANCH_CODE = @Branch_Code
        `;
        const summaryRequest = new sql.Request(transaction);
        summaryRequest.input("DI_REF", sql.NVarChar, DI_REF);
        summaryRequest.input("SKU_CODE", sql.NVarChar, SKU_CODE);
        summaryRequest.input("SKU_CODE", sql.NVarChar, SKU_CODE);
        summaryRequest.input("Branch_Code", sql.VarChar, BranchCode);
        const summaryResult = await summaryRequest.query(summaryQuery);

        if (summaryResult.recordset.length === 0) {
            return res.status(400).json({ success: false, message: "Stock summary data not found!" });
        }

        let { TOTAL_CR_QTY, REMAINING_QTY } = summaryResult.recordset[0];

        // 3️⃣ คำนวณค่าใหม่
        const NEW_TOTAL_CR_QTY = (TOTAL_CR_QTY || 0) - (OLD_CR_QTY || 0) + (NEW_CR_QTY || 0);
        const UPDATED_REMAINING_QTY = (REMAINING_QTY || 0) + (TOTAL_CR_QTY || 0) - (NEW_TOTAL_CR_QTY || 0);

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
            UPDATE_BY = @UPDATEBY,
            UPDATE_DATE = GETDATE()
        WHERE DI_REF = @DIREF AND SKU_CODE = @SKUCODE AND BRANCH_CODE = @BranchCode
        `;
        const updateSummaryRequest = new sql.Request(transaction);
        updateSummaryRequest.input("TOTALCRQTY", sql.Decimal(18,2), NEW_TOTAL_CR_QTY);
        updateSummaryRequest.input("UPDATEDREMAININGQTY", sql.Decimal(18,2), UPDATED_REMAINING_QTY);
        updateSummaryRequest.input("UPDATEBY", sql.VarChar, Username);
        updateSummaryRequest.input("DIREF", sql.VarChar, DI_REF);
        updateSummaryRequest.input("SKUCODE", sql.VarChar, SKU_CODE);
        updateSummaryRequest.input("BranchCode", sql.VarChar, BranchCode);
        await updateSummaryRequest.query(updateSummaryQuery);

        await transaction.commit();
        res.json({ success: true, message: "Stock summary updated successfully!" });

    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ success: false, message: "Database error" });
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



