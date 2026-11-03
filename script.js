import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getDatabase, ref, onValue, push, update, remove } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyC61C_WZjL6TRLGZ0o5ssRU0YwaEl4rIHg",
    authDomain: "menang-f11af.firebaseapp.com",
    databaseURL: "https://menang-f11af-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "menang-f11af",
    storageBucket: "menang-f11af.firebasestorage.app",
    messagingSenderId: "210917784585",
    appId: "1:210917784585:web:026f352c6d55948922ccd8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- State Management ---
let appData = { dptTotal: 0, bgImage: '', fotoCalon: '', voters: [], users: [] };
let addressChartInstance = null;
let genderChartInstance = null;

const bgLayer = document.getElementById('bg-layer');
const voterForm = document.getElementById('voter-form');

// View Elements
const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');

// --- Logika Login/Autentikasi ---
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();

    // Cek Master Admin
    if (u === "04menang" && p === "pawongagasan") {
        sessionStorage.setItem('sessionRole', 'admin');
        sessionStorage.setItem('sessionName', 'Administrator');
        window.openModal({ type: 'success', title: 'Berhasil', message: 'Selamat datang, Admin Master!' });
        setTimeout(() => { window.closeModal(); checkRouter(); }, 1000);
        return;
    } 

    // Cek Relawan (User) di Database
    const userFound = appData.users.find(user => user.username === u && user.password === p);
    if (userFound) {
        sessionStorage.setItem('sessionRole', 'user');
        sessionStorage.setItem('sessionName', userFound.nama);
        sessionStorage.setItem('sessionUsername', userFound.username);
        window.openModal({ type: 'success', title: 'Berhasil', message: `Selamat bekerja, ${userFound.nama}!` });
        setTimeout(() => { window.closeModal(); checkRouter(); }, 1000);
    } else {
        window.openModal({ type: 'error', title: 'Akses Ditolak', message: 'Username atau Kata Sandi salah/tidak ditemukan.' });
    }
});

window.logoutAdmin = function() {
    sessionStorage.clear();
    document.getElementById('login-form').reset();
    checkRouter();
};

function checkRouter() {
    const role = sessionStorage.getItem('sessionRole');
    if (!role) {
        loginView.classList.remove('hidden');
        mainView.classList.add('hidden');
        return;
    }

    loginView.classList.add('hidden');
    mainView.classList.remove('hidden');
    
    // Update text DPT di progress bar (seperti di gambar)
    document.getElementById('text-dpt').innerText = (appData.dptTotal || 0).toLocaleString('id-ID');
    
    // Atur visibilitas tab berdasarkan Role
    document.getElementById('btn-tab-hasil').classList.remove('hidden');
    document.getElementById('btn-tab-tabel').classList.remove('hidden');
    
    if (role === 'admin') {
        document.getElementById('btn-tab-akun').classList.remove('hidden');
        document.getElementById('btn-tab-pengaturan').classList.remove('hidden');
        document.getElementById('btn-tab-input').classList.add('hidden');
        window.switchTab('tab-akun'); // Default admin ke kelola akun
        
        // Isi nilai form DPT saat ini
        if(document.getElementById('edit-dpt-input')) {
            document.getElementById('edit-dpt-input').value = appData.dptTotal || '';
        }
    } else {
        document.getElementById('btn-tab-akun').classList.add('hidden');
        document.getElementById('btn-tab-pengaturan').classList.add('hidden');
        document.getElementById('btn-tab-input').classList.remove('hidden');
        window.switchTab('tab-input'); // Default user ke input data
    }
}

// --- Listener Realtime Data ---
const dbRef = ref(db, '/');
onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        appData.dptTotal = data.settings?.dptTotal || 0;
        appData.bgImage = data.settings?.bgImage || '';
        appData.fotoCalon = data.settings?.fotoCalon || '';

        const votersObj = data.voters || {};
        appData.voters = Object.keys(votersObj).map(key => ({
            id: key,
            ...votersObj[key]
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const usersObj = data.users || {};
        appData.users = Object.keys(usersObj).map(key => ({
            id: key,
            ...usersObj[key]
        }));
    } else {
        appData = { dptTotal: 0, bgImage: '', fotoCalon: '', voters: [], users: [] };
    }

    window.terapkanFotoCalon();
    bgLayer.style.backgroundImage = appData.bgImage ? `url(${appData.bgImage})` : 'none';
    
    // Panggil router untuk mengelola perpindahan view dengan aman
    checkRouter();
    
    window.updateDashboard();
    window.renderTable();
    window.renderUsers(); 
});

// --- Pengaturan Aplikasi (Admin) ---
const pengaturanForm = document.getElementById('pengaturan-form');
if (pengaturanForm) {
    pengaturanForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const dptInput = document.getElementById('edit-dpt-input').value;
        const bgInput = document.getElementById('edit-bg-input').files[0];

        if (bgInput) {
            if(bgInput.size > 2 * 1024 * 1024) {
                window.openModal({ type: 'error', title: 'Terlalu Besar', message: 'Maksimal 2MB.'});
                return;
            }
            const reader = new FileReader();
            reader.onload = function(event) {
                update(ref(db, 'settings'), { 
                    dptTotal: parseInt(dptInput),
                    bgImage: event.target.result
                }).then(() => window.openModal({ type: 'success', title: 'Berhasil', message: 'Pengaturan dan DPT diperbarui.' }));
            };
            reader.readAsDataURL(bgInput);
        } else {
            update(ref(db, 'settings'), { dptTotal: parseInt(dptInput) })
                .then(() => window.openModal({ type: 'success', title: 'Berhasil', message: 'Target DPT diperbarui.' }));
        }
    });
}

// --- Voter Form ---
voterForm.addEventListener('submit', function(e) {
    e.preventDefault();
    let nama = document.getElementById('nama').value.trim();
    const alamat = document.getElementById('alamat').value;
    const jk = document.getElementById('jk').value;
    const normalizedName = nama.toLowerCase().replace(/\s+/g, ' ');

    const isDuplicate = appData.voters.some(v => v.name.toLowerCase().replace(/\s+/g, ' ') === normalizedName);
    if (isDuplicate) {
        window.openModal({ type: 'error', title: 'Data Ganda!', message: `Nama "${nama}" sudah terdaftar.` });
        return;
    }

    const relawanName = sessionStorage.getItem('sessionName') || 'Unknown';
    const newVoter = { 
        name: nama, 
        address: alamat, 
        gender: jk, 
        inputBy: relawanName,
        timestamp: new Date().toISOString() 
    };
    push(ref(db, 'voters'), newVoter);

    voterForm.reset();
    document.getElementById('nama').focus();
});

// --- Fungsi Global (Terhubung dengan HTML) ---
window.handleFotoCalon = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    if(file.size > 2 * 1024 * 1024) {
        window.openModal({ type: 'error', title: 'Terlalu Besar', message: 'Maksimal 2MB.'});
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        update(ref(db, 'settings'), { fotoCalon: e.target.result });
    };
    reader.readAsDataURL(file);
};

window.terapkanFotoCalon = function() {
    const wadah = document.getElementById('wadah-foto-calon');
    const teks = document.getElementById('teks-04');
    if (appData.fotoCalon) {
        wadah.style.backgroundImage = `url(${appData.fotoCalon})`;
        teks.classList.add('hidden');
    } else {
        wadah.style.backgroundImage = 'none';
        teks.classList.remove('hidden');
    }
};

// --- Logika Form Kelola Akun (Admin) ---
const userForm = document.getElementById('user-form');
if(userForm) {
    userForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const namaUser = document.getElementById('new-nama-user').value.trim();
        const username = document.getElementById('new-username').value.trim().toLowerCase();
        const password = document.getElementById('new-password').value.trim();

        const isDuplicate = appData.users.some(u => u.username === username);
        if (isDuplicate || username === "04menang") {
            window.openModal({ type: 'error', title: 'Gagal', message: 'Username sudah digunakan, pilih yang lain.' });
            return;
        }

        push(ref(db, 'users'), { nama: namaUser, username: username, password: password });
        userForm.reset();
        window.openModal({ type: 'success', title: 'Berhasil', message: `Akun untuk ${namaUser} berhasil dibuat.` });
    });
}

window.deleteUserAcc = function(id, nama) {
    window.openModal({
        type: 'confirm', title: 'Hapus Akun?', message: `Yakin menghapus akses untuk relawan ${nama}?`,
        onConfirm: () => remove(ref(db, 'users/' + id))
    });
};

window.renderUsers = function() {
    const tbody = document.getElementById('user-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    appData.users.forEach(user => {
        // Hitung berapa data yang sudah diinput relawan ini
        const totalInput = appData.voters.filter(v => v.inputBy === user.nama).length;
        
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-brand-offwhite/50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 font-semibold text-brand-green2">${user.nama}</td>
            <td class="p-3 text-gray-600">${user.username}</td>
            <td class="p-3 text-center"><span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">${totalInput} Suara</span></td>
            <td class="p-3 text-center">
                <button onclick="window.deleteUserAcc('${user.id}', '${user.nama}')" class="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition-colors" title="Hapus Akun">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.deleteVoter = function(id) {
    window.openModal({
        type: 'confirm', title: 'Hapus Data?', message: 'Yakin hapus data ini?',
        onConfirm: () => remove(ref(db, 'voters/' + id))
    });
};

// --- Logika Edit Data Pemilih ---
window.editVoter = function(id) {
    // Cari data berdasarkan ID
    const voter = appData.voters.find(v => v.id === id);
    if (!voter) return;
    
    // Isi nilai ke dalam form modal edit
    document.getElementById('edit-id').value = voter.id;
    document.getElementById('edit-nama').value = voter.name;
    document.getElementById('edit-alamat').value = voter.address;
    document.getElementById('edit-jk').value = voter.gender;
    
    // Tampilkan modal
    const modal = document.getElementById('edit-modal');
    modal.classList.remove('hidden', 'opacity-0');
};

window.closeEditModal = function() {
    const modal = document.getElementById('edit-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

const editVoterForm = document.getElementById('edit-voter-form');
if (editVoterForm) {
    editVoterForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const nama = document.getElementById('edit-nama').value.trim();
        const alamat = document.getElementById('edit-alamat').value;
        const jk = document.getElementById('edit-jk').value;
        
        // Cek duplikat data (kecuali dirinya sendiri yang sedang diedit)
        const normalizedName = nama.toLowerCase().replace(/\s+/g, ' ');
        const isDuplicate = appData.voters.some(v => v.id !== id && v.name.toLowerCase().replace(/\s+/g, ' ') === normalizedName);
        if (isDuplicate) {
            window.openModal({ type: 'error', title: 'Data Ganda!', message: `Nama "${nama}" sudah terdaftar di sistem.` });
            return;
        }

        // Update data ke Firebase
        update(ref(db, 'voters/' + id), {
            name: nama,
            address: alamat,
            gender: jk
            // timestamp dan inputBy tidak diubah agar riwayat aslinya tetap terjaga
        }).then(() => {
            window.closeEditModal();
            window.openModal({ type: 'success', title: 'Berhasil', message: 'Data pemilih berhasil diperbarui.' });
        }).catch((error) => {
            window.openModal({ type: 'error', title: 'Gagal', message: 'Gagal memperbarui data. Periksa koneksi internet.' });
        });
    });
}

window.confirmReset = function() {
    window.openModal({
        type: 'confirm', title: 'Reset Data Pemilih?', message: 'Data pemilih akan dihapus dari server. (Foto calon dipertahankan)',
        onConfirm: () => {
            const sandi = prompt("Masukkan sandi keamanan:");
            if (sandi === "04Menang") {
                remove(ref(db, 'voters'));
                update(ref(db, 'settings'), {
                    dptTotal: 0,
                    bgImage: '',
                    fotoCalon: appData.fotoCalon || ''
                });

                document.getElementById('admin-form').reset();
                setTimeout(() => window.openModal({ type: 'success', title: 'Berhasil', message: 'Data pemilih berhasil di-reset.' }), 500);
            } else if (sandi !== null) {
                setTimeout(() => window.openModal({ type: 'error', title: 'Ditolak', message: 'Sandi salah!' }), 500);
            }
        }
    });
};

// Update switchTab agar lebih aman dan tidak menghapus class 'hidden'
window.switchTab = function(targetTab) {
    const role = sessionStorage.getItem('sessionRole');
    
    // 1. Keamanan Ekstra: Blokir Relawan/User dari Kelola Akun & Pengaturan
    if ((targetTab === 'tab-akun' || targetTab === 'tab-pengaturan') && role !== 'admin') {
        console.warn("Akses ditolak: Hanya Admin.");
        return;
    }

    // 2. Sembunyikan semua konten tab
    document.getElementById('tab-akun').classList.add('hidden');
    if(document.getElementById('tab-pengaturan')) document.getElementById('tab-pengaturan').classList.add('hidden');
    document.getElementById('tab-input').classList.add('hidden');
    document.getElementById('tab-hasil').classList.add('hidden');
    document.getElementById('tab-tabel').classList.add('hidden');
    
    // 3. Reset warna tombol ke default TANPA menghapus class 'hidden'
    const buttons = ['btn-tab-akun', 'btn-tab-pengaturan', 'btn-tab-input', 'btn-tab-hasil', 'btn-tab-tabel'];
    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if(btn) {
            btn.classList.remove('bg-brand-green1', 'text-white'); // Hapus warna aktif
            btn.classList.add('bg-gray-200', 'text-gray-600', 'hover:bg-gray-300'); // Tambah warna pasif
        }
    });

    // 4. Tampilkan konten tab yang dipilih
    document.getElementById(targetTab).classList.remove('hidden');
    
    // 5. Beri warna aktif khusus pada tombol yang dipilih
    const activeBtn = document.getElementById(`btn-${targetTab}`);
    if(activeBtn) {
        activeBtn.classList.remove('bg-gray-200', 'text-gray-600', 'hover:bg-gray-300');
        activeBtn.classList.add('bg-brand-green1', 'text-white');
    }
};

window.exportData = function() {
    if(appData.voters.length === 0) {
        window.openModal({type: 'info', title: 'Kosong', message: 'Tidak ada data.'});
        return;
    }
    const dataUntukExcel = appData.voters.map(voter => {
        const dateObj = new Date(voter.timestamp);
        const waktuFormat = dateObj.toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) + ' ' + 
                            dateObj.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        return {
            "Nama Lengkap": voter.name.toUpperCase(),
            "Alamat": voter.address,
            "Jenis Kelamin": voter.gender,
            "Waktu Input": waktuFormat
        };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataUntukExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Pemilih");
    XLSX.writeFile(workbook, "Data_Pemilih_04_Tika_Liyana.xlsx");
};

window.openModal = function(options) {
    const modal = document.getElementById('custom-modal');
    const { type = 'info', title, message, onConfirm = null } = options;
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    
    const actions = document.getElementById('modal-actions');
    actions.innerHTML = '';
    
    if (type === 'confirm') {
        const btnCancel = document.createElement('button');
        btnCancel.className = 'px-6 py-2 bg-gray-200 text-gray-800 rounded-lg';
        btnCancel.innerText = 'Batal';
        btnCancel.onclick = window.closeModal;
        
        const btnConfirm = document.createElement('button');
        btnConfirm.className = 'px-6 py-2 bg-red-600 text-white rounded-lg';
        btnConfirm.innerText = 'Ya, Lanjutkan';
        btnConfirm.onclick = () => { window.closeModal(); if(onConfirm) onConfirm(); };
        
        actions.appendChild(btnCancel);
        actions.appendChild(btnConfirm);
    } else {
        const btn = document.createElement('button');
        btn.className = 'px-6 py-2 bg-brand-green1 text-white rounded-lg';
        btn.innerText = 'OK';
        btn.onclick = window.closeModal;
        actions.appendChild(btn);
    }

    modal.classList.remove('hidden', 'opacity-0');
};

window.closeModal = function() {
    const modal = document.getElementById('custom-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

window.updateDashboard = function() {
    const total = appData.voters.length;
    const males = appData.voters.filter(v => v.gender === 'Laki-laki').length;
    const females = appData.voters.filter(v => v.gender === 'Perempuan').length;

    document.getElementById('stat-total').innerText = total.toLocaleString('id-ID');
    document.getElementById('stat-male').innerText = males.toLocaleString('id-ID');
    document.getElementById('stat-female').innerText = females.toLocaleString('id-ID');

    const percentage = appData.dptTotal > 0 ? ((total / appData.dptTotal) * 100).toFixed(1) : 0;
    document.getElementById('progress-text').innerText = `${percentage}%`;
    document.getElementById('progress-bar').style.width = `${Math.min(percentage, 100)}%`;

    const dusunLabels = ['Dusun 1', 'Dusun 2', 'Dusun 3', 'Dusun 4', 'Dusun 5', 'Dusun 6', 'Dusun 7', 'Dusun 8'];
    const addressCounts = new Array(8).fill(0);
    
    appData.voters.forEach(v => {
        const index = dusunLabels.indexOf(v.address);
        if (index !== -1) addressCounts[index]++;
    });

    const ctxAddress = document.getElementById('addressChart').getContext('2d');
    if (addressChartInstance) {
        addressChartInstance.data.datasets[0].data = addressCounts;
        addressChartInstance.update();
    } else {
        addressChartInstance = new Chart(ctxAddress, {
            type: 'bar',
            data: {
                labels: dusunLabels,
                datasets: [{
                    label: 'Jumlah Pemilih',
                    data: addressCounts,
                    backgroundColor: '#2F6B3F',
                    borderColor: '#0B3D2E',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }

    const ctxGender = document.getElementById('genderChart').getContext('2d');
    if (genderChartInstance) {
        genderChartInstance.data.datasets[0].data = [males, females];
        genderChartInstance.update();
    } else {
        genderChartInstance = new Chart(ctxGender, {
            type: 'pie',
            data: {
                labels: ['Laki-laki', 'Perempuan'],
                datasets: [{
                    data: [males, females],
                    backgroundColor: ['#3B82F6', '#EC4899'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
};

window.renderTable = function() {
    const tableBody = document.getElementById('voter-table-body');
    const emptyState = document.getElementById('empty-state');
    tableBody.innerHTML = '';
    
    const elAlamat = document.getElementById('filter-alamat');
    const elJk = document.getElementById('filter-jk');
    const valAlamat = elAlamat ? elAlamat.value : 'semua';
    const valJk = elJk ? elJk.value : 'semua';

    const filteredVoters = appData.voters.filter(voter => {
        const matchAlamat = (valAlamat === 'semua') || (voter.address === valAlamat);
        const matchJk = (valJk === 'semua') || (voter.gender === valJk);
        return matchAlamat && matchJk;
    });
    
    if (filteredVoters.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');
    
    filteredVoters.forEach((voter, index) => {
        const dateObj = new Date(voter.timestamp);
        const timeStr = dateObj.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        const dateStr = dateObj.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});
        
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-brand-offwhite/50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 text-center text-gray-500">${index + 1}</td>
            <td class="p-3 font-semibold uppercase">${voter.name}</td>
            <td class="p-3"><span class="bg-gray-100 px-2 py-1 rounded text-xs border">${voter.address}</span></td>
            <td class="p-3">${voter.gender === 'Laki-laki' ? '<span class="text-blue-600"><i class="fa-solid fa-mars mr-1"></i> Laki-laki</span>' : '<span class="text-pink-600"><i class="fa-solid fa-venus mr-1"></i> Perempuan</span>'}</td>
            <td class="p-3 text-center text-xs text-gray-500">${dateStr} ${timeStr}</td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="window.editVoter('${voter.id}')" class="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors" title="Edit Data">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button onclick="window.deleteVoter('${voter.id}')" class="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition-colors" title="Hapus Data">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
};
