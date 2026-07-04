type GameInfoPanelProps = {
  boardSize: number;
  blackName: string;
  capturedBlack: number;
  capturedWhite: number;
  currentMoveNumber: number;
  komi: number;
  nextColor: "black" | "white";
  onBlackNameChange: (value: string) => void;
  onKomiChange: (value: number) => void;
  onRulesChange: (value: string) => void;
  onWhiteNameChange: (value: string) => void;
  result?: string;
  rules: string;
  sourceFileName: string;
  timeControl?: string;
  totalMoves: number;
  whiteName: string;
};

export function GameInfoPanel({
  boardSize,
  blackName,
  capturedBlack,
  capturedWhite,
  currentMoveNumber,
  komi,
  nextColor,
  onBlackNameChange,
  onKomiChange,
  onRulesChange,
  onWhiteNameChange,
  result,
  rules,
  sourceFileName,
  timeControl,
  totalMoves,
  whiteName
}: GameInfoPanelProps) {
  const handleKomiChange = (value: string) => {
    const nextKomi = Number(value);
    if (Number.isFinite(nextKomi)) {
      onKomiChange(nextKomi);
    }
  };

  return (
    <div className="game-info-panel">
      <dl className="game-info-grid">
        <div className="game-info-row game-info-wide">
          <dt>文件</dt>
          <dd title={sourceFileName}>{sourceFileName}</dd>
        </div>
        <div className="game-info-row">
          <dt>黑方</dt>
          <dd>
            <input
              aria-label="黑方名称"
              className="panel-input"
              value={blackName}
              onChange={(event) => onBlackNameChange(event.target.value)}
            />
          </dd>
        </div>
        <div className="game-info-row">
          <dt>白方</dt>
          <dd>
            <input
              aria-label="白方名称"
              className="panel-input"
              value={whiteName}
              onChange={(event) => onWhiteNameChange(event.target.value)}
            />
          </dd>
        </div>
        <div className="game-info-row">
          <dt>贴目</dt>
          <dd>
            <input
              aria-label="贴目"
              className="panel-input panel-input-number"
              step="0.5"
              type="number"
              value={komi}
              onChange={(event) => handleKomiChange(event.target.value)}
            />
          </dd>
        </div>
        <div className="game-info-row">
          <dt>规则</dt>
          <dd>
            <input
              aria-label="规则"
              className="panel-input"
              value={rules}
              onChange={(event) => onRulesChange(event.target.value)}
            />
          </dd>
        </div>
        <div className="game-info-row">
          <dt>棋盘</dt>
          <dd>{boardSize} 路</dd>
        </div>
        <div className="game-info-row">
          <dt>手数</dt>
          <dd>{currentMoveNumber} / {totalMoves}</dd>
        </div>
        <div className="game-info-row">
          <dt>结果</dt>
          <dd>{result || "未填写"}</dd>
        </div>
        <div className="game-info-row">
          <dt>用时</dt>
          <dd>{timeControl || "未填写"}</dd>
        </div>
        <div className="game-info-row">
          <dt>提子</dt>
          <dd>黑 {capturedBlack} / 白 {capturedWhite}</dd>
        </div>
        <div className="game-info-row">
          <dt>下一手</dt>
          <dd>{nextColor === "black" ? "黑棋" : "白棋"}</dd>
        </div>
      </dl>
    </div>
  );
}
