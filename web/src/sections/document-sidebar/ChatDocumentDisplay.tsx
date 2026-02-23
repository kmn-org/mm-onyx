import { SourceIcon } from "@/components/SourceIcon";
import { MinimalOnyxDocument, OnyxDocument } from "@/lib/search/interfaces";
import { FiUser, FiExternalLink } from "react-icons/fi";
import { buildDocumentSummaryDisplay } from "@/components/search/DocumentDisplay";
import { DocumentUpdatedAtBadge } from "@/components/search/DocumentUpdatedAtBadge";
import { WebResultIcon } from "@/components/WebResultIcon";
import { Dispatch, SetStateAction, useMemo } from "react";
import { openDocument } from "@/lib/search/utils";
import { ValidSources } from "@/lib/types";
import { cn } from "@/lib/utils";
import Truncated from "@/refresh-components/texts/Truncated";
import Text from "@/refresh-components/texts/Text";

// --- Helper: extract position info from chunk link ---
function getPositionInfo(
  link: string | null | undefined,
  chunkInd: number
): { label: string; type: "page" | "sheet" | "slide" | "segment" } {
  if (link) {
    const pageMatch = link.match(/#page=(\d+)/);
    if (pageMatch) return { label: `Page ${pageMatch[1]}`, type: "page" };

    const slideMatch = link.match(/#slide=(\d+)/);
    if (slideMatch) return { label: `Slide ${slideMatch[1]}`, type: "slide" };

    const sheetMatch = link.match(/#sheet=(.+)/);
    if (sheetMatch)
      return {
        label: `Sheet: ${decodeURIComponent(sheetMatch[1] ?? "")}`,
        type: "sheet",
      };
  }
  return { label: `Segment ${chunkInd + 1}`, type: "segment" };
}

// --- Helper: extract file type badge from filename ---
function getFileType(semanticId: string | null | undefined): string | null {
  if (!semanticId) return null;
  const ext = semanticId.split(".").pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    pdf: "PDF",
    docx: "DOCX",
    doc: "DOC",
    xlsx: "XLSX",
    xls: "XLS",
    csv: "CSV",
    txt: "TXT",
    pptx: "PPTX",
    ppt: "PPT",
    html: "HTML",
    htm: "HTML",
    md: "MD",
    json: "JSON",
    xml: "XML",
  };
  return ext ? (typeMap[ext] ?? null) : null;
}

// --- Relevance score badge ---
function ConfidenceIndicator({ score }: { score: number | null | undefined }) {
  if (score == null) return null;

  const pct = Math.round(Math.min(Math.max(score * 100, 0), 100));
  const level = score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low";

  return (
    <span
      className={cn(
        "shrink-0 text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full",
        level === "high" &&
          "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
        level === "medium" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
        level === "low" &&
          "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
      )}
      title="Relevance score"
    >
      {pct}% relevance
    </span>
  );
}

export interface ChatDocumentDisplayProps {
  document: OnyxDocument;
  modal?: boolean;
  isSelected: boolean;
  setPresentingDocument: Dispatch<SetStateAction<MinimalOnyxDocument | null>>;
  /** Total number of chunks retrieved for this document (for N-of-M display) */
  totalGroupChunks?: number;
  /** Index of this chunk within its group (0-based) */
  chunkIndexInGroup?: number;
  /** Number of cited chunks for this document (shown as badge on first chunk) */
  citationCount?: number;
}

export default function ChatDocumentDisplay({
  document,
  modal,
  isSelected,
  setPresentingDocument,
  totalGroupChunks,
  chunkIndexInGroup,
  citationCount,
}: ChatDocumentDisplayProps) {
  const isInternet = document.is_internet;
  const title = useMemo(
    () => document.semantic_identifier || document.document_id,
    [document.semantic_identifier, document.document_id]
  );

  if (document.score === null) {
    return null;
  }

  const positionInfo = getPositionInfo(document.link, document.chunk_ind);
  const fileType =
    !isInternet &&
    document.source_type !== ValidSources.Web
      ? getFileType(document.semantic_identifier)
      : null;
  const hasOwners =
    document.primary_owners && document.primary_owners.length > 0;
  const hasFooter = document.updated_at || hasOwners;
  const isContinuation =
    chunkIndexInGroup !== undefined && chunkIndexInGroup > 0;
  const isExternalLink =
    document.link && !document.link.startsWith("#");

  // Position badge label with optional "N of M" suffix
  const positionLabel =
    totalGroupChunks && totalGroupChunks > 1
      ? `${positionInfo.label} · ${(chunkIndexInGroup ?? 0) + 1} of ${totalGroupChunks}`
      : positionInfo.label;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDocument(document, setPresentingDocument);
  };

  // Compact "continuation" view for 2nd+ chunks of the same document
  if (isContinuation) {
    return (
      <div
        onClick={() => openDocument(document, setPresentingDocument)}
        className={cn(
          "flex w-full flex-col pl-5 pr-3 py-2 gap-1 rounded-12 hover:bg-background-tint-00 cursor-pointer border-l-2 border-background-200 ml-2",
          isSelected && "bg-action-link-02"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full leading-none",
              positionInfo.type === "page" &&
                "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
              positionInfo.type === "slide" &&
                "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
              positionInfo.type === "sheet" &&
                "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
              positionInfo.type === "segment" && "bg-background-100 text-text-500"
            )}
          >
            {positionLabel}
          </span>
          <ConfidenceIndicator score={document.score} />
        </div>
        <Text as="p" className="line-clamp-2 text-left text-xs" text03>
          {buildDocumentSummaryDisplay(document.match_highlights, document.blurb)}
        </Text>
        <button
          onClick={handleOpen}
          className="self-start text-[11px] font-medium text-text-400 hover:text-text-600 flex items-center gap-1 mt-0.5"
        >
          {isExternalLink ? (
            <>Open <FiExternalLink className="w-3 h-3" /></>
          ) : (
            "Preview"
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => openDocument(document, setPresentingDocument)}
      className={cn(
        "flex w-full flex-col p-3 gap-2 rounded-12 hover:bg-background-tint-00 cursor-pointer",
        isSelected && "bg-action-link-02"
      )}
    >
      {/* Header: icon + title + file type badge + citation count badge */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {isInternet || document.source_type === ValidSources.Web ? (
            <WebResultIcon url={document.link} />
          ) : (
            <SourceIcon sourceType={document.source_type} iconSize={18} />
          )}
        </div>
        <Truncated className="line-clamp-2 flex-1 min-w-0" side="left">
          {title}
        </Truncated>
        {fileType && (
          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-background-200 text-text-500 uppercase tracking-wide leading-none self-start mt-0.5">
            {fileType}
          </span>
        )}
        {citationCount && citationCount > 1 && (
          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 leading-none self-start mt-0.5">
            {citationCount}×
          </span>
        )}
      </div>

      {/* Position badge + confidence dots */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full leading-none",
            positionInfo.type === "page" &&
              "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
            positionInfo.type === "slide" &&
              "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
            positionInfo.type === "sheet" &&
              "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
            positionInfo.type === "segment" && "bg-background-100 text-text-500"
          )}
        >
          {positionLabel}
        </span>
        <ConfidenceIndicator score={document.score} />
      </div>

      {/* Match highlights / blurb */}
      <Text as="p" className="line-clamp-4 text-left text-sm" text03>
        {buildDocumentSummaryDisplay(document.match_highlights, document.blurb)}
      </Text>

      {/* Footer: updated_at + owners + open button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {hasFooter && (
          <div className="flex items-center gap-2 flex-wrap">
            {document.updated_at && (
              <DocumentUpdatedAtBadge
                updatedAt={document.updated_at}
                modal={modal}
              />
            )}
            {hasOwners && (
              <div className="flex items-center gap-1 text-[11px] text-text-500">
                <FiUser className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px]">
                  {document.primary_owners![0]}
                  {document.primary_owners!.length > 1 &&
                    ` +${document.primary_owners!.length - 1}`}
                </span>
              </div>
            )}
          </div>
        )}
        <button
          onClick={handleOpen}
          className="ml-auto text-[11px] font-medium text-text-400 hover:text-text-600 flex items-center gap-1"
        >
          {isExternalLink ? (
            <>Open <FiExternalLink className="w-3 h-3" /></>
          ) : (
            "Preview"
          )}
        </button>
      </div>
    </div>
  );
}
