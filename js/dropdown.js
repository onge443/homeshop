// กำหนดค่าเริ่มต้นสำหรับ Pagination
let currentPage = 1;
let pageSize = 10;
async function searchPreparation() {
    
    const branch = localStorage.getItem("branch_code");
    const start = (currentPage - 1) * pageSize;
    console.log(`searchPreparation: currentPage=${currentPage}, start=${start}, pageSize=${pageSize}`);
    try {
        const responselist = await fetch('/api/search-preparation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                branch: branch,
                start: start,
                length: pageSize,
                status: window.selectedStatus, // ส่งค่า status ที่เลือกจากปุ่ม
                category: document.getElementById("filterCategory").value,
                documentID: document.getElementById("filterDocument").value
                // เพิ่ม filter อื่นๆ ถ้ามี
            })
        });
        const datalist = await responselist.json();
        console.log("API response:", datalist);

        if (!datalist.success){
            console.error("API Error:", datalist.message || "No error message provided");
            throw new Error("Failed to load");
        } 

        // คำนวณจำนวนหน้าจาก totalRecords ที่ส่งกลับมาจาก API
        const totalPages = Math.ceil(datalist.recordsTotal / pageSize);
        // ถ้า currentPage มากกว่าจำนวนหน้าที่แท้จริงและยังมีข้อมูล (totalRecords > 0) ให้ปรับ currentPage และเรียก searchPreparation ใหม่
        if (totalPages > 0 && datalist.data.length === 0 && currentPage > totalPages) {
            currentPage = totalPages;
            searchPreparation();
            return;
        }

        const PrepareList = document.getElementById('PrepareList');
        PrepareList.innerHTML = ""; // ล้างข้อมูลเก่า

        // เพิ่มหมวดหมู่ที่ได้จาก API
        datalist.data.forEach(stocklists => {
            const btnDisabled = (stocklists.canStart === 0) ? 'disabled' : '';
            let btncolor = "";
            if(stocklists.canStart == 0){
                btncolor ="btn-secondary";
            } else {
                btncolor ="btn-success";
            }
            PrepareList.innerHTML += `
                <a href="#" class="list-group-item list-group-item-action" aria-current="true">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">${stocklists.AR_NAME}</h5>
                    <button class="btn ${btncolor} btn-detail" data-doc="${stocklists.DocumentID}" ${btnDisabled}>
                    เปิดเอกสาร
                    </button>
                </div>
                <p class="mb-1">${stocklists.DocumentID}</p>
                <p class="mb-1">วันที่เอกสาร: ${stocklists.DI_DATE}</p>
                </a>
            `;
        });
        // อัปเดต Pagination โดยใช้จำนวน record ทั้งหมดที่ส่งกลับจาก API
        updatePagination(datalist.recordsTotal);

    } catch (error) {
        console.error("❌ Error loading:", error);
    } 
}
// ฟังก์ชันอัปเดต Pagination Control
function updatePagination(totalRecords) {
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = ""; // ล้างข้อมูลเก่า
    const totalPages = Math.ceil(totalRecords / pageSize);
    
    if (totalPages <= 1) return;  // ไม่แสดง pagination หากมีหน้ารวมไม่เกิน 1 หน้า
  
    const maxVisiblePages = 7; // จำนวนหน้าสูงสุดที่จะแสดงใน bar
    let startPage, endPage;
  
    if (totalPages <= maxVisiblePages) {
      // ถ้าจำนวนหน้ารวมไม่เกิน maxVisiblePages ให้แสดงทุกหน้า
      startPage = 1;
      endPage = totalPages;
    } else {
      // คำนวณช่วงหน้าที่จะแสดง โดยให้ currentPage อยู่ตรงกลาง (ถ้าเป็นไปได้)
      const half = Math.floor(maxVisiblePages / 2);
      if (currentPage <= half + 1) {
        startPage = 1;
        endPage = maxVisiblePages;
      } else if (currentPage + half >= totalPages) {
        startPage = totalPages - maxVisiblePages + 1;
        endPage = totalPages;
      } else {
        startPage = currentPage - half;
        endPage = currentPage + half;
      }
    }
  
    const ul = document.createElement("ul");
    ul.className = "pagination";
  
    // ปุ่ม Previous
    const prevLi = document.createElement("li");
    prevLi.className = currentPage === 1 ? "page-item disabled" : "page-item";
    const prevLink = document.createElement("a");
    prevLink.className = "page-link";
    prevLink.href = "#";
    prevLink.textContent = "Previous";
    prevLink.addEventListener("click", function(e) {
      e.preventDefault();
      if (currentPage > 1) {
        currentPage--;
        searchPreparation();
      }
    });
    prevLi.appendChild(prevLink);
    ul.appendChild(prevLi);
  
    // ถ้า startPage > 1 ให้แสดงปุ่มหน้าแรกและ ellipsis
    if (startPage > 1) {
      const firstLi = document.createElement("li");
      firstLi.className = "page-item";
      const firstLink = document.createElement("a");
      firstLink.className = "page-link";
      firstLink.href = "#";
      firstLink.textContent = "1";
      firstLink.addEventListener("click", function(e) {
        e.preventDefault();
        currentPage = 1;
        searchPreparation();
      });
      firstLi.appendChild(firstLink);
      ul.appendChild(firstLi);
  
      if (startPage > 2) {
        const ellipsis = document.createElement("li");
        ellipsis.className = "page-item disabled";
        const span = document.createElement("span");
        span.className = "page-link";
        span.textContent = "...";
        ellipsis.appendChild(span);
        ul.appendChild(ellipsis);
      }
    }
  
    // แสดงหมายเลขหน้าที่อยู่ในช่วงที่คำนวณได้
    for (let i = startPage; i <= endPage; i++) {
      const li = document.createElement("li");
      li.className = (i === currentPage) ? "page-item active" : "page-item";
      const a = document.createElement("a");
      a.className = "page-link";
      a.href = "#";
      a.textContent = i;
      a.addEventListener("click", function(e) {
        e.preventDefault();
        currentPage = i;
        searchPreparation();
      });
      li.appendChild(a);
      ul.appendChild(li);
    }
  
    // ถ้า endPage < totalPages ให้แสดง ellipsis และปุ่มหน้าสุดท้าย
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ellipsis = document.createElement("li");
        ellipsis.className = "page-item disabled";
        const span = document.createElement("span");
        span.className = "page-link";
        span.textContent = "...";
        ellipsis.appendChild(span);
        ul.appendChild(ellipsis);
      }
  
      const lastLi = document.createElement("li");
      lastLi.className = "page-item";
      const lastLink = document.createElement("a");
      lastLink.className = "page-link";
      lastLink.href = "#";
      lastLink.textContent = totalPages;
      lastLink.addEventListener("click", function(e) {
        e.preventDefault();
        currentPage = totalPages;
        searchPreparation();
      });
      lastLi.appendChild(lastLink);
      ul.appendChild(lastLi);
    }
  
    // ปุ่ม Next
    const nextLi = document.createElement("li");
    nextLi.className = currentPage === totalPages ? "page-item disabled" : "page-item";
    const nextLink = document.createElement("a");
    nextLink.className = "page-link";
    nextLink.href = "#";
    nextLink.textContent = "Next";
    nextLink.addEventListener("click", function(e) {
      e.preventDefault();
      if (currentPage < totalPages) {
        currentPage++;
        searchPreparation();
      }
    });
    nextLi.appendChild(nextLink);
    ul.appendChild(nextLi);
  
    paginationContainer.appendChild(ul);
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

            // เคลียร์ตารางที่แสดงอยู่ก่อนโหลดข้อมูลใหม่
            const prepareList = document.getElementById('PrepareList');
            if (prepareList) {
                prepareList.innerHTML = "";
            }
            const paginationContainer = document.getElementById('pagination');
            if (paginationContainer) {
                paginationContainer.innerHTML = "";
            }
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
    // document.addEventListener("click", function(event) {
    //     if (event.target.classList.contains("btn-detail")) {
    //         const docID = event.target.getAttribute("data-doc");
    //         if (!docID) return;
    //         const branch = localStorage.getItem("branch_code");
    //         const categoryDropdown = document.getElementById("filterCategory");
    //         const username = localStorage.getItem("username");
    //         // เรียก API เพื่อเปลี่ยนสถานะเป็น 2 (รอการจัด)
    //         fetch('/api/update-status', {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify({ DI_REF: docID, branch: branch ,category :categoryDropdown.value,username: username})
    //         })
    //         .then(response => response.json())
    //         .then(result => {
    //         if (result.success) {
    //             // เมื่ออัปเดตสถานะสำเร็จ ให้เปลี่ยนหน้าไปยัง prepdetail.html
    //             // const categoryDropdown = document.getElementById("filterCategory");
    //             const category = categoryDropdown ? categoryDropdown.value : "all";
    //             const SearchStatus = window.selectedStatus;
    //             window.location.href = `/prepdetail?di_ref=${encodeURIComponent(docID)}&category=${encodeURIComponent(category)}&SearchStatus=${encodeURIComponent(SearchStatus)}`;
    //         } else {
    //             alert("Failed to update status: " + result.message);
    //         }
    //         })
    //         .catch(error => {
    //         console.error("Error updating status:", error);
    //         alert("Error updating status.");
    //         });
    //     }
    //     });
   // Event listener สำหรับปุ่ม "เริ่มจัด"
// document.addEventListener("click", function(event) {
//   if (event.target.classList.contains("btn-detail")) {
//       const docID = event.target.getAttribute("data-doc");
//       if (!docID) return;
//       const branch = localStorage.getItem("branch_code");
//       const categoryDropdown = document.getElementById("filterCategory");
//       const username = localStorage.getItem("username");

//       // เรียก API /api/update-status ซึ่งได้รวมฟังก์ชันล็อกและอัปเดทสถานะไว้แล้ว
//       fetch('/api/update-status', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ 
//               DI_REF: docID, 
//               branch: branch,
//               category: categoryDropdown.value,
//               username: username 
//           })
//       })
//       .then(response => response.json())
//       .then(result => {
//           if (result.success) {
//               // เมื่อ response success แปลว่า record นั้นไม่ถูกล็อกโดยคนอื่นหรือถูกล็อกโดย currentUser
//               // เปลี่ยนหน้าไปยัง prepdetail.html
//               window.location.href = `/prepdetail?di_ref=${encodeURIComponent(docID)}&category=${encodeURIComponent(categoryDropdown.value)}&SearchStatus=${encodeURIComponent(window.selectedStatus)}`;
//           } else {
//               // ถ้า response ไม่ success (เช่น record ถูกล็อกโดยคนอื่น)
//               alert("ไม่สามารถเปิดเอกสารได้: " + result.message);
//           }
//       })
//       .catch(error => {
//           console.error("Error updating status:", error);
//           alert("เกิดข้อผิดพลาดในการเปิดเอกสาร");
//       });
//   }
// });
document.getElementById('PrepareList').addEventListener('click', function(e) {
  const target = e.target.closest('.btn-detail');
  if (target) {
      e.preventDefault();
      const docID = target.getAttribute("data-doc");
      if (!docID) return;
      
      const categoryDropdown = document.getElementById("filterCategory");
      const categoryValue = categoryDropdown ? categoryDropdown.value : "all";
      const currentSearchStatus = window.selectedStatus;
      
      window.location.href = `/prepdetail?di_ref=${encodeURIComponent(docID)}&category=${encodeURIComponent(categoryValue)}&SearchStatus=${encodeURIComponent(currentSearchStatus)}`;
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


