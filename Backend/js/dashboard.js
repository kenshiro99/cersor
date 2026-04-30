// --- Configuration & Helpers ---
        const STORAGE_URL = 'https://mvcsbylbsffgbkocehzx.supabase.co/storage/v1/object/public/Nexgen/';
        
        function getImageUrl(path, name) {
            if (!path || path.trim() === '') return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=f59e0b&color=fff&bold=true`;
            if (path.startsWith('http')) return path;
            return STORAGE_URL + path.trim();
        }

        // --- Session Guard ---
        const userData = JSON.parse(localStorage.getItem('nexgen_user'));
        if (!userData || (userData.level.toLowerCase() !== 'admin' && userData.level.toLowerCase() !== 'manager')) {
            window.location.href = '../index.html';
        }

        // --- State ---
        let staffData = [];
        let unitsData = [];
        let editingEmpId = null;
        let editingUnitId = null;
        let lineChart, barChart;
        let currentPage = 1;
        const itemsPerPage = 12;
        let filteredData = [];

        // --- Initialization ---
        document.addEventListener('DOMContentLoaded', async () => {
            if (userData) {
                // Populate User Profile
                if (document.getElementById('userName')) document.getElementById('userName').innerText = userData.name || 'Admin User';
                if (document.getElementById('userLevel')) document.getElementById('userLevel').innerText = userData.level || 'Administrator';
                
                const avatarUrl = getImageUrl(userData.image, userData.name);
                if (document.getElementById('userImg')) document.getElementById('userImg').src = avatarUrl;
                if (document.getElementById('mobileUserImg')) document.getElementById('mobileUserImg').src = avatarUrl;
            }

            initChart();
            await fetchUnits();
            await fetchStaff();
            await fetchLeaves();
            await fetchFinance();
        });

        function initChart() {
            const ctx = document.getElementById('dashboardChart').getContext('2d');
            let gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
            gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');

            lineChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
                    datasets: [{
                        label: 'ผู้ปฏิบัติงาน (นาย)',
                        data: [18, 22, 20, 24, 21, 26, 23],
                        borderColor: '#f59e0b',
                        backgroundColor: gradient,
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#0f172a',
                        pointBorderColor: '#f59e0b',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });

            const ctxBar = document.getElementById('barChart').getContext('2d');
            let barGradient = ctxBar.createLinearGradient(0, 0, 0, 300);
            barGradient.addColorStop(0, '#10b981');
            barGradient.addColorStop(1, 'rgba(16, 185, 129, 0.2)');

            barChart = new Chart(ctxBar, {
                type: 'bar',
                data: {
                    labels: ['กทม.', 'ภาคกลาง', 'ภาคเหนือ', 'ภาคใต้', 'ภาคตะวันออก'],
                    datasets: [{
                        label: 'พนักงาน (นาย)',
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: barGradient,
                        borderRadius: 6
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        // --- Dashboard Logic ---
        function updateDashboardStats() {
            const activeUnits = unitsData.filter(u => u.status !== 'ปิด');
            const activeUnitNames = activeUnits.map(u => u.unit_name);
            const activeStaff = staffData.filter(s => activeUnitNames.includes(s.unit));

            if (document.getElementById('unitCount')) document.getElementById('unitCount').innerText = activeUnits.length;
            if (document.getElementById('staffCount')) document.getElementById('staffCount').innerText = activeStaff.length;

            if (barChart) {
                const zoneCounts = {};
                activeStaff.forEach(s => {
                    const unitObj = activeUnits.find(u => u.unit_name === s.unit);
                    const zone = unitObj ? unitObj.zone : 'อื่นๆ';
                    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
                });
                barChart.data.labels = Object.keys(zoneCounts);
                barChart.data.datasets[0].data = Object.values(zoneCounts);
                barChart.update();
            }
        }

        // --- UI & Navigation ---
        function switchTab(tabId, el) {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
            document.querySelectorAll('.submenu-item').forEach(s => s.classList.remove('active'));

            const target = document.getElementById(`tab-${tabId}`);
            if (target) target.classList.add('active');

            if (el) el.classList.add('active');

            // Auto fetch data when switching
            if (tabId === 'leaves') fetchLeaves();
            if (tabId === 'finance') fetchFinance();
            if (tabId === 'staff') fetchStaff();
            if (tabId === 'units') fetchUnits();

            // Handle editing states cleanup
            if (tabId !== 'units') {
                editingUnitId = null;
                const btnUnitText = document.getElementById('btnUnitText');
                if (btnUnitText) btnUnitText.innerText = 'บันทึกหน่วยงาน';
                clearUnitForm();
            }

            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar && sidebar.classList.contains('open')) toggleSidebar();
            }
        }

        function toggleSidebar() {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            sidebar.classList.toggle('open');
            overlay.classList.toggle('hidden');
        }

        function toggleSubMenu(submenuId, el) {
            const submenu = document.getElementById(submenuId);
            const isOpen = submenu.classList.contains('open');

            // Close other submenus if any
            document.querySelectorAll('.submenu').forEach(s => s.classList.remove('open'));
            document.querySelectorAll('.menu-item.has-submenu').forEach(m => m.classList.remove('open'));

            if (!isOpen) {
                submenu.classList.add('open');
                el.classList.add('open');
            }
        }

        // --- Staff Management ---
        async function fetchStaff() {
            try {
                const { data, error } = await supabaseClient.from('staff').select('*').order('emp_id', { ascending: true });
                if (error) throw error;
                staffData = data.map(i => ({ id: i.emp_id, name: i.name, unit: i.unit, role: i.role, level: i.level, status: i.status, image: i.image }));
                applyFilter();
                updateDashboardStats();
            } catch (error) {
                console.error("Staff Error:", error);
            }
        }

        function applyFilter() {
            const filters = {
                id: document.getElementById('hFilterId')?.value.toLowerCase() || '',
                name: document.getElementById('hFilterName')?.value.toLowerCase() || '',
                unit: document.getElementById('hFilterUnit')?.value || '',
                role: document.getElementById('hFilterRole')?.value.toLowerCase() || '',
                level: document.getElementById('hFilterLevel')?.value || '',
                status: document.getElementById('hFilterStatus')?.value || ''
            };

            filteredData = staffData.filter(s => {
                return (filters.id ? s.id.toLowerCase().includes(filters.id) : true) &&
                    (filters.name ? s.name.toLowerCase().includes(filters.name) : true) &&
                    (filters.unit ? s.unit === filters.unit : true) &&
                    (filters.role ? s.role.toLowerCase().includes(filters.role) : true) &&
                    (filters.level ? s.level === filters.level : true) &&
                    (filters.status ? s.status === filters.status : true);
            });
            currentPage = 1;
            renderTable();
        }

        function renderTable() {
            const body = document.getElementById('staffTable');
            const start = (currentPage - 1) * itemsPerPage;
            const data = filteredData.slice(start, start + itemsPerPage);

            body.innerHTML = data.map(s => {
                const imgUrl = getImageUrl(s.image, s.name);
                return `
                <tr class="hover:bg-slate-800/30 transition-colors">
                    <td class="px-3 py-2">
                        <img src="${imgUrl}" 
                             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=334155&color=fff'"
                             class="w-8 h-8 rounded-full border border-slate-700 object-cover">
                    </td>
                    <td class="px-3 py-2 font-mono text-amber-500 font-bold">${s.id}</td>
                    <td class="px-3 py-2 font-bold text-white">${s.name}</td>
                    <td class="px-3 py-2 text-slate-300">${s.unit}</td>
                    <td class="px-3 py-2 text-slate-400">${s.role}</td>
                    <td class="px-3 py-2 text-slate-300">${s.level}</td>
                    <td class="px-3 py-2"><span class="px-2 py-0.5 rounded text-[9px] font-bold ${s.status === 'เปิด' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-500'}">${s.status}</span></td>
                    <td class="px-3 py-2 text-center text-slate-500">
                        <i class="fas fa-edit mr-3 cursor-pointer hover:text-amber-500" onclick="editStaff('${s.id}')"></i>
                        <i class="fas fa-trash-alt cursor-pointer hover:text-red-500" onclick="deleteStaff('${s.id}')"></i>
                    </td>
                </tr>`;
            }).join('');
            renderPagination();
        }

        function renderPagination() {
            const totalItems = filteredData.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
            const start = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
            const end = Math.min(currentPage * itemsPerPage, totalItems);

            document.getElementById('pageStartItem').innerText = start;
            document.getElementById('pageEndItem').innerText = end;
            document.getElementById('totalItems').innerText = totalItems;

            let html = '';
            for (let i = 1; i <= totalPages; i++) {
                const active = i === currentPage ? 'bg-amber-500 text-black' : 'bg-[#0f172a] text-slate-400';
                html += `<button onclick="goToPage(${i})" class="w-6 h-6 rounded font-bold text-[10px] ${active} border border-slate-800">${i}</button>`;
            }
            document.getElementById('pageNumbers').innerHTML = html;

            const jump = document.getElementById('jumpSelect');
            jump.innerHTML = Array.from({ length: totalPages }, (_, i) => `<option value="${i + 1}" ${i + 1 === currentPage ? 'selected' : ''}>หน้า ${i + 1}</option>`).join('');
        }

        function goToPage(p) { currentPage = parseInt(p); renderTable(); }
        function nextPage() { if (currentPage < Math.ceil(filteredData.length / itemsPerPage)) { currentPage++; renderTable(); } }
        function prevPage() { if (currentPage > 1) { currentPage--; renderTable(); } }

        async function addNewStaff() {
            const id = document.getElementById('empId').value;
            const name = document.getElementById('empName').value;
            const unit = document.getElementById('empUnit').value;
            const role = document.getElementById('empRole').value;
            const level = document.getElementById('empLevel').value;
            const status = document.getElementById('empStatus').value;
            const image = document.getElementById('empImage').value;
            const password = document.getElementById('empPassword').value;

            if (!id || !name || !unit) return alert("กรุณากรอกข้อมูลหลักให้ครบถ้วน");

            const payload = { emp_id: id, name, unit, role, level, status, image };
            if (password) payload.password = password; else if (!editingEmpId) payload.password = '1234';

            try {
                const { error } = editingEmpId ?
                    await supabaseClient.from('staff').update(payload).eq('emp_id', editingEmpId) :
                    await supabaseClient.from('staff').insert([payload]);
                
                if (error) throw error;

                alert(editingEmpId ? 'แก้ไขข้อมูลพนักงานสำเร็จ' : 'เพิ่มพนักงานใหม่สำเร็จ');
                editingEmpId = null;
                document.getElementById('btnText').innerText = 'บันทึกข้อมูล';
                ['empId', 'empName', 'empUnit', 'empRole', 'empPassword', 'empImage'].forEach(i => document.getElementById(i).value = '');
                await fetchStaff();
            } catch (e) { 
                console.error("Staff Save Error:", e);
                alert("ไม่สามารถบันทึกข้อมูลได้: " + (e.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ")); 
            }
        }

        function editStaff(id) {
            const s = staffData.find(x => x.id === id);
            editingEmpId = s.id;
            document.getElementById('empId').value = s.id;
            document.getElementById('empName').value = s.name;
            document.getElementById('empUnit').value = s.unit;
            document.getElementById('empRole').value = s.role;
            document.getElementById('empLevel').value = s.level;
            document.getElementById('empStatus').value = s.status;
            document.getElementById('empImage').value = s.image || '';
            document.getElementById('btnText').innerText = 'บันทึกการแก้ไข';
            document.getElementById('empId').focus();
        }

        async function deleteStaff(id) {
            if (!confirm('ยืนยันการลบพนักงาน ' + id + ' ใช่หรือไม่?')) return;
            try {
                const { error } = await supabaseClient.from('staff').delete().eq('emp_id', id);
                if (error) throw error;
                alert('ลบข้อมูลพนักงานสำเร็จ');
                await fetchStaff();
            } catch (e) {
                console.error("Staff Delete Error:", e);
                alert("ไม่สามารถลบข้อมูลได้: " + (e.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ"));
            }
        }

        // --- Unit Management ---
        async function fetchUnits() {
            try {
                const { data, error } = await supabaseClient.from('units').select('*').order('unit_number', { ascending: true });
                if (error) throw error;
                unitsData = data || [];
                renderUnitsTable();
                updateDashboardStats();
                updateUnitDropdowns();
            } catch (e) { console.error("Units Error:", e); }
        }

        function renderUnitsTable() {
            const body = document.getElementById('unitsTable');
            if (unitsData.length === 0) { body.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-500">ไม่มีข้อมูลหน่วยงาน</td></tr>'; return; }
            body.innerHTML = unitsData.map(u => `
                <tr class="hover:bg-slate-800/30 transition-colors">
                    <td class="px-3 py-2 font-mono text-amber-500 font-bold">${u.unit_number}</td>
                    <td class="px-3 py-2 font-bold text-white">${u.unit_name}</td>
                    <td class="px-3 py-2 text-slate-300">${u.zone}</td>
                    <td class="px-3 py-2 text-slate-400">${u.unit_code}</td>
                    <td class="px-3 py-2 text-slate-300">${u.manager_name || '-'}</td>
                    <td class="px-3 py-2 text-amber-400/80 text-[10px] font-mono">${u.latitude || '-'}, ${u.longitude || '-'}</td>
                    <td class="px-3 py-2 text-center text-cyan-400">${u.radius_meters || 100}</td>
                    <td class="px-3 py-2 text-center font-bold text-blue-400">${u.required_guards || 0} นาย</td>
                    <td class="px-3 py-2 font-bold ${u.status === 'ปิด' ? 'text-red-500' : 'text-emerald-500'}">${u.status || 'เปิด'}</td>
                    <td class="px-3 py-2 text-center text-slate-500">
                        <i class="fas fa-edit mr-3 cursor-pointer hover:text-amber-500" onclick="editUnit('${u.id}')"></i>
                        <i class="fas fa-trash-alt cursor-pointer hover:text-red-500" onclick="deleteUnit('${u.id}')"></i>
                    </td>
                </tr>
            `).join('');
        }

        async function addNewUnit() {
            const payload = {
                unit_number: document.getElementById('uNumber').value,
                unit_name: document.getElementById('uName').value,
                zone: document.getElementById('uZone').value,
                unit_code: document.getElementById('uCode').value,
                manager_name: document.getElementById('uManager').value,
                latitude: parseFloat(document.getElementById('uLat').value) || null,
                longitude: parseFloat(document.getElementById('uLng').value) || null,
                radius_meters: parseInt(document.getElementById('uRadius').value) || 100,
                required_guards: parseInt(document.getElementById('uRequired').value) || 0,
                status: document.getElementById('uStatus').value
            };
            if (!payload.unit_number || !payload.unit_name) return alert("กรุณากรอกข้อมูลเลขที่และชื่อหน่วยงาน");

            try {
                const { error } = editingUnitId ?
                    await supabaseClient.from('units').update(payload).eq('id', editingUnitId) :
                    await supabaseClient.from('units').insert([payload]);
                
                if (error) throw error;
                
                alert(editingUnitId ? 'แก้ไขข้อมูลหน่วยงานสำเร็จ' : 'เพิ่มหน่วยงานใหม่สำเร็จ');
                clearUnitForm();
                await fetchUnits();
            } catch (e) { 
                console.error("Unit Save Error:", e);
                alert("ไม่สามารถบันทึกหน่วยงานได้: " + (e.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ")); 
            }
        }

        function editUnit(id) {
            const u = unitsData.find(x => x.id === id);
            editingUnitId = u.id;
            ['uNumber', 'uName', 'uZone', 'uCode', 'uManager', 'uLat', 'uLng', 'uRadius', 'uRequired', 'uStatus'].forEach(id => {
                const key = id === 'uNumber' ? 'unit_number' : id === 'uName' ? 'unit_name' : id === 'uZone' ? 'zone' : id === 'uCode' ? 'unit_code' : id === 'uManager' ? 'manager_name' : id === 'uLat' ? 'latitude' : id === 'uLng' ? 'longitude' : id === 'uRadius' ? 'radius_meters' : id === 'uRequired' ? 'required_guards' : 'status';
                document.getElementById(id).value = u[key] || (id === 'uRadius' ? 100 : id === 'uRequired' ? 0 : id === 'uStatus' ? 'เปิด' : '');
            });
            document.getElementById('btnUnitText').innerText = 'บันทึกการแก้ไข';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        async function deleteUnit(id) {
            if (!confirm('ยืนยันการลบหน่วยงานใช่หรือไม่? ข้อมูลนี้จะไม่สามารถกู้คืนได้')) return;
            
            try {
                const { error } = await supabaseClient.from('units').delete().eq('id', id);
                if (error) throw error;
                
                alert('ลบหน่วยงานสำเร็จ');
                await fetchUnits();
            } catch (e) {
                console.error("Delete Error:", e);
                alert("ไม่สามารถลบได้: " + (e.message || "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล"));
            }
        }

        // --- Utils & Suggestions ---
        function clearUnitForm() {
            editingUnitId = null;
            ['uNumber', 'uName', 'uZone', 'uCode', 'uManager', 'uLat', 'uLng', 'uRequired'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('uRadius').value = '100';
            document.getElementById('uStatus').value = 'เปิด';
            document.getElementById('btnUnitText').innerText = 'บันทึกหน่วยงาน';
        }

        function updateUnitDropdowns() {
            const f = document.getElementById('hFilterUnit');
            if (f) {
                const val = f.value;
                f.innerHTML = '<option value="">ทั้งหมด</option>' + unitsData.map(u => `<option value="${u.unit_name}" ${u.unit_name === val ? 'selected' : ''}>${u.unit_name}</option>`).join('');
            }
        }

        function handleUnitInput(val) {
            const box = document.getElementById('unitSuggestions');
            if (!box) return;
            const matches = val ? unitsData.filter(u => u.unit_name.toLowerCase().includes(val.toLowerCase()) || u.unit_code.toLowerCase().includes(val.toLowerCase())) : unitsData;
            if (matches.length > 0) {
                box.innerHTML = matches.map(u => `<div class="suggestion-item" onclick="selectUnit('${u.unit_name}')"><div class="font-bold text-white text-[12px]">${u.unit_name}</div><div class="text-[10px] text-amber-500/80">${u.unit_code}</div><div class="text-[9px] text-slate-400">${u.zone}</div></div>`).join('');
                box.classList.remove('hidden');
            } else if (val) {
                box.innerHTML = '<div class="p-4 text-center text-slate-500 text-[11px]">ไม่พบข้อมูล</div>';
                box.classList.remove('hidden');
            } else { box.classList.add('hidden'); }
        }

        function selectUnit(name) { document.getElementById('empUnit').value = name; document.getElementById('unitSuggestions').classList.add('hidden'); }
        document.addEventListener('click', e => { if (!e.target.closest('#empUnit') && !e.target.closest('#unitSuggestions')) document.getElementById('unitSuggestions')?.classList.add('hidden'); });

        // --- Leaves Logic ---
        async function fetchLeaves() {
            try {
                const { data, error } = await supabaseClient.from('leave_records').select('*, staff(name, role, image)').order('created_at', { ascending: false });
                if (error) throw error;
                const pending = data.filter(l => l.status === 'รออนุมัติ');
                const history = data.filter(l => l.status !== 'รออนุมัติ');
                
                document.getElementById('pendingCount').innerText = pending.length;
                renderPendingLeaves(pending);
                renderLeavesHistory(history);
            } catch (e) { console.error("Leaves Error:", e); }
        }

        function renderPendingLeaves(list) {
            const box = document.getElementById('pendingLeaves');
            if (list.length === 0) { box.innerHTML = '<div class="col-span-full p-8 text-center text-slate-500 bg-[#0f172a]/50 rounded-xl border border-dashed border-slate-800">ไม่มีรายการรออนุมัติ</div>'; return; }
            box.innerHTML = list.map(l => {
                // Calculate days if possible
                let daysText = '';
                if (l.start_date && l.end_date) {
                    const start = new Date(l.start_date);
                    const end = new Date(l.end_date);
                    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                    daysText = `(${diff} วัน)`;
                }

                return `
                <div class="data-card bg-[#1e293b]/40 border border-white/5 p-5">
                    <div class="flex gap-4 mb-4">
                        <img src="${getImageUrl(l.staff?.image, l.staff?.name)}" class="w-12 h-12 rounded-full border border-amber-500/30">
                        <div>
                            <h3 class="text-white font-bold">${l.staff?.name || 'Unknown'}</h3>
                            <p class="text-[10px] text-slate-400 uppercase tracking-wider">${l.staff?.role || 'Staff'}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 gap-3 mb-4">
                        <div class="bg-[#0f172a]/50 p-2 rounded-lg border border-white/5">
                            <p class="text-[9px] text-slate-500 uppercase mb-1">ประเภทการลา</p>
                            <p class="text-xs text-amber-500 font-bold">${l.leave_type}</p>
                        </div>
                        <div class="bg-[#0f172a]/50 p-2 rounded-lg border border-white/5">
                            <p class="text-[9px] text-slate-500 uppercase mb-1">ระยะเวลาที่ลา ${daysText}</p>
                            <p class="text-[11px] text-slate-300 font-bold">${l.start_date} <i class="fas fa-arrow-right mx-1 text-slate-600"></i> ${l.end_date || l.start_date}</p>
                        </div>
                    </div>
                    <div class="mb-4 p-2 bg-amber-500/5 rounded-lg border border-amber-500/10">
                        <p class="text-[9px] text-amber-500/60 uppercase mb-1">เหตุผลการลา</p>
                        <p class="text-[11px] text-slate-300 leading-relaxed">${l.reason || '-'}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="approveLeave('${l.id}')" class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-all shadow-lg shadow-emerald-600/10">อนุมัติ</button>
                        <button onclick="rejectLeave('${l.id}')" class="flex-1 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-500 rounded-lg text-[11px] font-bold transition-all">ไม่อนุมัติ</button>
                    </div>
                </div>
            `}).join('');
        }

        function renderLeavesHistory(list) {
            const body = document.getElementById('historyLeaves');
            body.innerHTML = list.slice(0, 10).map(l => `
                <tr class="hover:bg-slate-800/30 transition-colors">
                    <td class="px-4 py-3">
                        <p class="text-white font-bold">${l.staff?.name || 'Unknown'}</p>
                        <p class="text-[9px] text-slate-500">${l.leave_type}</p>
                    </td>
                    <td class="px-4 py-3 text-right">
                        <span class="px-2 py-0.5 rounded-[4px] text-[9px] font-bold ${l.status === 'อนุมัติ' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}">${l.status}</span>
                    </td>
                </tr>
            `).join('');
        }

        async function approveLeave(id) {
            if (!confirm('ยืนยันการอนุมัติการลา?')) return;
            try {
                const { error } = await supabaseClient.from('leave_records').update({ status: 'อนุมัติ' }).eq('id', id);
                if (error) throw error;
                alert('อนุมัติการลาสำเร็จ');
                fetchLeaves();
            } catch (e) { alert("Error: " + e.message); }
        }

        async function rejectLeave(id) {
            const reason = prompt('ระบุเหตุผลที่ไม่อนุมัติ:');
            if (reason === null) return;
            try {
                const { error } = await supabaseClient.from('leave_records').update({ status: 'ไม่อนุมัติ', reject_reason: reason }).eq('id', id);
                if (error) throw error;
                alert('ส่งคำขอคืนเรียบร้อย');
                fetchLeaves();
            } catch (e) { alert("Error: " + e.message); }
        }

        // --- Finance Logic ---
        async function fetchFinance() {
            try {
                const { data, error } = await supabaseClient.from('finance_records').select('*').order('created_at', { ascending: false });
                if (error) throw error;
                renderFinanceTable(data);
            } catch (e) { console.error("Finance Error:", e); }
        }

        function renderFinanceTable(list) {
            const body = document.getElementById('financeTableBody');
            if (!list || list.length === 0) { body.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500">ไม่มีข้อมูลการเงิน</td></tr>'; return; }
            body.innerHTML = list.map(f => `
                <tr class="hover:bg-slate-800/30 transition-colors">
                    <td class="px-5 py-3">
                        <div class="flex flex-col">
                            <span class="text-white font-bold">${f.emp_id || 'Unknown'}</span>
                            <span class="text-[9px] text-amber-500/70 font-bold uppercase tracking-wider">-</span>
                        </div>
                    </td>
                    <td class="px-5 py-3">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${f.type === 'รายได้' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">${f.type}</span>
                    </td>
                    <td class="px-5 py-3 font-mono text-white text-base">฿${f.amount?.toLocaleString() || 0}</td>
                    <td class="px-5 py-3 text-slate-400 text-[10px]">${new Date(f.created_at).toLocaleDateString('th-TH')}</td>
                    <td class="px-5 py-3">
                        <div class="max-w-[200px] truncate text-slate-500 italic text-[10px]" title="${f.description || '-'}">
                            ${f.description || '-'}
                        </div>
                    </td>
                    <td class="px-5 py-3 text-center">
                        <i class="fas fa-trash-alt cursor-pointer hover:text-red-500 transition-colors" onclick="deleteFinance('${f.id}')"></i>
                    </td>
                </tr>
            `).join('');
        }

        async function deleteFinance(id) {
            if (!confirm('ลบรายการการเงินนี้?')) return;
            try {
                const { error } = await supabaseClient.from('finance_records').delete().eq('id', id);
                if (error) throw error;
                alert('ลบรายการสำเร็จ');
                fetchFinance();
            } catch (e) { alert("Error: " + e.message); }
        }

        function logout() { 
            if(confirm('ต้องการออกจากระบบหรือไม่?')) {
                localStorage.removeItem('nexgen_user'); 
                window.location.href = '../index.html'; 
            }
        }