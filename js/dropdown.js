document.addEventListener('DOMContentLoaded', async () => {
    const dropdown = document.getElementById('productDropdown');
    const dataTableBody = document.querySelector('#dataTable tbody');
    
    // โหลดข้อมูล Dropdown
    try {
      const response = await fetch('/api/dropdown-data');
      const { data } = await response.json();
  
      data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.ICCAT_KEY;
        option.textContent = `${item.ICCAT_CODE} - ${item.ICCAT_NAME}`;
        dropdown.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading dropdown:', error);
    }

    // Event เมื่อเลือก Dropdown
  dropdown.addEventListener('change', async (e) => {
    const categoryKey = e.target.value;
    
    if (!categoryKey) {
      dataTableBody.innerHTML = ''; // ล้างตารางหากไม่เลือกค่า
      return;
    }

    try {
      const response = await fetch('/api/products-by-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryKey })
      });
      
      const { data } = await response.json();
      updateTable(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  });

  // ฟังก์ชันอัปเดตตาราง
  function updateTable(products) {
    dataTableBody.innerHTML = ''; // ล้างข้อมูลเดิม

    products.forEach((product, index) => {
      const row = `
        <tr>
          <td>${index + 1}</td>
          <td>${product.DI_REF}</td>
          <td>${product.ICCAT_CODE}</td>
          <td>${product.ICCAT_NAME}</td>
          <td>${product.SKM_QTY}</td>
          <td><input type="text" placeholder="0"></td>
          <td></td>
        </tr>
      `;
      dataTableBody.insertAdjacentHTML('beforeend', row);
    });
  }
  });