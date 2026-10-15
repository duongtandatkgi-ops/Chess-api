export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Chỉ hỗ trợ phương thức POST' });
    }

    try {
        const { boardState, side } = req.body;
        if (!boardState) {
            return res.status(400).json({ success: false, error: 'Thiếu trạng thái bàn cờ' });
        }

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
            if (target.toUpperCase() === 'K') return false; // Không bao giờ ăn Vua trực tiếp
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
            if (pUpper === 'Q') return (absDr === absDc || dr === 0 || dr === 0) && isPathClear(board, r1, c1, r2, c2);
            if (pUpper === 'K') return absDr <= 1 && absDc <= 1;
            return false;
        };

        // --- BẢNG TRỌNG SỐ VÀ VỊ TRÍ QUÂN CỜ NÂNG CAO (PST) ---
        const pieceValues = { 'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000 };

        const evaluateBoard = (board) => {
            let totalEvaluation = 0;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    let p = board[r][c];
                    if (p === '') continue;
                    let pLower = p.toLowerCase();
                    let baseVal = pieceValues[pLower] || 0;

                    // Thưởng điểm kiểm soát ô trung tâm tuyệt đối (d4, d5, e4, e5)
                    let centerBonus = 0;
                    if ((r >= 3 && r <= 4) && (c >= 3 && c <= 4)) {
                        centerBonus = 40;
                    } else if ((r >= 2 && r <= 5) && (c >= 2 && c <= 5)) {
                        centerBonus = 20;
                    }

                    if (isWhite(p)) {
                        totalEvaluation += baseVal + centerBonus + (7 - r) * 10;
                    } else {
                        totalEvaluation -= baseVal + centerBonus + r * 10;
                    }
                }
            }
            return totalEvaluation;
        };

        // Lấy tất cả nước đi và sắp xếp theo ưu tiên ăn quân (MVV-LVA) để tối ưu thuật toán cắt tỉa
        const getAllPossibleMoves = (board, isWhiteTurn) => {
            let moves = [];
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    let piece = board[r][c];
                    if (piece === '') continue;
                    if (isWhiteTurn && !isWhite(piece)) continue;
                    if (!isWhiteTurn && !isBlack(piece)) continue;

                    for (let tr = 0; tr < 8; tr++) {
                        for (let tc = 0; tc < 8; tc++) {
                            if (isValidMove(board, piece, r, c, tr, tc)) {
                                let target = board[tr][tc];
                                let capturePriority = 0;
                                // Sắp xếp nước đi ăn quân lên đầu để vét cạn nhanh hơn
                                if (target !== '') {
                                    capturePriority = (pieceValues[target.toLowerCase()] || 100) * 10 - (pieceValues[piece.toLowerCase()] || 100);
                                }
                                moves.push({ from: { r, c }, to: { r: tr, c: tc }, piece, priority: capturePriority });
                            }
                        }
                    }
                }
            }
            // Sắp xếp giảm dần theo ưu tiên chiến thuật
            moves.sort((a, b) => b.priority - a.priority);
            return moves;
        };

        // --- THUẬT TOÁN MINIMAX + ALPHA-BETA PRUNING (ĐỘ SÂU 4 LỚP) ---
        const alphaBeta = (board, depth, alpha, beta, isMaximizing) => {
            if (depth === 0) {
                return evaluateBoard(board);
            }

            let moves = getAllPossibleMoves(board, isMaximizing);
            if (moves.length === 0) return isMaximizing ? -999999 : 999999;

            if (isMaximizing) {
                let maxEval = -Infinity;
                for (let move of moves) {
                    let clonedBoard = board.map(row => [...row]);
                    clonedBoard[move.to.r][move.to.c] = clonedBoard[move.from.r][move.from.c];
                    clonedBoard[move.from.r][move.from.c] = '';

                    let evaluation = alphaBeta(clonedBoard, depth - 1, alpha, beta, false);
                    if (evaluation > maxEval) {
                        maxEval = evaluation;
                    }
                    alpha = Math.max(alpha, evaluation);
                    if (beta <= alpha) break; // Cắt tỉa alpha-beta
                }
                return maxEval;
            } else {
                let minEval = Infinity;
                for (let move of moves) {
                    let clonedBoard = board.map(row => [...row]);
                    clonedBoard[move.to.r][move.to.c] = clonedBoard[move.from.r][move.from.c];
                    clonedBoard[move.from.r][move.from.c] = '';

                    let evaluation = alphaBeta(clonedBoard, depth - 1, alpha, beta, true);
                    if (evaluation < minEval) {
                        minEval = evaluation;
                    }
                    beta = Math.min(beta, evaluation);
                    if (beta <= alpha) break; // Cắt tỉa alpha-beta
                }
                return minEval;
            }
        };

        let isWhiteTurn = (side === 'Trắng');
        let rootMoves = getAllPossibleMoves(boardState, isWhiteTurn);

        if (rootMoves.length === 0) {
            return res.status(200).json({ success: false, error: 'Không tìm thấy nước đi hợp lệ hoặc đã Chiếu Hết!' });
        }

        let bestMove = null;
        let bestValue = isWhiteTurn ? -Infinity : Infinity;
        let searchDepth = 4; // Độ sâu quét 4 lớp cực mạnh

        for (let move of rootMoves) {
            let clonedBoard = boardState.map(row => [...row]);
            clonedBoard[move.to.r][move.to.c] = clonedBoard[move.from.r][move.from.c];
            clonedBoard[move.from.r][move.from.c] = '';

            let value = alphaBeta(clonedBoard, searchDepth - 1, -Infinity, Infinity, !isWhiteTurn);

            if (isWhiteTurn) {
                if (value > bestValue) {
                    bestValue = value;
                    bestMove = move;
                }
            } else {
                if (value < bestValue) {
                    bestValue = value;
                    bestMove = move;
                }
            }
        }

        if (!bestMove) bestMove = rootMoves[0];

        const colNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        let fromStr = `${colNames[bestMove.from.c]}${8 - bestMove.from.r}`;
        let toStr = `${colNames[bestMove.to.c]}${8 - bestMove.to.r}`;
        let adviceText = `⚡ Siêu AI Engine (Depth 4): Quyết định chính xác đi quân [${bestMove.piece}] từ ${fromStr} sang ${toStr}.`;

        return res.status(200).json({
            success: true,
            side: side,
            move: { from: bestMove.from, to: bestMove.to },
            advice: adviceText
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
