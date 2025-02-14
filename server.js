const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const sql = require('mssql');

const { LocalStorage } = require('node-localstorage');

const app = express();

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
// 🛠️ ใช้ SQL Connection Pool Manager
const pools = {
    TestOng: new sql.ConnectionPool(configTestOng),
    HS54: new sql.ConnectionPool(configHS54)
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
    console.log("Received data:", req.body); // ✅ Debug ดูค่าที่ถูกส่งมา
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
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        let pool = await getPool("TestOng");
        let result = await pool.request()
            .input('username', sql.VarChar, username)
            .query(`
                SELECT u.password, b.branch_name 
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

                res.json({ success: true, branch: result.recordset[0].branch_name, redirect: '/dashboard' });
                
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
// ดึงสาขามาจาก branch
app.get('/api/branches', async (req, res) => {
    try {
        const pool = await getPool("TestOng"); // เชื่อมต่อฐานข้อมูล
        const result = await pool.request().query("SELECT branch_code, branch_name FROM branches");

        if (!result.recordset || result.recordset.length === 0) {
            return res.json({ success: false, message: "No branches found" });
        }

        console.log("🔍 Branches data:", result.recordset); // ✅ Debug log ดูข้อมูลที่ถูกส่งไป
        res.json({ success: true, data: result.recordset });

    } catch (error) {
        console.error("Error fetching branches:", error);
        res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
});

app.get('/api/get-stock-status', async (req, res) => {
    try {
        const pool = await getPool("TestOng");
        const result = await pool.request().query(`
            SELECT DI_REF, SKU_NAME, LATEST_PREPARE_QTY, STATUS
            FROM stock_summary
            WHERE STATUS != 'ตรวจจ่ายเรียบร้อย'  -- ✅ กรองที่ SQL
            ORDER BY UPDATE_DATE DESC
        `);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("Error fetching stock status:", error);
        res.status(500).json({ success: false, message: "Database error" });
    }
});

app.get('/api/product-categories', async (req, res) => {
    try {
        const pool = await getPool("HS54"); // ✅ เชื่อมต่อ HS54
        const result = await pool.request().query("SELECT ICCAT_KEY, ICCAT_NAME FROM ICCAT ORDER BY ICCAT_NAME");
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("❌ Error fetching product categories from HS54:", error);
        res.status(500).json({ success: false, message: "Database error" });
    }
});

app.post('/api/search-preparation', async (req, res) => {
    const { category, status, documentId } = req.body;

    try {
        const pool = await getPool("TestOng");
        const request = pool.request(); // ✅ ต้องสร้าง request ก่อนใช้

        let query = `
            SELECT 
                DI_REF AS DocumentID, 
                SKU_WL AS StorageLocation, 
                ICCAT_KEY AS ProductCategory, 
                SKU_CODE AS ProductCode, 
                SKU_NAME AS ProductName, 
                TOTAL_SKU_QTY AS SoldQty, 
                Total_CR_QTY AS ReceivedQty, 
                REMAINING_QTY AS PendingQty, 
                LATEST_PREPARE_QTY, 
                STATUS AS Status
            FROM stock_summary
            WHERE SKU_WL IN ('Warehouse', 'Store/Warehouse') 
        `;

        if (category && category !== "all") {
            query += ` AND ICCAT_KEY LIKE @Category`; // ✅ เปลี่ยนเป็น ICCAT_KEY
            request.input('Category', sql.NVarChar, `%${category}%`);
        }
        if (status && status !== "all") {
            query += ` AND STATUS LIKE @Status`; // ✅ เปลี่ยนเป็น STATUS
            request.input('Status', sql.NVarChar, `%${status}%`);
        }
        if (documentId) {
            query += ` AND DI_REF LIKE @DocumentID`; // ✅ เปลี่ยนเป็น DI_REF
            request.input('DocumentID', sql.NVarChar, `%${documentId}%`);
        }

        query += `
            ORDER BY 
                CASE WHEN STATUS = 'รอการจัดเตรียม' THEN 1 ELSE 2 END, 
                CREATE_DATE ASC
        `;

        // console.log("Executing Query:", query); // ✅ Debug Query
        const result = await request.query(query);
        // console.log("Query Result:", result.recordset); // ✅ Debug Response

        if (!result.recordset || result.recordset.length === 0) {
            return res.json({ success: true, data: [] }); // ✅ ป้องกัน undefined
        }

        res.json({ success: true, data: result.recordset });

    } catch (error) {
        console.error("Database Error:", error);
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
    const { DI_REF, ProductCode, PreparedQty, Username } = req.body;
    const PreparedBy = Username || "ระบบ"; // ให้ดึงจาก session user หรือใส่ "ระบบ" ถ้าไม่มีค่า

    try {
        if (!DI_REF || !ProductCode || PreparedQty === undefined) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const pool = await getPool("TestOng");;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        // ✅ อัปเดต `stock_summary`
        await transaction.request()
        .input('DI_REF', sql.NVarChar, DI_REF)
        .input('SKU_CODE', sql.NVarChar, ProductCode)
        .input('LATEST_PREPARE_QTY', sql.Int, PreparedQty)
        .input('UPDATE_DATE', sql.DateTime, new Date())
        .input('UPDATE_BY', sql.NVarChar, PreparedBy)
        .input('STATUS', sql.NVarChar, "จัดเตรียมสำเร็จ")
        .query(`
            UPDATE stock_summary
            SET 
                LATEST_PREPARE_QTY = @LATEST_PREPARE_QTY, 
                STATUS = @STATUS, 
                UPDATE_DATE = @UPDATE_DATE, 
                UPDATE_BY = @UPDATE_BY
            WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE
        `);

        // ✅ ดึงค่า ICCAT_CODE และ ICCAT_NAME จาก stock_summary
        const iccatQuery = await transaction.request()
        .input('DI_REF', sql.NVarChar, DI_REF)
        .input('SKU_CODE', sql.NVarChar, ProductCode)
        .query(`
            SELECT ICCAT_CODE, ICCAT_NAME 
            FROM stock_summary 
            WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE
        `);

    const { ICCAT_CODE, ICCAT_NAME } = iccatQuery.recordset[0] || { ICCAT_CODE: null, ICCAT_NAME: null };

    // ✅ ถ้าหาไม่เจอให้แจ้งเตือนและไม่ทำการ INSERT
    if (!ICCAT_CODE || !ICCAT_NAME) {
    throw new Error(`ICCAT_CODE หรือ ICCAT_NAME ไม่พบสำหรับ SKU_CODE: ${ProductCode}`);
    }

    // ✅ บันทึกข้อมูลลง preparationRecords
    await transaction.request()
    .input('DI_REF', sql.NVarChar, DI_REF)
    .input('SKU_CODE', sql.NVarChar, ProductCode)
    .input('ICCAT_CODE', sql.NVarChar, ICCAT_CODE) // ✅ เพิ่ม ICCAT_CODE
    .input('ICCAT_NAME', sql.NVarChar, ICCAT_NAME) // ✅ เพิ่ม ICCAT_NAME
    .input('PREPARE_QTY', sql.Int, PreparedQty)
    .input('PreparedBy', sql.NVarChar, PreparedBy)
    .input('Timestamp', sql.DateTime, new Date())
    .input('Status', sql.NVarChar, "จัดเตรียมสำเร็จ")
    .query(`
        INSERT INTO preparationRecords (DI_REF, SKU_CODE, ICCAT_CODE, ICCAT_NAME, PREPARE_QTY, PreparedBy, Timestamp, Status)
        VALUES (@DI_REF, @SKU_CODE, @ICCAT_CODE, @ICCAT_NAME, @PREPARE_QTY, @PreparedBy, @Timestamp, @Status)
    `);

        await transaction.commit();
        res.json({ success: true, message: "Preparation saved successfully!" });

    } catch (error) {
        console.error("Error saving preparation:", error);
        res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
});


app.post('/search1', async (req, res) => {
    const { reference } = req.body;

    if (!reference) {
        return res.status(400).json({ success: false, message: 'Reference is required' });
    }

    try {
        const pool = await getPool("TestOng");

        // เช็คข้อมูลจาก QUERY1
        const query1Result = await pool.request()
            .input('DI_REF', sql.VarChar, reference)
            .query(`
                SELECT
                    CONVERT(INT,ID) AS IDENT,
                    DI_REF,
                    CONVERT(VARCHAR,DI_DATE,105) as DI_DATE,
                    CONVERT(INT, LATEST_ROUND) as LATEST_ROUND,
                    SKU_CODE, 
                    SKU_WL, 
                    SKU_NAME,
                    ICCAT_KEY,
                    ICCAT_CODE,
                    ICCAT_NAME,
                    TOTAL_SKU_QTY as QTY,
                    TOTAL_CR_QTY,
                    REMAINING_QTY as REMAIN_QTY,
                    CONVERT(INT, ISNULL(LATEST_PREPARE_QTY, 0)) AS LATEST_PREPARE_QTY,
                    STATUS
                FROM
                    Stock_Summary
                WHERE
                    DI_REF = @DI_REF 
            `);

        // ถ้ามีข้อมูลจาก QUERY1 ส่งข้อมูลกลับ
        if (query1Result.recordset.length > 0) {
            res.json({ success: true, data: query1Result.recordset });
        } else {
            // ถ้าไม่มีข้อมูลใน QUERY1, ใช้ Connection `HS54` สำหรับ QUERY2
            const pool2 = await getPool("HS54");
            const query2Result = await pool2.request()
                .input('DI_REF', sql.VarChar, reference)
                .query(`
                    SELECT 
                        0 AS IDENT, 
                        DI_REF, 
                        CONVERT(VARCHAR, DI_DATE, 105) AS DI_DATE, 
                        0 AS LATEST_ROUND, 
                        SKU_CODE, 
                         CASE 
                            WHEN SKU_WL = 1 THEN 'Warehouse'
                            WHEN SKU_WL = 2 THEN 'Store/Warehouse'
                            WHEN SKU_WL = 3 THEN 'Store'
                            ELSE 'Unknown'
                        END AS SKU_WL, 
                        SKU_NAME,
                        ICCAT.ICCAT_KEY,
                        ICCAT.ICCAT_CODE,
                        ICCAT.ICCAT_NAME,
                        ABS(SKM_QTY) AS REMAIN_QTY, 
                        ABS(SKM_QTY) AS QTY, 
                        0 AS TOTAL_CR_QTY,  
                        0 AS LATEST_PREPARE_QTY,
	                    '' AS STATUS
                    FROM 
                        DOCINFO
                        INNER JOIN DOCTYPE ON DOCINFO.DI_DT = DOCTYPE.DT_KEY
                        INNER JOIN SKUMOVE ON DOCINFO.DI_KEY = SKUMOVE.SKM_DI
                        INNER JOIN SKUMASTER ON SKUMOVE.SKM_SKU = SKUMASTER.SKU_KEY
                        INNER JOIN ICCAT ON SKUMASTER.SKU_ICCAT = ICCAT.ICCAT_KEY
                    WHERE
                        DI_REF = @DI_REF
                `);

            // ส่งผลลัพธ์จาก QUERY2 ถ้าไม่พบข้อมูลจาก QUERY1
            if (query2Result.recordset.length > 0) {
                res.json({ success: true, data: query2Result.recordset });
            } else {
                res.json({ success: false, message: 'No data found in both queries.' });
            }
        }
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
    });     


// API สำหรับ Insert ข้อมูลจาก stock
app.post('/insert-stock-data', async (req, res) => {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
        return res.status(400).json({ success: false, message: "Invalid data format" });
    }

    try {
        let pool = await getPool("TestOng");
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        const request = new sql.Request(transaction);

        for (const [index, item] of data.entries()) {
            // Insert data into Stock table

            await request
                .input(`SRefNo_${index}`, sql.VarChar, item.RefNo)
                .input(`SRound_${index}`, sql.Int, item.Round)
                .input(`SLocation_${index}`, sql.VarChar, item.Location)
                .input(`SRefDate_${index}`, sql.Date, item.RefDate.split("-").reverse().join("-"))
                .input(`SProductCode_${index}`, sql.VarChar, item.ProductCode)
                .input(`SProductName_${index}`, sql.NVarChar, item.ProductName)
                .input(`SQuantitySold_${index}`, sql.Int, item.QuantitySold)
                .input(`SCheckQTY_${index}`, sql.Int, item.CheckQTY)
                .input(`SCreateBy_${index}`, sql.VarChar, item.CreateBy)
                .query(`
                    INSERT INTO Stock 
                    (DI_REF, CHECKROUND, DI_DATE, SKU_WL, SKU_CODE, SKU_NAME, SKU_QTY, CR_QTY, CREATE_BY, UPDATE_DATE, UPDATE_BY)
                    VALUES 
                    (@SRefNo_${index}, @SRound_${index}, @SRefDate_${index},  @SLocation_${index}, @SProductCode_${index}, @SProductName_${index}, 
                    @SQuantitySold_${index}, @SCheckQTY_${index}, @SCreateBy_${index}, GETDATE(), @SCreateBy_${index})
                `);

            // Calculate remaining quantity and insert into Stock_Summary table
            // const remainingQuantity = item.QuantitySold - item.CheckQTY;  // Calculating remaining quantity
            const CRQTY = item.TotalCR + item.CheckQTY;

            if(item.ID==0){
                await request
                .input(`DI_REF_${index}`, sql.VarChar, item.RefNo)
                .input(`DI_DATE_${index}`, sql.Date, item.RefDate.split("-").reverse().join("-"))
                .input(`SKU_WL_${index}`, sql.VarChar, item.Location)
                .input(`ICCAT_KEY_${index}`, sql.Int, item.CATKEY)
                .input(`LTRound_${index}`, sql.Int, item.Round)

                // .input(`RefDate_${index}`, sql.Date, item.RefDate.split("-").reverse().join("-"))
                .input(`ProductCode_${index}`, sql.VarChar, item.ProductCode)
                .input(`ProductName_${index}`, sql.NVarChar, item.ProductName)
                .input(`QuantitySold_${index}`, sql.Int, item.QuantitySold)
                .input(`TOTAL_CR_QTY_${index}`, sql.Int, CRQTY)      // Total CR quantity
                .input(`REMAINING_QTY_${index}`, sql.Int, item.RemainQTY) // Remaining quantity
                .input(`LATEST_PREPARE_QTY_${index}`, sql.Int, item.LatestPPQTY)
                .input(`Status_${index}`, sql.NVarChar, item.Status)
                .input(`CreateBy_${index}`, sql.VarChar, item.CreateBy)
                .input(`ICCAT_CODE_${index}`, sql.NVarChar, item.CATCODE)
                .input(`ICCAT_NAME_${index}`, sql.NVarChar, item.CATNAME)
                .query(`
                    INSERT INTO
                        Stock_Summary (
                            DI_REF,
                            DI_DATE,
                            SKU_WL,
                            ICCAT_KEY,
                            LATEST_ROUND,
                            SKU_CODE,
                            SKU_NAME,
                            TOTAL_SKU_QTY,
                            TOTAL_CR_QTY,
                            REMAINING_QTY,
                            LATEST_PREPARE_QTY,
                            status,
                            CREATE_BY,
                            UPDATE_DATE,
                            UPDATE_BY,
                            ICCAT_CODE,
                            ICCAT_NAME
                        ) VALUES (
                            @DI_REF_${index},
                            @DI_DATE_${index},
                            @SKU_WL_${index},
                            @ICCAT_KEY_${index},
                            @LTRound_${index},
                            @ProductCode_${index},
                            @ProductName_${index}, 
                            @QuantitySold_${index},
                            @TOTAL_CR_QTY_${index},
                            @REMAINING_QTY_${index},
                            @LATEST_PREPARE_QTY_${index},
                            @Status_${index},
                            @CreateBy_${index},
                            GETDATE(),
                            @CreateBy_${index},
                            @ICCAT_CODE_${index},
                            @ICCAT_NAME_${index}
                        )
                `);
            }else{
                await request
                .input(`ident_${index}`, sql.Int, item.ID)
                .input(`CKROUND_${index}`, sql.Int, item.Round)
                .input(`LATEST_PREPARE_QTY_${index}`, sql.Int, item.LatestPPQTY)
                .input(`Status_${index}`, sql.NVarChar, item.Status)
                .input(`TOTAL_CR_QTY_${index}`, sql.Int, CRQTY)      // Total CR quantity
                .input(`REMAINING_QTY_${index}`, sql.Int, item.RemainQTY) // Remaining quantity
                .input(`Updateby_${index}`, sql.VarChar, item.CreateBy)
                .query(`
                    UPDATE Stock_Summary 
                    SET 
                        LATEST_ROUND = @CKROUND_${index},
                        TOTAL_CR_QTY = @TOTAL_CR_QTY_${index},
                        REMAINING_QTY = @REMAINING_QTY_${index},
                        LATEST_PREPARE_QTY = @LATEST_PREPARE_QTY_${index},
                        status = @Status_${index},
                        UPDATE_DATE = GETDATE(),
                        UPDATE_BY = @Updateby_${index}
                    WHERE id = @ident_${index}
                `);
            }
            
        }

        await transaction.commit();
        res.json({ success: true, message: "Data inserted successfully" });
    } catch (err) {
        console.error("Database error:", err);
        await transaction.rollback();
        res.status(500).json({ success: false, message: "Failed to insert data" });
    }
});

app.post("/api/get-stock-transactions", async (req, res) => {
    try {
        const { DI_REF, CHECKROUND } = req.body;
        const pool = await getPool("TestOng");
        const request = pool.request();

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
            WHERE 1=1
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
    const { ID, DI_REF, SKU_CODE, NEW_CR_QTY, Username } = req.body;
    // console.error("Check:", req.body);
    if (!ID || !DI_REF || !SKU_CODE || NEW_CR_QTY === undefined || !Username) {
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
            WHERE DI_REF = @DI_REF AND SKU_CODE = @SKU_CODE
        `;
        const summaryRequest = new sql.Request(transaction);
        summaryRequest.input("DI_REF", sql.NVarChar, DI_REF);
        summaryRequest.input("SKU_CODE", sql.NVarChar, SKU_CODE);
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
        updateStockRequest.input("NEWCRQTY", sql.Int, NEW_CR_QTY);
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
        WHERE DI_REF = @DIREF AND SKU_CODE = @SKUCODE
        `;
        const updateSummaryRequest = new sql.Request(transaction);
        updateSummaryRequest.input("TOTALCRQTY", sql.Int, NEW_TOTAL_CR_QTY);
        updateSummaryRequest.input("UPDATEDREMAININGQTY", sql.Int, UPDATED_REMAINING_QTY);
        updateSummaryRequest.input("UPDATEBY", sql.VarChar, Username);
        updateSummaryRequest.input("DIREF", sql.VarChar, DI_REF);
        updateSummaryRequest.input("SKUCODE", sql.VarChar, SKU_CODE);
        await updateSummaryRequest.query(updateSummaryQuery);

        await transaction.commit();
        res.json({ success: true, message: "Stock summary updated successfully!" });

    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ success: false, message: "Database error" });
    }
});






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
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
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



