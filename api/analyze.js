export default function handler(req, res) {
    // Cho phép Extension (Kiwi Browser) gọi API vượt qua chính sách CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Xử lý khi trình duyệt gửi yêu cầu kiểm tra kết nối (CORS preflight)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Chỉ chấp nhận phương thức POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST' });
    }

    try {
        const { boardState, side } = req.body;

        // --- NƠI VIẾT HOẶC TÍCH HỢP THUẬT TOÁN / STOCKFISH API ---
        // Ở đây cấu hình mẫu logic phân tích dựa trên lượt đi
        let fromR = 6, fromC = 4, toR = 4, toC = 4; // Mặc định Trắng: e2 -> e4
        let adviceText = "Đi tốt từ e2 lên e4 để kiểm soát trung tâm.";

        if (side === 'Đen') {
            fromR = 1; fromC = 4; toR = 3; toC = 4; // Mặc định Đen: e7 -> e5
            adviceText = "Đi tốt từ e7 xuống e5 để đối kháng trung tâm.";
        }
        // --------------------------------------------------------

        // Trả về kết quả JSON chứa tọa độ ô xuất phát (from) và ô đích (to) để vẽ mũi tên
        return res.status(200).json({
            success: true,
            side: side,
            move: {
                from: { r: fromR, c: fromC },
                to: { r: toR, c: toC }
            },
            advice: adviceText
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
