#!/usr/bin/env node
/**
 * Bước 1 curate 100 quán (doc 05): đội seed nhập Google Sheet theo
 * tools/quan100-template.csv → File > Download > CSV → chạy:
 *
 *   node tools/sheet-to-seed.js duong-dan-file.csv > seed/quan100.json
 *
 * Rồi seed như thường lệ (curl.exe --data-binary "@seed/quan100.json").
 * Quy tắc tuân thủ tự động: caption của nguồn THREADS bị BỎ QUA
 * (Threads cấm lưu nội dung); Instagram không được nhận (chỉ tham khảo
 * tìm quán, chưa rà pháp lý).
 */
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('Cách dùng: node tools/sheet-to-seed.js <file.csv>');
  process.exit(1);
}

// CSV parser nhỏ đủ dùng: hỗ trợ ô có dấu phẩy trong ngoặc kép
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const rows = parseCsv(fs.readFileSync(file, 'utf8'));
const header = rows.shift();
const restaurants = [];
const contents = [];
const errors = [];

rows.forEach((r, idx) => {
  const line = idx + 2;
  const [ten, diaChi, khuVuc, mon, giaMin, giaMax, lat, lng, ...nguon] = r.map((c) => c.trim());
  if (!ten) return;
  if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) {
    errors.push(`Dòng ${line} (${ten}): thiếu/sai lat-lng`);
    return;
  }
  restaurants.push({
    name: ten,
    address: diaChi || undefined,
    area: khuVuc || 'quan-7',
    cuisineTypes: mon ? mon.split('|').map((s) => s.trim()).filter(Boolean) : [],
    priceMin: giaMin ? Number(giaMin) : undefined,
    priceMax: giaMax ? Number(giaMax) : undefined,
    lat: Number(lat),
    lng: Number(lng),
    source: 'manual',
  });

  // các cụm nguồn: mỗi cụm 5 cột (platform, url, tác giả, caption, dịp)
  for (let i = 0; i + 4 < nguon.length + 1; i += 5) {
    const [platform, url, tacGia, caption, dip] = [
      nguon[i], nguon[i + 1], nguon[i + 2], nguon[i + 3], nguon[i + 4],
    ].map((c) => (c ?? '').trim());
    if (!platform && !url) continue;
    if (!['tiktok', 'threads'].includes(platform)) {
      errors.push(`Dòng ${line} (${ten}): platform "${platform}" không được nhận (chỉ tiktok/threads — Instagram chưa rà pháp lý)`);
      continue;
    }
    if (!url || !tacGia) {
      errors.push(`Dòng ${line} (${ten}): nguồn ${platform} thiếu url hoặc tác giả`);
      continue;
    }
    contents.push({
      restaurantName: ten,
      mediaType: platform === 'tiktok' ? 'video' : 'text',
      // Tuân thủ: Threads KHÔNG lưu caption — bỏ qua kể cả sheet có điền
      ...(platform === 'tiktok' && caption ? { caption } : {}),
      sourcePlatform: platform,
      sourceUrl: url,
      sourceAuthor: tacGia,
      occasions: dip ? dip.split('|').map((s) => s.trim()).filter(Boolean) : [],
    });
  }
});

if (errors.length) {
  console.error('CẢNH BÁO — các dòng bị bỏ qua/thiếu:');
  errors.forEach((e) => console.error('  - ' + e));
}
console.error(`OK: ${restaurants.length} quán, ${contents.length} nội dung nguồn.`);
process.stdout.write(JSON.stringify({ restaurants, contents }, null, 2));
