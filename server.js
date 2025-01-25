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

app.post('/search1', async (req, res) => {
    const { reference } = req.body;

    if (!reference) {
        return res.status(400).json({ success: false, message: 'Reference is required' });
    }

    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('DI_REF', sql.VarChar, reference) // ใช้ parameter เพื่อป้องกัน SQL Injection
            .query(`
                SELECT DI_REF, CONVERT(VARCHAR,DI_DATE,105) as DI_DATE, DI_AMOUNT, SKM_QTY, SKU_CODE, SKU_NAME, SKM_QTY as 'QTY'
                FROM DOCINFO, DOCTYPE, SKUMASTER, SKUMOVE 
                WHERE DI_REF = @DI_REF
            `);

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset });
        } else {
            res.json({ success: false, message: 'No data found for the given reference.' });
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
            await request
                .input(`RefNo_${index}`, sql.VarChar, item.RefNo)
                .input(`Round_${index}`, sql.Int, item.Round)
                .input(`RefDate${index}`, sql.Date, item.RefDate)
                .input(`ProductCode_${index}`, sql.VarChar, item.ProductCode)
                .input(`ProductName_${index}`, sql.VarChar, item.ProductName)
                .input(`QuantitySold_${index}`, sql.Int, item.QuantitySold)
                .input(`CheckQTY_${index}`, sql.Int, item.CheckQTY)
                .input(`CreateBy_${index}`, sql.VarChar, item.CreateBy)
                .query(`
                    INSERT INTO Stock (DI_REF, CHECKROUND, DI_DATE, SKU_CODE, SKU_NAME, SKU_QTY, CR_QTY, CREATE_BY, UPDATE_DATE, UPDATE_BY)
                    VALUES (@RefNo_${index}, @Round_${index}, @RefDate${index}, @ProductCode_${index}, @ProductName_${index}, @QuantitySold_${index}, @CheckQTY_${index}, @CreateBy_${index}, GETDATE(), @CreateBy_${index})
                `);
        }


        await transaction.commit();
        res.json({ success: true, message: "Data inserted successfully" });
    } catch (err) {
        console.error("Database error:", err);
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



