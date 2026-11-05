# Chùa Online

Một sân chùa **3D** chung cho tối đa **5 người**, tên tối đa **14 ký tự**. Mặc định dùng camera **Trên đầu**, ở gần phía trên nhân vật để nhìn rõ toàn thân; kéo dọc để ngẩng nhìn lên cao hoặc nhìn xuống. Nhân vật ngồi xuống khoanh chân, khoanh tay trước người khi thiền. Vẫn có camera toàn cảnh và theo chân. Không tài khoản, không chat, không bảng xếp hạng, không database. Dữ liệu người chơi, điểm phước lành, lá và hương chỉ ở trong bộ nhớ server.

Link đang dùng: **https://dichua-d2ud.onrender.com/**. Mở cùng link, chọn nhân vật và nhập tên là vào chung một sân, thấy ngay những người đã vào. Nút **↗** cạnh nút âm thanh sao chép link mời bạn. Tối đa 5 người cùng lúc; khi đủ chỗ, người thứ 6 được báo phòng đầy. Không đặt `ROOM_PASSWORD` trên Render để ai có link cũng vào được.

## Chạy trên máy

Yêu cầu Node.js 22; dự án đã khai báo phiên bản trong `.node-version` và `package.json`.

```powershell
npm install
npm start
```

Mở **http://localhost:3000**. Mỗi tab là một người chơi. Người thứ 6 sẽ được báo sân đã đủ người.

Bạn bè cùng Wi-Fi có thể mở `http://<IP-máy-chạy-server>:3000`. Nếu không kết nối được, cho phép Node.js qua Windows Firewall trong mạng riêng.

## Cách chơi

- Chọn **Nam** hoặc **Nữ**. Kéo ngang trên bản xem 3D, dùng hai nút xoay hoặc thanh trượt để xem nhân vật đủ **360°**.
- Các nút **Đứng / Đi / Thiền / Lạy / Hương** ngay dưới bản xem cho phép thử hoạt ảnh trước khi vào sân. Thiền có chuyển tiếp ngồi xuống–đứng dậy; lạy và dâng hương tự hoàn thành trong khoảng 1,5 giây.
- Chỉnh riêng **áo, quần, giày, tóc**; có đầu trọc, tóc ngắn, rẽ ngôi, bob, đuôi ngựa, hai bím và tóc dài. Bật/tắt **dây chuyền**; nhân vật nữ có thêm **nơ / kẹp tóc**.
- Mỗi món có màu riêng: áo, quần, giày, đế/dây giày thể thao, tóc, dây buộc tóc, dây chuyền, nơ/kẹp và da. Dùng bảng màu nhanh, ô chọn màu hoặc nhập mã HEX bất kỳ. Tùy chỉnh của nam/nữ được ghi nhớ riêng trên trình duyệt, và gửi cho những người chơi cùng khi bạn vào sân.
- Nhập tên rồi bấm **Ghé vào chùa**.
- **Trên điện thoại (thiết bị chơi chính):** giữ và kéo cần tròn bên trái để đi, vuốt lên cảnh bằng ngón còn lại để nhìn quanh. Thả cần hoặc xoay màn hình sẽ dừng di chuyển. Các nút **Ngồi thiền, Cúi lạy, Thắp nhang** ở cuối màn hình; nút **Var nhau** lớn ở phía phải khi cầm chổi. Nút tùy chọn bên phải mở camera và **Tiết kiệm pin**; nút **↗** phía trên sao chép link mời bạn. Giao diện hỗ trợ màn hình dọc, ngang và vùng an toàn quanh tai thỏ.
- **WASD / mũi tên:** đi theo hướng camera. **Chạm / bấm lên sân:** tự đi tới điểm đã chọn, tìm đường vòng hồ và qua cầu.
- **Qua cầu trên điện thoại:** dùng cần di chuyển để đi lên cầu cong mặt gỗ; tầm mắt tự nâng lên và hạ xuống theo mặt cầu. Lan can hai bên giữ lối đi. Bờ sông có đá xen cỏ thủy sinh, nước gợn và chảy từ thác ra ngoài khuôn viên.
- **Kéo chuột / kéo một ngón:** xoay góc nhìn. **Cuộn chuột / chụm hai ngón:** phóng gần / thu xa. Có các nút `+`, `−` trên màn hình.
- **V:** đổi lần lượt **Trên đầu → Toàn cảnh → Theo chân**. **R:** nhìn thẳng và đặt lại thu phóng.
- Đi lên các bậc thềm để vào chính điện. Mái chùa và mái cổng mờ khi che nhân vật để nhìn rõ toàn thân.
- **E:** ngồi thiền / đứng dậy. Bước đi cũng tự đứng dậy.
- **Hồ sen:** mặt nước xanh lam trong có gợn sáng, vòng sóng lan và 8 cá koi bơi lượn. Ba lá sen nằm trọn trong hồ, tạo thành tam giác đều và có đá bước nối từ bờ; chạm vào một lá để tự đi tới và ngồi thiền. Có thể dùng WASD / cần di chuyển để bước lên lá rồi bấm **E / Ngồi thiền**. Lá sen và người ngồi nhấp nhô nhẹ cùng nhau.
- **Space:** cúi lạy trong 1,5 giây.
- **F:** thắp nhang khi trong vòng 80 px quanh lư hương. Có 12 ô, mỗi người tối đa 3 nén, cháy trong 5 phút. Cắm từng nén: hoàn thành động tác khoảng 1,5 giây là có thể bấm cắm nén tiếp theo ngay. Bấm dồn hoặc giữ phím không tạo thêm nén trong lúc đang dâng hương.
- **M:** bật / tắt âm thanh. Trình duyệt nhớ lựa chọn này.
- **Lấy chổi / Trả chổi:** đến gần một trong ba giá chổi gần cổng, bên vườn phía tây hoặc gần suối phía đông. Nút **Lấy chổi** tự hiện để chạm lấy; khi đang cầm chổi, đến gần giá sẽ hiện **Trả chổi**.
- **Quét lá:** khi cầm chổi, đứng gần một đám lá dưới cây để nút **Quét lá** hiện ra rồi chạm vào. Mỗi đám lá được dọn cộng **1 điểm Phước lành**; quét chỗ trống không cộng điểm. Lá rơi liên tục từ tán cây; quét xong khoảng **3 giây** lại có đám lá mới để quét. Mọi người cùng thấy lá đã được dọn. Điểm tính riêng trong lượt ghé chùa hiện tại và đặt lại khi rời sân hoặc mất phiên kết nối.
- **Var nhau (G):** nút **Var nhau** luôn hiện khi cầm chổi. Chạm nút hoặc bấm **G** để dùng **tay phải** quét chổi **ngang trước người, từ trái sang phải**, rồi thu chổi về. Chổi kiểm tra va chạm ở nhịp đi qua phía trước, trong tầm 40 px; người kia có thể né và không cần cầm chổi. **Chỉ khi trúng người, người vung chổi mất 1 phước lành** (có thể âm); vung hụt không mất điểm, người bị chạm không mất điểm. Mọi người thấy cùng động tác và kết quả. Mỗi lần cách nhau ít nhất 1,4 giây, không đánh xuyên tường hoặc qua nước.

Sân dùng sáu cột đèn thân thép mạ kẽm, cần cong và đầu đèn LED theo dáng đèn đường Việt Nam. Thao tác chổi được thiết kế cho điện thoại: di chuyển bằng cần tròn và chạm nút hiện ra khi đến gần, không cần bàn phím.

Âm thanh suối, chim và chuông được tạo bằng Web Audio API. Thế giới 3D dựng bằng **Three.js / WebGL**, dùng mô hình tạo từ mã nguồn: chính điện hai tầng mái cong, tượng Phật, cổng, cây, suối, hồ sen, cầu đá và nhân vật có hoạt ảnh. Three.js được phát trực tiếp từ server của dự án, không phụ thuộc CDN. Các ảnh chân dung nhỏ dùng Canvas 2D. Font Google Fonts có font dự phòng khi không có mạng.

Thiết kế nhân vật áp dụng phong cách chibi và tinh thần hoạt ảnh trong tài liệu `nhan-vat-chua-online.md` vào mô hình **3D**, theo lựa chọn giữ hai nhân vật nam/nữ và bộ tùy chỉnh. Đầu chiếm khoảng 40% chiều cao, khuôn mặt hiền, viền mảnh cùng tông, thân áo là bề mặt cong liền có cổ/nếp vải. Các chuỗi xương và trọng số chuyển tiếp giữ khuỷu/gối liền khi gập; độ cao cơ thể được hiệu chỉnh theo đáy giày để chân không chìm xuống sàn.

Nhân vật thở nhẹ, chớp mắt cách nhau 3–6 giây, giữ hướng cuối khi dừng. Chu kỳ bước chân được tính từ quãng đường thực tế, gồm vị trí đã nội suy của người chơi khác. Tăng/giảm tốc khoảng 0,1 giây; đứng dậy trước khi đi mất khoảng 0,5 giây. Lạy có chuẩn bị–cúi–giữ–trở lại; dâng hương có nâng tay và đưa hương về phía trước. Tiếng bước chân nhẹ thay đổi theo nền cỏ, sân đá hoặc cầu gỗ và tuân theo nút tắt âm chung.

Màn tạo nhân vật và sân chùa dùng chung một ngữ cảnh WebGL; sân chỉ được dựng khi vào chơi. Bản xem nhân vật chạy tối đa 24 khung hình/giây để thể hiện nhịp thở, chớp mắt và xem thử động tác; dừng vẽ khi trang bị ẩn.

**Tiết kiệm pin** bật mặc định trên thiết bị cảm ứng: nhịp vẽ mục tiêu 30 khung hình/giây, mật độ pixel tối đa 1.2 (giảm còn 1.0 khi trình duyệt báo bộ nhớ thiết bị không quá 4 GB) và tắt bóng đổ. Điện thoại dùng WebGL không khử răng cưa đa mẫu; các lớp làm mờ giao diện được bỏ để giảm tải khi vừa đi vừa xoay camera. Kích thước canvas và cần di chuyển được ghi nhớ thay vì đo lại ở mỗi khung hình hoặc mỗi lần kéo. Khói tối đa 12 nén nhang dùng chung một lượt vẽ, với 36 cụm khói ở chế độ tiết kiệm và 60 cụm ở chất lượng cao. Logic di chuyển và gửi trạng thái mạng vẫn hoạt động độc lập. Có thể đổi chất lượng trong nút tùy chọn; lựa chọn được ghi nhớ. Gói tin di chuyển chỉ gửi vị trí/hành động, không lặp lại toàn bộ ngoại hình mỗi lần.

Khuôn viên có **21 cây** với thân cong liền, vân vỏ, rễ, cành lớn/cành nhỏ và từng lá có gân. Có ba dáng lá: lá rộng, lá xẻ và lá thuôn. Lá được gắn dọc theo các nhánh; đầu lá lay nhẹ theo gió. Lá rơi xuất phát từ tán cây, lắc và xoay khi rơi, nằm trên mặt đất rồi mờ dần để tái sử dụng. Chế độ tiết kiệm pin giữ khoảng 6.720 lá trên cây và 30 lá rơi; chất lượng cao có khoảng 12.096 lá và 72 lá rơi. Các lá dùng chung hình học/vật liệu và vẽ theo nhóm để giảm tải điện thoại.

Bốn chú chim đậu trên cành, thỉnh thoảng bay sang cây khác. Tiếng chim được tổng hợp bằng Web Audio với ba kiểu nhịp/giai điệu, đôi lúc có tiếng đáp từ phía khác của vườn. Âm lượng giảm theo khoảng cách và vị trí trái–phải thay đổi theo góc nhìn; chuyển động chim gắn với tiếng hót. Nút loa / phím **M** tắt cả chim, nước, chuông và bước chân. Không cần tải bản ghi âm ngoài.

Trình duyệt cần hỗ trợ WebGL 2 và bật tăng tốc đồ họa. Nếu trình duyệt báo không mở được đồ họa 3D, thử Chrome / Edge phiên bản mới hoặc bật hardware acceleration. Chất lượng bóng đổ và mật độ pixel được giới hạn để giảm tải; hiệu năng thực tế còn tùy GPU và điện thoại.

## Cấu hình tùy chọn

```powershell
$env:PORT = "3000"
$env:ROOM_PASSWORD = "mat-khau-chung-cua-nhom"
npm start
```

Không đặt `ROOM_PASSWORD` thì không cần mật khẩu. Không đưa mật khẩu vào mã nguồn. Phải khởi động lại server sau khi thay đổi biến môi trường.

## Đưa lên mạng

Dự án cần dịch vụ chạy **Node.js lâu dài và hỗ trợ WebSocket**, ví dụ Render hoặc Railway. Không triển khai thư mục `public` riêng lên hosting tĩnh vì sẽ mất phần chơi chung.

Đã cấu hình sẵn **Render Free, vùng Singapore, Node.js 22, một instance** trong `render.yaml`. Server lắng nghe `0.0.0.0` và tự nhận cổng `PORT` do Render cấp; không cần sửa URL kết nối Socket.IO.

1. Tạo repository trên GitHub và đưa mã nguồn lên, gồm `public/`, `server.js`, `package.json`, `package-lock.json`, `.node-version` và `render.yaml`. Bỏ qua `node_modules`, `.env` và ảnh kiểm thử theo `.gitignore`.
2. Đăng nhập [Render Dashboard](https://dashboard.render.com/), chọn **New → Blueprint**.
3. Kết nối tài khoản GitHub, chọn repository và nhánh chứa dự án. Render sẽ đọc `render.yaml` ở thư mục gốc.
4. Kiểm tra dịch vụ `chua-online`, gói **Free**, vùng **Singapore**, rồi chọn **Deploy Blueprint**. Không chọn Static Site vì dự án cần server để chơi chung.
5. Khi dịch vụ báo **Live**, mở đường dẫn HTTPS do Render cấp. Có thể kiểm tra `/api/status`: kết quả ban đầu có `online: 0`, `capacity: 5`.
6. Mở cùng đường dẫn trên hai điện thoại hoặc hai trình duyệt và vào sân để kiểm tra chơi chung, rồi gửi đường dẫn cho bạn bè.

Nếu tạo **New → Web Service** thủ công, dùng các giá trị sau:

| Mục | Giá trị |
|---|---|
| Language / Runtime | Node |
| Region | Singapore |
| Instance Type | Free |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/api/status` |
| Environment | `NODE_ENV=production`, `NODE_VERSION=22` |
| Instances | `1` |

Không cần cài Playwright/Chrome trên hosting; đồ họa 3D chạy trong trình duyệt điện thoại. Render tự cấp HTTPS. Những lần đẩy thay đổi lên nhánh đã kết nối sẽ tự deploy lại.

Nếu muốn đặt mật khẩu chung, vào dịch vụ → **Environment**, thêm `ROOM_PASSWORD` rồi lưu và deploy lại. Không đưa mật khẩu vào GitHub hoặc `render.yaml`.

Gói Free có thể ngủ sau 15 phút không có lưu lượng; lần mở tiếp theo có thể mất khoảng một phút để khởi động. Nếu muốn vào chơi thường xuyên không phải chờ khởi động, đổi sang gói trả phí chạy liên tục trong Render. Xem [giới hạn gói Free](https://render.com/docs/free) và [cấu hình Blueprint](https://render.com/docs/blueprint-spec).

Chỉ chạy **một instance** vì dữ liệu sân hiện nằm trong RAM, chưa có database dùng chung. Tối đa **5 người** cùng sân. Khi server khởi động/deploy lại, mọi người cần vào lại; hương, trạng thái lá và điểm phước lành của phiên cũ không được giữ. Chưa tạo dịch vụ Render hay URL công khai từ máy này; bước kết nối GitHub và xác nhận deploy thực hiện trong tài khoản Render của bạn.

## Kiểm thử

Chính điện có sàn gạch vuông, bốn ghế sofa ba chỗ hai bên lối giữa, trần gỗ cao và hai quạt trần quay. Sofa bọc vải tông nâu be, có tựa lưng, tay vịn và gối tựa. Tượng Phật ngồi trên đài sen, có bàn thờ, bình hoa và đèn vàng. Lư hương nằm **bên trong chính điện, trước bàn thờ**; bước lên thềm, đến gần rồi nhấn **F** hoặc **Thắp nhang**. Ánh sáng chuyển dịu và ấm hơn khi vào trong bằng góc nhìn mắt nhân vật.

```powershell
npm test
npm run test:browser
```

`npm test` kiểm tra dữ liệu ngoại hình, hình học/khớp nối khi cử động, nhịp chuyển động mắt và server qua các kết nối Socket.IO thật. Các bài trình duyệt kiểm tra tùy chỉnh từng món/màu, xoay 360°, lưu lựa chọn, đồng bộ ngoại hình, hai ngón vừa đi vừa nhìn, thả cần để dừng, và bố cục 320×640, 390×844, 844×390. Đây là mô phỏng điện thoại trên Chrome; hiệu năng GPU và thao tác trên Safari/điện thoại thật cần kiểm tra trực tiếp trên thiết bị.

Kiểm thử trình duyệt dùng Google Chrome đã cài trên máy; nếu không có Chrome, cài qua `npx playwright install chrome` hoặc sửa `channel` trong `playwright.config.js` cho phù hợp. Ảnh kiểm tra được lưu ở `test-results/`.

Mã nguồn chính:

- `public/scene.js`: điểm vào đồ họa 3D.
- `public/avatar-model.mjs`: mô hình nam/nữ, trang phục, phụ kiện, xương và hoạt ảnh.
- `public/avatar-motion.mjs`: trạng thái hoạt ảnh, bước chân theo quãng đường, hướng nhìn, chớp mắt và nhịp hành động; `public/locomotion.mjs`: tăng/giảm tốc.
- `public/avatar-studio.mjs`: màn xem 360°; `public/customizer.mjs`: giao diện chọn kiểu/màu và lưu lựa chọn.
- `public/avatar-config.js`: định nghĩa ngoại hình, kiểm tra kiểu/màu dùng chung cho server và trình duyệt.
- `public/scene3d.js`: sân chùa, camera, mắt/tay và raycasting; `public/embodiment.mjs`: nhịp động tác.
- `public/garden.mjs`: cây/cành/lá có gân, gió, lá rơi và chim; `public/garden-layout.mjs`: bố trí cây và quỹ đạo lá; `public/birdsong.js`: giai điệu và vị trí âm thanh chim.
- `public/yard-care.mjs`: cột đèn đường, giá chổi, chổi cầm tay và đám lá để quét; `public/sweeping.js`: vị trí dùng chung và khoảng cách tương tác; `public/yard.css`: khung Phước lành và nút quét sân.
- `public/river-garden.mjs`: cầu cong, lan can, bờ đá, cây thủy sinh và dòng nước có chuyển động; độ cao mặt cầu dùng chung với `public/world.js`.
- `public/app.js`: kết nối và điều khiển, bao gồm cần di chuyển cảm ứng.
- `public/mobile.css`: bố cục tạo nhân vật và điều khiển điện thoại; `public/style.css`, `public/immersive.css`: giao diện chung.
- `public/world.js`, `public/audio.js`, `server.js`: thế giới, âm thanh và server.
