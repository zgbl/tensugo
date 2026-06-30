import type { ResearchDocument } from "../research/types";
import type { Translator } from "../i18n";

type ResearchDocumentPanelProps = {
  document: ResearchDocument;
  commentary: string;
  onAddGameProgress: () => void;
  onAddText: () => void;
  onAddVariation: () => void;
  onExportPdf: () => void;
  onSaveDocument: () => void;
  onUpdateCommentary: (markdown: string) => void;
  onUpdateDocumentMeta: (patch: { author?: string; title?: string }) => void;
  onUpdateTextBlock: (blockId: string, markdown: string) => void;
  selectedBlock: ResearchDocument["sections"][number]["blocks"][number] | null;
  t: Translator;
};

export function ResearchDocumentPanel({
  document,
  commentary,
  onAddGameProgress,
  onAddText,
  onAddVariation,
  onExportPdf,
  onSaveDocument,
  onUpdateCommentary,
  onUpdateDocumentMeta,
  onUpdateTextBlock,
  selectedBlock,
  t
}: ResearchDocumentPanelProps) {
  const blocks = document.sections.flatMap((section) => section.blocks);
  const textButtonLabel = selectedBlock?.type === "paragraph" || selectedBlock?.type === "conclusion" ? "更新文字" : t("insertText");
  const variationButtonLabel = selectedBlock?.type === "variation" ? "更新变化" : t("insertVariation");
  void onUpdateTextBlock;

  return (
    <div className="research-panel">
      <div className="research-panel-header">
        <div>
          <h2>{t("researchDocument")}</h2>
          <input
            aria-label={t("researchTitle")}
            value={document.title}
            onChange={(event) => onUpdateDocumentMeta({ title: event.target.value })}
          />
          <input
            aria-label={t("researchAuthor")}
            value={document.author}
            onChange={(event) => onUpdateDocumentMeta({ author: event.target.value })}
          />
        </div>
        <span>{blocks.length} blocks</span>
      </div>

      <div className="research-commentary">
        <textarea
          value={commentary}
          rows={5}
          placeholder={t("commentaryPlaceholder")}
          onChange={(event) => onUpdateCommentary(event.target.value)}
          aria-label={t("commentaryLabel")}
        />
      </div>

      <div className="research-command-grid">
        <button type="button" onClick={onAddVariation}>{variationButtonLabel}</button>
        <button type="button" onClick={onAddGameProgress}>插入棋谱</button>
        <button type="button" onClick={onAddText}>{textButtonLabel}</button>
        <button type="button" onClick={onSaveDocument}>{t("save")}</button>
        <button type="button" onClick={onExportPdf}>导出PDF</button>
      </div>
    </div>
  );
}
