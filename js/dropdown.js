async function searchPreparation() {
    $('#loadingModal').modal('show');
    const branch = localStorage.getItem("branch_code");
    try {
        const responselist = await fetch('/api/search-preparation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                branch: branch,
                start: 0,
                length: 100,
                status: window.selectedStatus, // ส่งค่า status ที่เลือกจากปุ่ม
                category: document.getElementById("filterCategory").value,
                documentID: document.getElementById("filterDocument").value
                // เพิ่ม filter อื่นๆ ถ้ามี
            })
        });
        const datalist = await responselist.json();

        if (!datalist.success){
            console.error("API Error:", datalist.message || "No error message provided");
            throw new Error("Failed to load");
        } 

        const PrepareList = document.getElementById('PrepareList');
        // เปลี่ยนเป็น filterCategory ให้ตรง HTML
        PrepareList.innerHTML = ""; //  ล้างค่าก่อนโหลดใหม่



        // เพิ่มหมวดหมู่ที่ได้จาก API
        datalist.data.forEach(stocklists => {
            PrepareList.innerHTML +=
            `<a href="#" class="list-group-item list-group-item-action" aria-current="true">
            <div class="d-flex w-100 justify-content-between">
                <h5 class="mb-1">${stocklists.AR_NAME}</h5>
                <button class="btn btn-success btn-detail" data-doc="${stocklists.DocumentID}">เริ่มจัด</button>
            </div>
            <p class="mb-1">${stocklists.DocumentID}</p>
            <p class="mb-1">วันที่เอกสาร: ${stocklists.DI_DATE}</p>
            </a>`;
        });


    } catch (error) {
        console.error("❌ Error loading:", error);
        
    
    } 
        finally {
        // ซ่อน loading modal หลังจาก delay เล็กน้อย
        setTimeout(() => {
            $('#loadingModal').modal('hide');
        }, 100); }
  
}


// ✅ โหลดข้อมูลประเภทสินค้า
async function loadProductCategories() {
    try {
        const response = await fetch('/api/product-categories');
        const data = await response.json();

        // console.log(" API Response:", data); // Debug เช็ค API ส่งข้อมูลมาให้จริงไหม

        if (!data.success) throw new Error("Failed to load categories");

        const categoryDropdown = document.getElementById("filterCategory"); // เปลี่ยนเป็น filterCategory ให้ตรง HTML
        categoryDropdown.innerHTML = ""; // ล้างค่าก่อนโหลดใหม่

        // พิ่มค่า "ทั้งหมด" เป็นค่าเริ่มต้น
        
        const defaultOption = document.createElement("option");
        defaultOption.value = "all";
        defaultOption.textContent = "ทั้งหมด";
        categoryDropdown.appendChild(defaultOption);
        

        // เพิ่มหมวดหมู่ที่ได้จาก API
        data.data.forEach(category => {
            const option = document.createElement("option");
            option.value = category.categoryCode;  // ส่ง categoryCode ไป API
            option.textContent = category.categoryName;  // แสดงชื่อหมวดหมู่ที่กำหนด
            categoryDropdown.appendChild(option);
        });

        // console.log("Dropdown Updated:", categoryDropdown.innerHTML); // Debug เช็คว่ามีการอัปเดต dropdown จริง

    } catch (error) {
        console.error("❌ Error loading categories:", error);
    }
}

const categoryMapping = {
    'A': 'เหล็ก',
    'K': 'โครงสร้าง',
    // 'M': 'ฮาร์ดแวร์',
    // 'O': 'เฟอร์นิเจอร์',
    // 'P': 'เกษตรและสวน',
    // 'Q': 'ไฟฟ้า',
    'R': 'เซรามิค'
    // 'S': 'สุขภัณฑ์',
    // 'T': 'สี',
    // 'V': 'ไม้'
  };
  function updateFilterDisplay() {
    const category = document.getElementById("filterCategory").value;
    const status = window.selectedStatus || "all";
    const currentCategoryEl = document.getElementById("currentCategory");
    const currentStatusEl = document.getElementById("currentStatus");

    let categoryText = category === "all" ? "ทั้งหมด" : (categoryMapping[category] || category);

    let statusText;
    switch (status) {
        case "1": statusText = "รอจัด"; break;
        case "2": statusText = "กำลังจัด"; break;
        case "3": statusText = "จัดบางส่วน"; break;
        case "4": statusText = "จัดเสร็จ"; break;
        case "5": statusText = "จ่ายบางส่วน"; break;
        case "6": statusText = "จ่ายทั้งหมด"; break;
        default: statusText = "ทั้งหมด";
    }

    if (currentCategoryEl) currentCategoryEl.textContent = categoryText;
    if (currentStatusEl) currentStatusEl.textContent = statusText;
}




// ✅ ฟังก์ชันที่ใช้ส่งค่าหมวดหมู่ไปที่ API เมื่อเลือก dropdown
document.getElementById("filterCategory").addEventListener("change", function() {
    // const selectedCategory = this.value; // ✅ ค่าที่เลือกจาก dropdown (A, K, M, O, ...)

    updateFilterDisplay();
});

// ฟังก์ชันโหลดปุ่มสถานะ (Status Buttons) ในหน้า tables2.html
async function loadStatusButtons() {
    const statusButtonsContainer = document.getElementById('statusButtons');
    if (!statusButtonsContainer) return;
    statusButtonsContainer.innerHTML = ''; // ล้างข้อมูลเดิม

    // กำหนดรายการสถานะที่ต้องการ (สามารถปรับแก้ได้ตามความเหมาะสม)
    const statuses = [
        { value: 'all', text: 'ทั้งหมด', class: 'btn-secondary' },
        { value: '1', text: 'รอจัด', class: 'btn-danger' },
        { value: '2', text: 'กำลังจัด', class: 'btn-pink' }, // btn-pink อาจต้องมี custom CSS
        { value: '3', text: 'จัดบางส่วน', class: 'btn-warning' },
        { value: '4', text: 'จัดเสร็จ', class: 'btn-success' },
        { value: '5', text: 'จ่ายบางส่วน', class: 'btn-info' },
        { value: '6', text: 'จ่ายทั้งหมด', class: 'btn-primary' }
    ];

    statuses.forEach(status => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn ${status.class} status-btn`;
        btn.dataset.status = status.value;
        btn.textContent = status.text;
        statusButtonsContainer.appendChild(btn);
    });

    // กำหนดค่าเริ่มต้น (เลือก "ทั้งหมด" เป็นค่า default)
    window.selectedStatus = 'all';

    // เพิ่ม event listener ให้กับปุ่มสถานะทุกปุ่ม
    document.querySelectorAll('.status-btn').forEach(button => {
        button.addEventListener('click', function() {
            // เอา active class ออกจากปุ่มทั้งหมด
            document.querySelectorAll('.status-btn').forEach(btn => btn.classList.remove('active'));
            // เพิ่ม active class ให้กับปุ่มที่ถูกคลิก
            this.classList.add('active');
            window.selectedStatus = this.dataset.status;
            updateFilterDisplay();

            // อัปเดต query string parameter "SearchStatus" โดยใช้ history.pushState
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.set('SearchStatus', window.selectedStatus);
            // หากต้องการรักษาค่า category ด้วย ให้ตรวจสอบและ set ค่า category ด้วย
            const categoryDropdown = document.getElementById("filterCategory");
            if (categoryDropdown && categoryDropdown.value) {
                urlParams.set('category', categoryDropdown.value);
            }
            // อัปเดต URL โดยไม่ reload หน้าใหม่
            history.pushState(null, '', '?' + urlParams.toString());
            
            // เรียกค้นหาข้อมูลใหม่ตามตัวกรองที่อัปเดตแล้ว (ใช้ฟังก์ชัน searchPreparation)
            // if (typeof searchPreparation === "function") {
            //     searchPreparation();
            // }
                });
            });
    }


document.addEventListener("DOMContentLoaded", async function() {
    
    
    // const cat ='all';
    // อ่านค่า query string เพื่อตั้งค่าตัวกรอง (เช่นในหน้า tables2.html)
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get("category");
    const statusParam = urlParams.get("SearchStatus");
    console.log("cat:"+categoryParam+" status:"+statusParam);
    await loadProductCategories();
    await loadStatusButtons();
    const categoryDropdown = document.getElementById("filterCategory");
  
    if (categoryParam) {
      if (categoryDropdown) {
        categoryDropdown.value = categoryParam;
      }
    }
    
    if (statusParam) {
      console.log("statusPara:"+statusParam);
      window.selectedStatus = statusParam;
    } else {
      window.selectedStatus = "all";
    }

    
    
    updateFilterDisplay();
    
    if (categoryParam && statusParam && typeof searchPreparation === "function") {
        searchPreparation();
      }


    // Event listener สำหรับปุ่มที่มี class "btn-detail"
    document.addEventListener("click", function(event) {
        if (event.target.classList.contains("btn-detail")) {
            const docID = event.target.getAttribute("data-doc");
            if (!docID) return;
            const branch = localStorage.getItem("branch_code");
            // เรียก API เพื่อเปลี่ยนสถานะเป็น 2 (รอการจัด)
            fetch('/api/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ DI_REF: docID, branch: branch })
            })
            .then(response => response.json())
            .then(result => {
            if (result.success) {
                // เมื่ออัปเดตสถานะสำเร็จ ให้เปลี่ยนหน้าไปยัง prepdetail.html
                const categoryDropdown = document.getElementById("filterCategory");
                const category = categoryDropdown ? categoryDropdown.value : "all";
                const SearchStatus = window.selectedStatus;
                window.location.href = `/prepdetail?di_ref=${encodeURIComponent(docID)}&category=${encodeURIComponent(category)}&SearchStatus=${encodeURIComponent(SearchStatus)}`;
            } else {
                alert("Failed to update status: " + result.message);
            }
            })
            .catch(error => {
            console.error("Error updating status:", error);
            alert("Error updating status.");
            });
        }
        });
    
  
  });

// }
// });
async function PrepareCheckRight() {
    const username = localStorage.getItem("username");
    const rights = localStorage.getItem("user_rights");

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

PrepareCheckRight();

document.getElementById("searchButton").addEventListener("click", searchPreparation);


