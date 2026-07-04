import { useEffect, useMemo, useState } from "react";
import { OGSBrowserService, type OgsBrowserFilters, type OgsBrowserGame } from "../ogs/OGSBrowserService";

type OgsBrowserDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onOpenGame: (gameId: number) => void;
  onOpenUrl: () => void;
  onOpenReview: (reviewId: number) => void;
};

const DEFAULT_FILTERS: OgsBrowserFilters = {
  boardSize: "19",
  gameType: "all",
  maxRank: "",
  minRank: "1d",
  requireWatchers: false,
  rules: "all",
  search: ""
};

const service = new OGSBrowserService();

export function OgsBrowserDialog({ isOpen, onClose, onOpenGame, onOpenUrl, onOpenReview: _onOpenReview }: OgsBrowserDialogProps) {
  const [activeTab, setActiveTab] = useState<"live" | "reviews">("live");
  const [filters, setFilters] = useState<OgsBrowserFilters>(DEFAULT_FILTERS);
  const [games, setGames] = useState<OgsBrowserGame[]>([]);
  const [reviews, setReviews] = useState<OgsBrowserGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === "live") {
        setGames(await service.fetchLiveGames(filters));
      } else {
        setReviews(await service.fetchReviews());
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void refresh();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="ogs-browser-dialog" role="dialog" aria-modal="true" aria-labelledby="ogs-browser-title">
        <header className="dialog-title-row">
          <div>
            <h2 id="ogs-browser-title">OGS Browser</h2>
            <p>浏览公开 OGS 对局，点击一行即可只读同步到 TensuGo。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="ogs-browser-tabs">
          <button type="button" className={activeTab === "live" ? "active" : ""} onClick={() => setActiveTab("live")}>Live Games</button>
          <button type="button" className={activeTab === "reviews" ? "active" : ""} onClick={() => setActiveTab("reviews")}>Reviews</button>
          <button type="button" onClick={refresh} disabled={isLoading}>{isLoading ? "Refreshing..." : "Refresh"}</button>
          <button type="button" onClick={() => {
            onClose();
            onOpenUrl();
          }}>Open URL...</button>
        </div>

        {activeTab === "live" ? (
          <>
            <div className="ogs-browser-filters">
              <label>Search <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
              <label>Min Rank <input value={filters.minRank} placeholder="1d" onChange={(event) => setFilters({ ...filters, minRank: event.target.value })} /></label>
              <label>Max Rank <input value={filters.maxRank} placeholder="9d" onChange={(event) => setFilters({ ...filters, maxRank: event.target.value })} /></label>
              <label>Board
                <select value={filters.boardSize} onChange={(event) => setFilters({ ...filters, boardSize: event.target.value as OgsBrowserFilters["boardSize"] })}>
                  <option value="all">All</option>
                  <option value="19">19x19</option>
                  <option value="13">13x13</option>
                  <option value="9">9x9</option>
                </select>
              </label>
              <label>Type
                <select value={filters.gameType} onChange={(event) => setFilters({ ...filters, gameType: event.target.value as OgsBrowserFilters["gameType"] })}>
                  <option value="all">All</option>
                  <option value="live">Live</option>
                  <option value="blitz">Blitz</option>
                  <option value="correspondence">Correspondence</option>
                </select>
              </label>
              <label>Rules
                <select value={filters.rules} onChange={(event) => setFilters({ ...filters, rules: event.target.value as OgsBrowserFilters["rules"] })}>
                  <option value="all">All</option>
                  <option value="chinese">Chinese</option>
                  <option value="japanese">Japanese</option>
                  <option value="aga">AGA</option>
                </select>
              </label>
              <label className="ogs-checkbox-filter"><input type="checkbox" checked={filters.requireWatchers} onChange={(event) => setFilters({ ...filters, requireWatchers: event.target.checked })} /> Watchers</label>
              <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset Filters</button>
              <button type="button" onClick={refresh}>Apply</button>
            </div>
            <OgsGameTable games={games} emptyText={error ?? "No games found."} onOpenGame={(gameId) => {
              onOpenGame(gameId);
              onClose();
            }} />
          </>
        ) : (
          <div className="ogs-browser-empty">
            {reviews.length > 0 ? (
              <OgsGameTable games={reviews} emptyText="No reviews found." onOpenGame={(gameId) => {
                onOpenGame(gameId);
                onClose();
              }} />
            ) : (
              <p>OGS 当前前端没有公开 Review 列表接口；已支持通过 Watch → Open OGS URL... 打开 review/demo 链接。</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

type RankSort = {
  direction: "asc" | "desc";
  key: "black" | "white" | "moves";
};

function OgsGameTable({ games, emptyText, onOpenGame }: { games: OgsBrowserGame[]; emptyText: string; onOpenGame: (gameId: number) => void }) {
  const [sort, setSort] = useState<RankSort>({ direction: "desc", key: "moves" });
  const sortedGames = useMemo(() => sortGames(games, sort), [games, sort]);
  const toggleRankSort = (key: "black" | "white") => {
    setSort((current) => ({
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
      key
    }));
  };
  const onSortHeaderKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>, key: "black" | "white") => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleRankSort(key);
    }
  };
  const rankSortIndicator = (key: "black" | "white") => {
    if (sort.key !== key) {
      return "↕";
    }
    return sort.direction === "desc" ? "↓" : "↑";
  };

  if (games.length === 0) {
    return <div className="ogs-browser-empty"><p>{emptyText}</p></div>;
  }
  return (
    <div className="ogs-browser-table-wrap">
      <table className="ogs-browser-table">
        <thead>
          <tr>
            <th
              aria-sort={sort.key === "black" ? (sort.direction === "desc" ? "descending" : "ascending") : "none"}
              className={`ogs-sortable-header ${sort.key === "black" ? "active" : ""}`}
              onClick={() => toggleRankSort("black")}
              onKeyDown={(event) => onSortHeaderKeyDown(event, "black")}
              tabIndex={0}
              title="按黑方段位排序"
            >
              <span>Black</span>
              <span className="ogs-sort-indicator">{rankSortIndicator("black")}</span>
            </th>
            <th
              aria-sort={sort.key === "white" ? (sort.direction === "desc" ? "descending" : "ascending") : "none"}
              className={`ogs-sortable-header ${sort.key === "white" ? "active" : ""}`}
              onClick={() => toggleRankSort("white")}
              onKeyDown={(event) => onSortHeaderKeyDown(event, "white")}
              tabIndex={0}
              title="按白方段位排序"
            >
              <span>White</span>
              <span className="ogs-sort-indicator">{rankSortIndicator("white")}</span>
            </th>
            <th>Size</th>
            <th>Moves</th>
            <th>Speed</th>
            <th>Rules</th>
            <th>Watchers</th>
            <th>AI Review</th>
          </tr>
        </thead>
        <tbody>
          {sortedGames.map((game) => (
            <tr key={game.gameId} onClick={() => onOpenGame(game.gameId)}>
              <td>{game.blackName}</td>
              <td>{game.whiteName}</td>
              <td>{game.boardSize}</td>
              <td>{game.moveNumber}</td>
              <td>{game.speed ?? "-"}</td>
              <td>{game.rules ?? "-"}</td>
              <td>{typeof game.watchers === "number" ? game.watchers : "-"}</td>
              <td>{typeof game.aiReview === "boolean" ? (game.aiReview ? "Yes" : "No") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sortGames(games: OgsBrowserGame[], sort: RankSort): OgsBrowserGame[] {
  const sorted = [...games];
  sorted.sort((left, right) => {
    if (sort.key === "moves") {
      return right.moveNumber - left.moveNumber;
    }
    const leftRank = sort.key === "black" ? left.blackRank : left.whiteRank;
    const rightRank = sort.key === "black" ? right.blackRank : right.whiteRank;
    const leftValue = typeof leftRank === "number" ? leftRank : Number.NEGATIVE_INFINITY;
    const rightValue = typeof rightRank === "number" ? rightRank : Number.NEGATIVE_INFINITY;
    return sort.direction === "desc" ? rightValue - leftValue : leftValue - rightValue;
  });
  return sorted;
}
