document.addEventListener("DOMContentLoaded", function () {
    // Create Html5Qrcode instance
    CheckQTYCheckRight();

    // ดึงค่า username จาก localStorage
    const html5QrCode = new Html5Qrcode("reader");
            
    // Function when QR Code scan is successful
    async function onScanSuccess(decodedText) {
        // console.log("Decoded Text:", decodedText); // Debug
        try {

            // ส่งข้อมูลไปยัง API `/search1` เพื่อ Query ข้อมูลและอัปเดตตาราง
            const searchResponse = await fetch('/searchCheckQTY', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference: decodedText })
            });

            if (!searchResponse.ok) {
                throw new Error(`HTTP error during search! status: ${searchResponse.status}`);
            }

            const searchResult = await searchResponse.json();
            updateTable(searchResult);
            document.getElementById('reader').style.display = 'none';

        } catch (err) {
            console.error("Error during scan process:", err);
            document.getElementById('reader').style.display = 'none';
            alert("An error occurred. Please try again.");
        }
    }
    // Function when QR Code scan fails
    function onScanFailure(error) {
        console.warn("Scan Error:", error);
    }

    // Start scanning from camera
    Html5Qrcode.getCameras().then(cameras => {
        if (cameras && cameras.length) {
            html5QrCode.start(
                { facingMode: "environment" },  // ใช้กล้องหลัง
                {
                    fps: 10,                    // กำหนดค่า fps (frame rate)
                    qrbox: 250,
                    focusMode: "continuous",               // ขนาดของพื้นที่สแกน
                    formatsToSupport: [          // กำหนดให้รองรับหลายฟอร์แมต
                        Html5QrcodeSupportedFormats.QR_CODE,
                        Html5QrcodeSupportedFormats.DATA_MATRIX,
                        Html5QrcodeSupportedFormats.AZTEC,
                        Html5QrcodeSupportedFormats.UPC_E,
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.UPC_A
                    ]
                    
                },
                onScanSuccess,
                onScanFailure
            );
        } else {
            // console.log("No camera found.");
        document.getElementById('reader').style.display = 'none';
        }
    }).catch(err => {
        // console.log("Camera error:", err);
    document.getElementById('reader').style.display = 'none';
    });

    // Scan QR Code from uploaded image file
    document.getElementById("fileInput").addEventListener("change", async function (event) {
        const file = event.target.files[0];
        if (!file) {
            alert("No file selected.");
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            alert("Please upload a valid image file (.jpg, .png).");
                return;
        }
            try {
            
                const decodedText = await html5QrCode.scanFile(file, true);
                // alert("Decode."+`${decodedText}`);
                const response = await fetch('/searchCheckQTY', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reference: decodedText })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    // เพิ่มบรรทัดนี้เพื่อรับผลลัพธ์ JSON
                    const result1 = await response.json();
                    const StockList = document.getElementById("StockList");
                    StockList.innerHTML = ""; // เคลียร์ข้อมูลเก่า

                    result1.data.forEach(stocklist => {
                    StockList.innerHTML +=
                        `<a href="#" class="list-group-item list-group-item-action" aria-current="true">
                        <div class="d-flex w-100 justify-content-between">
                            <h5 class="mb-1">${stocklist.AR_NAME}</h5>
                            <button class="btn btn-success btn-detail" data-doc="${stocklist.DI_REF}">ตรวจจ่าย</button>
                        </div>
                        <p class="mb-1">${stocklist.DI_REF}</p>
                        <p class="mb-1">วันที่เอกสาร: ${stocklist.DI_DATE}</p>
                        </a>`;
                    });
                    
            } catch (err) {
                console.error("Error scanning file:", err);
                
                alert("Failed to decode QR Code. Please try again.");
            }
   
    });

    document.getElementById('searchForm1').addEventListener('submit', async (event) => {
    event.preventDefault();
    //const ref = document.getElementById('reference').value; // reference
    const dataarray = {
        reference: document.getElementById('reference').value, // reference
        // branch: localStorage.getItem("branch_code")
    };
    const response = await fetch('/searchCheckQTY', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataarray)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();

    const StockList = document.getElementById('StockList');
        // ✅ เปลี่ยนเป็น filterCategory ให้ตรง HTML
    StockList.innerHTML = ""; // ✅ ล้างค่าก่อนโหลดใหม่
    document.getElementById('labelCheckStockList').hidden=false;


        // ✅ เพิ่มหมวดหมู่ที่ได้จาก API
        result.data.forEach(stocklist => {
            StockList.innerHTML +=
            `<a href="#" class="list-group-item list-group-item-action" aria-current="true">
            <div class="d-flex w-100 justify-content-between">
                <h5 class="mb-1">${stocklist.AR_NAME}</h5>
                <button class="btn btn-success btn-detail" data-doc="${stocklist.DI_REF}">ตรวจจ่าย</button>
            </div>
            <p class="mb-1">${stocklist.DI_REF}</p>
            <p class="mb-1">วันที่เอกสาร: ${stocklist.DI_DATE}</p>
            </a>`;
        });
 
    
    });



    async function showAlert(text) {
        // สร้าง div สำหรับ Alert
        const alertDiv = document.createElement('div');
        alertDiv.classList.add('alert', 'alert-success', 'd-flex', 'align-items-center');
        alertDiv.setAttribute('role', 'alert');
        // กำหนดสไตล์ให้แสดงที่ด้านบนสุด
        alertDiv.style.position = "fixed";
        alertDiv.style.top = "10PX"; // เว้นจากขอบบนเล็กน้อย
        alertDiv.style.left = "50%";
        alertDiv.style.width = "40%";
        alertDiv.style.minWidth = "300px";
        alertDiv.style.textAlign = "center";
        alertDiv.style.transform = "translateX(-50%)"; // จัดให้อยู่ตรงกลาง
        alertDiv.style.zIndex = "9999"; // ให้ Alert อยู่ด้านบนสุด
        alertDiv.style.padding = "15px";
        alertDiv.style.fontSize = "16px";
        alertDiv.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.1)";

        // สร้าง svg ไอคอน
        const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgIcon.classList.add('bi', 'flex-shrink-0', 'me-2');
        svgIcon.setAttribute('width', '24');
        svgIcon.setAttribute('height', '24');
        svgIcon.setAttribute('role', 'img');
        svgIcon.setAttribute('aria-label', 'Success:');
        const useElement = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        useElement.setAttribute('xlink:href', '#check-circle-fill');
        svgIcon.appendChild(useElement);

        // สร้างข้อความใน Alert
        const alertText = document.createElement('div');
        alertText.textContent = text;

        // เพิ่มไอคอนและข้อความเข้าไปใน alertDiv
        alertDiv.appendChild(svgIcon);
        alertDiv.appendChild(alertText);

        // เพิ่ม alert ลงใน body หรือส่วนที่ต้องการ
        document.body.appendChild(alertDiv);

        // ปิด alert หลังจาก 5 วินาที
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }                               


    document.addEventListener("click", function(event) {
        if (event.target.classList.contains("btn-detail")) {
            const docID = event.target.getAttribute("data-doc");
            if (!docID) return; 
            window.location.href = `/Checkdetail?di_ref=${encodeURIComponent(docID)}`;
        }
      });
});

async function CheckQTYCheckRight() {
    
    const rights = localStorage.getItem("user_rights");
    const username = localStorage.getItem("username");
    try {
        if (username) {
            document.querySelector("#userDropdown span").textContent = username;
        }else{
            alert("กรุณาเข้าสู่ระบบก่อนใช้งาน");
            window.location.href = '/';
            return;
        }
    
        if (rights == 'user') {
            document.getElementById("Report").hidden = true;
            return;
        }



    } catch (error) {
        console.error("Error:", error);
    }
}

document.getElementById('logoutButton').addEventListener('click', function() {
    localStorage.clear();
    window.location.href = '/';
});

