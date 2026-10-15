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
        if (!boardState) {
            return res.status(400).json({ success: false, error: 'Thiếu trạng thái bàn cờ' });
        }

        // Các hàm kiểm tra luật cờ cơ bản cho Server
        const isWhite = (p) => p >= 'A' && p <= 'Z';
        const isBlack = (p) => p >= 'a' && p <= 'z';
        const isSameTeam = (p1, p2) => {
            if (p1 === '' || p2 === '') return false;
            return (isWhite(p1) && isWhite(p2)) || (isBlack(p1) && isBlack(p2));
        };

        const isPathClear = (board, r1, c1, r2, c2) => {
            let dr = Math.sign(r2 - r1);
            let dc = Math.sign(c2 - c1);
            let r = r1 + dr;
            let c = c1 + dc;
            while (r !== r2 || c !== c2) {
                if (board[r][c] !== '') return false;
                r += dr;
                c += dc;
            }
            return true;
        };

        const isValidMove = (board, piece, r1, c1, r2, c2) => {
            let target = board[r2][c2];
            if (isSameTeam(piece, target)) return false;
            let dr = r2 - r1;
            let dc = c2 - c1;
            let absDr = Math.abs(dr);
            let absDc = Math.abs(dc);
            let pUpper = piece.toUpperCase();

            if (pUpper === 'P') {
                let isW = isWhite(piece);
                let forward = isW ? -1 : 1;
                let startRow = isW ? 6 : 1;
                if (dc === 0 && dr === forward && target === '') return true;
                if (dc === 0 && dr === forward * 2 && r1 === startRow && target === '' && board[r1 + forward][c1] === '') return true;
                if (absDc === 1 && dr === forward && target !== '' && !isSameTeam(piece, target)) return true;
                return false;
            }
            if (pUpper === 'N') return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
            if (pUpper === 'B') return absDr === absDc && isPathClear(board, r1, c1, r2, c2);
            if (pUpper === 'R') return (dr === 0 || dc === 0) && isPathClear(board, r1, c1, r2, c2);
            if (pUpper === 'Q') return (absDr === absDc || dr === 0 || dc === 0) && isPathClear(board, r1, c1, r2, c2);
            if (pUpper === 'K') return absDr <= 1 && absDc <= 1;
            return false;
        };

        // Bảng định giá trị quân cờ để bot biết ưu tiên ăn quân lớn
        const pieceValues = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 1000 };
        let allMoves = [];
        let isTargetWhite = (side === 'Trắng');

        // Quét toàn bộ bàn cờ để tìm tất cả các nước đi hợp lệ của bên cần phân tích
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let piece = boardState[r][c];
                if (piece === '') continue;
                if (isTargetWhite && !isWhite(piece)) continue;
                if (!isTargetWhite && !isBlack(piece)) continue;

                for (let tr = 0; tr < 8; tr++) {
                    for (let tc = 0; tc < 8; tc++) {
                        if (isValidMove(boardState, piece, r, c, tr, tc)) {
                            let targetPiece = boardState[tr][tc];
                            let score = 0;

                            // Ưu tiên ăn quân đối phương có giá trị cao
                            if (targetPiece !== '') {
                                score += (pieceValues[targetPiece.toLowerCase()] || 1) * 20;
                            }
                            // Thưởng điểm nếu kiểm soát các ô trung tâm bàn cờ
                            if ((tr === 3 || tr === 4) && (tc === 3 || tc === 4)) {
                                score += 5;
                            }
                            // Thưởng điểm đẩy tốt tiến lên
                            if (piece.toUpperCase() === 'P') {
                                score += isTargetWhite ? (6 - tr) : tr;
                            }

                            allMoves.push({
                                from: { r, c },
                                to: { r: tr, c: tc },
                                score: score,
                                piece: piece
                            });
                        }
                    }
                }
            }
        }

        if (allMoves.length === 0) {
            return res.status(200).json({
                success: false,
                error: 'Không tìm thấy nước đi hợp lệ nào cho bên này!'
            });
        }

        // Sắp xếp các nước đi theo điểm số từ cao xuống thấp và chọn nước tối ưu nhất
        allMoves.sort((a, b) => b.score - a.score);
        let bestMove = allMoves[0];

        const colNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        let fromStr = `${colNames[bestMove.from.c]}${8 - bestMove.from.r}`;
        let toStr = `${colNames[bestMove.to.c]}${8 - bestMove.to.r}`;
        let adviceText = `🤖 Bot phân tích: Đề xuất đi quân [${bestMove.piece}] từ ${fromStr} sang ${toStr}.`;

        return res.status(200).json({
            success: true,
            side: side,
            move: {
                from: bestMove.from,
                to: bestMove.to
            },
            advice: adviceText
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
