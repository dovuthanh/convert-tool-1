## index_flagler.js
1. chạy chrome shortcut từ màn hình desktop => chỉ chạy ở đây vì chỗ nàuy em config nhé
2. khi chrome chạy try cập: http://127.0.0.1/json/view để lấy thông tin về socket. 
3. Copy gía trị trong thẻ: webSocketDebuggerUrl và paste vào file index_flagler.js chỗ browserWSEndpoint
vd: browserWSEndpoint: 'ws://127.0.0.1:9222/devtools/browser/3bfb10a8-9e0c-4e1e-8171-3f5aad2eda45',
4. Copy file xmls vào folder FLAGLER
5. xoá fil list_collection.json nếu muốn chạy lại
6. chạy file: 'node index_flagler.js'