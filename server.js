const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const sql = require('mssql');

const { LocalStorage } = require('node-localstorage');

const app = express();

const port = 3000;

// การตั้งค่าการเชื่อมต่อ SQL Server
const config = {
    user: 'my_user', // db_user
    password: 'my_password', // db_password
    server: 'DESKTOP-3ISTS3L\\SQLEXPRESS', // db_server
    database: 'Test_ong', // db_name
    port: 1433, // port db
    options: {
        encrypt: false, // สำหรับ Azure หรือเซิร์ฟเวอร์ที่ต้องใช้การเข้ารหัส
        trustServerCertificate: true, // ใช้ในระหว่างการพัฒนาท้องถิ่น
    },
};

// เชื่อมต่อฐานข้อมูล
sql.connect(config).then(() => {
    console.log('Connected to the database successfully!');
}).catch(err => {
    console.error('Database connection failed:', err);
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// API สำหรับการสร้างผู้ใช้ใหม่ (Register)
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        // เข้ารหัสรหัสผ่านด้วย bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        let pool = await sql.connect(config);
        let result = await pool.request()
            .input('username', sql.VarChar, username)
            .input('password', sql.VarChar, hashedPassword)
            .query('INSERT INTO Users (username, password) VALUES (@username, @password)');

        res.json({ success: true, message: 'User registered successfully!' });
    } catch (err) {
        if (err.originalError && err.originalError.info && err.originalError.info.number === 2627) {
            res.status(400).json({ success: false, message: 'Username already exists!' });
        } else {
            console.error(err);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
});

// API สำหรับตรวจสอบการล็อกอิน
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        let pool = await sql.connect(config);
        let result = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT password FROM Users WHERE username = @username');
           
            // Getting EmployeeID to store in localstorage
            //.query('SELECT EmployeeID, password FROM Users WHERE username = @username');

        if (result.recordset.length > 0) {
            const hashedPassword = result.recordset[0].password;

            // ตรวจสอบรหัสผ่าน
            const isMatch = await bcrypt.compare(password, hashedPassword);
            if (isMatch) {

                res.json({ success: true, redirect: '/dashboard' }); // JSON response
                
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

app.get('/api/product-categories', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT ICCAT_KEY, ICCAT_NAME FROM ICCAT ORDER BY ICCAT_NAME
        `);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("Error fetching product categories:", error);
        res.status(500).json({ success: false, message: "Database error" });
    }
});

app.post('/api/search-preparation', async (req, res) => {
    const { category, status, documentId } = req.body;

    try {
        const pool = await sql.connect(config);
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

        console.log("Executing Query:", query); // ✅ Debug Query
        const result = await request.query(query);
        console.log("Query Result:", result.recordset); // ✅ Debug Response

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
        const pool = await sql.connect(config);
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

        const pool = await sql.connect(config);
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
        const pool = await sql.connect(config);

        // เช็คข้อมูลจาก QUERY1
        const query1Result = await pool.request()
            .input('DI_REF', sql.VarChar, reference)
            .query(`
                SELECT CONVERT(INT,ID) AS IDENT, DI_REF, CONVERT(VARCHAR,DI_DATE,105) as DI_DATE, CONVERT(INT, LATEST_ROUND) as LATEST_ROUND, SKU_WL, SKU_CODE, SKU_NAME, TOTAL_SKU_QTY as QTY, TOTAL_CR_QTY, REMAINING_QTY as REMAIN_QTY, CONVERT(INT, LATEST_PREPARE_QTY) AS LATEST_PREPARE_QTY
                FROM Stock_Summary
                WHERE DI_REF = @DI_REF 
            `);

        // ถ้ามีข้อมูลจาก QUERY1
        if (query1Result.recordset.length > 0) {
            res.json({ success: true, data: query1Result.recordset });
        } else {
            // ถ้าไม่มีข้อมูลใน QUERY1, ดึงข้อมูลจาก QUERY2
            const query2Result = await pool.request()
                .input('DI_REF', sql.VarChar, reference)
                .query(`
                  SELECT 0 AS IDENT, DI_REF, CONVERT(VARCHAR,DI_DATE,105) as DI_DATE, 0 as LATEST_ROUND, SKU_CODE, SKU_WL, SKU_NAME, ABS(SKM_QTY) as REMAIN_QTY, ABS(SKM_QTY) as QTY, 0 as TOTAL_CR_QTY,  0 AS LATEST_PREPARE_QTY
                  FROM DOCINFO, DOCTYPE, SKUMASTER, SKUMOVE 
                  WHERE DI_REF = @DI_REF
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
        let pool = await sql.connect(config);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        const request = new sql.Request(transaction);

        for (const [index, item] of data.entries()) {
            // Insert data into Stock table

            await request
                .input(`RefNo_${index}`, sql.VarChar, item.RefNo)
                .input(`Round_${index}`, sql.Int, item.Round)
                .input(`RefDate_${index}`, sql.Date, item.RefDate.split("-").reverse().join("-"))
                .input(`ProductCode_${index}`, sql.VarChar, item.ProductCode)
                .input(`ProductName_${index}`, sql.VarChar, item.ProductName)
                .input(`QuantitySold_${index}`, sql.Int, item.QuantitySold)
                .input(`CheckQTY_${index}`, sql.Int, item.CheckQTY)
                .input(`CreateBy_${index}`, sql.VarChar, item.CreateBy)
                .query(`
                    INSERT INTO Stock 
                    (DI_REF, CHECKROUND, DI_DATE, SKU_CODE, SKU_NAME, SKU_QTY, CR_QTY, CREATE_BY, UPDATE_DATE, UPDATE_BY)
                    VALUES 
                    (@RefNo_${index}, @Round_${index}, @RefDate_${index}, @ProductCode_${index}, @ProductName_${index}, 
                    @QuantitySold_${index}, @CheckQTY_${index}, @CreateBy_${index}, GETDATE(), @CreateBy_${index})
                `);

            // Calculate remaining quantity and insert into Stock_Summary table
            // const remainingQuantity = item.QuantitySold - item.CheckQTY;  // Calculating remaining quantity
            const CRQTY = item.TotalCR + item.CheckQTY;
            if(item.ID==0){
                // await request
                // .input(`DI_REF_${index}`, sql.VarChar, item.RefNo)
                // .input(`DI_DATE_${index}`, sql.Date, item.RefDate.split("-").reverse().join("-"))
                // .input(`SKU_WL_${index}`, sql.Int, item.Location)
                // .input(`Round_${index}`, sql.Int, item.Round)
                // // .input(`RefDate_${index}`, sql.Date, item.RefDate.split("-").reverse().join("-"))
                // .input(`ProductCode_${index}`, sql.VarChar, item.ProductCode)
                // .input(`ProductName_${index}`, sql.VarChar, item.ProductName)
                // .input(`QuantitySold_${index}`, sql.Int, item.QuantitySold)
                // .input(`CheckQTY_${index}`, sql.Int, item.CheckQTY)
                // .input(`CreateBy_${index}`, sql.VarChar, item.CreateBy)
                // .query(`
                //     INSERT INTO Stock_Summary
                //     (DI_REF, CHECKROUND, DI_DATE, SKU_CODE, SKU_NAME, SKU_QTY, CR_QTY, CREATE_BY, UPDATE_DATE, UPDATE_BY)
                //     VALUES 
                //     (@RefNo_${index}, @Round_${index}, @RefDate_${index}, @ProductCode_${index}, @ProductName_${index}, 
                //     @QuantitySold_${index}, @CheckQTY_${index}, @CreateBy_${index}, GETDATE(), @CreateBy_${index})
                // `);
            }else{
                await request
                .input(`ident_${index}`, sql.Int, item.ID)
                .input(`CKROUND_${index}`, sql.Int, item.Round)
                .input(`LATEST_PREPARE_QTY_${index}`, sql.Int, item.LatestPPQTY)
                .input(`Status_${index}`, sql.VarChar, item.Status)
                .input(`TOTAL_CR_QTY_${index}`, sql.Int, CRQTY)      // Total CR quantity
                .input(`REMAINING_QTY_${index}`, sql.Int, item.RemainQTY) // Remaining quantity
                .input(`Updateby_${index}`, sql.VarChar, item.CreateBy)
                .query(`
                    UPDATE Stock_Summary 
                    SET 
                        LATEST_ROUND = @CKROUND_${index},
                        TOTAL_SKU_QTY = @TOTAL_CR_QTY_${index},
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
    res.send('This is the login route. Use POST to submit your credentials.');
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



