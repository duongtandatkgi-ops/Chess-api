export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Chỉ hỗ trợ phương thức POST' });
    }

    try {
        const { boardState, side } = req.body;

        let fromR = 6, fromC = 4, toR = 4, toC = 4; // Mặc định cho Trắng: e2 -> e4
        let adviceText = "Đi tốt từ e2 lên e4 để kiểm soát trung tâm.";

        // Kiểm tra linh hoạt cả 'Đen' và 'Den'
        if (side === 'Đen' || side === 'Den') {
            fromR = 1; fromC = 4; toR = 3; toC = 4; // Mặc định cho Đen: e7 -> e5
            adviceText = "Đi tốt từ e7 xuống e5 để đối kháng trung tâm.";
        }

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
