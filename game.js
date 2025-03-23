const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

if (ctx) { // Pastikan context 2D berhasil didapatkan
    ctx.fillStyle = "red";
    ctx.fillRect(50, 50, 100, 100);
    console.log("Canvas berfungsi!"); // Pesan jika canvas bekerja
} else {
    console.error("Gagal mendapatkan context 2D canvas!"); // Pesan error jika gagal
}
